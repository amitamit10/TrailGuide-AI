# TrailGuide AI ✈️

AI-powered travel planner that generates personalised itineraries, tracks your trip live, and keeps you updated via Telegram.

---

## Features

| Feature | Description |
|---|---|
| **Trip Wizard** | 8-step wizard: destination, dates, travelers, style, interests, transport mode, flights/hotels |
| **AI Itinerary** | Groq (llama-3.3-70b-versatile) generates a full day-by-day plan with times, costs, and photos |
| **Timeline** | Chronological activity view with check-off, replace, and Google Maps links |
| **Photo Journal** | Upload photos per activity; AI generates captions; photos appear in the summary mosaic |
| **Discover** | AI recommends nearby places not in your itinerary — add them with one tap |
| **Companion** | Live weather, next-activity countdown, and AI nudges while you travel |
| **Summary** | Post-trip stats, AI travel story, shareable link, and downloadable memory card (PNG) |
| **Budget Tracker** | Log expenses by category, visualise spending with a budget bar, export to CSV |
| **Packing List** | AI-generated packing list with weather context; manual add/remove; inline visa requirements |
| **Language & Culture** | AI culture pack: local phrases, customs, emergency numbers, live currency converter |
| **Notifications** | Telegram daily briefing, Resend email pre-trip reminders, automatic trip status transitions |
| **Social / Explore** | Make trips public, share via link, community explore feed, clone others' itineraries |
| **Export** | Download itinerary as PDF, `.ics` calendar file, or send to Google Calendar |
| **Telegram Bot** | `/trip`, `/next`, `/status` commands via @TrailGuideAI_bot |
| **Document Import** | Paste flight/hotel confirmations — AI extracts structured data |
| **Photos** | Real place photos via Wikipedia API, Unsplash fallback |

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

## Agent Harness (Claude Code)

This repo is configured for autonomous development with [Claude Code](https://claude.ai/code). The harness auto-loads context at session start and enforces a consistent workflow across sessions.

### How it works

`CLAUDE.md` (repo root) is the harness entry point. Claude Code reads it at the start of every session and `@`-imports the following files into the agent's context:

| File | Purpose |
|---|---|
| `AGENTS.md` | Multi-service architecture guide — which service owns what, auth patterns, security conventions |
| `CHANGELOG.md` | Phase status table and full history — the agent knows what's done and what's planned |
| `.claude/AFTER_EACH_PHASE.md` | Checklist the agent runs automatically after completing any phase |
| `.claude/DEPLOY_CHECKLIST.md` | Deploy steps referenced during infrastructure phases |
| `.claude/TOKEN_EFFICIENCY.md` | Rules for minimising context usage (Grep before Read, batch calls, etc.) |
| `docs/env-vars.md` | Every env var — the agent knows all variable names without grepping |
| `docs/architecture.md` | DB schema, service boundaries, API pipeline — loaded upfront to avoid mid-task file reads |

### Branch workflow

The harness runs each task on an isolated feature branch (e.g. `claude/some-task-abc123`). Changes are committed and pushed to that branch; a PR is created when the user asks for one. The agent never pushes directly to `main`.

### Adding new context

To make the agent aware of new conventions without a prompt:
1. Write the rule in a file under `.claude/` or `docs/`
2. Add an `@` reference to it in `CLAUDE.md`

It will be injected into every future session automatically.

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
