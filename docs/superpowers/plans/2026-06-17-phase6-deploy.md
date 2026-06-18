# Phase 6 — Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take TrailGuide AI from a locally-running dev app to a live production deployment on Vercel, with Supabase auth working, all migrations run, and the Telegram bot connected via webhook.

**Architecture:** The app is a Next.js 16.2.9 App Router project deployed to Vercel. Supabase handles auth + database with RLS. All AI calls go through Next.js API routes (never client-side) with `maxDuration = 60` to handle long Groq inference. The Telegram bot switches from local long-polling to a Vercel webhook in production.

**Tech Stack:** Next.js 16.2.9 · Supabase (Auth + PostgreSQL + RLS) · Vercel · Groq (llama-3.3-70b-versatile) · Tavily · Unsplash · Telegram (grammy webhook) · GitHub (`amitamit10/TrailGuide-AI`)

## Global Constraints

- Never commit `.env.local` — it is gitignored, all secrets go to Vercel env vars manually
- Supabase project ref: `nlqxnaktnvfomrcjlxmo` (URL: `https://nlqxnaktnvfomrcjlxmo.supabase.co`)
- GitHub remote: `https://github.com/amitamit10/TrailGuide-AI.git`
- Telegram bot username: `@TrailGuideAI_bot`, token in `TELEGRAM_BOT_TOKEN`
- `nvm` required for Node: prefix all `npm` / `npx` commands with `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" &&`
- Production URL is not yet known — tasks that reference it use `<PROD_URL>` as a placeholder

---

### Task 1: Fix Supabase auth redirect URLs (local)

**Files:**
- No code changes — this is Supabase dashboard configuration

**Why this first:** Both email and Google login return errors because Supabase blocks redirects to `localhost:3000`. Nothing can be tested until this is fixed.

**Interfaces:**
- Produces: working auth at `http://localhost:3000` for all subsequent local tests

- [ ] **Step 1: Open Supabase auth settings**

  Go to: https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration

- [ ] **Step 2: Set Site URL**

  Set **Site URL** to exactly:
  ```
  http://localhost:3000
  ```

- [ ] **Step 3: Add redirect URL**

  In **Redirect URLs**, add:
  ```
  http://localhost:3000/**
  ```
  Click Save.

- [ ] **Step 4: Verify an account exists**

  Go to: https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/users

  If no user appears, go to `http://localhost:3000/signup` and create one.

- [ ] **Step 5: Smoke test login**

  With the dev server running (`npm run dev`), open `http://localhost:3000/login`.
  - Email login should redirect to `/dashboard` ✓
  - Google login (if configured) should redirect to `/dashboard` ✓

  Expected: no "Invalid login credentials" or `?error=auth_failed` in the URL.

---

### Task 2: Run database migrations on Supabase

**Files:**
- `supabase/migrations/001_initial_schema.sql` — read-only reference
- `supabase/migrations/002_phase4_columns.sql` — read-only reference

**Why this order:** Migration 001 must run before 002 because 002 alters tables that 001 creates.

**Interfaces:**
- Produces: `trips` table with `transport_mode`, `max_walk_minutes`, `break_minutes` columns; `profiles` table with `telegram_chat_id` column and insert policy

- [ ] **Step 1: Open SQL editor**

  Go to: https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql

- [ ] **Step 2: Run migration 001**

  Paste and run the full contents of `supabase/migrations/001_initial_schema.sql`.

  Expected output: no errors. Statements like "already exists" are fine — the SQL uses `create table if not exists`.

- [ ] **Step 3: Run migration 002**

  Paste and run the full contents of `supabase/migrations/002_phase4_columns.sql`:

  ```sql
  alter table trips
    add column if not exists transport_mode text,
    add column if not exists max_walk_minutes int,
    add column if not exists break_minutes int;

  drop policy if exists "Users can insert own profile" on profiles;
  create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
  ```

  Expected output: `ALTER TABLE` and `CREATE POLICY` messages, no errors.

- [ ] **Step 4: Verify columns exist**

  In the SQL editor, run:
  ```sql
  select column_name from information_schema.columns
  where table_name = 'trips'
    and column_name in ('transport_mode', 'max_walk_minutes', 'break_minutes');
  ```

  Expected: 3 rows returned.

---

### Task 3: Local end-to-end smoke test

**Files:**
- No code changes — manual verification only

**Why:** Catch any runtime errors before committing and pushing. A broken deploy is harder to debug than a broken local run.

**Interfaces:**
- Consumes: working auth (Task 1), migrations applied (Task 2)
- Produces: confidence that all major user flows work

