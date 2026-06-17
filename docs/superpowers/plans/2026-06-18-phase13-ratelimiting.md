# TrailGuide AI — Phase 13: Rate Limiting & Response Caching

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect Groq API quota from abuse by rate-limiting all AI routes per authenticated user, and add cache headers to weather and photo routes so Vercel CDN serves repeat requests without hitting upstream APIs.

**Architecture:** `@upstash/ratelimit` with sliding-window keyed on `user.id` (not IP — user ID is already available from the existing auth guard and is more accurate). Cache headers on deterministic proxy routes (`/api/places/photo`, `/api/weather`) let Vercel's CDN cache responses at the edge. No new database tables, no session state.

**Tech Stack:** `@upstash/ratelimit` v2, `@upstash/redis` v1, Upstash Redis (free tier, edge-compatible with Vercel).

## Global Constraints

- Upstash free tier: 10,000 commands/day — more than enough for a single-user app; monitor in Upstash dashboard after launch.
- Rate limit: 10 AI requests per user per minute (sliding window). This covers normal chat sessions.
- Do NOT rate-limit `/api/places/photo` or `/api/weather` — these have no auth and are cached at the CDN layer instead.
- Do NOT use IP-based limiting — unreliable behind Vercel's proxy. User ID is the correct key.
- All AI routes already call `supabase.auth.getUser()` — add the rate limit check AFTER the auth check so unauthenticated requests still get 401 (not 429).
- Weather cache: `s-maxage=3600` (1 hour). Photo cache: `s-maxage=86400` (24 hours).
- Two new environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

## File Map

```
src/
└── lib/
    └── ratelimit.ts              CREATE — shared Upstash rate limiter instance

src/app/api/
├── ai/
│   ├── chat/route.ts             MODIFY — add rate limit check
│   ├── generate-itinerary/route.ts  MODIFY — add rate limit check
│   ├── edit-itinerary/route.ts   MODIFY — add rate limit check
│   ├── recommendations/route.ts  MODIFY — add rate limit check
│   ├── replace-activity/route.ts MODIFY — add rate limit check
│   ├── preview-replace/route.ts  MODIFY — add rate limit check
│   ├── add-discovery/route.ts    MODIFY — add rate limit check
│   ├── companion/route.ts        MODIFY — add rate limit check
│   └── trip-story/route.ts       MODIFY — add rate limit check
├── documents/
│   └── import/route.ts           MODIFY — add rate limit check
├── places/
│   └── photo/route.ts            MODIFY — add cache headers
└── weather/route.ts              MODIFY — add cache headers

docs/env-vars.md                  MODIFY — document new vars
.env.local.example                MODIFY — add new vars (force-add, gitignored)
DEPLOY_CHECKLIST.md               MODIFY — add Upstash setup step
```

---

## Task 1: Install Upstash packages and create the rate limiter utility

**Files:**
- Create: `src/lib/ratelimit.ts`

**Interfaces:**
- Produces: `aiRatelimit` — an `Ratelimit` instance. Usage: `const { success } = await aiRatelimit.limit(userId);`

- [ ] **Step 1: Install packages**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm install @upstash/ratelimit @upstash/redis
```

Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create `src/lib/ratelimit.ts`**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const aiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "trailguide:ai",
  analytics: false,
});
```

`Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically — no manual config needed.

- [ ] **Step 3: Add env vars to `.env.local`**

Add these two lines to `.env.local` (get the values from [console.upstash.com](https://console.upstash.com) after creating a free Redis database):

```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

- [ ] **Step 4: Update `.env.local.example` and `docs/env-vars.md`**

In `.env.local.example` add after the `UNSPLASH_ACCESS_KEY` line:
```bash
# ── Rate limiting (Upstash Redis) ────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxXXXXXX...
```

In `docs/env-vars.md`, add a new section under **Recommended**:
```markdown
### Upstash Redis (rate limiting)

| Variable | Description | Where to find |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | [console.upstash.com](https://console.upstash.com) → Database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Same page as URL |
```

- [ ] **Step 5: Manual test**

Start the dev server:
```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm run dev
```

