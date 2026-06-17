# TrailGuide AI — Phases 61-80: Mobile Completion Roadmap

> This document covers the remaining mobile phases. Phases 61-70 are polish and platform-specific; 71-80 are launch, growth, and native device features.
>
> Each phase listed here should have its own full implementation plan written (using the `writing-plans` skill) before being implemented. This document provides enough scope to write those plans.

**Prerequisite for all phases here:** Phases 51-60 (mobile foundation complete — foundation, auth, navigation, trips, timeline, map, AI chat, explore, live companion, photo journal).

---

## Phase 61: Push Notifications (Expo Push + Telegram)

**Goal:** Register device for Expo push notifications. Send push notifications for: pre-departure reminder (24h before trip start), daily morning itinerary briefing, activity nudges (from Phase 59 — now via server push instead of GPS-only).

**Key work:**
- `expo-notifications` registration → send push token to `POST /api/v1/devices` → stored in `device_tokens` table
- Go `NotificationScheduler` (Phase 38) updated to send via `https://exp.host/--/api/v2/push/send` in addition to Telegram
- `supabase/migrations/017_device_tokens.sql`: `(user_id, token, platform)` table
- In-app notification center: `GET /api/v1/notifications` shows last 30 notifications
- New env var: no extra key needed — Expo Push is free for dev, FCM key needed for production Android

**Verification:** Install app on physical device → receive push 24h before a test trip.

---

## Phase 62: Offline Support (Core Content)

**Goal:** Cache trip itinerary for offline viewing. When offline, the timeline shows cached data with a "Last synced X ago" banner. Mutations (mark complete, add activity) queue and sync on reconnect.

**Key work:**
- `expo-sqlite` for local trip/day/activity cache; update on every successful API fetch
- `@react-native-community/netinfo` for connectivity state
- Offline queue: store pending mutations in SQLite `sync_queue` table; drain on next network event
- `SyncQueue` hook: `useSyncQueue()` → drains on mount if online
- Offline banner component shown in timeline header when `isOffline`

**Verification:** Load trip → airplane mode → close and reopen app → timeline still shows.

---

## Phase 63: Performance & Launch Time

**Goal:** Cold launch under 2 seconds on a mid-range Android device. Reduce JS bundle size. Implement image caching.

**Key work:**
- `expo-image` (replaces `<Image>`) with built-in caching and progressive loading
- `expo-font` preloading in `_layout.tsx`
- Lazy-load heavy screens (map, photo journal) with React.lazy / `Suspense`
- `flipper` profiling to identify re-renders
- `metro.config.js` tree-shaking: exclude unused `@supabase/supabase-js` modules
- Target: < 2s to first interactive on Pixel 6

**Verification:** Measure cold launch with `adb shell am start -S -W` and report TotalTime.

---

## Phase 64: App Store Submission (iOS)

**Goal:** Build and submit the iOS app to the App Store via EAS Build + EAS Submit.

**Key work:**
- `eas.json`: configure `production` profile with `distribution: "store"`
- Create App Store Connect listing: app name, description, screenshots (6.7", 6.1", iPad)
- Privacy manifest (`PrivacyInfo.xcprivacy`) — required for all iOS apps since May 2024
- Age rating: 4+ (no objectionable content)
- App Store screenshots: capture via iOS Simulator + Simulator app's screenshot tool
- `eas build --platform ios --profile production`
- `eas submit --platform ios`

**Key env:** `APPLE_ID`, `APPLE_TEAM_ID`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID` in EAS secrets

**Verification:** TestFlight build installable via TestFlight link.

---

## Phase 65: Play Store Submission (Android)

**Goal:** Build and submit the Android app to the Play Store via EAS.

**Key work:**
- Generate signing keystore: `eas credentials` → Android → Generate new keystore (stored in EAS)
- Create Play Console listing: store listing, screenshots, content rating
- `eas build --platform android --profile production` → `.aab` file
- `eas submit --platform android`
- Privacy policy URL (required by Play Store — host at `trailguide.app/privacy`)

**Key env:** `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` in EAS secrets for automatic submit

**Verification:** Internal test track in Play Console shows the app installable.

---

## Phase 66: Deep Linking + Universal Links

**Goal:** `trailguide.app/trips/[id]` opens the mobile app directly (if installed) on both iOS and Android. Share links from the web app open in the native app.

**Key work:**
- iOS: `apple-app-site-association` file hosted at `https://trailguide.app/.well-known/apple-app-site-association`
- Android: `assetlinks.json` at `https://trailguide.app/.well-known/assetlinks.json`
- `app.json`: `intentFilters` for Android, `associatedDomains` for iOS
- Expo Router handles deep link routes automatically via the `scheme: "trailguide"` config
- Test: tap a `trailguide://trips/[id]` link → app opens to timeline

**Verification:** On iOS with app installed, tap `https://trailguide.app/trips/test-id` → opens app timeline.

---

## Phase 67: Siri Shortcuts (iOS)

