# TrailGuide AI — Design Spec
*2026-06-16*

## Product Summary

TrailGuide AI is an AI-first travel planning and trip companion web app. It replaces ChatGPT + Google Maps + TripAdvisor + Booking.com + notes apps with one seamless experience. Users plan a full trip via AI conversation, get a generated itinerary, manage it on a dashboard, then use it as a live guide during the trip. Telegram delivers real-time notifications.

Tagline: **Your Personal AI Travel Planner & Trip Companion**

---

## Tech Stack

> **Note (updated 2026-06-17):** Several choices changed during implementation. Actual stack is listed below.

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack) + TypeScript | Full-stack in one repo, Vercel deploy |
| Styling | Tailwind CSS v4 (CSS-first config) | Speed + consistency; shadcn/ui not used |
| Database | Supabase (PostgreSQL) | Auth + storage + RLS included |
| AI | Groq — llama-3.3-70b-versatile / llama-3.1-8b-instant | Free tier, fast, no Gemini billing needed |
| Search | Tavily API | Web search for AI recommendations |
| Photos | Wikipedia API (free) + Unsplash (fallback) | Google Places requires billing |
| Maps | Leaflet + OpenStreetMap (interactive); Google Maps deep-links for navigation | No API key needed for OSM |
| Notifications | Telegram Bot via grammy (webhook on `/api/telegram/webhook`) | User requirement |
| Document import | Groq text parsing | PDF text sent as prompt; no separate PDF library |
| Weather | Open-Meteo API (free, no key) | Companion + dashboard |
| Deployment | Vercel + Supabase | Zero-ops |

---

## Design System

Visual language derived from mockups:

- **Colors**: White/cream (`#FAFAF8`) backgrounds, forest green (`#2D6A4F`) accents, warm neutral cards (`#F5F0E8`), light gray text hierarchy
- **Typography**: Inter or Plus Jakarta Sans — clean, premium weight contrast
- **Cards**: Rounded corners (`rounded-2xl`), soft shadows (`shadow-sm`), large hero images
- **Spacing**: Generous padding, breathable layouts — never crowded
- **Glassmorphism**: Used sparingly on overlays (live companion nudges, navigation HUD)
- **Mobile-first**: All screens designed for 390px width, responsive to desktop

Avoid: corporate SaaS blue, dense dashboards, small text, icon overload.

---

## Screen Map (15 Screens)

### Flow 1 — Onboarding & Trip Creation

**1. Welcome Screen**
- Full-bleed destination photo background
- "TrailGuide AI" wordmark + tagline
- "Start Planning" primary CTA
- "Sign In" secondary link
- Subtle animation on load

**2. AI Travel Planning Chat**
- Full-screen chat interface, clean like iMessage
- AI opens: "Where are you dreaming of going?"
- Asks one question at a time: destination → dates → travelers → ages → budget → travel style → interests → flights booked? → hotels booked?
- User can type or tap quick-reply chips ("Beach lover", "History buff", "Foodie", etc.)
- Progress indicator showing how far through setup
- When complete: "Perfect! Generating your itinerary..." transition

**3. Document Import Screen**
- Drop zone for PDFs, screenshots, images
- Supported types: flight confirmations, hotel bookings, Airbnb reservations
- Gemini extracts: flight number, departure/arrival airports, times, hotel name, address, check-in/out times, reservation numbers
- User reviews extracted details in editable cards before confirming
- Can skip entirely

### Flow 2 — Itinerary Views

**4. Itinerary Timeline View**
- Vertical scrolling timeline, grouped by day
- Each day has a header (Day 1 — Monday, June 20)
- Activity cards show: time, title, location, duration, category icon, photo thumbnail
- "Add activity" button between slots
- AI edit bar at bottom: type to modify ("make tomorrow more relaxed")
- Animated re-generation when AI updates itinerary

**5. Calendar View**
- Monthly grid
- Days with activities show a colored dot + count badge
- Tap a day to expand into a mini-timeline below the grid
- Visual overview of the full trip duration

**6. Interactive Map View**
- Full-screen Google Map
- All activities pinned with numbered markers (matching day/order)
- Tap pin → bottom sheet slides up with activity details
- Day filter chips at top to show/hide specific days
- Route lines connecting the day's activities in order

### Flow 3 — Trip Dashboard

