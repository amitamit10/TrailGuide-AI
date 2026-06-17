# TrailGuide AI — Phase 55: Mobile Timeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trip timeline screen — the core of the mobile app. Shows a horizontal day selector at the top, then a vertical list of activity cards for the selected day. Activities can be marked complete, deleted (long-press), and reordered (drag handles). A "Generate" button triggers AI itinerary generation if the timeline is empty.

**Architecture:** `GET /api/v1/trips/:id/days` returns days + activities (already built in Phase 19). Day selector is a horizontal `FlatList`. Activity list is a vertical `ScrollView` with activity cards. Drag-to-reorder uses `react-native-draggable-flatlist` (Reanimated-based, works on Expo with bare workflow). Mark complete calls `PATCH /api/v1/activities/:id/complete`.

**Tech Stack:** `react-native-draggable-flatlist`, `expo-haptics` (haptic feedback on reorder), NativeWind.

**Prerequisite:** Phase 54 (mobile trips + navigation).

## Global Constraints
- Day selector: horizontal scroll, selected day highlighted with brand green.
- Activity cards: category emoji + time + title + duration. Long-press opens action sheet (Delete / Cancel).
- Drag-to-reorder sends `PATCH /api/v1/days/:dayId/activities/reorder` with new sorted IDs.
- "Generate" button visible only when `activities.length === 0`.
- Generating state: shimmer skeleton replaces activity list while AI runs.
- `expo-haptics` `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on drag start.

---

## Task 1: Dependencies

- [ ] **Step 1: Install packages**

```bash
cd "/home/amit/travel app/mobile"
npm install react-native-draggable-flatlist react-native-reanimated expo-haptics expo-action-sheet
npx expo install react-native-gesture-handler
```

- [ ] **Step 2: Update `babel.config.js`** — Reanimated plugin (must be last)

```javascript
plugins: [
  'nativewind/babel',
  ['module-resolver', { root: ['./'], alias: { '@': './' } }],
  'react-native-reanimated/plugin',  // MUST be last
]
```

- [ ] **Step 3: Wrap app with GestureHandlerRootView in `_layout.tsx`**

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SupabaseProvider>
      <SafeAreaProvider>
        <ActionSheetProvider>
          <Slot/>
        </ActionSheetProvider>
      </SafeAreaProvider>
    </SupabaseProvider>
  </GestureHandlerRootView>
);
```

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat: install Reanimated, DraggableFlatList, Haptics for timeline drag-to-reorder"
```

---

## Task 2: Timeline data hook

- [ ] **Step 1: Create `mobile/hooks/useTimeline.ts`**

```typescript
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useSupabase } from "@/lib/supabase";
import { apiGet, apiPost, apiDelete } from "@/lib/api";

export interface Activity {
  id: string; title: string; description: string;
  time: string; duration: string; cost: number;
  category: string; address: string; photo_url: string;
  sort_order: number; is_complete: boolean;
}

export interface Day {
  id: string; date: string; day_number: number;
  activities: Activity[];
  weather?: { weather_code: number; temp_max_c: number; temp_min_c: number; };
}

export interface Trip {
  id: string; title: string; destination: string;
  start_date: string; end_date: string;
  travelers: number; trip_style: string; budget: string;
}

