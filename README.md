# TrailGuide AI ✈️

**TrailGuide AI is a full-stack AI travel planner.** You describe your trip — destination, dates, travel style, interests — and it builds a complete day-by-day itinerary in seconds. From there it travels with you: live weather, activity nudges, a Telegram bot for quick updates, and a photo journal that turns into a shareable memory card when you get home.

It's built for real trips, not demo apps. The backend is a three-service architecture (Next.js + Go + Python) with Supabase for auth and data, Groq for all AI, and a full suite of trip management tools: budget tracking, packing lists, visa info, currency conversion, local culture guides, document import, and community trip sharing.

---

## Features

### Planning
| Feature | What it does |
|---|---|
| **Trip Wizard** | 8-step setup: destination, dates, travelers, style, interests, transport, flights, hotel |
| **AI Itinerary** | Generates a full day-by-day plan with activity times, costs, durations, and place photos |
| **AI Edit** | Reshape the itinerary with a plain-English command ("swap day 2 and 3", "add a cooking class") |
| **Document Import** | Paste a flight or hotel confirmation — AI extracts the structured details automatically |
| **Packing List** | AI builds a weather-aware packing list; add/remove items manually; shows visa requirements |
| **Language & Culture** | Local phrases, customs, electricity, water safety, emergency numbers, visa summary |
| **Currency Converter** | Live exchange rates with a built-in converter on the culture page |

### During the Trip
| Feature | What it does |
|---|---|
| **Timeline** | Chronological activity view; tap to complete, replace, or open in Google Maps |
| **Discover** | AI suggests nearby places not in your itinerary — add them with one tap |
| **Companion** | Live weather, next-activity countdown, and AI nudges based on your current time |
| **Photo Journal** | Upload photos per activity; AI writes a caption; photos appear in the summary mosaic |
| **Map View** | All activities on an interactive Leaflet map with OpenStreetMap tiles |
| **Calendar View** | Day-by-day calendar layout of the full itinerary |

### After the Trip
| Feature | What it does |
|---|---|
| **Summary** | Stats, AI-written travel story, and a shareable memory card |
| **Export** | Download as PDF, `.ics` calendar file, or send to Google Calendar |
| **Public Sharing** | Make a trip public — anyone can view it via a link, no login required |

### Budget & Organisation
| Feature | What it does |
|---|---|
| **Budget Tracker** | Log expenses by category; budget bar; export to CSV |
| **Social / Explore** | Community feed of public trips; clone any trip into your own account |

### Notifications
| Feature | What it does |
|---|---|
| **Telegram Bot** | `/trip`, `/next`, `/status` — check your trip without opening the app |
| **Morning Briefing** | Telegram message every morning with today's full activity list |
| **Email Reminders** | Resend email 3 days and 1 day before departure |
| **Auto Status** | Trip automatically transitions `planning → active → completed` based on dates |

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16.2.9 (App Router, Turbopack)
- **Language:** TypeScript 5, React 19
- **Styling:** Tailwind CSS v4 (CSS-first config), Plus Jakarta Sans font
- **Maps:** Leaflet + OpenStreetMap (no API key), Google Maps deep-links for navigation
- **Export:** html2canvas (PNG), jsPDF (PDF), iCalendar (`.ics`)

### Backend
- **API Server:** Go 1.22 (Gin) — trip CRUD, JWT auth middleware, AI proxy to Python service
- **AI Service:** Python 3.12 (FastAPI) — all LLM logic (Groq), document parsing, place photos, weather
- **Auth + DB:** Supabase (PostgreSQL + RLS + Auth)
- **Rate Limiting:** Upstash Redis (`@upstash/ratelimit`)

### AI & External APIs
- **AI:** Groq SDK — `llama-3.3-70b-versatile` for planning, `llama-3.1-8b-instant` for fast tasks
- **Search:** Tavily API (web search for recommendations and visa info)
- **Photos:** Wikipedia API (free, no key) + Unsplash API (fallback)
- **Weather:** Open-Meteo (free, no key needed)
- **Currency:** open.er-api.com (free, no key needed)
- **Email:** Resend (pre-trip reminders)
- **Telegram:** grammy v1 webhook handler

---

## Local Setup

> The full stack runs three services: Next.js frontend, Go backend, and Python AI service.
> For a quick frontend-only start (reduced AI functionality), skip steps 5–6.

### Prerequisites

