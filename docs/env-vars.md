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

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. It is only used in server-side API routes.

### Groq

| Variable | Description | Where to find |
|---|---|---|
| `GROQ_API_KEY` | Groq Cloud API key | [console.groq.com](https://console.groq.com) → API Keys |

### Tavily

| Variable | Description | Where to find |
|---|---|---|
| `TAVILY_API_KEY` | Tavily search API key | [app.tavily.com](https://app.tavily.com) → API Keys |

---

## Recommended

### Unsplash (photo fallback)

| Variable | Description | Where to find |
|---|---|---|
| `UNSPLASH_ACCESS_KEY` | Unsplash API access key | [unsplash.com/developers](https://unsplash.com/developers) → Your apps → Access Key |

The app works without this — it falls back to a placeholder image — but photos will be missing for places not in Wikipedia.

---

## Optional

### Telegram Bot

| Variable | Description | Where to find |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | Message [@BotFather](https://t.me/BotFather) → `/newbot` |

The Telegram bot is optional. Without it, all app features work except Telegram notifications and linking.

---

## Production-Only

These are not needed locally. Add them in Vercel environment variables.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your production URL (e.g. `https://trailguide.vercel.app`) — used for share links |

---

## Phase 7+ (Future)

| Variable | Description | Where to find |
|---|---|---|
| `RESEND_API_KEY` | Resend email API key | [resend.com](https://resend.com) → API Keys |
| `CRON_SECRET` | Secret to authorize Vercel Cron Jobs | Generate a random string — set same value in Vercel env and use in cron header |

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

# Telegram (optional)
TELEGRAM_BOT_TOKEN=123456789:ABC...
```
