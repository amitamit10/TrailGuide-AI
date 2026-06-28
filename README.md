# TrailGuide AI

AI-powered travel planner. You tell it where you're going, for how long, and what you're into — it builds a full day-by-day itinerary. Then it follows you on the trip: weather, activity nudges, a Telegram bot, and a photo journal that becomes a shareable memory card when you're back.

**Live demo:** https://trailguide-ai-iota.vercel.app

---

## What it does

You fill out an 8-step wizard (destination, dates, travelers, travel style, interests, transport mode, flights, hotel) and get a complete itinerary with times, costs, durations, and photos for each activity. From there:

- **Edit with plain English** — "swap day 2 and 3" or "add a cooking class on day 4"
- **Replace any activity** — tap replace, get 3 AI alternatives, pick one
- **Import documents** — paste a flight or hotel confirmation, AI pulls out the details
- **Discover tab** — AI suggests nearby places not in your plan
- **Companion** — live weather + what to do next based on your current time
- **Photo journal** — upload a photo per activity, AI writes a caption, it all goes into a summary mosaic
- **Budget tracker** — log expenses, see a breakdown by category, export to CSV
- **Packing list** — AI generates a weather-aware list, shows visa requirements for your destination
- **Culture pack** — local phrases, customs, electricity, emergency numbers, currency converter
- **Telegram bot** — `/next`, `/status`, morning briefing — works without opening the app

When the trip is done: AI writes a short travel story, you export to PDF or calendar, and you can share the whole thing as a public link.

---

## AI

Built with [Claude Code](https://claude.ai/code) (Anthropic's AI coding assistant) and [Groq](https://console.groq.com) for all LLM calls at runtime.

- `llama-3.3-70b-versatile` — itinerary generation, editing, recommendations, culture packs, packing lists, trip stories
- `llama-3.1-8b-instant` — photo captions, companion nudges (faster, cheaper)

No OpenAI. No paid tiers for the AI — Groq's free tier covers normal usage.

---

## Tech stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Go 1.22 (Gin) — auth, trip CRUD, AI proxy
- **AI service:** Python 3.12 (FastAPI) — all the LLM logic
- **Database:** Supabase (Postgres + RLS + Auth)
- **Maps:** Leaflet + OpenStreetMap (no API key needed)
- **Rate limiting:** Upstash Redis
- **Notifications:** Telegram bot (grammy) + Resend email
- **Photos:** Wikipedia API + Unsplash fallback
- **Weather:** Open-Meteo (free, no key)

---

## Running locally

You need Node 20+, Go 1.22+, Python 3.12+, a Supabase project, and a Groq API key.

```bash
git clone https://github.com/amitamit10/TrailGuide-AI.git
cd TrailGuide-AI
npm install
cp .env.local.example .env.local
# fill in .env.local
npm run dev
```

For the full stack (Go backend + Python AI service):

```bash
# Go backend
cd backend && cp .env.example .env && go run main.go

# Python AI service
cd ai-service && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn main:app --port 8081 --reload
```

Run the Supabase migrations in order (`supabase/migrations/001` through `007`) and create an `activity-photos` storage bucket (public).

See [`docs/env-vars.md`](docs/env-vars.md) for all the environment variables.

---

## License

MIT
