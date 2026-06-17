# TrailGuide AI — Phase 53: Mobile Navigation (Bottom Tabs + Stack)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the main navigation structure: a bottom tab bar with 4 tabs (Dashboard, Explore, Templates, Profile) and a stack navigator for drill-down screens (trip detail → timeline, settings). Skeleton screens for all tabs.

**Architecture:** Expo Router `(tabs)` group for the tab bar. Individual screens pushed onto the stack use `app/(tabs)/trips/[id]/timeline.tsx` etc. The tab bar uses custom icons (React Native's SVG or emoji for now). All tab screens have skeleton `<View>` placeholders — real content comes in later phases.

**Tech Stack:** Expo Router 3 (Tabs + Stack), NativeWind, `@expo/vector-icons` (Ionicons).

**Prerequisite:** Phase 52 (mobile auth, session in SupabaseProvider).

## Global Constraints
- Tab bar colors: active = `#2D6A4F` (brand), inactive = `#9CA3AF` (gray-400).
- Tab bar background: white in light mode.
- No custom tab bar component — use Expo Router's built-in `<Tabs>`.
- Stack headers use the brand green as background color.
- Use `@expo/vector-icons` Ionicons — already in Expo SDK, no separate install.

---

## Task 1: Tab bar layout

- [ ] **Step 1: Create `mobile/app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, focused }: { name: IoniconsName; color: string; focused: boolean }) {
  return <Ionicons name={focused ? name : `${name}-outline` as IoniconsName} size={24} color={color}/>;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: "#2D6A4F",
      tabBarInactiveTintColor: "#9CA3AF",
      tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#E5E7EB", height: 60, paddingBottom: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      headerStyle: { backgroundColor: "#2D6A4F" },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: { fontWeight: "700" },
    }}>
      <Tabs.Screen name="dashboard" options={{
        title: "Trips",
        tabBarIcon: (props) => <TabIcon name="airplane" {...props}/>,
      }}/>
      <Tabs.Screen name="explore" options={{
        title: "Explore",
        tabBarIcon: (props) => <TabIcon name="compass" {...props}/>,
      }}/>
      <Tabs.Screen name="templates" options={{
        title: "Templates",
        tabBarIcon: (props) => <TabIcon name="copy" {...props}/>,
      }}/>
      <Tabs.Screen name="profile" options={{
        title: "Profile",
        tabBarIcon: (props) => <TabIcon name="person" {...props}/>,
      }}/>

      {/* Hidden from tab bar — pushed onto stack */}
      <Tabs.Screen name="trips/[id]" options={{ href: null }}/>
      <Tabs.Screen name="trips/[id]/timeline" options={{ href: null }}/>
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat: add 4-tab bottom navigation with Ionicons and brand green styling"
```

---

## Task 2: Skeleton screens for all 4 tabs

- [ ] **Step 1: Create `mobile/app/(tabs)/dashboard.tsx`**

```tsx
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-on-surface">My Trips</Text>
        <Text className="text-gray-500 mt-1">Your adventures appear here</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Create `mobile/app/(tabs)/explore.tsx`**

```tsx
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-on-surface">Explore</Text>
        <Text className="text-gray-500 mt-1">Discover destinations</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Create `mobile/app/(tabs)/templates.tsx`**

```tsx
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TemplatesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-on-surface">Templates</Text>
        <Text className="text-gray-500 mt-1">Pre-built itineraries</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Create `mobile/app/(tabs)/profile.tsx`**

```tsx
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold text-on-surface">Profile</Text>
        <Text className="text-gray-500 mt-1">{user?.email}</Text>
        <TouchableOpacity onPress={signOut}
          className="mt-8 bg-red-50 border border-red-200 rounded-xl py-3.5 items-center">
          <Text className="text-red-600 font-medium">Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/
git commit -m "feat: add skeleton screens for all 4 tabs (dashboard, explore, templates, profile)"
```

---

## Task 3: Trip detail stack

- [ ] **Step 1: Create `mobile/app/(tabs)/trips/[id]/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function TripLayout() {
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: "#2D6A4F" },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: { fontWeight: "700" },
    }}/>
  );
}
```

- [ ] **Step 2: Create `mobile/app/(tabs)/trips/[id]/index.tsx`** — trip overview

```tsx
import { View, Text } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: "Trip" }}/>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="px-4 py-6">
          <Text className="text-gray-500">Trip ID: {id}</Text>
          <Text className="text-sm text-gray-400 mt-4">(Trip detail coming in Phase 54)</Text>
        </View>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 3: Create `mobile/app/(tabs)/trips/[id]/timeline.tsx`** — timeline placeholder

```tsx
import { View, Text } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: "Timeline" }}/>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="px-4 py-6">
          <Text className="text-gray-500">Timeline for trip {id}</Text>
          <Text className="text-sm text-gray-400 mt-4">(Timeline coming in Phase 55)</Text>
        </View>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 4: Add SafeAreaProvider to root layout**

```bash
npm install react-native-safe-area-context
```

In `mobile/app/_layout.tsx`:
```tsx
import { SafeAreaProvider } from "react-native-safe-area-context";
// Wrap Slot with SafeAreaProvider
return <SupabaseProvider><SafeAreaProvider><Slot/></SafeAreaProvider></SupabaseProvider>;
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/trips/ mobile/app/_layout.tsx
git commit -m "feat: add trip detail stack navigator with placeholder timeline screen"
```

---

## Verification Checklist

- [ ] 4 tabs visible at the bottom: Trips, Explore, Templates, Profile
- [ ] Active tab icon is filled, inactive is outline
- [ ] Active tab text/icon is brand green (#2D6A4F)
- [ ] Tab headers have green background with white title
- [ ] Profile tab shows user email and a "Sign out" button
- [ ] Tapping "Sign out" → returns to login screen
- [ ] Navigating to `/trips/[id]/timeline` shows timeline placeholder (verify with direct navigation or a test Link)
- [ ] Back button in stack headers works (returns to previous screen)
- [ ] Safe area insets respected (content not hidden under notch or home indicator)
