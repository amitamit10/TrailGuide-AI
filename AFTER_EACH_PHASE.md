# After Each Phase — Checklist

This file tells both you (Amit) and Claude exactly what to do after every phase completes.
Claude reads this file and follows the **Claude** steps automatically.
You follow the **You** steps manually.

---

## Standard Steps — Every Phase

### Claude does these automatically
- [ ] Run `tsc --noEmit` and fix any type errors before committing
- [ ] Update `CHANGELOG.md` — mark the phase ✅ Done in the phase table
- [ ] Update `CHANGELOG.md` — mark the group ✅ Complete if all phases in the group are done
- [ ] Add a changelog entry under the current date with what was built
- [ ] Commit with a clear message (`feat:`, `fix:`, `docs:` prefix)
- [ ] Push to GitHub immediately — no confirmation needed:
  ```bash
  git push origin main
  ```

### You do these manually
- [ ] **Deploy to Vercel** — Vercel auto-deploys from GitHub. Check the deployment succeeded at:
  [vercel.com/amits-projects-79cd529f/trailguide-ai](https://vercel.com/amits-projects-79cd529f/trailguide-ai)
- [ ] **Smoke test** — open [trailguide-ai-iota.vercel.app](https://trailguide-ai-iota.vercel.app) and verify the app still works after the deploy

---

## Phase-Specific Manual Steps

Some phases add new features that need your manual setup. Listed below — check the ones for the phase you just completed.

---

### Phase 13 — Rate Limiting (DONE ✅)

**You must do this or rate limiting will crash in production:**

1. Go to [console.upstash.com](https://console.upstash.com) → create a free Redis database
2. Click the database → **REST API** tab → copy the REST URL and token
3. Add to `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```
4. Add the same two vars to Vercel:
   - Go to [Vercel → trailguide-ai → Settings → Environment Variables](https://vercel.com/amits-projects-79cd529f/trailguide-ai/settings/environment-variables)
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for Production + Preview + Development
5. Redeploy on Vercel so the new env vars take effect (Deployments → Redeploy)

---

### Phase 14 — PWA (DONE ✅)

No new env vars needed.

**Verify it works after deploy:**
1. Open [trailguide-ai-iota.vercel.app](https://trailguide-ai-iota.vercel.app) in Chrome
2. Look for the install icon (⊕) in the address bar → click it → confirm "Install TrailGuide AI" appears
3. On Android Chrome: tap the three-dot menu → "Add to Home Screen"
4. On iPhone (Safari): tap Share → "Add to Home Screen"

---

### Phase 15 — Trip Export (DONE ✅)

No new env vars needed.

**Verify it works:**
1. Open any trip → Summary tab
2. Click **Export** → try each option:
   - Calendar (.ics) → file downloads → import to Google Calendar
   - Google Calendar → new tab opens pre-filled with the first activity
   - PDF Itinerary → PDF downloads with all days and activities

---

### Phase 16 — Go Backend (Planned)

Will need:
- [ ] Install Go on your machine if not already: `go version`
- [ ] New env var: `DATABASE_URL` (Postgres connection string from Supabase)
  - Supabase → Settings → Database → Connection String → URI
- [ ] Add `DATABASE_URL` to `.env.local` and Vercel env vars
- [ ] Vercel will need to build the Go binary — `vercel.json` changes will be needed

---

### Phase 17 — Python AI Service (Planned)

Will need:
- [ ] Python 3.11+ installed: `python3 --version`
- [ ] New env vars: `PYTHON_SERVICE_URL` (internal URL of the Python service)
- [ ] If deploying Python to Vercel: no changes needed (Vercel supports Python)
- [ ] If deploying Python to Railway/Fly.io: you'll need an account there

---

### Phase 18 — Frontend Migration (Planned)

No new env vars. Heavy code changes — after this phase:
- [ ] Full regression test: every tab, every feature, every API route
- [ ] Check the Vercel build logs carefully — this phase rewrites how the frontend calls the API

---

### Phase 19 — Infrastructure & Deploy (Planned)

Will need:
- [ ] Possibly a custom domain — buy one if you want (Vercel → Domains)
- [ ] Update Supabase redirect URLs if the domain changes
- [ ] Update Telegram webhook URL if the domain changes:
  ```
  https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yournewdomain.com/api/telegram/webhook
  ```

---

### Any Phase That Adds a New Supabase Migration

If the phase plan includes files under `supabase/migrations/`:
1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql)
2. Paste and run each new migration file in order
3. Verify no errors ("already exists" warnings are fine — migrations use `IF NOT EXISTS`)

---

### Any Phase That Adds New Env Vars

Claude will note the new vars in the phase plan and in the commit message. When that happens:
1. Get the value from the service's dashboard
2. Add it to `.env.local` (never commit this file)
3. Add it to Vercel: Settings → Environment Variables → add for Production + Preview + Development
4. Redeploy on Vercel so the var takes effect

---

## Quick Reference

| What | Where |
|---|---|
| Vercel project | [vercel.com/amits-projects-79cd529f/trailguide-ai](https://vercel.com/amits-projects-79cd529f/trailguide-ai) |
| Production URL | [trailguide-ai-iota.vercel.app](https://trailguide-ai-iota.vercel.app) |
| Supabase project | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo) |
| Supabase SQL editor | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql) |
| Supabase auth config | [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/auth/url-configuration) |
| GitHub repo | [github.com/amitamit10/TrailGuide-AI](https://github.com/amitamit10/TrailGuide-AI) |
| Upstash dashboard | [console.upstash.com](https://console.upstash.com) |
| Telegram bot | [@TrailGuideAI_bot](https://t.me/TrailGuideAI_bot) |
| Google Cloud Console | [console.cloud.google.com](https://console.cloud.google.com) |