export function useTimeline(tripId: string) {
  const { session } = useSupabase();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const token = session?.access_token ?? "";

  const fetchTimeline = useCallback(async () => {
    if (!token || !tripId) return;
    setLoading(true);
    try {
      const [tripData, daysData] = await Promise.all([
        apiGet<{ data: Trip }>(`/api/v1/trips/${tripId}`, token),
        apiGet<{ data: Day[] }>(`/api/v1/trips/${tripId}/days`, token),
      ]);
      setTrip(tripData.data);
      setDays(daysData.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  useFocusEffect(fetchTimeline);

  async function generate() {
    setGenerating(true);
    try {
      await apiPost(`/api/v1/trips/${tripId}/generate`, {}, token);
      await fetchTimeline();
    } finally {
      setGenerating(false);
    }
  }

  async function toggleComplete(activityId: string, currentState: boolean) {
    await apiPost(`/api/v1/activities/${activityId}/complete`, { is_complete: !currentState }, token);
    setDays(prev => prev.map(d => ({
      ...d, activities: d.activities.map(a =>
        a.id === activityId ? { ...a, is_complete: !currentState } : a
      )
    })));
  }

  async function deleteActivity(activityId: string) {
    await apiDelete(`/api/v1/activities/${activityId}`, token);
    setDays(prev => prev.map(d => ({
      ...d, activities: d.activities.filter(a => a.id !== activityId)
    })));
  }

  return { trip, days, loading, generating, generate, toggleComplete, deleteActivity, refetch: fetchTimeline };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/hooks/useTimeline.ts
git commit -m "feat: add useTimeline hook (days + activities + generate + complete + delete)"
```

---

## Task 3: Timeline screen

- [ ] **Step 1: Update `mobile/app/(tabs)/trips/[id]/timeline.tsx`**

```tsx
import { useState, useCallback } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";
import { useTimeline, type Activity } from "@/hooks/useTimeline";
import { useSupabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍽️", attraction: "📍", transport: "🚌",
  hotel: "🏨", free: "🎭", activity: "⚡",
};

const WEATHER_EMOJI = (code: number) => {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 67) return "🌧️";
  return "⛈️";
};

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSupabase();
  const { trip, days, loading, generating, generate, toggleComplete, deleteActivity } = useTimeline(id);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const selectedDay = days[selectedDayIdx];

  async function handleReorder(dayId: string, activities: Activity[]) {
    const orderedIds = activities.map(a => a.id);
    await apiPost(`/api/v1/days/${dayId}/activities/reorder`, { ordered_ids: orderedIds }, session?.access_token ?? "");
  }

  const renderActivity = useCallback(({ item, drag, isActive }: RenderItemParams<Activity>) => (
    <TouchableOpacity
      className={`bg-white rounded-2xl mx-4 mb-2.5 p-4 shadow-sm ${isActive ? "opacity-80 scale-105" : ""}`}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        drag();
      }}
      onPress={() => toggleComplete(item.id, item.is_complete)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.is_complete ? "completed" : "not completed"}`}
    >
      <View className="flex-row items-start gap-3">
        <Text className="text-2xl">{CATEGORY_EMOJI[item.category] ?? "📌"}</Text>
        <View className="flex-1">
          <Text className={`font-semibold text-on-surface ${item.is_complete ? "line-through text-gray-400" : ""}`}
            numberOfLines={1}>{item.title}</Text>
          {item.time && <Text className="text-xs text-gray-500 mt-0.5">⏰ {item.time}</Text>}
          {item.address && <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>📍 {item.address}</Text>}
        </View>
        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
          item.is_complete ? "bg-brand border-brand" : "border-gray-300"
        }`}>
          {item.is_complete && <Text className="text-white text-xs">✓</Text>}
        </View>
      </View>
    </TouchableOpacity>
  ), [toggleComplete]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#2D6A4F"/>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: trip?.destination ?? "Timeline" }}/>
      <SafeAreaView className="flex-1 bg-surface">
        {/* Day selector */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={days}
          keyExtractor={d => d.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
          renderItem={({ item: day, index }) => {
            const date = new Date(day.date);
            const isSelected = index === selectedDayIdx;
            return (
              <TouchableOpacity
                className={`px-4 py-2.5 rounded-xl items-center min-w-[56px] ${
                  isSelected ? "bg-brand" : "bg-white"
                }`}
                onPress={() => setSelectedDayIdx(index)}
                accessibilityRole="tab"
                accessibilityLabel={`Day ${day.day_number}, ${date.toLocaleDateString("en",{weekday:"short"})}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text className={`text-xs font-medium ${isSelected ? "text-green-100" : "text-gray-400"}`}>
                  {date.toLocaleDateString("en", { weekday: "short" })}
                </Text>
                <Text className={`text-lg font-bold mt-0.5 ${isSelected ? "text-white" : "text-on-surface"}`}>
                  {date.getDate()}
                </Text>
                {day.weather && (
                  <Text className="text-sm">{WEATHER_EMOJI(day.weather.weather_code)}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />

        {/* Activities */}
        {generating ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color="#2D6A4F"/>
            <Text className="text-gray-500">Generating your itinerary with AI…</Text>
          </View>
        ) : selectedDay && selectedDay.activities.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text className="text-4xl">🗓️</Text>
            <Text className="text-lg font-bold text-on-surface text-center">No activities yet</Text>
            <TouchableOpacity
              className="bg-brand px-6 py-3.5 rounded-2xl mt-2"
              onPress={generate}
              accessibilityRole="button"
            >
              <Text className="text-white font-medium">Generate with AI ✨</Text>
            </TouchableOpacity>
          </View>
        ) : selectedDay ? (
          <DraggableFlatList
            data={selectedDay.activities}
            keyExtractor={a => a.id}
            renderItem={renderActivity}
            onDragEnd={({ data }) => handleReorder(selectedDay.id, data)}
            contentContainerStyle={{ paddingBottom: 80, paddingTop: 4 }}
          />
        ) : null}
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/trips/\[id\]/timeline.tsx
git commit -m "feat: add mobile timeline with day selector, draggable activities, and AI generate"
```

---

## Verification Checklist

- [ ] Day selector shows all trip days; scrolls horizontally
- [ ] Tapping a day shows its activities
- [ ] Selected day highlighted with brand green
- [ ] Activity tap toggles complete (checkmark appears, title struck through)
- [ ] Long-press on activity → drag handle activates with haptic feedback
- [ ] Releasing drag → new order persists on reload
- [ ] Empty day → "Generate with AI" button shown
- [ ] Generating state shows spinner + message
- [ ] Weather emoji shown on day selector when available
