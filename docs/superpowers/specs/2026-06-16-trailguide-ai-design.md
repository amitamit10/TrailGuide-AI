# TrailGuide AI — Design Spec
*2026-06-16*

## Product Summary

TrailGuide AI is an AI-first travel planning and trip companion web app. It replaces ChatGPT + Google Maps + TripAdvisor + Booking.com + notes apps with one seamless experience. Users plan a full trip via AI conversation, get a generated itinerary, manage it on a dashboard, then use it as a live guide during the trip. Telegram delivers real-time notifications.

Tagline: **Your Personal AI Travel Planner & Trip Companion**

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) + TypeScript | Full-stack in one repo, Vercel deploy |
| Styling | Tailwind CSS + shadcn/ui | Speed + consistency |
| Database | Supabase (PostgreSQL) | Auth + storage + real-time included |
| AI | Google Gemini 1.5 Pro | User preference |
| Maps | Google Maps JS API + Places + Directions | Pairs with Gemini, best coverage |
| Notifications | Telegram Bot via grammy (webhook on `/api/telegram/webhook`) | User requirement |
| PDF parsing | pdf-parse + Gemini vision for screenshots | Document import |
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

## AI Integration (Gemini 1.5 Pro)

### GeminiService — 4 modes

**1. Planning Chat** (`/api/ai/chat`)
- Multi-turn conversation, system prompt = "You are a professional travel agent..."
- Maintains conversation history in Supabase (`chat_messages` table)
- When all required fields collected → returns structured `TripConfig` JSON
- Triggers itinerary generation

**2. Itinerary Generation** (`/api/ai/generate-itinerary`)
- Input: full `TripConfig` + any imported document data
- Output: structured JSON array of days → activities
- Each activity includes: title, description, time, duration, location, lat/lng, category, estimated_cost, photo_query (for Google Places image lookup)
- Stored in DB, never re-generated on page load

**3. Itinerary Editing** (`/api/ai/edit-itinerary`)
- Input: current itinerary JSON + natural language edit command
- Output: modified itinerary JSON
- Diff applied with animation in the UI

**4. Live Companion** (`/api/ai/companion`)
- Called every 15 minutes during active trip (via client-side polling)
- Input: current time, GPS coordinates, next activity, weather API data
- Output: 0-3 nudge objects `{type, message, action?}`
- Nudges shown in UI + sent via Telegram

### Document Import (Gemini Vision)
- PDF text extracted via `pdf-parse`, images sent directly to Gemini vision
- Prompt: "Extract all travel booking information from this document. Return JSON with fields: type, flight_number, departure_airport, arrival_airport, departure_time, arrival_time, airline, hotel_name, hotel_address, check_in, check_out, confirmation_number"
- Results stored in `documents.extracted_json`

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

### Phase 1 — Foundation (Week 1)
- Next.js project setup, Supabase schema, auth
- Welcome screen + auth flow
- AI Chat + trip creation
- Basic itinerary generation + timeline view
- Git commits after each

### Phase 2 — Core Views (Week 2)
- Calendar view + map view
- Trip dashboard
- Document import
- Attraction + hotel detail pages

### Phase 3 — Discovery (Week 3)
- Discovery screen
- Search & filters
- AI recommendations
- Places API integration

### Phase 4 — Live Trip (Week 4)
- Live companion mode
- Navigation screen
- Telegram bot + notifications
- Companion polling + nudges

### Phase 5 — Polish (Week 5)
- Trip summary screen
- Animations + transitions
- Mobile responsiveness pass
- Performance + error handling

---

## Key Technical Decisions

1. **All AI calls server-side only** — Gemini API key never exposed to client. All AI routes are Next.js API routes.
2. **Itinerary stored as structured data** — not markdown. Enables editing, filtering, map rendering.
3. **Google Places API for photos** — activities get a `photo_query` field, photos fetched client-side from Places to avoid storing images.
4. **Telegram webhook not polling** — grammy webhook mode, no long-polling. Simpler on Vercel.
5. **RLS everywhere** — Supabase row-level security on all tables from day one.
6. **Optimistic UI** — itinerary edits show immediately, Gemini response patches in when ready.
