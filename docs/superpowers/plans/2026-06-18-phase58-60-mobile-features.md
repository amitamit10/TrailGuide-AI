# TrailGuide AI — Phases 58-60: Mobile Discovery, Live Companion, Photo Journal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three mobile-specific features — (58) Destination Discovery (the Explore tab), (59) Live Trip Companion (GPS nudges while traveling), (60) Photo Journal (camera integration to attach photos to activities).

---

# Phase 58: Mobile Destination Discovery

**Goal:** The Explore tab (`app/(tabs)/explore.tsx`) lets users discover new destinations by entering travel preferences. Calls `POST /ai/inspire` (built in Phase 24) and shows destination cards with photos, highlights, and a "Plan this trip" CTA.

**Prerequisite:** Phase 24 (Python destination discovery). Phase 53 (mobile navigation).

## Task 1: Explore screen

- [ ] **Step 1: Create `mobile/hooks/useDestinationDiscovery.ts`**

```typescript
import { useState } from "react";
import { useSupabase } from "@/lib/supabase";

interface Destination {
  name: string; country: string; highlight: string;
  why: string; best_month: string; budget_estimate: string;
  photo_query: string;
}

export function useDestinationDiscovery() {
  const { session } = useSupabase();
  const [results, setResults] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);

  async function discover(budget: string, style: string, month: string) {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/ai/inspire`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ budget, travel_style: style, travel_month: month }),
      });
      const data = await res.json();
      setResults(data.data?.destinations ?? []);
    } finally {
      setLoading(false);
    }
  }

  return { results, loading, discover };
}
```

- [ ] **Step 2: Update `mobile/app/(tabs)/explore.tsx`**

```tsx
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDestinationDiscovery } from "@/hooks/useDestinationDiscovery";

