# Environment Variables

Copy `.env.local.example` to `.env.local` and fill in each value. Never commit `.env.local`.

---

## Required

### Supabase

| Variable | Description | Where to find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Supabase Dashboard → Settings → API → `service_role` `secret` |

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. It is used only in server-side API routes (Telegram webhook, cron jobs, public share page).

### Groq

| Variable | Description | Where to find |
|---|---|---|
| `GROQ_API_KEY` | Groq Cloud API key | [console.groq.com](https://console.groq.com) → API Keys |

### Tavily

| Variable | Description | Where to find |
|---|---|---|
| `TAVILY_API_KEY` | Tavily search API key | [app.tavily.com](https://app.tavily.com) → API Keys |

### Notifications

| Variable | Description | Where to find |
|---|---|---|
| `RESEND_API_KEY` | Resend email API key — used for pre-trip reminder emails | [resend.com](https://resend.com) → API Keys |
| `CRON_SECRET` | Authorises Vercel Cron Job requests | Generate any random 32-char string; set the same value in Vercel env |

---

## Recommended

### Unsplash (photo fallback)

| Variable | Description | Where to find |
|---|---|---|
| `UNSPLASH_ACCESS_KEY` | Unsplash API access key | [unsplash.com/developers](https://unsplash.com/developers) → Your apps → Access Key |

The app works without this — it falls back to a placeholder image — but photos will be missing for places not covered by Wikipedia.

### Rate Limiting (Upstash Redis)

| Variable | Description | Where to find |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | [console.upstash.com](https://console.upstash.com) → database → REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Same location as the URL |

Without these, rate limiting is silently skipped (no crash). Required for production to prevent quota abuse.

---

## Optional

### Telegram Bot

| Variable | Description | Where to find |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | Message [@BotFather](https://t.me/BotFather) → `/newbot` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Bot username without @ | Set during BotFather setup, e.g. `TrailGuideAI_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification token | Generate any random string; pass as `secret_token` when registering webhook |

`TELEGRAM_WEBHOOK_SECRET` prevents forged webhook calls via constant-time comparison. Omitting it skips webhook auth (insecure in production).

---

## Go Backend

These vars go in `backend/.env` (not the Next.js `.env.local`).

| Variable | Description | Where to find |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Supabase → Settings → Database → Connection String → URI |
| `SUPABASE_JWT_SECRET` | JWT secret for token validation | Supabase → Settings → API → JWT Settings → JWT Secret |
| `INTERNAL_API_SECRET` | Shared secret between Go and Python | Generate any random 32-char string — must match Python service |
| `AI_SERVICE_URL` | Python AI service base URL | e.g. `http://localhost:8081` in dev, or Railway URL in prod |
| `CORS_ALLOW_ORIGIN` | Allowed CORS origin for Go responses | e.g. `https://your-app.vercel.app`; defaults to `*` in dev |
| `PORT` | Go server port | Defaults to `8080` |

### Next.js side (when using Go backend)

| Variable | Description |
|---|---|
| `BACKEND_URL` | Go backend base URL, e.g. `http://localhost:8080` — enables the backend proxy in `src/lib/backend-proxy.ts` |

---

## Python AI Service

These vars go in `ai-service/.env` (not the Next.js `.env.local`).

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Same Groq key as Next.js |
| `TAVILY_API_KEY` | Same Tavily key as Next.js |
| `UNSPLASH_ACCESS_KEY` | Same Unsplash key as Next.js |
| `INTERNAL_API_SECRET` | Must match the Go backend value |
| `PORT` | Python service port; defaults to `8081` |

---

## Production-Only

Add these in Vercel → Settings → Environment Variables, not in `.env.local`.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your production URL (e.g. `https://trailguide.vercel.app`) — used for public share links |

---

## Full `.env.local.example`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...

# Photos (optional but recommended)
UNSPLASH_ACCESS_KEY=...

# Notifications (required for cron jobs + email reminders)
RESEND_API_KEY=re_...
CRON_SECRET=<random-32-char-string>

# Telegram (optional)
TELEGRAM_BOT_TOKEN=123456789:ABC...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=TrailGuideAI_bot
TELEGRAM_WEBHOOK_SECRET=<random-string>

# Rate limiting (optional but recommended for production)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Go backend (optional — enables v1 API)
BACKEND_URL=http://localhost:8080

# Production only
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```