**Goal:** Add Siri shortcuts for common actions: "Open today's itinerary", "What's my next activity?", "Add activity to trip".

**Key work:**
- `expo-intent-launcher` or native module for Siri shortcuts (NSUserActivity)
- `INIntent` donation when user views timeline — makes Siri suggest the shortcut
- `SiriButton` in profile settings: "Add to Siri" → records phrase
- Shortcut handler: when invoked, opens the current live trip timeline

**Verification:** Record "Show my trip" → say "Hey Siri, Show my trip" → app opens today's activities.

---

## Phase 68: In-App Purchases (iOS & Android)

**Goal:** Implement the premium subscription via native IAP (Apple IAP on iOS, Google Play Billing on Android) instead of Stripe Web Checkout (which has 30% Apple tax if using web payments for digital goods in a native app — this is required by App Store rule 3.1.1).

**Key work:**
- `react-native-iap` (cross-platform IAP library)
- iOS: configure subscription product in App Store Connect; Android: in Play Console
- Replace the Stripe-based upgrade flow with `RNIap.requestSubscription()` on mobile
- Receipt validation via Go backend: `POST /api/v1/billing/iap-verify` validates Apple/Google receipts
- `profiles.subscription_tier` updated after successful receipt verification

**Verification:** Sandbox purchase in TestFlight → subscription_tier = 'premium'.

---

## Phase 69: Mobile Dark Mode

**Goal:** Dark mode support on mobile, respecting the system preference. Uses NativeWind's `dark:` variants (same as web's Tailwind `dark:` variants).

**Key work:**
- `useColorScheme` from React Native detects system dark/light
- NativeWind 4.x: configure `darkMode: "media"` in `tailwind.config.js`
- Update all custom color classes to include `dark:` variants:
  - `bg-surface` → `bg-surface dark:bg-gray-900`
  - `text-on-surface` → `text-on-surface dark:text-white`
- Status bar: `<StatusBar style="auto"/>` from expo-status-bar
- Map in dark mode: `userInterfaceStyle: "dark"` on MapView

**Verification:** Toggle iOS system dark mode → all screens update without restart.

---

## Phase 70: Mobile Accessibility

**Goal:** VoiceOver (iOS) and TalkBack (Android) support. Logical focus order, all custom components accessible.

**Key work:**
- `accessibilityRole`, `accessibilityLabel`, `accessibilityState` on all interactive elements (many already added in Phases 51-60)
- `accessibilityHint` for complex interactions (drag to reorder)
- `accessible={true}` on container views that should be a single focusable unit
- Test with VoiceOver on physical iPhone
- `ActivityIndicator` has `accessibilityLabel="Loading"`
- FlatList items: `accessibilityRole="listitem"`
- Minimum touch target: 44×44 points (all buttons)

**Verification:** Navigate entire app with VoiceOver enabled, no unlabelled elements.

---

## Phase 71: App Store Optimization (ASO)

**Goal:** Optimize App Store listing for discovery. Keyword research, localized metadata, A/B test screenshots.

**Key work:**
- Keyword research with AppFollow or Sensor Tower (trial)
- Primary keywords: "AI travel planner", "trip itinerary", "travel app"
- App Store title: "TrailGuide - AI Trip Planner"
- Subtitle (30 chars): "Plan Any Trip with AI"
- Screenshots: 3 hero frames — (1) timeline view, (2) AI chat, (3) destination discovery
- Preview video (15-30s) showing trip creation → AI generation → timeline

**Verification:** App visible in search for "AI travel planner" after indexing (7-14 days).

---

## Phase 72: Mobile Analytics & Crash Reporting

**Goal:** Track mobile-specific events (screen views, feature usage) and catch crashes. Use Sentry for crash reporting and Expo's built-in updates analytics.

**Key work:**
- `@sentry/react-native` + Sentry native SDKs: `Sentry.init()` in `_layout.tsx`
- Wrap root with `Sentry.wrap(App)`
- Screen tracking: `Sentry.addBreadcrumb` on every navigation event
- `expo-updates` + Sentry release tracking so crashes are tied to the right version
- Custom events via `Sentry.captureMessage`: `"ai_chat_sent"`, `"trip_created"`, `"activity_completed"`

**Verification:** Force a crash in dev → error appears in Sentry dashboard with stack trace.

---

## Phase 73: EAS Updates (OTA)

**Goal:** Ship JavaScript bundle updates without App Store review using Expo's OTA update system.

**Key work:**
- `expo-updates` (already installed via Expo SDK)
- `eas.json`: add `update` channel config for `preview` and `production`
- `UpdateChecker` component: on app focus, check `Updates.checkForUpdateAsync()` and download silently
- Show "Update available — restart to apply" toast when update downloaded
- Workflow: `eas update --branch production --message "fix: ..."` deploys JS changes in minutes

**Verification:** Deploy a JS-only change via `eas update` → already-installed app receives it within 5 minutes.

