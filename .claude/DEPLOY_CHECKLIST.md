# Things To Do Before Deploy

## 1. Supabase — Run All Migrations

Run every migration file in the Supabase SQL editor (Dashboard → SQL Editor) in order:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_phase4_columns.sql`
- `supabase/migrations/003_expenses.sql`
- `supabase/migrations/004_checklist.sql`
- `supabase/migrations/005_public_trips.sql`
- `supabase/migrations/006_activity_photos.sql`
- `supabase/migrations/007_culture_currency_cache.sql`

"Already exists" warnings are fine — all migrations use `IF NOT EXISTS` guards.

## 2. Supabase Storage

Create the `activity-photos` bucket:
- Storage → New bucket → Name: `activity-photos` → Public: **ON**

Public is required so thumbnail URLs (`/storage/v1/object/public/...`) resolve without authentication.

## 3. Environment Variables (Vercel)

Add all of these in Vercel → Settings → Environment Variables (Production + Preview + Development):

```
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
TAVILY_API_KEY=
RESEND_API_KEY=
CRON_SECRET=

# Recommended
UNSPLASH_ACCESS_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
TELEGRAM_WEBHOOK_SECRET=

# Go backend (if deployed)
BACKEND_URL=https://your-go-backend.railway.app

# Production
NEXT_PUBLIC_SITE_URL=https://yourapp.vercel.app
```

## 4. Supabase Auth — Add Production URL

In Supabase Dashboard → Authentication → URL Configuration:
- Set **Site URL** to your production domain (e.g. `https://yourapp.vercel.app`)
- Add to **Redirect URLs**: `https://yourapp.vercel.app/**`

## 5. Register the Telegram Webhook

After deploying, run this once in a browser or curl:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Replace `<TELEGRAM_BOT_TOKEN>`, `yourapp.vercel.app`, and `<TELEGRAM_WEBHOOK_SECRET>` with real values.

## 6. Google OAuth (if using Sign in with Google)

In Google Cloud Console → OAuth 2.0 → Authorized redirect URIs, add:
```
https://yourapp.vercel.app/auth/callback
```

## 7. Deploy Go Backend (optional)

```bash
# Railway CLI
npm install -g @railway/cli
railway login
cd backend
railway up
```

Set these env vars in Railway for the Go service:
```
DATABASE_URL=postgresql://...  (from Supabase → Settings → Database → URI)
SUPABASE_JWT_SECRET=           (from Supabase → Settings → API → JWT Secret)
INTERNAL_API_SECRET=           (random 32-char string, same as Python service)
AI_SERVICE_URL=                (Railway URL of your Python service)
CORS_ALLOW_ORIGIN=https://yourapp.vercel.app
```

## 8. Deploy Python AI Service (optional)

```bash
cd ai-service
railway up
```

Set these env vars in Railway for the Python service:
```
GROQ_API_KEY=
TAVILY_API_KEY=
UNSPLASH_ACCESS_KEY=
INTERNAL_API_SECRET=  (same value as Go service)
```

## 9. Smoke Test Before Announcing

- [ ] Sign up / log in works (email + Google OAuth)
- [ ] Create a trip end-to-end (wizard → review → timeline)
- [ ] Timeline shows activities with place photos
- [ ] Photo upload on an activity card works
- [ ] Discover tab loads AI recommendations
- [ ] Companion tab shows weather + nudges
- [ ] Budget tab: add and delete an expense
- [ ] Pack tab: AI packing list generates, items can be checked
- [ ] Info tab: culture pack loads for the destination
- [ ] Summary tab: AI story generates, share link works
- [ ] Export: PDF, ICS, and PNG download
- [ ] Explore page: public trips appear, clone works
- [ ] Telegram bot responds to /start, /trip, /next, /status
- [ ] Activity location links open Google Maps

## 10. Cron Jobs (automatic after Vercel deploy)

Vercel reads `vercel.json` and registers the crons automatically on deploy.
Verify they appear at: Vercel Dashboard → Project → Settings → Cron Jobs

The three crons are:
- `advance-trip-status` — 6am
- `daily-briefing` — 7am
- `pre-trip-reminder` — 8am