- [ ] **Step 1: Start the dev server**

  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm run dev
  ```

  Expected: `▲ Next.js 16.2.9` and `Local: http://localhost:3000` in terminal.

- [ ] **Step 2: Create a trip end-to-end**

  Open `http://localhost:3000/dashboard` → tap **Plan a trip** → complete all 8 wizard steps:
  1. Destination
  2. Dates (use the slider for nights)
  3. Travelers
  4. Travel style
  5. Interests
  6. Getting Around (transport step)
  7. Flights & Hotels
  8. Review

  Tap **Generate itinerary**. Expected: loading spinner → itinerary appears within 30 seconds.

- [ ] **Step 3: Save and view timeline**

  On the review page, tap **Save Trip**. Expected: redirect to `/trips/[id]/timeline`.

  Tap an activity card. Expected: card is clickable, `ReplaceActivitySheet` slides up.

  Tap a photo thumbnail. Expected: full-screen lightbox opens, Escape closes it.

- [ ] **Step 4: Test Summary tab**

  Tap the **Summary** tab. Expected: stats cards appear, AI story generates within 15 seconds.

  Tap **Share trip**. Expected: "Link copied!" toast appears.

  Tap **Save image**. Expected: PNG download starts.

- [ ] **Step 5: Test Discover tab**

  Tap **Discover**. Expected: place cards load with photos within 10 seconds.

  Tap **Add to trip** on a card. Expected: success state.

- [ ] **Step 6: Test Companion tab**

  Tap **Companion**. Expected: weather card and nudges load (may take 5-10 seconds).

- [ ] **Step 7: Test Settings → Telegram link**

  Go to Settings (gear icon on dashboard). Tap **Open @TrailGuideAI_bot** → in Telegram tap Start.

  Bot should reply with a numeric Telegram ID. Copy it, paste in the Settings input, tap Save.

  Expected: "Telegram connected" green confirmation.

  To verify the link works, run the polling script in a separate terminal:
  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && node scripts/telegram-poll.mjs
  ```
  Send `/trip` to the bot. Expected: today's itinerary or "No active trip" message.

---

### Task 4: Commit all Phase 3-5 code

**Files:** All modified and new files from Phases 3, 4, and 5 (see git status output below)

**Interfaces:**
- Produces: clean git history with all work committed, ready to push

- [ ] **Step 1: Review what will be committed**

  ```bash
  git status --short
  git diff --stat HEAD
  ```

  Verify `.env.local` does NOT appear in the list. If it does, stop — check `.gitignore`.

- [ ] **Step 2: Stage all changes**

  ```bash
  git add \
    DEPLOY_CHECKLIST.md \
    docs/ \
    package.json \
    package-lock.json \
    scripts/ \
    src/ \
    supabase/migrations/002_phase4_columns.sql
  ```

- [ ] **Step 3: Commit**

  ```bash
  git commit -m "feat: Phase 3-5 — discovery, photos, live companion, Telegram bot, trip summary, deploy prep"
  ```

  Expected: commit created, no hook errors.

- [ ] **Step 4: Push to GitHub**

  ```bash
  git push origin main
  ```

  Expected: `Branch 'main' set up to track remote branch 'main'` or `Everything up-to-date`.

  Verify at: https://github.com/amitamit10/TrailGuide-AI

---

### Task 5: Deploy to Vercel

**Files:**
- No code changes — Vercel dashboard configuration

**Interfaces:**
- Consumes: pushed GitHub repo (Task 4)
- Produces: live URL at `<PROD_URL>` (e.g. `https://trailguide-ai.vercel.app`)

- [ ] **Step 1: Create Vercel project**

  Go to https://vercel.com/new → **Import Git Repository** → select `amitamit10/TrailGuide-AI`.

  Framework: **Next.js** (auto-detected).
  Root directory: leave blank (project root).

- [ ] **Step 2: Add all environment variables**

  In the "Environment Variables" section, add each of these exactly:

  | Name | Value |
  |------|-------|
  | `NEXT_PUBLIC_SUPABASE_URL` | `https://nlqxnaktnvfomrcjlxmo.supabase.co` |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(copy from `.env.local` line 3)* |
  | `SUPABASE_SERVICE_ROLE_KEY` | *(copy from `.env.local` line 4)* |
  | `GROQ_API_KEY` | *(copy from `.env.local` line 7)* |
  | `TAVILY_API_KEY` | *(copy from `.env.local` line 10)* |
  | `UNSPLASH_ACCESS_KEY` | *(copy from `.env.local` line 19)* |
  | `TELEGRAM_BOT_TOKEN` | *(copy from `.env.local` line 25)* |
  | `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `TrailGuideAI_bot` |

- [ ] **Step 3: Deploy**

  Click **Deploy**. Expected: build completes in ~2 minutes (same as local `npm run build`).

  Note the production URL shown after deploy (e.g. `https://trailguide-ai.vercel.app`).

