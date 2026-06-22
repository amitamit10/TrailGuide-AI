# TrailGuide AI — Status & Changelog

## Phase Status

| Phase | Name | Status |
|---|---|---|
| 1 | Foundation | ✅ Done |
| 2 | Core Views | ✅ Done |
| 3 | Discovery | ✅ Done |
| 4 | Live Trip | ✅ Done |
| 5 | Trip Summary | ✅ Done |
| 6 | Deploy | ✅ Done |
| 7 | Notifications | ✅ Done |
| 8 | Budget Tracker | ✅ Done |
| 9 | Packing List | ✅ Done |
| 10 | Social | ✅ Done |
| 11 | Documentation | ✅ Done |
| 12 | Security Hardening | ✅ Done |
| 13 | Rate Limiting & Caching | ✅ Done |
| 14 | PWA & Offline Mode | ✅ Done |
| 15 | Trip Export & Calendar | ✅ Done |
| 16 | Go Backend | ✅ Done |
| 17 | Python AI Service | ✅ Done |
| 18 | Frontend Migration | ✅ Done |
| 19 | Infrastructure & Deploy | ✅ Done |
| 20 | Real-time Collaboration | 📋 Planned |
| 21 | Photo Journal | 📋 Planned |
| 22 | Flight Tracker | 📋 Planned |
| 23 | Language & Culture Toolkit | 📋 Planned |
| 24 | AI Destination Discovery | 📋 Planned |
| 25 | Monitoring & Admin | 📋 Planned |
| 26 | Agent-Friendly Codebase | 📋 Planned |
| 27 | TypeScript Strict Mode | 📋 Planned |
| 28 | Go Test Suite | 📋 Planned |
| 29 | Python Tests | 📋 Planned |
| 30 | E2E Tests (Playwright) | 📋 Planned |
| 31 | Structured Logging & Sentry | 📋 Planned |
| 32 | OpenAPI Spec Generation | 📋 Planned |
| 33 | Local Dev Experience | 📋 Planned |
| 34 | Code Quality & Linting | 📋 Planned |
| 35 | Debug & Security Audit | 📋 Planned |
| 36 | Budget Tracker | 📋 Planned |
| 37 | AI Packing List | 📋 Planned |
| 38 | Smart Notifications | 📋 Planned |
| 39 | Trip Templates | 📋 Planned |
| 40 | Onboarding Redesign | 📋 Planned |
| 41 | Dark Mode | 📋 Planned |
| 42 | Voice Input | 📋 Planned |
| 43 | Advanced Search | 📋 Planned |
| 44 | Multi-Language i18n | 📋 Planned |
| 45 | Restaurant & Booking Links | 📋 Planned |
| 46 | Weather Intelligence | 📋 Planned |
| 47 | Accessibility (WCAG 2.1 AA) | 📋 Planned |
| 48 | Premium & Paywall | 📋 Planned |
| 49 | Analytics & Growth | 📋 Planned |
| 50 | Public Trip Sharing | 📋 Planned |
| 51 | Mobile Foundation (Expo) | 📋 Planned |
| 52 | Mobile Auth | 📋 Planned |
| 53 | Mobile Navigation | 📋 Planned |
| 54 | Mobile Trip List & Creation | 📋 Planned |
| 55 | Mobile Timeline | 📋 Planned |
| 56 | Mobile Map View | 📋 Planned |
| 57 | Mobile AI Chat | 📋 Planned |
| 58 | Mobile Destination Discovery | 📋 Planned |
| 59 | Mobile Live Companion (GPS) | 📋 Planned |
| 60 | Mobile Photo Journal | 📋 Planned |
| 61 | Push Notifications | 📋 Planned |
| 62 | Offline Support | 📋 Planned |
| 63 | Performance & Launch Time | 📋 Planned |
| 64 | App Store Submission (iOS) | 📋 Planned |
| 65 | Play Store Submission (Android) | 📋 Planned |
| 66 | Deep Linking | 📋 Planned |
| 67 | Siri Shortcuts | 📋 Planned |
| 68 | In-App Purchases | 📋 Planned |
| 69 | Mobile Dark Mode | 📋 Planned |
| 70 | Mobile Accessibility | 📋 Planned |
| 71 | App Store Optimization | 📋 Planned |
| 72 | Mobile Analytics & Crash | 📋 Planned |
| 73 | EAS OTA Updates | 📋 Planned |
| 74 | iOS Widget | 📋 Planned |
| 75 | iOS Live Activities | 📋 Planned |
| 76 | Social — Follow & Feed | 📋 Planned |
| 77 | Multi-City Trip Planning | 📋 Planned |
| 78 | Mobile Budget Tracker | 📋 Planned |
| 79 | Personalized AI Recommendations | 📋 Planned |
| 80 | Launch Polish & App Review | 📋 Planned |

