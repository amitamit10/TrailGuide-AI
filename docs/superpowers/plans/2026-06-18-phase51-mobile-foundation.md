# TrailGuide AI — Phase 51: Mobile Foundation (React Native + Expo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the React Native / Expo mobile app. Set up the project structure, configure Expo Router for file-based navigation, connect to Supabase, and implement a splash screen and app icon. The result is a working skeleton that builds and runs on both iOS Simulator and Android Emulator.

**Architecture:** Expo SDK 51+ with Expo Router 3 (file-based routing, same mental model as Next.js App Router). The mobile app lives in `/mobile/` alongside `backend/`, `ai-service/`, and the Next.js root. It connects directly to Supabase (same project as web) and to the Go backend at `EXPO_PUBLIC_API_URL`. Shared Supabase types are copy-synced from `src/types/generated.ts`.

**Tech Stack:** Expo SDK 51, Expo Router 3, React Native 0.74, TypeScript, `@supabase/supabase-js`, `expo-secure-store` (token storage), NativeWind (Tailwind for React Native).

**Prerequisite:** Supabase project (Phase 1). Go backend running (Phase 19).

## Global Constraints
- All mobile code lives in `/mobile/` — never under `src/`.
- Environment variables use `EXPO_PUBLIC_` prefix (baked in at build time) or EAS secrets.
- Minimum iOS: 16.0. Minimum Android: API 26 (Android 8).
- NativeWind version: 4.x (matches Tailwind 3.x).
- No Expo Go for dev — use `expo run:ios` / `expo run:android` from the start (Expo Go doesn't support native modules like SecureStore reliably).
- `mobile/AGENTS.md` must be created with mobile-specific guidance.

---

## Task 1: Project bootstrap

- [ ] **Step 1: Create the Expo project**

```bash
cd "/home/amit/travel app"
npx create-expo-app mobile --template expo-template-blank-typescript
cd mobile
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install expo-router expo-status-bar expo-splash-screen expo-secure-store \
  @supabase/supabase-js @react-native-async-storage/async-storage \
  nativewind tailwindcss react-native-url-polyfill

npm install -D babel-plugin-module-resolver
```

- [ ] **Step 3: Configure `app.json`**

```json
{
  "expo": {
    "name": "TrailGuide",
    "slug": "trailguide",
    "version": "1.0.0",
    "scheme": "trailguide",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.trailguide.mobile",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Used to show your location on the trip map"
      }
    },
    "android": {
      "package": "app.trailguide.mobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon-foreground.png",
        "backgroundColor": "#2D6A4F"
      }
    },
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": { "typedRoutes": true },
    "extra": {
      "eas": { "projectId": "FILL_IN_AFTER_EAS_INIT" }
    }
  }
}
```

- [ ] **Step 4: Configure `babel.config.js`**

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      ['module-resolver', {
        root: ['./'],
        alias: { '@': './' }
      }]
    ],
  };
};
```

- [ ] **Step 5: Configure `tailwind.config.js`**

```javascript
module.exports = {
  content: ['./app/**/*.{tsx,ts}', './components/**/*.{tsx,ts}'],
  theme: {
    extend: {
      colors: {
        brand: '#2D6A4F',
        'brand-light': '#52B788',
        surface: '#FAFAF8',
        'on-surface': '#1A1A1A',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Create root `_layout.tsx`** — Expo Router root

```tsx
// mobile/app/_layout.tsx
import { useEffect } from "react";
import { Slot, SplashScreen } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import { View } from "react-native";
import { SupabaseProvider } from "@/lib/supabase";
import "react-native-url-polyfill/auto";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SupabaseProvider>
      <Slot />
    </SupabaseProvider>
  );
}
```

- [ ] **Step 7: Create `.env.local`** (not committed)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_API_URL=http://localhost:8080
```

Create `mobile/.env.local.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://api.trailguide.app
```

- [ ] **Step 8: Commit**

```bash
cd "/home/amit/travel app"
git add mobile/
git commit -m "feat: bootstrap Expo React Native project with Expo Router, NativeWind, Supabase"
```

---

## Task 2: Supabase client + API client

- [ ] **Step 1: Create `mobile/lib/supabase.ts`**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);

interface SupabaseContextValue { supabase: SupabaseClient; session: Session | null; loading: boolean; }
const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return <SupabaseContext.Provider value={{ supabase, session, loading }}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error("useSupabase must be used within SupabaseProvider");
  return ctx;
}
```

- [ ] **Step 2: Create `mobile/lib/api.ts`** — typed Go API client

```typescript
const BASE = process.env.EXPO_PUBLIC_API_URL!;

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/
git commit -m "feat: add Supabase provider with SecureStore and typed Go API client for mobile"
```

---

## Task 3: App icon + splash screen

- [ ] **Step 1: Create assets**

Using the brand green (#2D6A4F):
- `mobile/assets/icon.png` — 1024×1024 app icon (hiking person / compass on green bg)
- `mobile/assets/splash.png` — 2048×2048 splash (white TrailGuide logo on brand green)
- `mobile/assets/adaptive-icon.png` — 1024×1024 foreground for Android adaptive

For now, create simple placeholder PNGs or use the existing web favicon as starting point.

- [ ] **Step 2: Update `app.json` with icon paths**

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#2D6A4F"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add mobile/assets/
git commit -m "feat: add app icon and splash screen assets"
```

---

## Task 4: mobile/AGENTS.md

- [ ] **Step 1: Create `mobile/AGENTS.md`**

```markdown
# TrailGuide Mobile — Agent Guide

## Key facts for AI agents working in this directory

This is the React Native / Expo mobile app. It runs INDEPENDENTLY from the web frontend (`src/`). Never modify `src/` when working on mobile, and never import from `src/`.

## Directory layout

| Path | Purpose |
|---|---|
| `app/` | Expo Router file-based routes — every file is a screen |
| `app/(auth)/` | Login, signup screens (no tab bar) |
| `app/(tabs)/` | Main tab bar screens |
| `app/(tabs)/trips/` | Trip list, trip detail, timeline |
| `components/` | Shared RN components |
| `lib/` | Supabase client, API client, hooks |
| `hooks/` | React hooks |
| `types/` | TypeScript types (copy from `src/types/generated.ts` if needed) |

## Architecture rules

1. **No new state management library** — React Context + useState is enough for now
2. **NativeWind for styling** — Use `className` prop, not StyleSheet
3. **SecureStore for tokens** — Never AsyncStorage for sensitive data
4. **Expo Router for navigation** — Never React Navigation directly
5. **API calls always include the Supabase JWT** — Get it with `const { data: { session } } = await supabase.auth.getSession()`

## Adding a new screen

1. Create `app/(tabs)/your-screen.tsx`
2. Add to the `<Tabs>` definition in `app/(tabs)/_layout.tsx` if it needs a tab
3. Use `expo-router`'s `Link` or `router.push('/your-screen')` for navigation

## DO NOT

- Add Expo Go workarounds (we use native builds)
- Import from `../src/` — the mobile app is independent
- Use `StyleSheet.create` — use NativeWind className instead
- Add new npm packages without checking Expo SDK compatibility first
- Use hooks from `react-dom` — this is React Native, not web
```

- [ ] **Step 2: Commit**

```bash
git add mobile/AGENTS.md
git commit -m "docs: add mobile/AGENTS.md with RN-specific guidance for AI agents"
```

---

## Task 5: Verify build

- [ ] **Step 1: Start Metro**

```bash
cd "/home/amit/travel app/mobile"
npx expo start --dev-client
```

Expected: Metro bundler starts, QR code shown, no errors.

- [ ] **Step 2: Run on iOS Simulator** (macOS only)

```bash
npx expo run:ios
```

Expected: builds, installs, app opens showing white screen (no routes yet).

- [ ] **Step 3: Run on Android Emulator**

```bash
npx expo run:android
```

Expected: builds, installs, app opens showing white screen.

- [ ] **Step 4: Commit skeleton**

```bash
git add mobile/
git commit -m "feat: verified mobile skeleton builds on iOS and Android"
```

---

## Verification Checklist

- [ ] `cd mobile && npx expo start` starts Metro without errors
- [ ] App builds on iOS Simulator (no red screen)
- [ ] App builds on Android Emulator (no red screen)
- [ ] Brand green (#2D6A4F) splash screen shown on launch
- [ ] `mobile/AGENTS.md` exists with complete guidance
- [ ] `mobile/lib/supabase.ts` exports `SupabaseProvider` and `useSupabase`
- [ ] `mobile/lib/api.ts` exports `apiGet`, `apiPost`, `apiDelete`
- [ ] `.env.local.example` exists in `mobile/`