const STYLES = ["adventure", "culture", "relaxation", "food", "family"];
const BUDGETS = ["budget", "comfort", "luxury"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ExploreScreen() {
  const [style, setStyle] = useState("culture");
  const [budget, setBudget] = useState("comfort");
  const [month, setMonth] = useState("Jun");
  const { results, loading, discover } = useDestinationDiscovery();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-4 py-5">
          <Text className="text-2xl font-bold text-on-surface">Explore</Text>
          <Text className="text-gray-500 mt-1">Where should you go next?</Text>
        </View>

        {/* Filter chips */}
        <View className="px-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase mb-2">Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STYLES.map(s => (
              <TouchableOpacity key={s} onPress={() => setStyle(s)}
                className={`px-4 py-2 rounded-xl mr-2 ${style === s ? "bg-brand" : "bg-white"}`}>
                <Text className={`text-sm capitalize font-medium ${style === s ? "text-white" : "text-on-surface"}`}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View className="px-4 mb-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase mb-2">Budget</Text>
          <View className="flex-row gap-2">
            {BUDGETS.map(b => (
              <TouchableOpacity key={b} onPress={() => setBudget(b)}
                className={`flex-1 py-2.5 rounded-xl items-center border ${budget === b ? "bg-brand border-brand" : "bg-white border-gray-200"}`}>
                <Text className={`text-sm capitalize font-medium ${budget === b ? "text-white" : "text-on-surface"}`}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="px-4 mb-5">
          <Text className="text-xs font-semibold text-gray-400 uppercase mb-2">Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {MONTHS.map(m => (
              <TouchableOpacity key={m} onPress={() => setMonth(m)}
                className={`px-3.5 py-2 rounded-xl mr-2 ${month === m ? "bg-brand" : "bg-white"}`}>
                <Text className={`text-sm font-medium ${month === m ? "text-white" : "text-on-surface"}`}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          className={`bg-brand mx-4 py-4 rounded-2xl items-center mb-6 ${loading ? "opacity-60" : ""}`}
          onPress={() => discover(budget, style, month)}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? <ActivityIndicator color="white"/> : <Text className="text-white font-bold">Inspire me ✨</Text>}
        </TouchableOpacity>

        {results.map((dest, i) => (
          <View key={i} className="bg-white mx-4 mb-4 rounded-2xl overflow-hidden shadow-sm">
            <View className="h-2 bg-brand"/>
            <View className="p-4">
              <Text className="text-lg font-bold text-on-surface">{dest.name}, {dest.country}</Text>
              <Text className="text-sm text-gray-500 mt-1">{dest.why}</Text>
              <Text className="text-xs text-gray-400 mt-2">✈️ {dest.budget_estimate} · 📅 Best in {dest.best_month}</Text>
              <TouchableOpacity
                className="bg-brand py-2.5 rounded-xl items-center mt-3"
                onPress={() => router.push({
                  pathname: "/(tabs)/trips/new",
                  params: { destination: `${dest.name}, ${dest.country}` }
                })}
                accessibilityRole="button"
              >
                <Text className="text-white text-sm font-medium">Plan this trip →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/hooks/useDestinationDiscovery.ts mobile/app/\(tabs\)/explore.tsx
git commit -m "feat: add mobile Explore tab with AI destination discovery"
```

---

# Phase 59: Mobile Live Trip Companion (GPS Nudges)

**Goal:** While on a trip, use `expo-location` to track the user's position. When the user is within 300m of an upcoming activity's location, send a local push notification: "You're near [Nobu Restaurant] — your 7pm dinner!".

**Prerequisite:** Phase 56 (map with geocoded pins). Phase 55 (timeline). `expo-notifications`.

## Task 1: Location-based nudges

- [ ] **Step 1: Install**

```bash
npx expo install expo-location expo-notifications expo-task-manager
```

- [ ] **Step 2: Add permissions to `app.json`**

```json
{
  "expo": {
    "plugins": [
      ["expo-location", { "locationWhenInUsePermission": "Used to send nudges when near your planned activities" }],
      "expo-notifications"
    ]
  }
}
```

- [ ] **Step 3: Create `mobile/lib/liveCompanion.ts`**

```typescript
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export interface NudgeActivity {
  id: string; title: string; time: string;
  lat: number; lng: number;
}

let watchSubscription: Location.LocationSubscription | null = null;
const notifiedIds = new Set<string>();

export async function startLiveCompanion(activities: NudgeActivity[]) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  const notifStatus = await Notifications.requestPermissionsAsync();
  if (!notifStatus.granted) return;

  watchSubscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 50 },
    (location) => {
      const { latitude, longitude } = location.coords;
      for (const activity of activities) {
        if (notifiedIds.has(activity.id)) continue;
        const dist = getDistanceMeters(latitude, longitude, activity.lat, activity.lng);
        if (dist < 300) {
          notifiedIds.add(activity.id);
          Notifications.scheduleNotificationAsync({
            content: {
              title: `📍 You're near ${activity.title}`,
              body: `Your ${activity.time} activity is just ${Math.round(dist)}m away!`,
            },
            trigger: null, // immediate
          });
        }
      }
    }
  );
}

export function stopLiveCompanion() {
  watchSubscription?.remove();
  watchSubscription = null;
  notifiedIds.clear();
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

- [ ] **Step 4: Wire live companion to today's activities in timeline**

```typescript
// In timeline.tsx, when the trip is "live" (today is between start and end dates):
useEffect(() => {
  if (!trip) return;
  const today = new Date().toISOString().split("T")[0];
  const isLive = trip.start_date <= today && today <= trip.end_date;
  if (!isLive) return;

  const todayDay = days.find(d => d.date === today);
  if (!todayDay) return;

  // Geocode today's activities that have addresses
  const nudgeActivities: NudgeActivity[] = [];
  // ... geocode each activity with address, push to nudgeActivities
  startLiveCompanion(nudgeActivities);
  return () => stopLiveCompanion();
}, [trip, days]);
```

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/liveCompanion.ts mobile/app/\(tabs\)/trips/\[id\]/timeline.tsx
git commit -m "feat: add GPS-based live companion with local push notifications when near activities"
```

---

# Phase 60: Mobile Photo Journal

**Goal:** Let users attach photos to activities — take a photo with the camera or pick from the gallery. Photos stored in Supabase Storage (same bucket as web). Tapping an activity card shows an "Add Photo" button; photos appear in a horizontal scroll below the activity.

**Prerequisite:** Phase 21 (Supabase Storage bucket `activity-photos`). Phase 55 (activity cards).

## Task 1: Camera integration

- [ ] **Step 1: Install**

```bash
npx expo install expo-image-picker expo-camera
```

- [ ] **Step 2: Add permissions to `app.json`**

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", {
        "photosPermission": "Attach photos to your trip activities",
        "cameraPermission": "Take photos for your trip activities"
      }]
    ]
  }
}
```

- [ ] **Step 3: Create `mobile/hooks/useActivityPhotos.ts`**

```typescript
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useSupabase } from "@/lib/supabase";

export function useActivityPhotos(activityId: string) {
  const { supabase, session } = useSupabase();
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload(source: "camera" | "gallery") {
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, aspect: [4, 3], allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: false, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (result.canceled) return null;
    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() ?? "jpg";
    const path = `activities/${activityId}/${Date.now()}.${ext}`;

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error } = await supabase.storage
        .from("activity-photos")
        .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("activity-photos").getPublicUrl(path);

      // Update activity in DB via Go API
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/activities/${activityId}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: publicUrl, caption: "" }),
      });

      return publicUrl;
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUpload, uploading };
}
```

- [ ] **Step 4: Add photo UI to activity cards in timeline**

When a user taps an activity card (expands it), show:
- Horizontal scroll of existing photos (from `activity.photos` array)
- "+" button that opens an action sheet: "Take Photo" / "Choose from Library"

```tsx
// In expanded activity view:
import { useActivityPhotos } from "@/hooks/useActivityPhotos";
import { useActionSheet } from "@expo/react-native-action-sheet";

const { pickAndUpload, uploading } = useActivityPhotos(activity.id);
const { showActionSheetWithOptions } = useActionSheet();

function addPhoto() {
  showActionSheetWithOptions(
    { options: ["Take Photo", "Choose from Library", "Cancel"], cancelButtonIndex: 2 },
    async (index) => {
      if (index === 0) await pickAndUpload("camera");
      else if (index === 1) await pickAndUpload("gallery");
    }
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/hooks/useActivityPhotos.ts mobile/
git commit -m "feat: add photo journal — camera/gallery upload to Supabase Storage for activities"
```

---

## Verification Checklist

**Phase 58:**
- [ ] Explore tab: selecting style/budget/month and tapping "Inspire me" returns destinations
- [ ] Destination card shows name, why text, budget estimate
- [ ] "Plan this trip" CTA navigates to trip wizard with destination pre-filled

**Phase 59:**
- [ ] Location permission dialog shown when viewing a live trip
- [ ] Standing within 300m of an activity's geocoded address triggers a push notification
- [ ] Notification shows activity name and distance

**Phase 60:**
- [ ] "Add Photo" in activity detail shows action sheet with Camera/Library options
- [ ] Photo taken with camera appears in the activity's photo row
- [ ] Photo picked from gallery uploads and appears
- [ ] Upload progress shown (spinner)
