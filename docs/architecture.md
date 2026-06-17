# TrailGuide AI — Architecture

## Overview

TrailGuide AI is a Next.js 16.2.9 App Router application. The backend is Supabase (PostgreSQL + Auth + RLS). AI is powered by Groq. All server-side logic runs as Next.js API routes deployed on Vercel.

---

## Database Schema

All tables use UUID primary keys and `updated_at` timestamps.

### `profiles`
Extended user info linked to Supabase Auth user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | matches `auth.users.id` |
| `full_name` | text | |
| `avatar_url` | text | |
| `telegram_chat_id` | text | nullable; set when user links Telegram |
| `updated_at` | timestamptz | |

### `trips`
One row per planned trip.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK → profiles) | |
| `title` | text | |
| `destination` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `travelers` | int | |
| `trip_style` | text | e.g. "backpacker", "luxury" |
| `interests` | text[] | e.g. ["food", "history"] |
| `transport_mode` | text | e.g. "public", "rental" |
| `flight_info` | text | free text from wizard |
| `hotel_info` | text | free text from wizard |
| `budget` | text | e.g. "medium" |
| `currency` | text | ISO 4217 |
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

### RLS Rules

All tables have `auth.uid() = user_id` policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`. `is_public = true` trips and their days/activities are readable without auth (service role client used for public share page and Telegram webhook).

---

## Authentication Flow

```
User → /login or /signup
  → Supabase Auth (email link or Google OAuth)
  → Redirect to /auth/callback
  → createClient().auth.exchangeCodeForSession(code)
  → Session stored in cookies (httpOnly)
  → Redirect to /dashboard
```

Two Supabase client patterns:
- **`createClient()`** (`src/lib/supabase/server.ts`) — reads session from cookies, respects RLS. Used in authenticated API routes and server components.
- **`createServiceClient()`** (`src/lib/supabase/server.ts`) — service role key, bypasses RLS. Used in Telegram webhook, public share page, and other trusted server contexts.

---

## AI Pipeline

### Itinerary Generation

```
POST /api/ai/generate-itinerary
  → GeminiService.generateItinerary(tripData)
  → Groq: llama-3.3-70b-versatile, max_tokens: 8192, temperature: 0.7
  → Returns structured JSON: { days: [{ date, activities: [...] }] }
  → Caller saves to Supabase: days → activities
```

`GeminiService` in `src/lib/ai.ts` is the Groq wrapper (named before the AI swap). The prompt instructs the model to return strict JSON with no markdown fences.

### Chat (AI Companion)

```
POST /api/ai/chat
  → System prompt: trip context (destination, dates, today's activities)
  → User message → Groq stream → streamed response
  → Quick reply chips suggested by model
```

### Activity Replacement

```
POST /api/ai/replace-activity
  → Prompt: "suggest 3 alternatives to [activity] in [destination]"
  → Groq: llama-3.1-8b-instant, max_tokens: 1024
  → Returns array of 3 activity objects with same schema
```

### Trip Story (Summary)

```
POST /api/ai/trip-story
  → Prompt: trip overview + completed activities list
  → Groq: llama-3.3-70b-versatile, max_tokens: 400, temperature: 0.85
  → Returns 2-3 paragraph narrative
```

All heavy AI routes export `export const maxDuration = 60` to override Vercel's default 10s timeout.

---

## Photo Pipeline

1. **Request:** Activity card requests `GET /api/places/photo?query=Eiffel+Tower`
2. **Wikipedia API:** Search Wikidata for the query → get page image URL
3. **Proxy:** Fetch image bytes server-side, return with `Access-Control-Allow-Origin: *`
4. **Fallback:** If Wikipedia returns nothing, try Unsplash `/photos/random?query=...`
5. **html2canvas:** Gets bytes via proxy (not a redirect) → CORS safe for PNG export

---

## Telegram Bot

```
Webhook: POST /api/telegram/webhook
  → grammy Bot processes update
  → Uses createServiceClient() (bypasses RLS)
  → /start → returns Chat ID to user
  → /trip  → finds profile by chat_id → returns trip list
  → /next  → finds active trip → returns next activity
  → /status → returns today's remaining activities
```

Linking flow:
1. User opens bot → `/start` → bot replies with their numeric Chat ID
2. User goes to Settings in the app → pastes Chat ID → clicks Save
3. `POST /api/telegram/link` saves `telegram_chat_id` to their profile

---

## Key Directories

```
src/app/api/
├── ai/
│   ├── chat/              # Streaming AI companion
│   ├── edit-itinerary/    # AI itinerary edits
│   ├── generate-itinerary/# Full itinerary generation
│   ├── recommendations/   # Discover tab suggestions
│   ├── replace-activity/  # Single activity replacement
│   └── trip-story/        # Summary narrative
├── documents/
│   └── import/            # AI document parsing (flights, hotels)
├── places/
│   └── photo/             # Wikipedia + Unsplash photo proxy
├── telegram/
│   ├── link/              # Save chat_id to profile
│   └── webhook/           # grammy bot handler
└── weather/               # Open-Meteo proxy
```

---

## Deployment

- **Platform:** Vercel (serverless functions)
- **DB:** Supabase (managed PostgreSQL)
- **AI:** Groq Cloud API
- **No containers, no crons in Phase 6** — stateless serverless only

See [`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md) for the full deploy guide.