---

## Phase Groups

Groups define the recommended execution order. Within a group, phases listed as "parallel" can run as simultaneous subagents.

| Group | Name | Phases | Status | Execution order |
|---|---|---|---|---|
| A | Foundation | 1, 2, 3, 4, 5, 11 | ✅ Complete | Done |
| B | Production Ship | 6, 12 | ✅ Complete | Done |
| C | Current-Stack Hardening | 13, 14, 15 | ✅ Complete | Done |
| D | Architecture Transition | 16, 17, 18, 19 | ✅ Complete | Done |
| E | Feature Expansion | 7, 8, 9, 10 | ✅ Complete | 7, 8, 9, 10 in parallel — after Group D |
| F | Trip Enrichment | 20, 21, 22, 23 | 📋 Planned | 20, 21, 22, 23 in parallel — after Group D |
| G | Discovery & Ops | 24, 25 | 📋 Planned | 24 + 25 in parallel — after Group D |
| H | Code Quality & Debug | 26-35 | 📋 Planned | 26 first (AGENTS.md), then 27-34 in parallel, 35 last (audit) |
| I | UX & Feature Expansion (Web) | 36-50 | 📋 Planned | 36-41 in parallel, then 42-50 in parallel — after Group D |
| J | Mobile Core | 51-60 | 📋 Planned | 51 → 52 → 53 → 54 → 55 → 56-60 in parallel |
| K | Mobile Polish & Platform | 61-70 | 📋 Planned | 61-63 in parallel → 64-65 in parallel → 66-70 in parallel |
| L | Mobile Launch & Growth | 71-80 | 📋 Planned | 71-73 in parallel → 74-76 in parallel → 77-80 sequential |

> **Why Group E comes after Group D:** Phases 7–10 add backend features (notifications, budget, packing, social). Building them before the architecture transition would mean writing them as Next.js API routes, then immediately migrating them to Go/Python in Phase 18. Build them in Go + Python from the start.

> **Why Groups F and G come after Group D:** Phases 20–25 add features that touch the Go backend (member tables, photo metadata, flight alerts, culture cache, admin events). Building them before the architecture transition would mean writing new Next.js API routes that immediately get deleted in Phase 18.

> **Why Group H comes after Group D:** Code quality tooling (TypeScript strict, Go tests, linting) must be applied to the final architecture — there's no point running golangci-lint or Playwright on code that's about to be rewritten.

> **Why Group I comes after Group H:** New features (budget tracker, packing, dark mode) should be built on a clean, tested, type-safe codebase. Building on unaudited code multiplies bugs.

> **Why Group J (Mobile) starts after Group I:** The mobile app consumes the same Go/Python API as the web frontend. All API endpoints must exist and be tested before building the mobile client.

> **Why Group B comes before Group C:** Phase 12 (security hardening) fixes missing auth guards on live routes — that must land before the app goes to production in Phase 6. Group C improvements (rate limiting, PWA, export) are useful but not blockers for shipping.

---

## Known Accepted Risks

| Risk | Severity | Reason accepted |
|---|---|---|
| PostCSS XSS in CSS output (`GHSA-qx2v-qp2m-jg93`) | Moderate | Build-time only — not a runtime attack surface. Fix would downgrade Next.js to 9.3.3 (breaking). Monitor for a non-breaking fix. |
| CSP `unsafe-eval` in script-src | Low | Required by Next.js dev mode. In production (Vercel), Next.js compiles ahead of time — consider tightening post-deploy. |
| Telegram linking has no proof-of-ownership | Low | A user can paste any numeric chat ID; `telegram_chat_id` is `UNIQUE` so it cannot be stolen from a linked account, only pre-claimed before the real owner links. Worst case is misdirected briefings (spam). Proper fix is a bot-issued verification code, deferred as a feature change. |

