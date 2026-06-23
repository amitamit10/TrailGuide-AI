# Things To Do Before Deploy

## 1. Supabase — Run All Migrations

Run all migration files in order via Supabase SQL Editor (Dashboard → SQL Editor):

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_phase4_columns.sql`
- `supabase/migrations/003_expenses.sql`
- `supabase/migrations/004_checklist.sql`
- `supabase/migrations/005_public_trips.sql`
- `supabase/migrations/006_activity_photos.sql`
- `supabase/migrations/007_culture_currency_cache.sql`

"Already exists" warnings are fine — migrations use `IF NOT EXISTS` guards.

## 2. Supabase Storage — Create Bucket

In Supabase Dashboard → Storage → New bucket:
- **Name:** `activity-photos`
- **Public:** ON (required for thumbnail URLs)

## 3. Environment Variables

Add all of these to Vercel → Settings → Environment Variables (Production + Preview + Development):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GROQ_API_KEY=
TAVILY_API_KEY=

# Photos (optional but recommended)
UNSPLASH_ACCESS_KEY=

# Notifications
RESEND_API_KEY=
CRON_SECRET=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
TELEGRAM_WEBHOOK_SECRET=

# Rate limiting (recommended)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Go backend (if deploying)
BACKEND_URL=https://your-go-backend.railway.app

# Production URL
NEXT_PUBLIC_SITE_URL=https://yourapp.vercel.app
```

## 4. Supabase Auth — Add Production URL

In Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to your production domain (e.g. `https://yourapp.vercel.app`)
- Add to **Redirect URLs**: `https://yourapp.vercel.app/**`

## 5. Register the Telegram Webhook

After deploying, run this once (browser or curl):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Replace `<TOKEN>`, `yourapp.vercel.app`, and `<TELEGRAM_WEBHOOK_SECRET>` with real values.
The `secret_token` param enables webhook verification. After this, `scripts/telegram-poll.mjs` is no longer needed.

## 6. Google OAuth (if using Sign in with Google)

In Google Cloud Console → OAuth 2.0 → Authorized redirect URIs, add:
```
https://yourapp.vercel.app/auth/callback
```

## 7. Cron Jobs (automatic)

Vercel reads `vercel.json` and registers crons automatically on deploy.
Verify: Vercel Dashboard → Project → Settings → Cron Jobs

Expected cron jobs:
- `advance-trip-status` — 6am daily
- `daily-briefing` — 7am daily
- `pre-trip-reminder` — 8am daily

## 8. (Optional) Deploy Go Backend + Python AI Service

Both services have Dockerfiles and can be deployed to Railway:

```bash
# From repo root
railway init
# Then set service root dirs per Railway service:
# - Go: backend/
# - Python: ai-service/
```

Set the backend env vars listed in `docs/env-vars.md` in each Railway service.
After deploying, add `BACKEND_URL=https://your-go-service.railway.app` to Vercel.

## 9. Test Before Announcing

- [ ] Sign up / log in works (email + Google OAuth)
- [ ] Create a trip end-to-end (wizard → review → save → timeline)
- [ ] Timeline shows activities with place photos
- [ ] Photo upload works (activity photo → AI caption → thumbnail)
- [ ] Discover tab loads AI recommendations
- [ ] Companion tab shows weather + nudges
- [ ] Expenses tab — add expense, export CSV
- [ ] Pack tab — generate packing list, toggle items, visa card
- [ ] Info tab — culture pack, currency converter
- [ ] Summary tab — trip story, share link, PNG export
- [ ] Explore page — community trips visible, Clone works
- [ ] Telegram bot responds to /start, /trip, /next, /status
- [ ] Cron jobs appear in Vercel → Cron Jobs settings
