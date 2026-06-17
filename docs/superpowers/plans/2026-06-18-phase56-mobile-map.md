# TrailGuide AI — Phase 56: Mobile Map View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive map to the trip timeline showing all activities as pins, grouped by day. Tapping a pin shows the activity name and address in a callout. The map centers on the trip's destination on load. A day filter chips bar at the bottom lets users show only one day's activities.

**Architecture:** `react-native-maps` with the default provider (Apple Maps on iOS, Google Maps on Android). Coordinates are geocoded using the Open-Meteo Geocoding API (same as Phase 46) or Google Geocoding (if a key is available). Activity pins are colored by day. The map screen is a tab under trip detail: `trips/[id]/map.tsx`.

**Tech Stack:** `react-native-maps`, Expo, NativeWind.

**Prerequisite:** Phase 55 (timeline with activities). Phase 19 (activities have addresses).

## Global Constraints
- Google Maps API key required for Android — add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env.local`.
- iOS uses Apple Maps by default (no key required).
- Pin colors by day: day 1 = #2D6A4F, day 2 = #52B788, day 3 = #B7E4C7, cycle.
- Geocoding: only geocode activities that have an `address` field. Activities with no address get no pin.
- Geocoded coordinates are cached in app state (not persisted — re-geocoded on next app launch).
- Max 50 pins shown at once — limit for performance on older devices.

---

## Task 1: Install react-native-maps

- [ ] **Step 1: Install**

```bash
cd "/home/amit/travel app/mobile"
npx expo install react-native-maps
```

- [ ] **Step 2: Add Google Maps config to `app.json`** (for Android)

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "PLACEHOLDER_SET_IN_ENV"
        }
      }
    }
  }
}
```

The actual key is pulled from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` at build time via EAS. For local dev, add it to `mobile/.env.local`.

- [ ] **Step 3: Commit**

```bash
git add mobile/app.json mobile/
git commit -m "feat: install react-native-maps and configure Google Maps for Android"
```

---

## Task 2: Geocoding service

- [ ] **Step 1: Create `mobile/lib/geocode.ts`**

```typescript
const cache: Record<string, { lat: number; lng: number }> = {};

export async function geocodeAddress(address: string, destination: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${address},${destination}`;
  if (cache[key]) return cache[key];

  // Try Open-Meteo geocoding API (free, no key)
  const query = encodeURIComponent(address || destination);
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1`);
    const data = await res.json();
    if (data.results?.length) {
      const { latitude: lat, longitude: lng } = data.results[0];
      cache[key] = { lat, lng };
      return { lat, lng };
    }
  } catch {}
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/lib/geocode.ts
git commit -m "feat: add geocode utility using Open-Meteo geocoding API with in-memory cache"
```

---

## Task 3: Map screen

- [ ] **Step 1: Create `mobile/app/(tabs)/trips/[id]/map.tsx`**

```tsx
import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from "react-native-maps";
import { useTimeline } from "@/hooks/useTimeline";
import { geocodeAddress } from "@/lib/geocode";

const DAY_COLORS = ["#2D6A4F", "#52B788", "#B7E4C7", "#74C69D", "#40916C", "#1B4332"];

interface Pin {
  id: string; title: string; address: string;
  lat: number; lng: number; dayIndex: number;
}