---

## Changelog

### 2026-06-22 (security audit hardening)

**Full-surface security review — findings remediated**
- `places/photo` route: added HTTPS host allowlist (`upload.wikimedia.org`, `images.unsplash.com`) + image-only content-type allowlist + `X-Content-Type-Options: nosniff` before proxying bytes; removed the open `redirect(photoUrl)` fallback — closes SSRF/open-proxy gap and brings it in line with the Python `photos.py` hardening
- New `src/lib/ratelimit.ts` `publicRatelimit` (30/min per IP) + `clientIp()` helper; applied to the three unauthenticated, externally-billed routes (`places/photo`, `visa`, `weather`) to stop anonymous quota drain
- `weather` route: validate `lat`/`lng` are finite numbers in range before interpolating into the Open-Meteo URL (parameter-injection guard)
- Telegram webhook: verify `X-Telegram-Bot-Api-Secret-Token` (constant-time) against `TELEGRAM_WEBHOOK_SECRET` so forged updates are rejected
- New `src/lib/cron-auth.ts` `isAuthorizedCron()` — constant-time (`crypto.timingSafeEqual`) `CRON_SECRET` check; replaces `!==` comparisons in all three `cron/*` routes
- Go backend CORS: `Access-Control-Allow-Origin` now driven by `CORS_ALLOW_ORIGIN` env (pin to frontend origin in prod; `*` default for dev) + `Vary: Origin`
- Removed duplicate root `middleware.ts` (Next.js used `src/middleware.ts`; the dead root file was a foot-gun)
- **Verified clean (no action needed):** Supabase RLS owner scoping, explicit ownership probes before all writes (`activities/complete`, `expenses`, `trips/*`), parameterized Go SQL, CSV formula-injection escaping, Go JWT signing-method pinning, Python constant-time internal-token check, no XSS sinks, no committed secrets

**New env vars:** `TELEGRAM_WEBHOOK_SECRET` (optional — enables webhook auth), `CORS_ALLOW_ORIGIN` (optional — Go backend)

**Group E — Feature Expansion ✅ Complete**

**Phase 7 — Notifications**
- Vercel cron jobs in `vercel.json`: advance-trip-status (6am), daily-briefing (7am), pre-trip-reminder (8am)
- `GET /api/cron/advance-trip-status` — auto-transitions trip status planning→active→completed based on date
- `GET /api/cron/daily-briefing` — sends Telegram message with today's activities for active trips
- `GET /api/cron/pre-trip-reminder` — sends Resend HTML email 3 and 1 days before trip start

**Phase 8 — Budget Tracker**
- `supabase/migrations/003_expenses.sql` — `expenses` table with hardened RLS (user_id + trip ownership in USING and WITH CHECK)
- `GET/POST/DELETE /api/expenses` — CRUD with `verifyTripOwnership()` defense-in-depth
- `GET /api/expenses/export` — CSV download with formula injection prevention (`csvSafe` function, `\r\n` line endings)
- Expenses tab in TripTabNav; `ExpensesClient` with budget bar, category breakdown, optimistic updates

**Phase 9 — Packing List**
- `supabase/migrations/004_checklist.sql` — `checklist_items` table with hardened RLS
- `POST /api/ai/packing-list` — idempotent AI generation (Groq llama-3.3-70b), Open-Meteo weather context, trip ownership + rate limiting
- `GET /api/visa` — Tavily-powered visa/entry requirements, destination input validation (`^[A-Za-z ,'-]{1,100}$`), source URL allowlist (https-only), 24-hour public cache
- `PATCH /api/checklist/check` — toggle is_checked with RLS-scoped ownership probe
- `POST/DELETE /api/checklist/item` — add/remove manual checklist items
- Pack tab in TripTabNav; `PackingClient` with progress bar, visa card, category-grouped checklist, optimistic updates

