# TrailGuide AI — Architecture

## Overview

TrailGuide AI is a three-service application:

- **Next.js 16.2.9** (App Router) — frontend + thin API layer (auth, Telegram, cron, photos, culture, expenses, checklist, social)
- **Go 1.22 (Gin)** — main API server (trip CRUD, JWT auth, proxy to Python AI service)
- **Python 3.12 (FastAPI)** — AI service (all Groq/LLM logic, document parsing, place photos, weather)

The database is Supabase (PostgreSQL + Auth + RLS). All three services are independently deployable.

---

## Database Schema

All tables use UUID primary keys and `created_at`/`updated_at` timestamps unless noted.

### `profiles`
Extended user info linked to Supabase Auth.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | matches `auth.users.id` |
| `full_name` | text | |
| `avatar_url` | text | |
| `telegram_chat_id` | text | nullable; UNIQUE; set when user links Telegram |
| `updated_at` | timestamptz | |

### `trips`
One row per planned trip.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles) | |
| `title` | text | max 500 chars (Go-validated) |
| `destination` | text | max 300 chars |
| `start_date` | date | |
| `end_date` | date | |
| `travelers` | int | 1–50 |
| `trip_style` | text | e.g. "backpacker", "luxury" |
| `interests` | text[] | e.g. ["food", "history"] |
| `transport_mode` | text | e.g. "public", "rental" |
| `flight_info` | text | free text from wizard |
| `hotel_info` | text | free text from wizard |
| `budget` | text | e.g. "medium" |
| `currency` | text | ISO 4217 |
| `status` | text | `planning` \| `active` \| `completed` |
| `is_public` | boolean | false by default |
| `created_at` | timestamptz | |

### `days`
One row per trip day.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `trip_id` | uuid (FK → trips) | |
| `date` | date | |
| `day_number` | int | 1-indexed |

### `activities`
One row per planned activity.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `day_id` | uuid (FK → days) | |
| `trip_id` | uuid (FK → trips) | denormalised for RLS |
| `title` | text | |
| `description` | text | |
| `time` | text | e.g. "09:00" |
| `duration` | text | e.g. "2 hours" |
| `cost` | numeric | |
| `category` | text | e.g. "food", "attraction" |
| `address` | text | |
| `photo_url` | text | Wikipedia/Unsplash URL |
| `photo_query` | text | search term used |
| `is_completed` | boolean | false by default |
| `sort_order` | int | |

### `expenses`
Budget tracking — one row per expense entry.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `trip_id` | uuid (FK → trips) | |
| `user_id` | uuid (FK → profiles) | |
| `title` | text | |
| `amount` | numeric | |
| `category` | text | e.g. "food", "transport", "accommodation" |
| `date` | date | |
| `created_at` | timestamptz | |

### `checklist_items`
Packing list — one row per item.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `trip_id` | uuid (FK → trips) | |
| `user_id` | uuid (FK → profiles) | |
| `title` | text | |
| `category` | text | e.g. "clothing", "documents", "tech" |
| `is_checked` | boolean | false by default |
| `is_ai_generated` | boolean | true for AI-generated items |
| `created_at` | timestamptz | |

### `activity_photos`
Uploaded trip photos via Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `activity_id` | uuid (FK → activities) | |
| `trip_id` | uuid (FK → trips) | denormalised for RLS |
| `storage_path` | text | path in `activity-photos` bucket |
| `caption` | text | AI-generated (≤15 words) |
| `created_at` | timestamptz | |

### `culture_cache`
Shared AI culture pack cache — no RLS (shared across users, no PII).

| Column | Type | Notes |
|---|---|---|
| `destination` | text (PK) | |
| `data` | jsonb | phrases, customs, emergency numbers, etc. |
| `expires_at` | timestamptz | 7-day TTL |

### `currency_cache`
Shared exchange rate cache — no RLS.

| Column | Type | Notes |
|---|---|---|
| `base_currency` | text (PK) | |
| `data` | jsonb | rates keyed by target currency |
| `expires_at` | timestamptz | 1-hour TTL |

### RLS Rules

All user tables (`trips`, `days`, `activities`, `expenses`, `checklist_items`, `activity_photos`) enforce `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. `trips` with `is_public = true` and their `days`/`activities` are readable without auth (via service role client). `culture_cache` and `currency_cache` have no RLS.

---

## Authentication Flow

```
User → /login or /signup
  → Supabase Auth (email magic link or Google OAuth)
  → Redirect to /auth/callback
  → createClient().auth.exchangeCodeForSession(code)
  → Session stored in httpOnly cookies
  → Redirect to /dashboard