export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip, days, loading } = useTimeline(id);
  const [pins, setPins] = useState<Pin[]>([]);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!days.length || !trip) return;
    setGeocoding(true);
    const destination = trip.destination;

    Promise.all(
      days.flatMap((day, dayIndex) =>
        day.activities
          .filter(a => a.address)
          .slice(0, 50)
          .map(async activity => {
            const coords = await geocodeAddress(activity.address, destination);
            if (!coords) return null;
            return {
              id: activity.id, title: activity.title,
              address: activity.address, dayIndex,
              lat: coords.lat, lng: coords.lng,
            };
          })
      )
    ).then(results => {
      const validPins = results.filter((p): p is Pin => p !== null);
      setPins(validPins);
      setGeocoding(false);

      // Center map on first pin or trip destination
      if (validPins.length && mapRef.current) {
        mapRef.current.fitToCoordinates(
          validPins.map(p => ({ latitude: p.lat, longitude: p.lng })),
          { edgePadding: { top: 60, right: 40, bottom: 60, left: 40 }, animated: true }
        );
      }
    });
  }, [days, trip]);

  const visiblePins = selectedDay !== null ? pins.filter(p => p.dayIndex === selectedDay) : pins;
  const initialRegion = trip ? {
    latitude: 35.6762, longitude: 139.6503, // Tokyo as fallback
    latitudeDelta: 0.5, longitudeDelta: 0.5,
  } : undefined;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#2D6A4F"/>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Map", headerShown: false }}/>
      <View className="flex-1">
        <MapView
          ref={mapRef}
          className="flex-1"
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
        >
          {visiblePins.map(pin => (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              pinColor={DAY_COLORS[pin.dayIndex % DAY_COLORS.length]}
            >
              <Callout>
                <View className="p-2 max-w-[200px]">
                  <Text className="font-bold text-sm text-on-surface">{pin.title}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">{pin.address}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* Day filter chips */}
        <SafeAreaView className="absolute bottom-0 left-0 right-0 bg-white/95 py-3 px-4">
          {geocoding && (
            <Text className="text-xs text-gray-400 text-center mb-2">Loading locations…</Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              className={`px-4 py-2 rounded-xl mr-2 ${selectedDay === null ? "bg-brand" : "bg-gray-100"}`}
              onPress={() => setSelectedDay(null)}
            >
              <Text className={`text-sm font-medium ${selectedDay === null ? "text-white" : "text-on-surface"}`}>
                All days
              </Text>
            </TouchableOpacity>
            {days.map((day, index) => (
              <TouchableOpacity
                key={day.id}
                className={`px-4 py-2 rounded-xl mr-2 ${selectedDay === index ? "bg-brand" : "bg-gray-100"}`}
                onPress={() => setSelectedDay(selectedDay === index ? null : index)}
              >
                <Text className={`text-sm font-medium ${selectedDay === index ? "text-white" : "text-on-surface"}`}>
                  Day {day.day_number}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}
```

- [ ] **Step 2: Add map tab to trip layout**

In `mobile/app/(tabs)/trips/[id]/_layout.tsx`, add a top tab bar:
```tsx
import { Stack } from "expo-router";

export default function TripLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: "#2D6A4F" },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: { fontWeight: "700" },
    }}>
      <Stack.Screen name="index" options={{ title: "Trip" }}/>
      <Stack.Screen name="timeline" options={{ title: "Timeline" }}/>
      <Stack.Screen name="map" options={{ title: "Map" }}/>
    </Stack>
  );
}
```

Add navigation buttons to the timeline header to toggle between timeline and map views:
```tsx
// In timeline.tsx Stack.Screen:
<Stack.Screen options={{
  title: trip?.destination ?? "Timeline",
  headerRight: () => (
    <TouchableOpacity onPress={() => router.push(`/(tabs)/trips/${id}/map`)}>
      <Ionicons name="map-outline" size={22} color="white" style={{ marginRight: 12 }}/>
    </TouchableOpacity>
  ),
}}/>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/trips/\[id\]/map.tsx mobile/app/\(tabs\)/trips/\[id\]/_layout.tsx mobile/app/\(tabs\)/trips/\[id\]/timeline.tsx
git commit -m "feat: add map view with geocoded activity pins, day filter chips, and map button in timeline header"
```

---

## Verification Checklist

- [ ] Map icon in timeline header navigates to map view
- [ ] Activity pins appear on the map for activities with addresses
- [ ] Pins are color-coded by day (day 1 = dark green, day 2 = lighter green)
- [ ] Tapping a pin shows callout with activity name and address
- [ ] "All days" chip shows all pins; "Day N" chip shows only that day's pins
- [ ] Map auto-fits to show all visible pins on load
- [ ] Activities without addresses have no pin (no crash)
- [ ] Geocoding loading state shown while resolving addresses
- [ ] iOS: Apple Maps renders correctly
- [ ] Android: Google Maps renders with valid API key