**Phase 10 — Social**
- `supabase/migrations/005_public_trips.sql` — `is_public` column + RLS policies for public SELECT on trips/itinerary_days/activities
- `PATCH /api/trips/visibility` — toggle is_public with ownership check + boolean validation
- `POST /api/trips/clone` — copies a public trip (itinerary_days + activities) into the authenticated user's account
- Public/private toggle in Summary tab with animated badge, "Make public & share" → "Copy share link" flow
- `/explore` page — community itineraries feed, Clone button, "View itinerary" link
- Compass icon in dashboard header linking to `/explore`
- Photo mosaic in Summary memory card (2–6 activity photos in 3-column grid, included in PNG export)

**Security fixes (Group E)**
- activities/complete: RLS-scoped ownership probe + `typeof completed !== "boolean"` validation before update
- expenses/export: `csvSafe()` function prevents CSV formula injection
- visa route: destination charset validation, https-only source URL validation
- packing-list: trip ownership check, rate limiting, Groq error handling
- SummaryClient: fixed `trip_id`/`is_public` → `tripId`/`isPublic` to match API contract

### 2026-06-20

**Group D — Architecture Transition ✅ Complete**

**Phase 16 — Go Backend**
- Created `backend/` directory with full Gin router, pgx/v5 DB connection, JWT auth middleware (validates Supabase HS256 tokens)
- Trip CRUD handlers (`GET/POST/PUT/DELETE /api/v1/trips`) query Postgres directly
- AI proxy handler forwards all `/api/v1/ai/*`, `/api/v1/documents/*`, `/api/v1/places/*`, `/api/v1/weather` to Python AI service with `X-Internal-Token`
- `backend/config/config.go` — typed env config with fail-fast on missing required vars
- `backend/.env.example`, `backend/.gitignore`, `backend/go.mod` (Go 1.22)

**Phase 17 — Python FastAPI AI Service**
- Created `ai-service/` with 10 routers: generate-itinerary, chat (streaming), recommendations, replace-activity, preview-replace, trip-story, edit-itinerary, documents/import, places/photo, weather
- `middleware/auth.py` — `X-Internal-Token` verification with `hmac.compare_digest` (constant-time)
- `photos.py` — SSRF protection: URL allowlist (wikimedia.org, unsplash.com), content-type allowlist, `X-Content-Type-Options: nosniff`
- All routers protected by internal token auth (including photos and weather)
- Virtualenv + pip install complete; `ai-service/.gitignore` excludes `.venv/`

**Phase 18 — Frontend Migration**
- Created `src/lib/backend-proxy.ts` — typed proxy helper; forwards requests to Go when `BACKEND_URL` env var is set, falls back to direct Groq on unreachable backend
- Updated routes: `generate-itinerary`, `trip-story`, `recommendations`, `preview-replace` — all try Go backend first
- Added `preview-replace` Python router (was missing from Phase 17)

**Phase 19 — Infrastructure & Deploy**
- `backend/Dockerfile` — multi-stage build (golang:1.22 → alpine:3.20), no CGO
- `ai-service/Dockerfile` — python:3.12-slim, layer-cached deps
- `docker-compose.yml` — wires go-backend + python-ai; env vars from host `.env`
- `.github/workflows/ci.yml` — 4 jobs: Next.js tsc, Go vet+build, Python import+ruff lint, Docker image builds
- `SUDO_COMMANDS.md` — full runbook: Go install, Docker install, env var setup, how to start all 3 services

**Security fixes (Phase 17)**
- `middleware/auth.py`: `hmac.compare_digest` instead of `!=`, explicit 500 on empty secret
- `photos.py`: URL host allowlist before SSRF fetch, content-type allowlist, `X-Content-Type-Options: nosniff`
- `weather.py` + `photos.py`: added `verify_internal_token` dependency (were accidentally public)

---

### 2026-06-18 (continued)

**Phases 61-80 — Mobile Roadmap**
- Wrote `docs/superpowers/plans/2026-06-18-phase61-80-mobile-roadmap.md` — full scope for 20 remaining mobile phases: push notifications, offline support, App Store/Play Store submission, deep linking, Siri shortcuts, IAP, dark mode, accessibility, ASO, crash reporting, EAS OTA, iOS widget, Live Activities, social follow feed, multi-city trips, mobile budget, personalized AI, launch polish

