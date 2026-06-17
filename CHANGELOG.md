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

---

## Changelog

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
