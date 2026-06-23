<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Multi-Service Architecture

TrailGuide AI runs three services. Read this before touching any API code.

## Services

| Service | Dir | Port | Language |
|---|---|---|---|
| Next.js frontend + thin API | `src/` | 3000 | TypeScript |
| Go backend (trip CRUD, AI proxy) | `backend/` | 8080 | Go 1.22 (Gin) |
| Python AI service (all LLM logic) | `ai-service/` | 8081 | Python 3.12 (FastAPI) |

## Which service owns what

- **New AI feature?** → Add router in `ai-service/routers/`, then add a Next.js route that proxies through Go → Python. Or add directly as a Next.js API route if it's simple.
- **Trip data (CRUD)?** → Go backend (`backend/handlers/trips.go`). Never add trip DB writes to Next.js API routes directly.
- **Auth/session logic?** → Next.js only. Go validates JWTs; it never issues them.
- **Cron jobs?** → Next.js API routes under `src/app/api/cron/`. Registered in `vercel.json`.
- **Telegram bot?** → Next.js only (`src/app/api/telegram/`).

## Input validation — always do all three layers

| Layer | How |
|---|---|
| Next.js route | Check bounds, types, and ownership before passing to Groq or Go |
| Go handler | Validate `title` ≤500, `destination` ≤300, `status` enum, numeric ranges |
| Python Pydantic | `max_length`, `ge`/`le` on every field that touches a prompt |

Never pass unsanitised user input into a Groq prompt. Even a capped string should be trimmed.

## Auth patterns

- **User requests → Next.js routes:** `createClient()` from `src/lib/supabase/server.ts` (reads session cookie, respects RLS)
- **Trusted server contexts (Telegram, cron, public share):** `createServiceClient()` (service role, bypasses RLS)
- **Next.js → Go:** include the user's `Authorization: Bearer <jwt>` header; Go validates it with `SUPABASE_JWT_SECRET`
- **Go → Python:** `X-Internal-Token: <INTERNAL_API_SECRET>` (constant-time verified via `hmac.compare_digest`)

## Security conventions

- Rate limit all unauthenticated routes with `publicRatelimit` from `src/lib/ratelimit.ts`
- Always probe trip ownership before reading/writing expenses, checklist items, photos
- Use `crypto.timingSafeEqual` for secret comparisons (cron, Telegram webhook)
- Sanitise filenames before Supabase Storage paths
- Never redirect to user-supplied URLs — proxy bytes instead (see `places/photo`)

## Database migrations

Migrations live in `supabase/migrations/` (001–007). Run them in order via Supabase SQL Editor. Always use `IF NOT EXISTS` / `IF NOT EXISTS` guards. New tables need RLS policies or an explicit no-RLS justification comment.
