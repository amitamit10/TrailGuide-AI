# TrailGuide AI — Phase 54: Mobile Trip List + Trip Creation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Trips tab with a scrollable list of user trips, a floating "+" button to create a new trip, and a simplified 4-step trip creation flow optimized for mobile (destination, dates, style, traveler count). On completion, navigate to the new trip's timeline.

**Architecture:** `GET /api/v1/trips` returns the user's trip list (already built in Phase 19). Trip creation uses the same `POST /api/v1/trips` + `POST /api/v1/trips/:id/generate` flow as web. The mobile wizard is simpler than the 8-step web wizard — 4 steps in a modal stack. AI generation runs in the background; the app shows a "Generating…" spinner on the timeline screen.

**Tech Stack:** Expo Router, `FlatList` for the trip list, NativeWind.

**Prerequisite:** Phase 53 (navigation), Phase 19 (Go backend trips endpoint).

## Global Constraints
- Trips are fetched on focus (not just on mount) — use `useFocusEffect`.
- "+" FAB (floating action button) is fixed above the tab bar at bottom-right.
- Mobile creation wizard: 4 steps (destination → dates → style+budget → travelers). No photo upload, no interests multi-select.
- Trip card shows: destination emoji, title, dates, traveler count, a status badge (upcoming/past/live).
- Empty state: illustration + "Plan your first trip" CTA button.

---

## Task 1: Trip list screen

- [ ] **Step 1: Create `mobile/hooks/useTrips.ts`**

```typescript
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/lib/supabase";
import { apiGet } from "@/lib/api";

export interface Trip {
  id: string; title: string; destination: string;
  start_date: string; end_date: string; travelers: number;
  trip_style: string; budget: string; is_public: boolean;
}

export function useTrips() {
  const { session } = useSupabase();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTrips = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true); setError("");
    try {
      const r = await apiGet<{ data: Trip[] }>("/api/v1/trips", session.access_token);
      setTrips(r.data ?? []);
    } catch (e) {
      setError("Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useFocusEffect(fetchTrips);

  return { trips, loading, error, refetch: fetchTrips };
}
```

- [ ] **Step 2: Create `mobile/components/TripCard.tsx`**

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import type { Trip } from "@/hooks/useTrips";

const STYLE_EMOJI: Record<string, string> = {
  adventure: "🏔️", relaxation: "🏖️", culture: "🏛️",
  food: "🍜", urban: "🌆", family: "👨‍👩‍👧", romantic: "💑", budget: "💰",
};

function tripStatus(trip: Trip): { label: string; color: string } {
  const today = new Date().toISOString().split("T")[0];
  if (trip.end_date < today) return { label: "Past", color: "text-gray-400 bg-gray-100" };
  if (trip.start_date <= today) return { label: "Live", color: "text-green-700 bg-green-100" };
  return { label: "Upcoming", color: "text-blue-700 bg-blue-100" };
}