**Phases 51-60 — Mobile Core Plans**
- Wrote `docs/superpowers/plans/2026-06-18-phase51-mobile-foundation.md` — Expo SDK 51 + Expo Router 3 bootstrap: NativeWind, SecureStore, Supabase provider, typed Go API client, app icon, splash, `mobile/AGENTS.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase52-mobile-auth.md` — Supabase email/password auth: login + signup screens, session-based route protection in root layout, `useAuth` hook with sign-out
- Wrote `docs/superpowers/plans/2026-06-18-phase53-mobile-navigation.md` — 4-tab bottom bar (Ionicons, brand green), trip detail stack navigator, skeleton screens for all tabs, SafeAreaView setup
- Wrote `docs/superpowers/plans/2026-06-18-phase54-mobile-trips.md` — trip list with `FlatList` + `TripCard` (status badges, emoji), FAB, 4-step trip creation wizard (destination/dates/style/travelers), AI generation on finish
- Wrote `docs/superpowers/plans/2026-06-18-phase55-mobile-timeline.md` — day selector, draggable activity cards (Reanimated + DraggableFlatList), haptic feedback, mark complete, generate empty day with AI, weather emoji on day selector
- Wrote `docs/superpowers/plans/2026-06-18-phase56-mobile-map.md` — `react-native-maps` with Open-Meteo geocoding, day-colored pins, callouts, day filter chips, auto-fit to all pins, map button in timeline header
- Wrote `docs/superpowers/plans/2026-06-18-phase57-mobile-ai-chat.md` — streaming AI chat companion: FAB + bottom sheet, SSE via RN Fetch ReadableStream, message bubble UI, abort support
- Wrote `docs/superpowers/plans/2026-06-18-phase58-60-mobile-features.md` — three phases in one: (58) Explore tab with AI destination discovery, (59) GPS live companion with local push nudges, (60) photo journal with camera + gallery upload to Supabase Storage

**Phases 36-50 — Feature & UX Expansion Plans**
- Wrote `docs/superpowers/plans/2026-06-18-phase36-budget-tracker.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase37-packing-list.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase38-smart-notifications.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase39-trip-templates.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase40-onboarding.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase41-dark-mode.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase42-voice-input.md` — Web Speech API voice Quick Add for activities, mic button on AI chat
- Wrote `docs/superpowers/plans/2026-06-18-phase43-advanced-search.md` — PostgreSQL full-text search (`tsvector`), `GET /api/v1/search`, Cmd+K search overlay with 300ms debounce
- Wrote `docs/superpowers/plans/2026-06-18-phase44-i18n.md` — `next-intl` with English/Spanish/French/Hebrew (RTL), locale routing, language selector in profile
- Wrote `docs/superpowers/plans/2026-06-18-phase45-booking-links.md` — booking URL builder (OpenTable, Viator, GetYourGuide, Booking.com, etc.), `BookingLinks` chip component on activity cards
- Wrote `docs/superpowers/plans/2026-06-18-phase46-weather-intelligence.md` — Open-Meteo forecast (free, no key), PostgreSQL 12-hour cache, rain badges on outdoor activities, AI indoor alternatives
- Wrote `docs/superpowers/plans/2026-06-18-phase47-accessibility.md` — WCAG 2.1 AA: axe-core dev audit, skip-to-content, aria-labels, focus-trap-react, keyboard nav, contrast fixes
- Wrote `docs/superpowers/plans/2026-06-18-phase48-premium.md` — Stripe Checkout + webhooks, free tier limits (3 trips, 10 AI/day), `RequirePremium` middleware, `UpgradePrompt` modal, grandfathered existing users
- Wrote `docs/superpowers/plans/2026-06-18-phase49-analytics.md` — Umami analytics, OG image generation (`@vercel/og`), referral system (6-char codes, 30-day premium reward)
- Wrote `docs/superpowers/plans/2026-06-18-phase50-social-sharing.md` — public trips, discover feed, fork endpoint, make-public toggle