- Node.js 20+ via [nvm](https://github.com/nvm-sh/nvm)
- Go 1.22+ (`go version`)
- Python 3.12+ (`python3 --version`)
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key
- A [Tavily](https://tavily.com) API key
- An [Unsplash](https://unsplash.com/developers) Access Key (optional)
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (optional)
- An [Upstash](https://console.upstash.com) Redis database (optional — for rate limiting)

### 1. Clone and install

```bash
git clone https://github.com/amitamit10/TrailGuide-AI.git
cd TrailGuide-AI
nvm use   # or: nvm install 20
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in the values — see [`docs/env-vars.md`](docs/env-vars.md) for details on each key.

### 3. Set up Supabase

In **Supabase Dashboard → SQL Editor**, run all migrations in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_phase4_columns.sql
supabase/migrations/003_expenses.sql
supabase/migrations/004_checklist.sql
supabase/migrations/005_public_trips.sql
supabase/migrations/006_activity_photos.sql
supabase/migrations/007_culture_currency_cache.sql
```

In **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

In **Storage**: create an `activity-photos` bucket (Public: ON).

### 4. Start the Next.js frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the Go backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_JWT_SECRET, INTERNAL_API_SECRET, AI_SERVICE_URL
go mod tidy
go run main.go
# Listening on :8080
```

### 6. Start the Python AI service

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in GROQ_API_KEY, TAVILY_API_KEY, UNSPLASH_ACCESS_KEY, INTERNAL_API_SECRET
uvicorn main:app --port 8081 --reload
# Listening on :8081
```

### 7. (Optional) Telegram bot — local polling

```bash
node scripts/telegram-poll.mjs
```

Long-polls Telegram and forwards updates to `localhost:3000/api/telegram/webhook`. No ngrok needed. See [`docs/telegram-bot.md`](docs/telegram-bot.md).

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes
│   │   ├── dashboard/      # Trip list
│   │   ├── explore/        # Community itineraries feed
│   │   ├── settings/       # Account + Telegram link
│   │   └── trips/
│   │       ├── new/        # 8-step wizard
│   │       ├── review/     # Pre-save itinerary review
│   │       └── [id]/       # Per-trip tabs
│   │           ├── timeline/   # Activities + photo journal
│   │           ├── companion/  # Live AI companion + weather
│   │           ├── discover/   # AI recommendations
│   │           ├── summary/    # Stats + story + export + share
│   │           ├── calendar/   # Calendar view
│   │           ├── map/        # Leaflet map
│   │           ├── import/     # Document import
│   │           ├── expenses/   # Budget tracker
│   │           ├── pack/       # Packing list + visa info
│   │           └── info/       # Language & culture toolkit
│   ├── (auth)/             # Login / signup / OAuth callback
│   ├── api/                # Next.js API routes
│   └── share/[tripId]/     # Public trip view (no auth required)
├── components/             # React components
├── lib/
│   ├── ai.ts               # Groq wrapper (GeminiService)
│   ├── backend-proxy.ts    # Go backend proxy helper
│   ├── ratelimit.ts        # Upstash rate limiting helpers
│   └── supabase/           # client.ts + server.ts
└── types/                  # Shared TypeScript types
backend/                    # Go 1.22 (Gin) API server
├── handlers/               # HTTP handlers (trips, AI proxy)
├── middleware/             # JWT auth middleware
└── config/                 # Typed env config
ai-service/                 # Python 3.12 (FastAPI) AI service
├── routers/                # Route handlers (generate, chat, photos, etc.)
└── middleware/             # Internal token auth
supabase/
└── migrations/             # SQL migration files (001–007, run in order)
docs/                       # Architecture, API reference, guides
scripts/                    # Local dev utilities
```

---

## AI Agent

TrailGuide AI is built around a Groq-powered agent that helps plan, adapt, and narrate your trip — and keeps you updated via Telegram while you travel.

### Groq (the brain)

All LLM work runs through [Groq](https://console.groq.com) using two models:

| Model | Used for |
|---|---|
| `llama-3.3-70b-versatile` | Itinerary generation, editing, recommendations, culture packs, packing lists, trip stories |
| `llama-3.1-8b-instant` | Fast tasks: photo captions, companion nudges |

The agent has several modes depending on what stage of the trip you're in:

**Before the trip — Planning agent**
- Generates a full day-by-day itinerary from an 8-step wizard (destination, dates, style, interests, transport, budget)
- Edits the itinerary via natural language commands ("move the museum to day 3")
- Suggests nearby alternatives for any activity
- Builds a weather-aware packing list
- Generates a culture pack: local phrases, customs, emergency numbers, visa summary

**During the trip — Companion agent**
- Streams a live AI chat companion with trip context baked into every message
- Suggests what to do next based on current time and location
- Proactively pushes daily briefings via Telegram each morning

**After the trip — Memory agent**
- Writes a 2–3 paragraph travel narrative from your completed activities
- Generates captions for uploaded photos

### Telegram (the notification channel)

The Telegram bot (`@TrailGuideAI_bot`) is the agent's async interface — it reaches you without needing the app open.

**Commands:**

| Command | What it does |
|---|---|
| `/start` | Returns your Chat ID for account linking |
| `/trip` | Lists your upcoming trips |
| `/next` | Shows the next scheduled activity on your active trip |
| `/status` | Shows all remaining activities for today |

**Scheduled pushes (cron jobs):**

| Time | What gets sent |
|---|---|
| 7am daily | Telegram briefing with today's full activity list (active trips only) |
| 8am daily | Email reminder via Resend — 3 days and 1 day before trip start |
| 6am daily | Automatic trip status transitions: `planning → active → completed` |

**Linking your account:**
1. Message the bot → `/start` → copy your Chat ID
2. Open the app → Settings → paste Chat ID → Save
3. Bot commands and morning briefings now work

See [`docs/telegram-bot.md`](docs/telegram-bot.md) for setup and local dev instructions.

| Doc | What's in it |
|-----|-------------|
| [`docs/architecture.md`](docs/architecture.md) | DB schema, auth flow, AI pipeline, Go backend, Python service |
| [`docs/api-reference.md`](docs/api-reference.md) | All API routes with request/response shapes |
| [`docs/env-vars.md`](docs/env-vars.md) | Every environment variable and where to get it |
| [`docs/telegram-bot.md`](docs/telegram-bot.md) | Bot setup, linking flow, commands |
| [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) | Step-by-step production deploy guide |
| [`SUDO_COMMANDS.md`](SUDO_COMMANDS.md) | System-level setup: Go, Docker, env wiring |

---

## Deployment

See [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) for the full guide. The short version:

1. Run all 7 Supabase migrations
2. Create the `activity-photos` Storage bucket (Public)
3. Push to GitHub — Vercel auto-deploys
4. Add all env vars in Vercel → Settings → Environment Variables
5. Add production URL to Supabase Redirect URLs
6. Register the Telegram webhook (one browser request)
7. (Optional) Deploy Go backend and Python AI service to Railway

---

## License

MIT