Confirm it starts without errors (the rate limiter is lazy — it connects only on first use).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ratelimit.ts package.json package-lock.json docs/env-vars.md
git add -f .env.local.example
git commit -m "feat: add Upstash rate limiter utility"
```

---

## Task 2: Add rate limiting to all AI routes

**Files:**
- Modify: all 10 routes listed in the file map above

**Interfaces:**
- Consumes: `aiRatelimit` from `@/lib/ratelimit`
- The rate limit check goes AFTER `supabase.auth.getUser()` so unauthenticated requests still return 401, not 429.

The pattern to add to every AI route is identical. Find the block that looks like this (already present in all routes):

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

And add the rate limit block immediately after it:

```typescript
const { success } = await aiRatelimit.limit(user.id);
if (!success) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment before trying again." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
```

- [ ] **Step 1: Add import and rate limit to `src/app/api/ai/chat/route.ts`**

Add at the top of the file:
```typescript
import { aiRatelimit } from "@/lib/ratelimit";
```

Add the rate limit block after the existing auth check (the `if (!user)` return).

- [ ] **Step 2: Repeat for `src/app/api/ai/generate-itinerary/route.ts`**

Same import and same block after the existing auth check.

- [ ] **Step 3: Repeat for `src/app/api/ai/edit-itinerary/route.ts`**

Same.

- [ ] **Step 4: Repeat for `src/app/api/ai/recommendations/route.ts`**

Same.

- [ ] **Step 5: Repeat for `src/app/api/ai/replace-activity/route.ts`**

Same.

- [ ] **Step 6: Repeat for `src/app/api/ai/preview-replace/route.ts`**

Same.

- [ ] **Step 7: Repeat for `src/app/api/ai/add-discovery/route.ts`**

Same.

- [ ] **Step 8: Repeat for `src/app/api/ai/companion/route.ts`**

Same.

- [ ] **Step 9: Repeat for `src/app/api/ai/trip-story/route.ts`**

Same.

- [ ] **Step 10: Repeat for `src/app/api/documents/import/route.ts`**

Same.

- [ ] **Step 11: Manual test — rate limiting works**

With dev server running, log in to the app. Open DevTools → Console. In the browser console, run this to fire 11 rapid requests (one over the limit):

```javascript
for (let i = 0; i < 11; i++) {
  fetch('/api/ai/trip-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination: 'test', startDate: '2026-01-01', endDate: '2026-01-03', activities: [] })
  }).then(r => console.log(i, r.status));
}
```

Expected: first 10 return 200, the 11th returns 429.

- [ ] **Step 12: Manual test — auth still works**

Open an incognito tab. POST to `/api/ai/chat` without a session cookie. Should return 401, not 429.

- [ ] **Step 13: Commit**

```bash
git add src/app/api/
git commit -m "feat: add per-user rate limiting to all AI and document import routes"
```

---

## Task 3: Add cache headers to weather and photo routes

**Files:**
- Modify: `src/app/api/places/photo/route.ts`
- Modify: `src/app/api/weather/route.ts`

**Why:** These routes are public (no auth), deterministic, and called frequently. Vercel's CDN will serve cached responses from the edge for repeat requests — reducing latency and upstream API calls.

- [ ] **Step 1: Add cache headers to `src/app/api/places/photo/route.ts`**

Find the line that creates the success `NextResponse` (where the image bytes are returned). Before returning, add this header:

```typescript
response.headers.set(
  "Cache-Control",
  "public, s-maxage=86400, stale-while-revalidate=604800"
);
```

Full context — the return should look like:
```typescript
const response = new NextResponse(buffer, {
  headers: {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  },
});
return response;
```

`s-maxage=86400` = cached at CDN for 24 hours. `stale-while-revalidate=604800` = serve stale for up to 7 days while fetching fresh in background.

- [ ] **Step 2: Add cache headers to `src/app/api/weather/route.ts`**

Find the return statement that returns the weather JSON. Modify it to:
```typescript
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
  },
});
```

`s-maxage=3600` = cached at CDN for 1 hour. Weather data doesn't need to be fresher than that.

- [ ] **Step 3: Manual test**

In DevTools → Network, visit a trip that has a Companion tab (which shows weather). Look at the `/api/weather` response headers — confirm `cache-control: public, s-maxage=3600...` is present. Refresh the page and confirm the response is served from cache (status `304` or very fast response time).

Visit a timeline page with activity photos. Check `/api/places/photo` response headers for the cache-control header.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/places/photo/route.ts src/app/api/weather/route.ts
git commit -m "feat: add CDN cache headers to photo and weather proxy routes"
```

---

## Task 4: Update DEPLOY_CHECKLIST.md

**Files:**
- Modify: `DEPLOY_CHECKLIST.md`

- [ ] **Step 1: Add Upstash setup step**

In `DEPLOY_CHECKLIST.md`, find the section about environment variables and add:

```markdown
### Upstash Redis (rate limiting)
- [ ] Create a free Redis database at [console.upstash.com](https://console.upstash.com)
- [ ] Copy the REST URL and token from Database → REST API tab
- [ ] Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel environment variables
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY_CHECKLIST.md
git commit -m "docs: add Upstash setup step to deploy checklist"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] 11 rapid requests to any AI route → first 10 succeed, 11th returns 429 with `Retry-After: 60` header
- [ ] Unauthenticated request to any AI route → 401 (not 429)
- [ ] `/api/places/photo` response has `cache-control: public, s-maxage=86400...`
- [ ] `/api/weather` response has `cache-control: public, s-maxage=3600...`
- [ ] `npm run dev` starts without errors
- [ ] Normal app usage (chat, timeline, discover) works with rate limiting enabled