**Phases 26-35 — Code Quality & Debug Plans**
- Wrote `docs/superpowers/plans/2026-06-18-phase26-agent-friendly-codebase.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase27-typescript-strict.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase28-go-tests.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase29-python-tests.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase30-e2e-tests.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase31-structured-logging.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase32-openapi.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase33-local-dev.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase34-code-quality.md`
- Wrote `docs/superpowers/plans/2026-06-18-phase35-debug-audit.md`

**Phases 20-25 — Trip Enrichment, Discovery & Ops Plans**
- Wrote `docs/superpowers/plans/2026-06-18-phase20-collaboration.md` — real-time trip collaboration: `trip_members` table, role-based access (owner/editor/viewer), invite by email, Supabase Realtime live sync, collaborator avatars
- Wrote `docs/superpowers/plans/2026-06-18-phase21-photo-journal.md` — photo journal: Supabase Storage direct upload, activity-level photo attachment, AI captions (Groq), timeline thumbnails, summary mosaic
- Wrote `docs/superpowers/plans/2026-06-18-phase22-flight-tracker.md` — flight tracker: AviationStack real-time status, Go background polling worker (30-min interval), Telegram delay/gate notifications, dashboard flight card
- Wrote `docs/superpowers/plans/2026-06-18-phase23-culture-toolkit.md` — culture toolkit: AI culture pack (phrases, customs, emergency numbers, visa info), 7-day DB cache, ExchangeRate-API currency converter, new Local Info trip tab
- Wrote `docs/superpowers/plans/2026-06-18-phase24-destination-discovery.md` — AI destination discovery: `/explore` screen, Groq + Tavily inspiration, destination cards with hero photos, "Plan this trip" pre-fills wizard
- Wrote `docs/superpowers/plans/2026-06-18-phase25-monitoring.md` — monitoring & admin: async request logging to `api_events`, admin dashboard (stats, hourly chart, top endpoints), combined health endpoint, role-gated `/admin` page

**Phases 16-19 — Architecture Transition Plans**
- Wrote `docs/superpowers/plans/2026-06-18-phase16-go-backend.md` — Go (Gin) backend: JWT auth middleware, pgx CRUD for trips/days/activities/profiles, Telegram webhook handler (no library dependency), AI proxy to Python service
- Wrote `docs/superpowers/plans/2026-06-18-phase17-python-ai.md` — Python (FastAPI) AI service: all 8 AI routes (generate, chat, recommendations, replace, story, edit, import, photos/weather), internal token auth, Groq SDK
- Wrote `docs/superpowers/plans/2026-06-18-phase18-frontend-migration.md` — Next.js migration to pure frontend: `src/lib/api.ts` typed API client, replace all Supabase direct calls and Next.js API routes with Go/Python backends
- Wrote `docs/superpowers/plans/2026-06-18-phase19-infrastructure.md` — Docker Compose, multi-stage Dockerfiles (Go + Python + Next.js standalone), GitHub Actions CI (4 jobs), Railway production deployment guide

### 2026-06-18

**Phase 11 — Documentation**
- Wrote `README.md` — replaced create-next-app boilerplate with full project README
- Created `docs/architecture.md` — DB schema, auth flow, AI pipeline, photo pipeline
- Created `docs/api-reference.md` — all API routes with request/response shapes
- Created `docs/env-vars.md` — every environment variable and where to find it
- Created `docs/telegram-bot.md` — bot setup, linking flow, commands, local dev guide
- Updated `.env.local.example` — replaced Gemini/Google Maps with Groq/Tavily/Unsplash
- Updated design spec (`docs/superpowers/specs/`) — corrected tech stack, added phases 6-11
- Updated phase 1 plan (`docs/superpowers/plans/`) — corrected Next.js and AI references

---

### 2026-06-17

**Phase 11 Planning**
- Created `docs/superpowers/plans/2026-06-17-phase11-documentation.md`

