# Phase 11 — Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write comprehensive documentation for everything built in Phases 1–5 — a README for GitHub, an architecture overview, an API reference, and an environment variables guide — so any developer (or future-you) can understand, run, and extend the project cold.

**Architecture:** All docs live under `docs/` (existing) plus a root `README.md`. No new code. Each document is standalone and cross-links to the others. Docs describe what is actually built today (Phases 1–5), not future phases.

**Tech Stack:** Markdown · GitHub-flavored tables and code blocks

## Global Constraints

- Write about what is BUILT (Phases 1–5 only) — do not document planned phases 7–10
- All file paths in docs must match actual paths in the repo
- All API request/response shapes must match the actual route files
- Every environment variable listed must be the exact key name from `.env.local`
- Never include actual secret values — use `your-key-here` placeholders
- Keep docs in present tense ("The app does X") not past tense ("We built X")

---

### Task 1: README.md — project overview and local setup

**Files:**
- Create: `README.md` (project root)

**Interfaces:**
- Produces: the first file anyone reads on GitHub; must stand alone with no prior context

- [ ] **Step 1: Write README.md**

  Create `README.md` at the project root with this exact content:

  ````markdown
  # TrailGuide AI ✈️

  AI-powered travel planner that generates personalised itineraries, tracks your trip live, and keeps you updated via Telegram.

  **Live demo:** _coming soon_

  ---

  ## Features

  | Feature | Description |
  |---|---|
  | **Trip Wizard** | 8-step wizard: destination, dates, travelers, style, interests, transport mode, flights/hotels |
  | **AI Itinerary** | Groq (llama-3.3-70b-versatile) generates a full day-by-day plan with times, costs, and photos |
  | **Timeline** | Chronological activity view with check-off, replace, and Google Maps links |
  | **Discover** | AI recommends nearby places not in your itinerary — add them with one tap |
  | **Companion** | Live weather, next-activity countdown, and AI nudges while you travel |
  | **Summary** | Post-trip stats, AI travel story, and shareable/downloadable memory card |
  | **Telegram Bot** | `/trip`, `/next`, `/status` commands via @TrailGuideAI_bot |
  | **Document Import** | Paste or upload flight/hotel confirmations — AI extracts the details |
  | **Photos** | Real place photos via Wikipedia API, Unsplash fallback |

  ---

  ## Tech Stack

  - **Framework:** Next.js 16.2.9 (App Router, Turbopack)
  - **Language:** TypeScript 5, React 19
  - **Styling:** Tailwind CSS v4 (CSS-first config)
  - **Auth + DB:** Supabase (PostgreSQL + RLS + Auth)
  - **AI:** Groq SDK — `llama-3.3-70b-versatile` for planning, `llama-3.1-8b-instant` for fast tasks
  - **Search:** Tavily API (web search for recommendations)
  - **Photos:** Wikipedia API (free, no key) + Unsplash API (fallback)
  - **Telegram:** grammy v1 webhook handler
  - **Maps:** Leaflet + OpenStreetMap (no API key), Google Maps deep-links for navigation
  - **Weather:** Open-Meteo (free, no key)
  - **Export:** html2canvas (summary card download)

  ---

  ## Local Setup

  ### Prerequisites

  - Node.js 18+ via [nvm](https://github.com/nvm-sh/nvm)
  - A [Supabase](https://supabase.com) project
  - A [Groq](https://console.groq.com) API key
  - A [Tavily](https://tavily.com) API key
  - An [Unsplash](https://unsplash.com/developers) Access Key (optional — falls back to Wikipedia only)
  - A Telegram bot token from [@BotFather](https://t.me/BotFather) (optional)

  ### 1. Clone and install

  ```bash
  git clone https://github.com/amitamit10/TrailGuide-AI.git
  cd TrailGuide-AI
  nvm use   # or: nvm install 20
  npm install
  ```

  ### 2. Create `.env.local`

  ```bash
  cp .env.local.example .env.local
  ```

  Fill in the values — see [`docs/env-vars.md`](docs/env-vars.md) for details on each key.

  ### 3. Set up Supabase

  In your Supabase project's **SQL Editor**, run in order:

  ```
  supabase/migrations/001_initial_schema.sql
  supabase/migrations/002_phase4_columns.sql
  ```

  Then in **Authentication → URL Configuration**:
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/**`

  ### 4. Run the dev server

  ```bash
  npm run dev
  ```

  Open [http://localhost:3000](http://localhost:3000).

  ### 5. (Optional) Telegram bot — local testing

  ```bash
  node scripts/telegram-poll.mjs
  ```

  This long-polls Telegram and forwards updates to `localhost:3000/api/telegram/webhook`.
  See [`docs/telegram-bot.md`](docs/telegram-bot.md) for setup.

  ---

  ## Project Structure

  ```
  src/
  ├── app/
  │   ├── (app)/              # Authenticated routes
  │   │   ├── dashboard/      # Trip list
  │   │   ├── settings/       # Account + Telegram link
  │   │   └── trips/
  │   │       ├── new/        # 8-step wizard
  │   │       ├── review/     # Pre-save itinerary review
  │   │       └── [id]/       # Per-trip tabs
  │   │           ├── timeline/
  │   │           ├── companion/
  │   │           ├── discover/
  │   │           ├── summary/
  │   │           ├── calendar/
  │   │           ├── map/
  │   │           └── import/
  │   ├── (auth)/             # Login / signup / callback
  │   ├── api/                # All server-side API routes
  │   │   ├── ai/             # Groq AI endpoints
  │   │   ├── places/         # Photo proxy
  │   │   ├── telegram/       # Bot webhook + link
  │   │   └── weather/        # Open-Meteo proxy
  │   └── share/[tripId]/     # Public trip view (no auth)
  ├── components/             # React components
  ├── lib/
  │   ├── ai.ts               # GeminiService (Groq wrapper)
  │   └── supabase/           # client.ts + server.ts
  └── types/                  # Shared TypeScript types
  supabase/
  └── migrations/             # SQL migration files
  docs/                       # Architecture, API reference, guides
  ```

  ---

  ## Deployment

  See [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) for the full step-by-step guide.

  The short version:
  1. Run Supabase migrations
  2. Push to GitHub
  3. Import repo in [Vercel](https://vercel.com) → add env vars → deploy
  4. Add production URL to Supabase redirect URLs
  5. Register Telegram webhook at `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PROD_URL>/api/telegram/webhook`

  ---

  ## Architecture

  See [`docs/architecture.md`](docs/architecture.md) for the full system design.

  ## API Reference

  See [`docs/api-reference.md`](docs/api-reference.md) for all endpoints.

  ## Environment Variables

  See [`docs/env-vars.md`](docs/env-vars.md) for every variable and where to get it.

  ## Telegram Bot

  See [`docs/telegram-bot.md`](docs/telegram-bot.md) for bot setup and commands.

  ---

  ## License

  MIT
  ````

- [ ] **Step 2: Verify all links in README exist**

  Check that these files exist:
  - `docs/env-vars.md` — created in Task 4
  - `docs/telegram-bot.md` — created in Task 5
  - `docs/architecture.md` — created in Task 2
  - `docs/api-reference.md` — created in Task 3
  - `DEPLOY_CHECKLIST.md` — already exists ✓
  - `supabase/migrations/001_initial_schema.sql` — already exists ✓
  - `supabase/migrations/002_phase4_columns.sql` — already exists ✓
  - `scripts/telegram-poll.mjs` — already exists ✓

- [ ] **Step 3: Create `.env.local.example`**

  Create `.env.local.example` at the project root (safe to commit — no real values):

  ```bash
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

  # Groq (https://console.groq.com)
  GROQ_API_KEY=gsk_your-key-here

  # Tavily (https://tavily.com)
  TAVILY_API_KEY=tvly-your-key-here

  # Unsplash (https://unsplash.com/developers) — optional
  UNSPLASH_ACCESS_KEY=your-access-key-here

  # Telegram Bot (https://t.me/BotFather) — optional
  TELEGRAM_BOT_TOKEN=0000000000:your-token-here
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=YourBotUsername_bot

  # Production site URL (set to https://yourapp.vercel.app in Vercel env vars)
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add README.md .env.local.example
  git commit -m "docs: add README and .env.local.example"
  ```

---

### Task 2: Architecture document

**Files:**
- Create: `docs/architecture.md`

**Interfaces:**
- Produces: system design reference — DB schema, auth flow, AI pipeline, data flow

- [ ] **Step 1: Write docs/architecture.md**

  Create `docs/architecture.md`:

  ````markdown
  # Architecture

  ## Overview

  TrailGuide AI is a Next.js 16 App Router application. All AI calls happen server-side in API routes — the Groq API key is never exposed to the browser. Supabase handles auth, the database, and row-level security.

  ```
  Browser ──► Next.js App Router (Vercel)
                ├── (app)/ routes    ← authenticated pages
                ├── (auth)/ routes   ← login/signup/callback
                ├── share/           ← public, no auth
                └── api/             ← server-only, calls Groq/Tavily/etc.
                        │
                        ├── Groq API (AI generation)
                        ├── Tavily API (web search)
                        ├── Wikipedia API (photos, free)
                        ├── Unsplash API (photo fallback)
                        ├── Open-Meteo API (weather, free)
                        └── Telegram Bot API
                                │
                        Supabase (Auth + PostgreSQL)
  ```

  ---

  ## Database Schema

  All tables have Row Level Security (RLS) enabled. Users can only access their own data. Exception: the service role client (`createServiceClient()`) bypasses RLS — used only in trusted server contexts (Telegram webhook, public share page).

  ### `profiles`
  Auto-created on signup via a Supabase trigger on `auth.users`.

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | FK → auth.users |
  | `telegram_chat_id` | text | unique, set via Settings page |
  | `full_name` | text | from OAuth provider |
  | `avatar_url` | text | from OAuth provider |
  | `default_currency` | text | default `USD` |
  | `created_at` | timestamptz | |

  ### `trips`
  One row per trip. Status lifecycle: `planning` → `active` → `completed`.

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `user_id` | uuid | FK → profiles |
  | `title` | text | |
  | `destination` | text | |
  | `destination_lat/lng` | float | for map centering |
  | `departure_city` | text | |
  | `start_date / end_date` | date | |
  | `travelers_count` | int | |
  | `traveler_ages` | int[] | |
  | `flights_booked / hotels_booked` | boolean | |
  | `budget_total` | numeric | |
  | `budget_currency` | text | default `USD` |
  | `travel_style` | text | `budget` \| `balanced` \| `luxury` \| `explorer` |
  | `interests` | text[] | e.g. `{food, culture, nature}` |
  | `transport_mode` | text | `walking` \| `transit` \| `car` \| `bicycle` \| `mix` |
  | `max_walk_minutes` | int | max walk between stops |
  | `break_minutes` | int | gap between activities |
  | `status` | text | `planning` \| `active` \| `completed` |
  | `created_at` | timestamptz | |

  ### `itinerary_days`

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `trip_id` | uuid | FK → trips |
  | `day_number` | int | 1-based |
  | `date` | date | |
  | `notes` | text | |

  ### `activities`

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `trip_id` | uuid | FK → trips |
  | `day_id` | uuid | FK → itinerary_days |
  | `title` | text | |
  | `description` | text | |
  | `category` | text | `food` \| `attraction` \| `transport` \| `hotel` \| `flight` \| `free` |
  | `location_name` | text | |
  | `address` | text | |
  | `lat / lng` | float | |
  | `start_time / end_time` | text | `HH:MM` format |
  | `duration_minutes` | int | |
  | `estimated_cost` | numeric | |
  | `photo_query` | text | search query for Wikipedia/Unsplash |
  | `sort_order` | int | display order within a day |
  | `is_completed` | boolean | default false |

  ### `documents`
  Uploaded booking confirmations (flights, hotels, etc.).

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `trip_id` | uuid | FK → trips |
  | `type` | text | `flight` \| `hotel` \| `other` |
  | `file_url` | text | |
  | `extracted_json` | jsonb | AI-extracted structured data |

  ### `chat_messages`
  Stores conversation history for the AI chat on the review page.

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `trip_id` | uuid | nullable FK → trips |
  | `session_id` | text | client-generated |
  | `role` | text | `user` \| `model` |
  | `content` | text | |

  ### `companion_nudges`
  AI-generated tips shown on the Companion tab.

  | Column | Type | Notes |
  |--------|------|-------|
  | `id` | uuid | PK |
  | `trip_id` | uuid | FK → trips |
  | `type` | text | `timing` \| `discovery` \| `weather` \| `navigation` |
  | `message` | text | max ~100 chars |
  | `action_label` | text | optional CTA label |
  | `action_data` | jsonb | |
  | `sent_at` | timestamptz | |
  | `dismissed_at` | timestamptz | null until dismissed |

  ---

  ## Auth Flow

  ```
  1. User visits /login or /signup
  2. Supabase Auth handles email OTP or Google OAuth
  3. Callback lands at /auth/callback → exchangeCodeForSession()
  4. Session cookie set → redirect to /dashboard
  5. All (app)/ routes check auth via createClient().auth.getUser()
  6. Unauthenticated requests → redirect("/login")
  ```

  Supabase client comes in two flavours:

  | Function | File | Uses | When |
  |----------|------|------|------|
  | `createClient()` | `src/lib/supabase/server.ts` | anon key + cookies | Authenticated server routes |
  | `createServiceClient()` | `src/lib/supabase/server.ts` | service role key | Telegram webhook, public share page |

  ---

  ## AI Pipeline

  All AI calls go through `src/lib/ai.ts` (`GeminiService` class — named before Groq was chosen, kept for continuity).

  | Method | Model | Max tokens | Used in |
  |--------|-------|-----------|---------|
  | `generateItinerary()` | llama-3.3-70b-versatile | 8 192 | `/api/ai/generate-itinerary` |
  | `editItinerary()` | llama-3.3-70b-versatile | 8 192 | `/api/ai/edit-itinerary` |
  | `chat()` | llama-3.3-70b-versatile | 1 024 | `/api/ai/chat` |
  | `parseDocument()` | llama-3.1-8b-instant | 1 024 | `/api/documents/import` |
  | `getCompanionNudges()` | llama-3.1-8b-instant | 512 | `/api/ai/companion` |

  Routes that call Groq directly (not via `GeminiService`):

  | Route | Model | Max tokens |
  |-------|-------|-----------|
  | `/api/ai/recommendations` | llama-3.3-70b-versatile | 3 000 |
  | `/api/ai/replace-activity` | llama-3.3-70b-versatile | 512 |
  | `/api/ai/preview-replace` | llama-3.3-70b-versatile | 512 |
  | `/api/ai/trip-story` | llama-3.3-70b-versatile | 400 |

  Heavy routes (>10s expected) export `export const maxDuration = 60` for Vercel Pro compatibility.

  ---

  ## Photo Pipeline

  ```
  ActivityCard / ReplaceActivitySheet / DiscoverClient
      └─ <img src="/api/places/photo?query=Senso-ji+Temple&w=400">
              └─ GET /api/places/photo
                      ├─ Wikipedia search API → page image (real place photo, free)
                      │   └─ success → proxy bytes back (CORS-safe for html2canvas)
                      └─ Unsplash random photo API (fallback, requires key)
                          └─ success → proxy bytes back
  ```

  The proxy returns raw bytes (not a redirect) so that `html2canvas` can capture images into the Summary PNG without CORS errors.

  ---

  ## Telegram Bot

  In production: Telegram pushes updates to `POST /api/telegram/webhook` (grammy `webhookCallback`).

  In local dev: `scripts/telegram-poll.mjs` long-polls Telegram and forwards to `localhost:3000/api/telegram/webhook`.

  Linking flow:
  1. User sends `/start` → bot replies with their numeric Telegram Chat ID
  2. User pastes Chat ID into Settings page → `POST /api/telegram/link` saves it to `profiles.telegram_chat_id`
  3. Bot commands (`/trip`, `/next`, `/status`) look up the profile by `telegram_chat_id`

  Bot uses `createServiceClient()` so it can read profiles without a user session.
  ````

- [ ] **Step 2: Commit**

  ```bash
  git add docs/architecture.md
  git commit -m "docs: architecture overview — DB schema, auth flow, AI pipeline"
  ```

---

### Task 3: API reference

**Files:**
- Create: `docs/api-reference.md`

**Interfaces:**
- Produces: every server route documented with method, auth requirement, request body, response shape

- [ ] **Step 1: Write docs/api-reference.md**

  Create `docs/api-reference.md`:

  ````markdown
  # API Reference

  All routes are Next.js App Router API routes under `src/app/api/`.

  **Auth:** Routes marked 🔒 require a valid Supabase session cookie (user must be logged in). Routes marked 🌐 are public.

  ---

  ## AI Routes

  ### `POST /api/ai/generate-itinerary` 🔒
  Generate a full day-by-day itinerary. `maxDuration = 60`.

  **Request body:**
  ```json
  {
    "destination": "Tokyo",
    "start_date": "2026-07-01",
    "end_date": "2026-07-07",
    "travelers_count": 2,
    "travel_style": "explorer",
    "interests": ["food", "culture"],
    "transport_mode": "transit",
    "max_walk_minutes": 20,
    "break_minutes": 30
  }
  ```

  **Response:**
  ```json
  {
    "days": [
      {
        "day_number": 1,
        "date": "2026-07-01",
        "activities": [
          {
            "title": "Senso-ji Temple",
            "description": "...",
            "category": "attraction",
            "location_name": "Asakusa, Tokyo",
            "address": "2-3-1 Asakusa, Taito",
            "lat": 35.7148,
            "lng": 139.7967,
            "start_time": "09:00",
            "end_time": "10:30",
            "duration_minutes": 90,
            "estimated_cost": 0,
            "photo_query": "Senso-ji Temple Tokyo"
          }
        ]
      }
    ]
  }
  ```

  ---

  ### `POST /api/ai/chat` 🔒
  Conversational AI on the review page. `maxDuration = 60`.

  **Request body:**
  ```json
  {
    "message": "Add more food experiences on day 2",
    "history": [
      { "role": "user", "parts": [{ "text": "..." }] },
      { "role": "model", "parts": [{ "text": "..." }] }
    ],
    "context": { "destination": "Tokyo", "days": 7 }
  }
  ```

  **Response:** `{ "reply": "Great idea! Here are some food spots..." }`

  ---

  ### `POST /api/ai/recommendations` 🔒
  AI-powered place recommendations for the Discover tab. `maxDuration = 60`.

  **Request body:**
  ```json
  {
    "destination": "Tokyo",
    "interests": ["food", "culture"],
    "travelStyle": "explorer",
    "existingTitles": ["Senso-ji Temple", "Shibuya Crossing"],
    "category": "food",
    "count": 6
  }
  ```

  **Response:**
  ```json
  {
    "recommendations": [
      {
        "title": "Tsukiji Outer Market",
        "description": "...",
        "reason": "...",
        "category": "food",
        "location_name": "Tsukiji, Tokyo",
        "address": "...",
        "lat": 35.6654,
        "lng": 139.7707,
        "estimated_cost": 15,
        "photo_query": "Tsukiji Market Tokyo",
        "duration_minutes": 60
      }
    ]
  }
  ```

  ---

  ### `POST /api/ai/add-discovery` 🔒
  Append a Discover recommendation to the last day of a saved trip.

  **Request body:**
  ```json
  {
    "tripId": "uuid",
    "recommendation": { "title": "...", "category": "food", ... }
  }
  ```

  **Response:** `{ "ok": true }`

  ---

  ### `POST /api/ai/replace-activity` 🔒
  Replace an activity in a saved trip with an AI-generated alternative.

  **Request body:**
  ```json
  {
    "tripId": "uuid",
    "activityId": "uuid",
    "dayId": "uuid",
    "userRequest": "Something more adventurous"
  }
  ```

  **Response:** `{ "ok": true, "activity": { ...newActivity } }`

  ---

  ### `POST /api/ai/preview-replace` 🔒
  Preview an AI-generated replacement without saving it.

  **Request body:** Same as `/api/ai/replace-activity`

  **Response:** `{ "activity": { ...previewActivity } }`

  ---

  ### `POST /api/ai/edit-itinerary` 🔒
  Apply a free-text edit to the full in-memory itinerary (review page). `maxDuration = 60`.

  **Request body:**
  ```json
  {
    "itinerary": { "days": [...] },
    "edit": "Move the museum visit to day 3"
  }
  ```

  **Response:** `{ "days": [...updatedDays] }`

  ---

  ### `POST /api/ai/companion` 🔒
  Fetch weather, next activity, and AI nudges for the Companion tab.

  **Request body:** `{ "tripId": "uuid" }`

  **Response:**
  ```json
  {
    "weather": { "temp": 28, "description": "Partly cloudy", "icon": "⛅" },
    "nextActivity": { "title": "...", "start_time": "14:00", "location_name": "..." },
    "remainingToday": 3,
    "nudges": [
      { "type": "timing", "message": "Beat the lunchtime crowd — head out by 11:30", "action_label": null }
    ]
  }
  ```

  ---

  ### `POST /api/ai/trip-story` 🔒
  Generate a 2–3 paragraph travel narrative for the Summary tab.

  **Request body:**
  ```json
  {
    "destination": "Tokyo",
    "startDate": "2026-07-01",
    "endDate": "2026-07-07",
    "activities": [
      { "title": "Senso-ji Temple", "description": "...", "day": 1 }
    ]
  }
  ```

  **Response:** `{ "story": "Your adventure began at dawn..." }`

  ---

  ## Places

  ### `GET /api/places/photo` 🌐
  Photo proxy — Wikipedia first, Unsplash fallback. Returns raw image bytes (not a redirect).

  **Query params:**
  - `query` (required) — search term e.g. `Senso-ji Temple Tokyo`
  - `w` (optional) — desired width hint (passed to Wikipedia thumbnail API)

  **Response:** `image/jpeg` or `image/png` bytes, `Cache-Control: public, max-age=604800`

  **Error:** `404 { "error": "no photo found" }` if both sources fail

  ---

  ## Documents

  ### `POST /api/documents/import` 🔒
  AI extraction from booking confirmation text or file. `maxDuration = 60`.

  **Request body:** `multipart/form-data`
  - `tripId` — uuid
  - `text` — pasted text (optional)
  - `file` — PDF or image (optional)

  **Response:** `{ "document": { "id": "uuid", "type": "flight", "extracted_json": {...} } }`

  ---

  ## Weather

  ### `GET /api/weather` 🌐
  Open-Meteo proxy — current conditions for a destination.

  **Query params:** `destination` — city name e.g. `Tokyo`

  **Response:** `{ "temp": 28, "description": "Partly cloudy", "icon": "⛅", "humidity": 65 }`

  ---

  ## Telegram

  ### `POST /api/telegram/webhook` 🌐
  grammy webhook handler. Receives updates from Telegram (in production) or from `scripts/telegram-poll.mjs` (local dev).

  **Used by:** Telegram Bot API only. Do not call directly.

  ---

  ### `POST /api/telegram/link` 🔒
  Save a Telegram Chat ID to the authenticated user's profile.

  **Request body:** `{ "chatId": "123456789" }`

  **Response:** `{ "ok": true }`

  **Error:** `400 { "error": "Invalid Telegram Chat ID" }` if chatId is not numeric
  ````

- [ ] **Step 2: Commit**

  ```bash
  git add docs/api-reference.md
  git commit -m "docs: full API reference for all 14 routes"
  ```

---

### Task 4: Environment variables guide

**Files:**
- Create: `docs/env-vars.md`

**Interfaces:**
- Produces: every env var documented with purpose, where to get it, and whether it is required

- [ ] **Step 1: Write docs/env-vars.md**

  Create `docs/env-vars.md`:

  ````markdown
  # Environment Variables

  Copy `.env.local.example` to `.env.local` and fill in the values below.

  For Vercel deployment, add each variable in **Vercel → Project → Settings → Environment Variables**.

  ---

  ## Supabase

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your project URL. Supabase Dashboard → Settings → API → Project URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public anon key. Supabase Dashboard → Settings → API → anon public |
  | `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (bypasses RLS). Supabase Dashboard → Settings → API → service_role. **Never expose client-side.** |

  Where to find them: https://supabase.com/dashboard/project/_/settings/api

  ---

  ## AI — Groq

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `GROQ_API_KEY` | ✅ | API key for all AI generation (itinerary, chat, recommendations, etc.). Get at https://console.groq.com/keys |

  Free tier: 30 req/min, 6 000 tokens/min on llama-3.3-70b-versatile. Sufficient for personal use.

  ---

  ## Web Search — Tavily

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `TAVILY_API_KEY` | ✅ | Used for Discover tab recommendations. Get at https://tavily.com |

  Free tier: 1 000 searches/month.

  ---

  ## Photos — Unsplash

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `UNSPLASH_ACCESS_KEY` | Optional | Fallback when Wikipedia has no photo. Get at https://unsplash.com/developers → New Application. If absent, only Wikipedia photos are used. |

  ---

  ## Telegram Bot

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `TELEGRAM_BOT_TOKEN` | Optional | Bot token from @BotFather on Telegram. Required for `/trip`, `/next`, `/status` commands. |
  | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Optional | Your bot's username without `@` e.g. `TrailGuideAI_bot`. Shown as a link in Settings. |

  See [`docs/telegram-bot.md`](telegram-bot.md) for full setup instructions.

  ---

  ## Site URL

  | Variable | Required | Description |
  |----------|----------|-------------|
  | `NEXT_PUBLIC_SITE_URL` | Optional | Full URL of the app. Used in pre-trip reminder emails. Defaults work without it. Set to `https://yourapp.vercel.app` in Vercel. |

  ---

  ## Not needed

  These are **not** required:

  - Google Maps API key — replaced with Leaflet/OpenStreetMap (free) for map view; navigation uses a deep-link that needs no key
  - Google Gemini key — replaced with Groq
  - Open-Meteo key — free, no key needed
  - Wikipedia key — free, no key needed
  ````

- [ ] **Step 2: Commit**

  ```bash
  git add docs/env-vars.md
  git commit -m "docs: environment variables guide"
  ```

---

### Task 5: Telegram bot guide

**Files:**
- Create: `docs/telegram-bot.md`

**Interfaces:**
- Produces: complete guide to setting up, linking, and using the Telegram bot

- [ ] **Step 1: Write docs/telegram-bot.md**

  Create `docs/telegram-bot.md`:

  ````markdown
  # Telegram Bot

  TrailGuide AI includes an optional Telegram bot (`@TrailGuideAI_bot`) that lets you check your itinerary without opening the app.

  ---

  ## Commands

  | Command | What it does |
  |---------|-------------|
  | `/start` | Shows your Telegram Chat ID (needed to link your account) |
  | `/trip` | Today's full schedule with times and locations |
  | `/next` | Your next uncompleted activity |
  | `/status` | Countdown to upcoming trips / days remaining on active trip |

  Commands only work after you link your Telegram account in Settings.

  ---

  ## Setup — create a bot

  1. Open Telegram → search `@BotFather` → send `/newbot`
  2. Choose a name: e.g. `TrailGuide AI`
  3. Choose a username ending in `bot`: e.g. `TrailGuideAI_bot`
  4. BotFather replies with your token: `1234567890:AAXXXXXXXXXXXXXX`
  5. Add to `.env.local`:
     ```
     TELEGRAM_BOT_TOKEN=1234567890:AAXXXXXXXXXXXXXX
     NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
     ```

  ---

  ## Linking your account

  1. Open your bot in Telegram → tap **Start**
  2. The bot replies with your numeric Telegram ID (e.g. `987654321`)
  3. In the TrailGuide app → **Settings → Connect Telegram**
  4. Paste the number → tap **Save**
  5. The bot is now linked — try `/trip`

  ---

  ## Local development

  In production, Telegram pushes updates to your webhook URL. Locally, there's no public URL, so a polling script is used instead:

  ```bash
  node scripts/telegram-poll.mjs
  ```

  Keep this running in a separate terminal alongside `npm run dev`. It long-polls Telegram and forwards updates to `localhost:3000/api/telegram/webhook`.

  ---

  ## Production setup (after deploying to Vercel)

  Register the webhook once — open this URL in a browser:

  ```
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook
  ```

  Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`

  After this, `scripts/telegram-poll.mjs` is no longer needed.

  Verify with:
  ```
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
  ```
  ````

- [ ] **Step 2: Commit**

  ```bash
  git add docs/telegram-bot.md
  git commit -m "docs: Telegram bot setup and commands guide"
  ```

---

### Task 6: Push all docs to GitHub

**Files:** No new files — just push the commits from Tasks 1–5

- [ ] **Step 1: Confirm all docs committed**

  ```bash
  git log --oneline -6
  ```

  Expected: see commits for README, architecture, API reference, env vars, telegram bot.

- [ ] **Step 2: Push to GitHub**

  ```bash
  git push origin main
  ```

  Expected: `main` branch updated on `https://github.com/amitamit10/TrailGuide-AI`

- [ ] **Step 3: Verify README renders on GitHub**

  Open `https://github.com/amitamit10/TrailGuide-AI` in a browser.

  Expected:
  - README renders with the feature table, tech stack, setup steps
  - All internal links (`docs/architecture.md`, `docs/api-reference.md`, etc.) are clickable and resolve correctly
  - `.env.local.example` is visible in the file tree (not ignored)
  - `.env.local` does NOT appear in the file tree (gitignored)