```

Two Supabase client patterns:
- **`createClient()`** (`src/lib/supabase/server.ts`) — reads session from cookies, respects RLS. Used in authenticated API routes and server components.
- **`createServiceClient()`** (`src/lib/supabase/server.ts`) — service role key, bypasses RLS. Used in Telegram webhook, cron jobs, and public share page.

The Go backend validates JWTs using `SUPABASE_JWT_SECRET` (HS256, signing method pinned). All Go handlers extract `user_id` from the validated token — never from the request body.

---

## Service Architecture

### Next.js (port 3000)
Frontend rendering and the following API surface:
- Auth routes (`/api/auth/*`)
- Telegram webhook and linking (`/api/telegram/*`)
- Cron jobs (`/api/cron/*`)
- Activity photos (`/api/photos/*`)
- Culture pack and currency (`/api/culture-pack`, `/api/currency`)
- Visa requirements (`/api/visa`)
- Budget/expenses (`/api/expenses`, `/api/expenses/export`)
- Checklist (`/api/checklist/check`, `/api/checklist/item`)
- Social routes (`/api/trips/visibility`, `/api/trips/clone`)
- AI routes (fall back to direct Groq when Go backend is unreachable)

### Go Backend (port 8080)
- Trip CRUD: `GET/POST/PUT/DELETE /api/v1/trips`
- JWT auth middleware on all `/api/v1/*` routes
- AI proxy: forwards `/api/v1/ai/*`, `/api/v1/documents/*`, `/api/v1/places/*`, `/api/v1/weather` to Python service with `X-Internal-Token`
- HTTP client timeout: 55 s
- CORS: driven by `CORS_ALLOW_ORIGIN` env var (`Vary: Origin` added)
- Input validation: `title` ≤500, `destination` ≤300, `status` must be `planning|active|completed`

### Python AI Service (port 8081)
- All Groq (LLM) logic
- Protected by `X-Internal-Token` header (`hmac.compare_digest`)
- Routers: `generate-itinerary`, `chat` (streaming), `recommendations`, `replace-activity`, `preview-replace`, `trip-story`, `edit-itinerary`, `documents/import`, `places/photo`, `weather`, `packing-list`, `caption`, `companion`
- All Pydantic models have explicit `max_length` and numeric bounds
- SSRF guard on photo proxy: URL host allowlist (wikimedia.org, unsplash.com) + content-type allowlist

---

## AI Pipeline

### Itinerary Generation

```
POST /api/ai/generate-itinerary
  → (via Go proxy) Python: generate_itinerary router
  → Groq: llama-3.3-70b-versatile, max_tokens: 8192, temperature: 0.7
  → Returns structured JSON: { days: [{ date, activities: [...] }] }
  → Next.js saves to Supabase: days → activities
```

`GeminiService` in `src/lib/ai.ts` is the Groq wrapper (legacy name from before AI provider swap).

### Chat (AI Companion)

```
POST /api/ai/chat
  → System prompt: trip context (destination, dates, today's activities)
  → Groq stream → SSE response
  → Quick reply chips in <!-- chips: [...] --> comment at end
```

### Packing List

```
POST /api/ai/packing-list
  → Verify trip ownership
  → Fetch Open-Meteo weather for destination + trip dates
  → Groq: llama-3.3-70b-versatile → categorised JSON packing list
  → Save items to checklist_items (clears AI items first — idempotent)
```

### Photo Caption

```
POST /api/ai/caption
  → Groq: llama-3.1-8b-instant
  → Input: activity title + destination (both capped before prompt)
  → Returns ≤15-word evocative travel caption
```

### Culture Pack

```
GET /api/culture-pack?tripId=
  → Verify trip ownership
  → Check culture_cache (7-day TTL)
  → Groq: llama-3.3-70b-versatile + response_format: json_object
  → Generates: phrases, customs, electricity, currency, water safety, internet, emergency numbers, visa summary
  → Upsert to culture_cache
```

All heavy AI routes export `export const maxDuration = 60` to override Vercel's 10 s timeout.

---

## Photo Pipeline

### Place Photos (Wikipedia/Unsplash)
1. Activity card requests `GET /api/places/photo?query=Eiffel+Tower`
2. Wikipedia API → page image URL; fallback to Unsplash if empty
3. **SSRF guard:** URL host must be `upload.wikimedia.org` or `images.unsplash.com`; content-type must be `image/*`
4. Fetch bytes server-side, return with `Content-Type` + `Access-Control-Allow-Origin: *` + `X-Content-Type-Options: nosniff`
5. html2canvas receives bytes via proxy (CORS-safe for PNG export)

### Activity Photos (Supabase Storage)
1. Client calls `POST /api/photos/upload-url` → server verifies trip ownership, returns signed upload URL; sanitises filename
2. Client PUTs file directly to Supabase Storage (`activity-photos` bucket, max 10 MB, JPEG/PNG/WebP/HEIC)
3. Client calls `POST /api/photos` with storage path → server saves metadata to `activity_photos` + generates AI caption
4. Thumbnails rendered via public bucket URL: `/storage/v1/object/public/activity-photos/...`

---

## Telegram Bot

```
Webhook: POST /api/telegram/webhook
  → X-Telegram-Bot-Api-Secret-Token verified (crypto.timingSafeEqual, TELEGRAM_WEBHOOK_SECRET)
  → grammy Bot processes update
  → createServiceClient() (bypasses RLS)
  → /start → returns Chat ID
  → /trip  → finds profile by chat_id → returns trip list
  → /next  → finds active trip → returns next activity
  → /status → returns today's remaining activities
```

**Cron jobs** (registered via `vercel.json`, all require `CRON_SECRET` via `crypto.timingSafeEqual`):
- `GET /api/cron/advance-trip-status` — 6am: auto-transitions `planning→active→completed` by date
- `GET /api/cron/daily-briefing` — 7am: Telegram message with today's activities for active trips
- `GET /api/cron/pre-trip-reminder` — 8am: Resend HTML email 3 and 1 days before trip start

**Middleware bypass:** `/api/cron/*` and `/api/telegram/webhook` are excluded from session middleware (`isServiceRoute`) so Vercel Cron and Telegram can call them without a user session.

---

## Rate Limiting

Upstash Redis + `@upstash/ratelimit` (`src/lib/ratelimit.ts`):
- Authenticated routes: 60 requests/min per `user.id`
- Public/unauthenticated routes (`places/photo`, `visa`, `weather`): 30 requests/min per IP via `clientIp()` helper

---

## Key Directories

```
src/app/api/
├── ai/
│   ├── caption/              # AI photo captions (llama-3.1-8b-instant)
│   ├── chat/                 # Streaming AI companion
│   ├── companion/            # Live trip nudges
│   ├── edit-itinerary/       # AI itinerary edits
│   ├── generate-itinerary/   # Full itinerary generation
│   ├── packing-list/         # AI packing list with weather context
│   ├── preview-replace/      # Preview activity replacement
│   ├── recommendations/      # Discover tab suggestions
│   ├── replace-activity/     # Single activity replacement
│   └── trip-story/           # Summary narrative
├── checklist/
│   ├── check/                # Toggle is_checked
│   └── item/                 # Add/remove manual items
├── cron/
│   ├── advance-trip-status/  # Auto status transitions
│   ├── daily-briefing/       # Telegram morning briefing
│   └── pre-trip-reminder/    # Email reminders (Resend)
├── culture-pack/             # AI culture pack (7-day cache)
├── currency/                 # Exchange rates (1-hour cache, open.er-api.com)
├── documents/
│   └── import/               # AI document parsing
├── expenses/
│   └── export/               # CSV download (formula-injection safe)
├── photos/
│   └── upload-url/           # Signed Supabase Storage upload URL
├── places/
│   └── photo/                # Wikipedia + Unsplash proxy (SSRF-protected)
├── telegram/
│   ├── link/                 # Save chat_id to profile
│   └── webhook/              # grammy bot handler
├── trips/
│   ├── clone/                # Clone a public trip
│   └── visibility/           # Toggle is_public
├── visa/                     # Visa requirements via Tavily
└── weather/                  # Open-Meteo proxy
```

---

## Deployment

- **Frontend:** Vercel (serverless functions, cron jobs)
- **Go backend:** Railway or any container host (`backend/Dockerfile` — multi-stage, alpine)
- **Python AI service:** Railway (`ai-service/Dockerfile` — python:3.12-slim)
- **DB:** Supabase (managed PostgreSQL)
- **Storage:** Supabase Storage (`activity-photos` bucket, public)
- **AI:** Groq Cloud API
- **Rate limiting:** Upstash Redis

See [`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md) for the full deploy guide.
