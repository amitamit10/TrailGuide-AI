# TrailGuide AI ✈️

AI-powered travel planner that generates personalised itineraries, tracks your trip live, and keeps you updated via Telegram.

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
| **Public Sharing** | Share any trip via a public link — no login required to view |

---

## Tech Stack

- **Framework:** Next.js 16.2.9 (App Router, Turbopack)
- **Language:** TypeScript 5, React 19
- **Styling:** Tailwind CSS v4 (CSS-first config), Plus Jakarta Sans font
- **Auth + DB:** Supabase (PostgreSQL + RLS + Auth)
- **AI:** Groq SDK — `llama-3.3-70b-versatile` for planning, `llama-3.1-8b-instant` for fast tasks
- **Search:** Tavily API (web search for recommendations)
- **Photos:** Wikipedia API (free, no key) + Unsplash API (fallback)
- **Telegram:** grammy v1 webhook handler
- **Maps:** Leaflet + OpenStreetMap (no API key needed), Google Maps deep-links for navigation
- **Weather:** Open-Meteo (free, no key needed)
- **Export:** html2canvas (summary card PNG download)

---

## Local Setup

### Prerequisites

- Node.js 18+ via [nvm](https://github.com/nvm-sh/nvm)
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key
- A [Tavily](https://tavily.com) API key
- An [Unsplash](https://unsplash.com/developers) Access Key (optional)
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (optional)

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

In **Supabase Dashboard → SQL Editor**, run in order:

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

Long-polls Telegram and forwards updates to `localhost:3000/api/telegram/webhook`. See [`docs/telegram-bot.md`](docs/telegram-bot.md).

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
│   ├── (auth)/             # Login / signup / OAuth callback
│   ├── api/                # Server-side API routes (AI, photos, Telegram, weather)
│   └── share/[tripId]/     # Public trip view (no auth required)
├── components/             # React components
├── lib/
│   ├── ai.ts               # Groq wrapper (GeminiService class)
│   └── supabase/           # client.ts + server.ts
└── types/                  # Shared TypeScript types
supabase/
└── migrations/             # SQL migration files (run in order)
docs/                       # Architecture, API reference, guides
scripts/                    # Local dev utilities (Telegram polling)
```

---

## Documentation

| Doc | What's in it |
|-----|-------------|
| [`docs/architecture.md`](docs/architecture.md) | DB schema, auth flow, AI pipeline, photo pipeline |
| [`docs/api-reference.md`](docs/api-reference.md) | All API routes with request/response shapes |
| [`docs/env-vars.md`](docs/env-vars.md) | Every environment variable and where to get it |
| [`docs/telegram-bot.md`](docs/telegram-bot.md) | Bot setup, linking flow, commands |
| [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) | Step-by-step production deploy guide |

---

## Deployment

See [`DEPLOY_CHECKLIST.md`](DEPLOY_CHECKLIST.md) for the full guide. The short version:

1. Run Supabase migrations
2. Push to GitHub
3. Import repo in [Vercel](https://vercel.com) → add env vars → deploy
4. Add production URL to Supabase Redirect URLs
5. Register Telegram webhook (one browser request)

---

## License

MIT