export function TripCard({ trip }: { trip: Trip }) {
  const status = tripStatus(trip);
  const emoji = STYLE_EMOJI[trip.trip_style] ?? "✈️";
  const nights = Math.ceil(
    (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl mx-4 mb-3 shadow-sm overflow-hidden"
      onPress={() => router.push(`/(tabs)/trips/${trip.id}/timeline`)}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title} trip to ${trip.destination}`}
    >
      <View className="h-2 bg-brand"/>
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-2xl">{emoji}</Text>
              <Text className="text-base font-bold text-on-surface flex-1" numberOfLines={1}>
                {trip.title}
              </Text>
            </View>
            <Text className="text-sm text-gray-500">📍 {trip.destination}</Text>
            <Text className="text-xs text-gray-400 mt-1">
              {new Date(trip.start_date).toLocaleDateString("en", { month: "short", day: "numeric" })} –{" "}
              {new Date(trip.end_date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}{nights} night{nights !== 1 ? "s" : ""}
              {" · "}{trip.travelers} traveler{trip.travelers !== 1 ? "s" : ""}
            </Text>
          </View>
          <View className={`px-2.5 py-1 rounded-full ml-2 ${status.color.split(" ")[1]}`}>
            <Text className={`text-xs font-medium ${status.color.split(" ")[0]}`}>{status.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 3: Update `mobile/app/(tabs)/dashboard.tsx`**

```tsx
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TripCard } from "@/components/TripCard";
import { useTrips } from "@/hooks/useTrips";

export default function DashboardScreen() {
  const { trips, loading, error } = useTrips();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FlatList
        data={trips}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <TripCard trip={item}/>}
        ListHeaderComponent={() => (
          <View className="px-4 py-5">
            <Text className="text-2xl font-bold text-on-surface">My Trips</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          loading ? (
            <ActivityIndicator size="large" color="#2D6A4F" className="mt-16"/>
          ) : error ? (
            <View className="items-center mt-16 px-8">
              <Text className="text-gray-500 text-center">{error}</Text>
            </View>
          ) : (
            <View className="items-center mt-16 px-8">
              <Text className="text-5xl mb-4">✈️</Text>
              <Text className="text-lg font-bold text-on-surface text-center">No trips yet</Text>
              <Text className="text-gray-500 text-center mt-2 mb-6">Plan your first adventure</Text>
              <TouchableOpacity
                className="bg-brand px-6 py-3.5 rounded-2xl"
                onPress={() => router.push("/(tabs)/trips/new")}
                accessibilityRole="button"
              >
                <Text className="text-white font-medium">Create a trip</Text>
              </TouchableOpacity>
            </View>
          )
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      {!loading && (
        <TouchableOpacity
          className="absolute bottom-24 right-5 bg-brand w-14 h-14 rounded-full shadow-lg items-center justify-center"
          onPress={() => router.push("/(tabs)/trips/new")}
          accessibilityRole="button"
          accessibilityLabel="Create new trip"
        >
          <Text className="text-white text-3xl font-light mt-[-2]">+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add mobile/hooks/useTrips.ts mobile/components/TripCard.tsx mobile/app/\(tabs\)/dashboard.tsx
git commit -m "feat: add trip list screen with FlatList, TripCard, and status badges"
```

---

## Task 2: Trip creation wizard

- [ ] **Step 1: Create `mobile/app/(tabs)/trips/new.tsx`** — 4-step wizard

```tsx
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useSupabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";

const STYLES = [
  { id: "adventure", emoji: "🏔️", label: "Adventure" },
  { id: "relaxation", emoji: "🏖️", label: "Relaxation" },
  { id: "culture", emoji: "🏛️", label: "Culture" },
  { id: "food", emoji: "🍜", label: "Food" },
  { id: "urban", emoji: "🌆", label: "Urban" },
  { id: "family", emoji: "👨‍👩‍👧", label: "Family" },
];
const BUDGETS = ["budget", "comfort", "luxury"];

export default function NewTripScreen() {
  const { session } = useSupabase();
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [style, setStyle] = useState("adventure");
  const [budget, setBudget] = useState("comfort");
  const [travelers, setTravelers] = useState(2);
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!session?.access_token) return;
    setCreating(true);
    try {
      const trip = await apiPost<{ data: { id: string } }>("/api/v1/trips", {
        title: `${destination} Trip`,
        destination, start_date: startDate, end_date: endDate,
        trip_style: style, budget, travelers,
        interests: [], transport_mode: "mixed", currency: "USD",
      }, session.access_token);
      const tripId = trip.data.id;
      // Trigger AI generation (fire and forget — we navigate immediately)
      apiPost(`/api/v1/trips/${tripId}/generate`, {}, session.access_token).catch(() => {});
      router.replace(`/(tabs)/trips/${tripId}/timeline`);
    } catch {
      setCreating(false);
    }
  }

  const steps = [
    // Step 0: Destination
    <View key="destination" className="flex-1 px-6 py-8">
      <Text className="text-2xl font-bold text-on-surface mb-2">Where to?</Text>
      <Text className="text-gray-500 mb-6">Enter your destination city or country</Text>
      <TextInput
        className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-on-surface text-lg"
        placeholder="Tokyo, Japan"
        value={destination}
        onChangeText={setDestination}
        autoFocus
        accessibilityLabel="Destination"
      />
    </View>,

    // Step 1: Dates
    <View key="dates" className="flex-1 px-6 py-8">
      <Text className="text-2xl font-bold text-on-surface mb-2">When?</Text>
      <Text className="text-gray-500 mb-6">Enter your travel dates (YYYY-MM-DD)</Text>
      <Text className="text-sm font-medium text-on-surface mb-1">Start date</Text>
      <TextInput
        className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-on-surface text-base mb-4"
        placeholder="2026-08-01"
        value={startDate}
        onChangeText={setStartDate}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Start date"
      />
      <Text className="text-sm font-medium text-on-surface mb-1">End date</Text>
      <TextInput
        className="bg-white border border-gray-200 rounded-2xl px-4 py-4 text-on-surface text-base"
        placeholder="2026-08-07"
        value={endDate}
        onChangeText={setEndDate}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="End date"
      />
    </View>,

    // Step 2: Style + budget
    <ScrollView key="style" className="flex-1" contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-on-surface mb-2">What's your vibe?</Text>
      <View className="flex-row flex-wrap gap-3 mb-6">
        {STYLES.map(s => (
          <TouchableOpacity
            key={s.id}
            className={`flex-row items-center gap-2 px-4 py-3 rounded-2xl border ${
              style === s.id ? "bg-brand border-brand" : "bg-white border-gray-200"
            }`}
            onPress={() => setStyle(s.id)}
          >
            <Text className="text-xl">{s.emoji}</Text>
            <Text className={`font-medium ${style === s.id ? "text-white" : "text-on-surface"}`}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-lg font-bold text-on-surface mb-3">Budget level</Text>
      <View className="flex-row gap-3">
        {BUDGETS.map(b => (
          <TouchableOpacity
            key={b}
            className={`flex-1 py-3 rounded-2xl items-center border ${
              budget === b ? "bg-brand border-brand" : "bg-white border-gray-200"
            }`}
            onPress={() => setBudget(b)}
          >
            <Text className={`capitalize font-medium text-sm ${budget === b ? "text-white" : "text-on-surface"}`}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>,

    // Step 3: Travelers
    <View key="travelers" className="flex-1 px-6 py-8 items-center">
      <Text className="text-2xl font-bold text-on-surface mb-2">How many travelers?</Text>
      <Text className="text-gray-500 mb-10">Including yourself</Text>
      <View className="flex-row items-center gap-8">
        <TouchableOpacity
          className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
          onPress={() => setTravelers(Math.max(1, travelers - 1))}
          accessibilityRole="button" accessibilityLabel="Decrease travelers"
        >
          <Text className="text-3xl text-on-surface font-light">−</Text>
        </TouchableOpacity>
        <Text className="text-5xl font-bold text-brand">{travelers}</Text>
        <TouchableOpacity
          className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center"
          onPress={() => setTravelers(Math.min(20, travelers + 1))}
          accessibilityRole="button" accessibilityLabel="Increase travelers"
        >
          <Text className="text-3xl text-on-surface font-light">+</Text>
        </TouchableOpacity>
      </View>
    </View>,
  ];

  const canNext = [
    destination.length >= 2,
    startDate.match(/\d{4}-\d{2}-\d{2}/) && endDate.match(/\d{4}-\d{2}-\d{2}/),
    true,
    true,
  ][step];

  return (
    <>
      <Stack.Screen options={{ title: step === 0 ? "New Trip" : ["Dates","Style","Travelers"][step - 1] }}/>
      <SafeAreaView className="flex-1 bg-surface">
        {/* Progress bar */}
        <View className="h-1 bg-gray-100 mx-4 mt-2 rounded-full overflow-hidden">
          <View className="h-full bg-brand rounded-full" style={{ width: `${((step + 1) / 4) * 100}%` }}/>
        </View>

        {steps[step]}

        <View className="px-6 pb-8">
          {step < 3 ? (
            <TouchableOpacity
              className={`bg-brand py-4 rounded-2xl items-center ${!canNext ? "opacity-40" : ""}`}
              onPress={() => setStep(s => s + 1)}
              disabled={!canNext}
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold text-base">Continue</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`bg-brand py-4 rounded-2xl items-center ${creating ? "opacity-60" : ""}`}
              onPress={create}
              disabled={creating}
              accessibilityRole="button"
            >
              {creating
                ? <ActivityIndicator color="white"/>
                : <Text className="text-white font-semibold text-base">Create trip with AI ✨</Text>
              }
            </TouchableOpacity>
          )}
          {step > 0 && (
            <TouchableOpacity className="items-center mt-3" onPress={() => setStep(s => s - 1)}>
              <Text className="text-gray-400 text-sm">Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 2: Add hidden `trips/new` screen to tab layout**

In `mobile/app/(tabs)/_layout.tsx`:
```tsx
<Tabs.Screen name="trips/new" options={{ href: null }}/>
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/trips/new.tsx mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat: add 4-step mobile trip creation wizard with AI generation on finish"
```

---

## Verification Checklist

- [ ] Dashboard shows list of trips from `GET /api/v1/trips`
- [ ] Trip cards show destination, title, dates, traveler count, and status badge
- [ ] Empty state shows CTA button when no trips
- [ ] FAB visible above tab bar at bottom-right
- [ ] Tapping FAB → trip creation wizard opens
- [ ] Progress bar updates on each step (25% / 50% / 75% / 100%)
- [ ] "Continue" disabled when current step is not complete
- [ ] Finishing wizard → POST /api/v1/trips + POST generate → navigates to timeline
- [ ] "Back" button returns to previous wizard step