---

## Phase 74: Widget (iOS) — Trip Today View

**Goal:** iOS Lock Screen widget showing today's first activity. Users see their next activity from the Home Screen without opening the app.

**Key work:**
- Expo Widgets require a custom native module (not yet in Expo SDK) — use `expo-modules-core` to build a Swift `WidgetKit` extension
- Widget reads the current trip data from shared `UserDefaults(suiteName:)` (app group)
- App writes today's first activity to the app group on each timeline load
- Widget shows: activity emoji, title, time, and a "Open in TrailGuide" deep link

**Verification:** Add widget to iOS Home Screen → shows today's first activity.

---

## Phase 75: Live Activities (iOS) — In-Progress Trip

**Goal:** While actively traveling, show a Live Activity on the Lock Screen and Dynamic Island with the next activity name and countdown timer.

**Key work:**
- Requires iOS 16.1+ and a Swift `ActivityKit` extension
- Live Activity attributes: `nextActivity: String`, `startTime: Date`, `destination: String`
- Start Live Activity when user opens the timeline on a live trip day
- Update every 5 minutes via a background task
- End Live Activity when the trip ends or user manually stops it

**Verification:** On physical iPhone with iOS 16.1+, open a live trip timeline → Live Activity appears on Lock Screen.

---

## Phase 76: Social Features — Follow & Shared Trips Feed

**Goal:** Follow other TrailGuide users and see their public trips in a social feed. Browse and fork public trips from users you follow.

**Key work:**
- `follows` table: `(follower_id, following_id, created_at)` with RLS
- `GET /public/trips/feed?followed=true` — trips from followed users
- Mobile: new "Social" tab (replace Templates tab or add a 5th tab)
- Follow/unfollow button on public trip view
- Notification when someone follows you or forks your trip

**Verification:** Follow a user → their public trips appear in feed.

---

## Phase 77: Multi-City Trip Planning

**Goal:** Support trips that visit multiple cities (e.g., Tokyo → Kyoto → Osaka). The wizard allows adding multiple destinations; the timeline groups days by city.

**Key work:**
- `trips.destinations jsonb`: `[{city, start_date, end_date, nights}]`
- Go generates per-city sub-itineraries and labels days with the city
- Timeline: city header separators between city sections
- Map: different pin color sets per city
- AI generation prompt updated to handle multi-city context

**Verification:** Create a 2-city trip → timeline shows days grouped by city with headers.

---

## Phase 78: Travel Budget in Mobile

**Goal:** Port the web budget tracker (Phase 36) to mobile. View total vs budget progress bar, add expenses, see category breakdown.

**Key work:**
- `GET /api/v1/trips/:id/budget` → existing Go endpoint
- `POST /api/v1/trips/:id/expenses` → existing Go endpoint
- `BudgetScreen` at `trips/[id]/budget.tsx`: total bar, category bars, scrollable log
- "Add expense" FAB: bottom sheet with amount, category, description inputs
- Budget tab in trip detail navigation

**Verification:** Add 3 expenses → total updates, category bars appear, delete removes it.

---

## Phase 79: Advanced AI on Mobile — Personalized Recommendations

**Goal:** After completing 2+ trips, the AI uses the user's travel history to make personalized recommendations ("Based on your Tokyo trip, you might love Seoul").

**Key work:**
- `POST /ai/personalized-recommendations` (Python): takes user's past trip destinations + styles, returns 3 personalized destination suggestions
- Called automatically when user has 2+ past trips (end_date < today)
- Shown as a "For You" section at the top of the Explore tab
- Recommendation cards show: destination, "why you'd love it" line, similarity to past trip

**Verification:** Log in with an account that has 2+ past trips → Explore tab shows "For You" section.

---

## Phase 80: Launch Polish & App Review Prep

**Goal:** Final polish before public launch. Fix all UX rough edges, complete the onboarding flow on mobile, add ratings prompt, and prepare for App Review.

**Key work:**
- Mobile onboarding wizard (3 steps, mirrors Phase 40 web wizard) shown on first launch
- In-app ratings prompt via `expo-store-review` after user's 3rd AI generation (happy path timing)
- Error states: network error screens with retry buttons on every screen
- Empty states: illustrated empty states on all screens
- Legal: Privacy Policy + Terms of Service screens (required for App Store)
- App Review checklist: working demo account, test credentials in Review Notes, all features work without real money (use Sandbox/TestFlight)
- Performance: Lighthouse-equivalent audit with Flipper

**Verification:** Submit app to App Review — passes within 48 hours.

---

## Summary: Phase Groups H–J

| Group | Phases | Theme |
|---|---|---|
| H | 26-35 | Code Quality, Agent-Friendliness & Debug |
| I | 36-50 | New Features & UX (Web) |
| J | 51-60 | Mobile Core (iOS & Android) |
| K | 61-70 | Mobile Polish & Platform |
| L | 71-80 | Mobile Launch, Growth & Native |