**7. Trip Dashboard**
- User's home screen once a trip is created
- Top: countdown ("3d 14h 55m until your trip")
- Flight card: airline, flight number, departure/arrival, gate (when available)
- Today's weather at destination
- Today's itinerary preview (next 3 activities)
- Hotel card: name, check-in date, address
- Budget tracker: spent (sum of completed activities' estimated_cost) vs. budget_total, category breakdown
- Quick nav: Timeline | Map | Discover | Companion

### Flow 4 — Discovery & Details

**8. Discovery Screen**
- Search bar at top
- Category filter pills: Restaurants | Museums | Parks | Nightlife | Shopping | Hidden Gems
- Card grid of places near destination
- Each card: photo, name, rating, category, distance, price range
- Infinite scroll

**9. Search & Filters**
- Full-screen filter panel
- Rating: slider (3.0 – 5.0)
- Budget: $ / $$ / $$$ / $$$$
- Category: multi-select
- Tags: Family-friendly | Accessible | Hidden gem | Luxury | Quiet | Local only
- Distance: within X km from hotel
- Results update live

**10. AI Recommendations Screen**
- Curated list of AI-picked places with explanation cards
- Each card: place name, photo, rating, and a 1-2 sentence AI explanation
  - "Selected because it's rated 4.8★, 4 min walk from your next stop, and matches your preference for authentic local food."
- "Add to itinerary" on each card

**11. Attraction Details Page**
- Large hero image (full-width)
- Scrollable photo gallery
- Name, category badge, star rating, review count
- Tabs: Overview | Details | Reviews
- Info chips: opening hours, estimated visit time, entry cost, website
- "Add to Itinerary" sticky CTA at bottom
- Nearby places section
- Google Maps embedded mini-map

**12. Hotel Details Page**
- Same layout as attraction but hotel-specific
- Check-in / check-out dates and times
- Confirmation number
- Amenities list
- Address + map pin
- Link to booking confirmation

### Flow 5 — Live Trip

**13. Live Trip Companion**
- Activates automatically on trip start date
- Top: current time + next activity countdown
- Gemini nudge cards (glassmorphism overlay style):
  - "Leave in 15 minutes to arrive on time"
  - "You're near a 4.9★ bakery — want to add a quick stop?"
  - "Rain expected at 4pm — I've moved the outdoor walk to tomorrow"
- Weather widget
- Quick-action buttons: Navigate | Call taxi | Skip activity

**14. Navigation Screen**
- Full-screen Google Map in directions mode
- Step-by-step instruction banner at top
- Mode toggle: Walking | Transit | Taxi estimate
- Travel time + distance
- Auto-advances to next step
- "Arrived" confirmation

### Flow 6 — Trip Completion

**15. Trip Summary**
- Beautiful post-trip recap card
- Stats: cities visited, attractions completed, km walked, days traveled
- Timeline of completed activities with photos
- AI-generated travel story (2-3 paragraphs, Gemini)
- Shareable: image export via `html2canvas` + download, or public link via a `/share/[tripId]` read-only route

---

## AI Integration (Groq)

> **Note (updated 2026-06-17):** Gemini was replaced by Groq during Phase 1. `GeminiService` class name was kept in `src/lib/ai.ts` as a historical artefact. All AI now runs through Groq.

### GeminiService — implemented modes

**1. Planning Chat** (`/api/ai/chat`)
- Multi-turn conversation, system prompt = "You are a professional travel agent..."
- Conversation history in component state (not persisted to DB)
- Quick-reply chips suggested by the model

**2. Itinerary Generation** (`/api/ai/generate-itinerary`)
- Input: full trip config from wizard
- Model: `llama-3.3-70b-versatile`, `max_tokens: 8192`
- Output: structured JSON array of days → activities
- Stored in DB, never re-generated on page load

**3. Itinerary Editing** (`/api/ai/edit-itinerary`)
- Input: current itinerary JSON + natural language edit command
- Output: modified itinerary JSON

**4. Activity Replacement** (`/api/ai/replace-activity`)
- Model: `llama-3.1-8b-instant` (fast)
- Returns 3 alternative activity objects

**5. Trip Story** (`/api/ai/trip-story`)
- Model: `llama-3.3-70b-versatile`, `max_tokens: 400`, `temperature: 0.85`
- Returns 2-3 paragraph travel narrative for the Summary page

**6. Recommendations** (`/api/ai/recommendations`)
- Uses Tavily web search + Groq synthesis
- Powers the Discover tab

### Document Import
- User pastes text content of booking confirmation
- Groq extracts structured fields (flight number, times, hotel name, etc.)
- Results pre-fill trip info fields

---

## Data Model (Supabase)

```sql
-- Supabase Auth handles users table
-- Extended via profiles table:
profiles (
  id uuid references auth.users,
  telegram_chat_id text,
  full_name text,
  avatar_url text,
  default_currency text default 'USD'
)

trips (
  id uuid primary key,
  user_id uuid references profiles,
  title text,
  destination text,
  destination_lat float,
  destination_lng float,
  departure_city text,
  start_date date,
  end_date date,
  travelers_count int,
  budget_total numeric,
  budget_currency text,
  travel_style text,  -- 'relaxed' | 'packed' | 'balanced'
  interests text[],
  status text,  -- 'planning' | 'active' | 'completed'
  created_at timestamptz
)

itinerary_days (
  id uuid primary key,
  trip_id uuid references trips,
  day_number int,
  date date,
  notes text
)

activities (
  id uuid primary key,
  day_id uuid references itinerary_days,
  trip_id uuid references trips,
  title text,
  description text,
  category text,  -- 'food' | 'attraction' | 'transport' | 'hotel' | 'flight' | 'free'
  start_time time,
  end_time time,
  duration_minutes int,
  location_name text,
  address text,
  lat float,
  lng float,
  estimated_cost numeric,
  photo_url text,
  rating float,
  notes text,
  is_completed boolean default false,
  sort_order int
)

documents (
  id uuid primary key,
  trip_id uuid references trips,
  type text,  -- 'flight' | 'hotel' | 'airbnb' | 'other'
  file_url text,
  extracted_json jsonb,
  created_at timestamptz
)

chat_messages (
  id uuid primary key,
  trip_id uuid references trips,
  role text,  -- 'user' | 'model'
  content text,
  created_at timestamptz
)

companion_nudges (
  id uuid primary key,
  trip_id uuid references trips,
  type text,  -- 'timing' | 'discovery' | 'weather' | 'navigation'
  message text,
  action_label text,
  action_data jsonb,
  sent_at timestamptz,
  dismissed_at timestamptz
)
```

Row-level security on all tables — users can only access their own data.

---

## Telegram Bot

- Framework: `grammy` running as webhook on `/api/telegram/webhook`
- Bot registered via BotFather, webhook URL set to Vercel deployment URL
- User links their Telegram account inside the app settings (sends `/start` to bot → bot stores `chat_id` on their profile)

**Notification types:**
- Pre-trip reminders (24h before, day-of)
- Live companion nudges (forwarded from Gemini companion mode)
- Weather alerts
- "Time to leave for [next activity]" reminders
- Trip summary share

**Bot commands:**
- `/start` — link account
- `/trip` — show today's itinerary
- `/next` — show next activity
- `/status` — trip countdown

---

## Build Phases

> **Note (updated 2026-06-17):** Phases 1-5 are complete. Phases 6-11 were added.

### Phase 1 — Foundation ✅
- Next.js project setup, Supabase schema, auth
- Welcome screen + auth flow (email + Google OAuth)
- AI Chat + trip creation wizard (8 steps)
- Basic itinerary generation + timeline view

### Phase 2 — Core Views ✅
- Calendar view + map view (Leaflet/OSM)
- Trip dashboard
- Document import (Groq text parsing)

### Phase 3 — Discovery ✅
- AI recommendations (Tavily + Groq)
- Wikipedia + Unsplash photos
- Activity detail sheets, replace activity

### Phase 4 — Live Trip ✅
- Companion mode (weather, countdown, AI nudges)
- Navigation (Google Maps deep-link)
- Telegram bot + account linking

### Phase 5 — Summary ✅
- Trip summary screen (stats + AI story + share + PNG export)
- Photo lightbox
- Animations + `animate-fade-up`, `animate-sheet-in`

### Phase 6 — Deploy 🚀
- Vercel production deploy
- Supabase production project
- Telegram webhook registration

### Phase 7 — Notifications (Planned)
- Resend email digests
- Vercel Cron daily briefings
- Activity check-off sync

### Phase 8 — Budget Tracker (Planned)
- `expenses` table, CRUD API, CSV export

### Phase 9 — Packing List (Planned)
- AI packing list generator, Tavily visa check

### Phase 10 — Social (Planned)
- Public explore page, clone-a-trip, photo mosaic

### Phase 11 — Documentation ✅
- README, architecture.md, api-reference.md, env-vars.md, telegram-bot.md, .env.local.example

### Phase 12 — Security Hardening (Planned)
- Auth guards on `recommendations` and `trip-story` routes (missing in Phases 3-5)
- Next.js middleware for session refresh + auth redirect
- HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Clean up image allowlist (remove unused Google Maps entry)

### Phase 13 — Rate Limiting & Caching (Planned)
- Upstash Redis sliding-window rate limit on all AI routes (10 req/min per user)
- CDN cache headers on weather route (1 hour) and photo proxy (24 hours)

### Phase 14 — PWA & Offline Mode (Planned)
- Web app manifest — installable on Android and iOS home screen
- Serwist service worker — pre-caches app shell, runtime-caches trip timeline
- Offline fallback page with cached timeline access

### Phase 15 — Trip Export & Calendar Integration (Planned)
- iCal export (`/api/trips/[id]/export/ical`) — compatible with Google Calendar, Apple Calendar, Outlook
- Google Calendar deep-link (no OAuth needed)
- PDF itinerary download via `jsPDF` (client-side, multi-page)

### Phase 16 — Go Backend (Planned)
- Standalone Go REST API (`backend/` directory): Gin router, pgx v5 for direct PostgreSQL, JWT validation middleware (Supabase HS256 tokens)
- CRUD handlers: trips, days, activities, profiles
- Telegram webhook handler in pure Go (no library) — replaces grammy
- AI proxy: `GET/POST /api/v1/ai/*` forwarded to Python service with internal token
- Replaces all Next.js data API routes

### Phase 17 — Python AI Service (Planned)
- Standalone FastAPI service (`ai-service/` directory): all AI operations via Groq Python SDK
- Routes: generate-itinerary, chat (streaming), recommendations (Tavily+Groq), replace-activity, trip-story, edit-itinerary, document import, photo proxy (Wikipedia+Unsplash), weather proxy (Open-Meteo)
- Internal token auth (`X-Internal-Token` header) — not exposed to the public internet
- No database access — pure AI/HTTP service

### Phase 18 — Frontend Migration (Planned)
- Strip Next.js to pure frontend: remove all `src/app/api/` routes
- Create `src/lib/api.ts` typed API client — injects Supabase JWT as Bearer token on all Go backend calls
- Update all components to fetch from Go backend (`NEXT_PUBLIC_API_URL`) instead of Supabase directly
- Keep only Supabase Auth (login/signup/callback) in Next.js

### Phase 19 — Infrastructure & Deployment (Planned)
- Multi-stage Dockerfiles for Go backend (alpine, <25 MB) and Python AI service (slim)
- `docker-compose.yml` for local dev: `docker compose up backend ai-service`
- `Dockerfile.web` for Next.js standalone build
- GitHub Actions CI: 4 jobs (Go build+vet, Python imports, Next.js type-check+build, Docker builds)
- Production: Railway for Go + Python, Vercel for Next.js (unchanged)

---

## Key Technical Decisions

> **Note (updated 2026-06-17):** Decisions #1 and #3 changed during implementation.

1. **All AI calls server-side only** — Groq API key never exposed to client. All AI routes are Next.js API routes.
2. **Itinerary stored as structured data** — not markdown. Enables editing, filtering, map rendering.
3. **Wikipedia API for photos (not Google Places)** — Google Places requires billing. Wikipedia API is free and returns real place photos. Unsplash is the fallback. The photo proxy returns image bytes (not a redirect) so html2canvas can capture them without CORS errors.
4. **Telegram webhook not polling** — grammy webhook mode in production. Local dev uses `scripts/telegram-poll.mjs` (long-poll → forward to localhost). Simpler on Vercel.
5. **RLS everywhere** — Supabase row-level security on all tables from day one. Two client patterns: `createClient()` (respects RLS, for authenticated routes) and `createServiceClient()` (bypasses RLS, for Telegram webhook + public share page).
6. **Leaflet + OSM for maps, Google Maps deep-links for navigation** — Leaflet/OpenStreetMap requires no API key. Navigation delegates to Google Maps via `window.location.href` deep-link.