- [ ] **Step 4: Confirm build succeeded**

  Open `<PROD_URL>`. Expected: TrailGuide AI login/welcome screen loads.

---

### Task 6: Post-deploy — Supabase production URLs

**Files:**
- No code changes — Supabase dashboard configuration

**Interfaces:**
- Consumes: `<PROD_URL>` from Task 5
- Produces: auth redirects working in production

- [ ] **Step 1: Add production URL to Supabase**

  Go to: https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration

  In **Redirect URLs**, add (keep the localhost one too):
  ```
  <PROD_URL>/**
  ```
  Example: `https://trailguide-ai.vercel.app/**`

  Click Save.

- [ ] **Step 2: Test production login**

  Open `<PROD_URL>/login` in a fresh browser tab (not logged in).

  Sign in with email. Expected: redirects to `<PROD_URL>/dashboard`.

---

### Task 7: Post-deploy — Telegram webhook

**Files:**
- No code changes

**Why:** In production, the Telegram bot uses a webhook (Telegram pushes updates to the server) instead of the local polling script. This must be registered once.

**Interfaces:**
- Consumes: `<PROD_URL>` from Task 5, `TELEGRAM_BOT_TOKEN`
- Produces: bot commands work in production without running `scripts/telegram-poll.mjs`

- [ ] **Step 1: Register the webhook**

  Open this URL in a browser (replace values):
  ```
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<PROD_URL>/api/telegram/webhook
  ```

  Expected response:
  ```json
  {"ok":true,"result":true,"description":"Webhook was set"}
  ```

- [ ] **Step 2: Verify webhook info**

  Open in browser:
  ```
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
  ```

  Expected: `"url"` field matches `<PROD_URL>/api/telegram/webhook` and `"pending_update_count": 0`.

- [ ] **Step 3: Smoke test bot in production**

  In Telegram, send `/start` to `@TrailGuideAI_bot`.

  Expected: bot replies with your Telegram ID within 3 seconds (no polling script running).

---

### Task 8: Post-deploy — Google OAuth production redirect (if using Google login)

**Files:**
- No code changes — Google Cloud Console configuration

**Skip this task** if you are only using email login.

- [ ] **Step 1: Open Google Cloud Console**

  Go to: https://console.cloud.google.com → APIs & Services → Credentials → your OAuth 2.0 Client ID.

- [ ] **Step 2: Add production redirect URI**

  Under **Authorized redirect URIs**, add:
  ```
  <PROD_URL>/auth/callback
  ```
  Example: `https://trailguide-ai.vercel.app/auth/callback`

  Click Save.

- [ ] **Step 3: Test Google login in production**

  Open `<PROD_URL>/login` → tap **Sign in with Google**.

  Expected: Google OAuth flow completes, redirects to `<PROD_URL>/dashboard`.

---

### Task 9: Production smoke test

**Files:**
- No code changes — final verification

**Interfaces:**
- Consumes: all previous tasks complete

- [ ] **Step 1: Full trip creation in production**

  At `<PROD_URL>`, create a new trip through all 8 wizard steps. Tap Generate.

  Expected: itinerary generates within 30 seconds (Groq on Vercel, `maxDuration = 60`).

- [ ] **Step 2: Verify photos load**

  Open the Timeline tab. Expected: activity thumbnails load (Wikipedia/Unsplash via photo proxy).

- [ ] **Step 3: Verify Summary + Share**

  Open Summary tab. Expected: AI story generates. Tap "Share trip" → open the copied link in an incognito window.

  Expected: public share page loads without requiring login.

- [ ] **Step 4: Verify Telegram in production**

  In the app, go to Settings. Paste your Telegram ID and Save. Then send `/trip` to `@TrailGuideAI_bot`.

  Expected: bot replies with your trip itinerary.

- [ ] **Step 5: Update DEPLOY_CHECKLIST.md with the live URL**

  Edit `DEPLOY_CHECKLIST.md` — replace `yourapp.vercel.app` with the actual production URL.

  ```bash
  git add DEPLOY_CHECKLIST.md
  git commit -m "chore: update deploy checklist with production URL"
  git push origin main
  ```