**Phases 6–10 Planning**
- Created `docs/superpowers/plans/2026-06-17-phase6-deploy.md`
- Created `docs/superpowers/plans/2026-06-17-phase7-notifications.md`
- Created `docs/superpowers/plans/2026-06-17-phase8-budget.md`
- Created `docs/superpowers/plans/2026-06-17-phase9-packing.md`
- Created `docs/superpowers/plans/2026-06-17-phase10-social.md`

**Phase 5 — Trip Summary**
- Added Summary tab to trip navigation (`TripTabNav`)
- New `src/app/(app)/trips/[id]/summary/page.tsx` — stats, AI story, share button, PNG export
- New `src/components/summary/SummaryClient.tsx`
- New `src/app/share/[tripId]/page.tsx` — public share page (no auth required)
- New `src/app/api/ai/trip-story/route.ts` — Groq-generated travel narrative
- New `src/components/ui/PhotoLightbox.tsx` — full-screen photo preview (Escape / backdrop to close)
- Added CSS animations: `animate-fade-in`, `animate-fade-up`, `animate-sheet-in`

**Phase 4 — Telegram Bot**
- New `src/app/api/telegram/webhook/route.ts` — grammy bot handler with `/start`, `/trip`, `/next`, `/status`
- New `src/app/api/telegram/link/route.ts` — save Chat ID to user profile
- New `scripts/telegram-poll.mjs` — local dev long-polling script (no ngrok needed)
- New `src/components/settings/SettingsClient.tsx` — paste-Chat-ID linking flow
- Added `createServiceClient()` in `src/lib/supabase/server.ts` — service role client bypassing RLS

**Phase 3 — Discovery & Photos**
- New `src/app/(app)/trips/[id]/discover/page.tsx` and `DiscoverClient.tsx`
- Wikipedia API photo proxy at `src/app/api/places/photo/route.ts` — returns image bytes (not redirect) for html2canvas CORS compatibility
- Unsplash fallback when Wikipedia has no image
- New `src/components/itinerary/ReplaceActivitySheet.tsx` — AI-powered activity replacement
- New `src/app/api/ai/replace-activity/route.ts`

**Deploy Prep**
- New `DEPLOY_CHECKLIST.md` — step-by-step Vercel + Supabase production deploy guide
- Added `export const maxDuration = 60` to all heavy AI routes (generate-itinerary, edit-itinerary, chat, recommendations, documents/import)

---

### 2026-06-16

**Phase 2 — Core Views**
- Calendar view (`src/app/(app)/trips/[id]/calendar/`)
- Map view with Leaflet + OpenStreetMap (`src/app/(app)/trips/[id]/map/`)
- Trip dashboard with weather, countdown, next activities
- Document import — paste booking confirmation text, Groq extracts structured data
- Activity detail sheet

**Tech Stack Corrections**
- Swapped Google Maps JS API → Leaflet + OpenStreetMap (no API key required)
- Navigation delegates to Google Maps via deep-link (`window.location.href`)
- Fixed Leaflet Turbopack crash by replacing the navigate page with a Google Maps redirect

**Auth**
- Added Sign in with Google (OAuth) to login and signup pages

**Phase 1 — Foundation**
- Next.js 16.2.9 project with Tailwind CSS v4, Turbopack, Plus Jakarta Sans
- Supabase schema with RLS (`supabase/migrations/001_initial_schema.sql`)
- Email auth flow: signup → magic link → `/auth/callback` → dashboard
- AI chat flow: 8-step trip wizard → Groq itinerary generation → timeline view
- `GeminiService` wrapper in `src/lib/ai.ts` (Groq backend, legacy name)
- Two Supabase client patterns: `createClient()` (respects RLS) and later `createServiceClient()` (bypasses RLS)
- Shared TypeScript types for all domain entities (`src/types/`)

---

## Tech Stack Summary

| Choice | What replaced | Why |
|---|---|---|
| Groq (llama-3.3-70b) | Google Gemini 1.5 Pro | No billing required |
| Leaflet + OpenStreetMap | Google Maps JS API | No API key required |
| Wikipedia API + Unsplash | Google Places API | Free, no billing required |
| Next.js 16.2.9 | Next.js 14 (original plan) | Latest stable at time of build |
| Tailwind CSS v4 | Tailwind CSS v3 + shadcn/ui | Built-in to Next.js 16 scaffold |
