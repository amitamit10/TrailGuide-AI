# TrailGuide AI — Deploy Checklist

Step-by-step guide for deploying to production (Vercel + Supabase + optional Railway for Go/Python).

---

## 1. Supabase — Run All Migrations

In **Supabase Dashboard → SQL Editor**, run each file in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_phase4_columns.sql
supabase/migrations/003_expenses.sql
supabase/migrations/004_checklist.sql
supabase/migrations/005_public_trips.sql
supabase/migrations/006_activity_photos.sql
supabase/migrations/007_culture_currency_cache.sql
```

"Already exists" warnings are safe — all migrations use `IF NOT EXISTS` guards.

---

## 2. Supabase Storage — Create Activity Photos Bucket

In **Supabase Dashboard → Storage → New bucket**:
- **Name:** `activity-photos`
- **Public:** ON

Public bucket required for photo thumbnail URLs (`/storage/v1/object/public/...`).

---

## 3. Environment Variables

In **Vercel → Project → Settings → Environment Variables**, add for Production + Preview + Development:

### Required

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
RESEND_API_KEY=re_...
CRON_SECRET=<random-32-char-string>
```

### Recommended

```
UNSPLASH_ACCESS_KEY=...
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Telegram (optional)

```
TELEGRAM_BOT_TOKEN=123456789:ABC...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
TELEGRAM_WEBHOOK_SECRET=<random-string>
```

### Production URL

```
NEXT_PUBLIC_SITE_URL=https://yourapp.vercel.app
```

### Go Backend (if deploying)

```
BACKEND_URL=https://your-go-service.railway.app
```

---

## 4. Supabase Auth — Add Production URL

In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL:** `https://yourapp.vercel.app`
- **Redirect URLs:** add `https://yourapp.vercel.app/**`

---

## 5. Deploy to Vercel

```bash
git push origin main
```

Vercel auto-deploys from GitHub. Check the build at [vercel.com/amits-projects-79cd529f/trailguide-ai](https://vercel.com/amits-projects-79cd529f/trailguide-ai).

---

## 6. Register the Telegram Webhook

After deploying, run this once in a browser or with `curl`:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourapp.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Replace `<TOKEN>` and `<TELEGRAM_WEBHOOK_SECRET>` with real values.

Verify:
```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

The `scripts/telegram-poll.mjs` local dev script is no longer needed after this.

---

## 7. Google OAuth (if using Sign in with Google)

In **Google Cloud Console → OAuth 2.0 → Authorized redirect URIs**, add:
```
https://yourapp.vercel.app/auth/callback
```

---

## 8. Verify Cron Jobs

Vercel registers crons automatically from `vercel.json`.

Check: **Vercel Dashboard → Project → Settings → Cron Jobs**

Expected:
| Job | Schedule |
|---|---|
| `advance-trip-status` | Daily at 6am |
| `daily-briefing` | Daily at 7am |
| `pre-trip-reminder` | Daily at 8am |

---

## 9. (Optional) Deploy Go Backend + Python AI Service to Railway

```bash
npm install -g @railway/cli
railway login
railway init
```

Create two Railway services, setting their root directories:
- Go backend: root = `backend/`
- Python AI service: root = `ai-service/`

Set environment variables for each service (see `docs/env-vars.md` → Go Backend / Python AI Service sections).

After deploying both, add `BACKEND_URL=https://your-go-service.railway.app` to Vercel env vars and redeploy.

---

## 10. Smoke Test

- [ ] Sign up and log in (email link + Google OAuth)
- [ ] Create a trip end-to-end (wizard → review → timeline)
- [ ] Timeline: activities visible with photos
- [ ] Timeline: upload activity photo → AI caption appears
- [ ] Discover tab: AI recommendations load
- [ ] Companion tab: weather and AI nudge appear
- [ ] Expenses tab: add expense, view budget bar, export CSV
- [ ] Pack tab: generate packing list, toggle items, visa card shows
- [ ] Info tab: culture pack loads, currency converter works
- [ ] Summary: AI story generates, share link works, PNG export downloads
- [ ] Explore: community trips visible, Clone button works
- [ ] Telegram bot: `/start`, `/trip`, `/next`, `/status` all respond
- [ ] Cron jobs appear in Vercel settings

---

## Quick Reference

| What | Where |
|---|---|
| Vercel project | [vercel.com/amits-projects-79cd529f/trailguide-ai](https://vercel.com/amits-projects-79cd529f/trailguide-ai) |
| Production URL | [trailguide-ai-iota.vercel.app](https://trailguide-ai-iota.vercel.app) |
| Supabase project | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo) |
| Supabase SQL editor | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql) |
| Supabase auth config | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration) |
| Supabase storage | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/storage/buckets](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/storage/buckets) |
| GitHub repo | [github.com/amitamit10/TrailGuide-AI](https://github.com/amitamit10/TrailGuide-AI) |
| Upstash dashboard | [console.upstash.com](https://console.upstash.com) |
| Telegram bot | [@TrailGuideAI_bot](https://t.me/TrailGuideAI_bot) |
