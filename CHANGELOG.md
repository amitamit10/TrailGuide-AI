# TrailGuide AI — Status & Changelog

## Phase Status

| Phase | Name | Status |
|---|---|---|
| 1 | Foundation | ✅ Done |
| 2 | Core Views | ✅ Done |
| 3 | Discovery | ✅ Done |
| 4 | Live Trip | ✅ Done |
| 5 | Trip Summary | ✅ Done |
| 6 | Deploy | ⏳ Next |
| 7 | Notifications | 📋 Planned |
| 8 | Budget Tracker | 📋 Planned |
| 9 | Packing List | 📋 Planned |
| 10 | Social | 📋 Planned |
| 11 | Documentation | ✅ Done |
| 12 | Security Hardening | 📋 Planned |
| 13 | Rate Limiting & Caching | 📋 Planned |
| 14 | PWA & Offline Mode | 📋 Planned |
| 15 | Trip Export & Calendar | 📋 Planned |
| 16 | Go Backend | 📋 Planned |
| 17 | Python AI Service | 📋 Planned |
| 18 | Frontend Migration | 📋 Planned |
| 19 | Infrastructure & Deploy | 📋 Planned |

---

## Phase Groups

Groups define the recommended execution order. Within a group, phases listed as "parallel" can run as simultaneous subagents.

| Group | Name | Phases | Status | Execution order |
|---|---|---|---|---|
| A | Foundation | 1, 2, 3, 4, 5, 11 | ✅ Complete | Done |
| B | Production Ship | 6, 12 | ⏳ Next | 12 first (security guards), then 6 (deploy) |
| C | Current-Stack Hardening | 13, 14, 15 | 📋 Planned | 13, 14, 15 in parallel — all independent |
| D | Architecture Transition | 16, 17, 18, 19 | 📋 Planned | 16 + 17 parallel → 18 → 19 |
| E | Feature Expansion | 7, 8, 9, 10 | 📋 Planned | 7, 8, 9, 10 in parallel — after Group D |

> **Why Group E comes after Group D:** Phases 7–10 add backend features (notifications, budget, packing, social). Building them before the architecture transition would mean writing them as Next.js API routes, then immediately migrating them to Go/Python in Phase 18. Build them in Go + Python from the start.

> **Why Group B comes before Group C:** Phase 12 (security hardening) fixes missing auth guards on live routes — that must land before the app goes to production in Phase 6. Group C improvements (rate limiting, PWA, export) are useful but not blockers for shipping.

---

## Changelog

### 2026-06-18 (continued)

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
