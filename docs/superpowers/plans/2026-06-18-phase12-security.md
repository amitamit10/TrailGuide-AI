# TrailGuide AI — Phase 12: Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close real security gaps before production traffic hits the app — missing auth on two AI routes, no HTTP security headers, no route-level middleware protection, and an overfitted image allowlist.

**Architecture:** Minimal targeted fixes. No new dependencies. Every change is verifiable by reading the file or running the app.

**Tech Stack:** Next.js 16.2.9 middleware, `next.config.ts` HTTP headers, Supabase `createClient()` auth guard pattern already used in other routes.

## Global Constraints

- Do NOT run `npm audit fix --force` — it would downgrade Next.js to 9.3.3 (breaking). The PostCSS vulnerability is a build-time issue only, not a runtime attack surface. Accept it and document it.
- Do NOT add rate-limiting packages — Vercel's built-in DDoS protection is sufficient for Phase 12. Proper rate limiting is a Phase 13+ concern.
- Follow the existing auth guard pattern: `createClient()` → `supabase.auth.getUser()` → 401 if no user.
- No new environment variables.

---

## Findings Summary

| # | Severity | Finding | File |
|---|---|---|---|
| 1 | 🔴 High | `recommendations` route has no auth check — any anonymous caller can burn Groq quota | `src/app/api/ai/recommendations/route.ts` |
| 2 | 🔴 High | `trip-story` route has no auth check — same problem | `src/app/api/ai/trip-story/route.ts` |
| 3 | 🟡 Medium | No HTTP security headers (CSP, X-Frame-Options, etc.) | `next.config.ts` |
| 4 | 🟡 Medium | No Next.js middleware — unauthenticated requests hit server components before any auth check | missing `src/middleware.ts` |
| 5 | 🟢 Low | `next.config.ts` image allowlist includes `maps.googleapis.com` — unused since Google Maps was removed | `next.config.ts` |
| 6 | 🟢 Low | 2 moderate npm vulnerabilities (PostCSS XSS in CSS output) — build-time only, accepted risk | `package.json` |
| 7 | ✅ OK | Telegram webhook uses `createServiceClient()` correctly | `src/app/api/telegram/webhook/route.ts` |
| 8 | ✅ OK | No `dangerouslySetInnerHTML` anywhere | — |
| 9 | ✅ OK | No secrets in `NEXT_PUBLIC_` vars | — |
| 10 | ✅ OK | All other AI routes call `supabase.auth.getUser()` | — |

---

## File Map

```
src/
├── middleware.ts                    CREATE — route protection for (app) group
└── app/
    └── api/
        └── ai/
            ├── recommendations/
            │   └── route.ts         MODIFY — add auth guard
            └── trip-story/
                └── route.ts         MODIFY — add auth guard
next.config.ts                       MODIFY — add HTTP headers, clean image allowlist
```

---

## Task 1: Add auth guard to `recommendations` route

**Files:**
- Modify: `src/app/api/ai/recommendations/route.ts`

**Why:** Any unauthenticated HTTP client can POST to this route and trigger a Groq API call. This is a direct cost-burning vector.

- [ ] **Step 1: Read the current file**

Open `src/app/api/ai/recommendations/route.ts` and confirm there is no `supabase.auth.getUser()` call.

- [ ] **Step 2: Add the auth import and guard**

Add these two imports at the top (after existing imports):
```typescript
import { createClient } from "@/lib/supabase/server";
```

Then add this block as the first thing inside the `POST` handler, before any Groq call:
```typescript
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 3: Manual test**

Run `npm run dev`. In a browser private tab (logged out), open DevTools → Network and POST to `http://localhost:3000/api/ai/recommendations`. Confirm you get `401 Unauthorized`. Then log in and retry from the Discover tab — confirm recommendations still load.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/recommendations/route.ts
git commit -m "fix: add auth guard to recommendations route"
```

---

## Task 2: Add auth guard to `trip-story` route

**Files:**
- Modify: `src/app/api/ai/trip-story/route.ts`

**Why:** Same issue — anonymous callers can trigger expensive Groq calls.

- [ ] **Step 1: Read the current file**

Open `src/app/api/ai/trip-story/route.ts` and confirm no auth guard.

- [ ] **Step 2: Add the auth import and guard**

Add import:
```typescript
import { createClient } from "@/lib/supabase/server";
```

Add as first block inside `POST`:
```typescript
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

- [ ] **Step 3: Manual test**

Logged-out POST to `/api/ai/trip-story` → 401. Logged-in from Summary page → story still generates.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/trip-story/route.ts
git commit -m "fix: add auth guard to trip-story route"
```

---

## Task 3: Create `src/middleware.ts` for route protection

**Files:**
- Create: `src/middleware.ts`

**Why:** Without middleware, unauthenticated requests reach server components before Supabase session cookies are refreshed. Next.js 16 requires middleware to keep the session alive on the server.

- [ ] **Step 1: Create the file**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/auth");

  const isPublicRoute = request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/share/");

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Manual test**

Start the dev server. Open an incognito window and navigate to `http://localhost:3000/dashboard`. Confirm you are redirected to `/login`. Then log in and confirm `/dashboard` loads normally.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for session refresh and auth redirect"
```

---

## Task 4: Add HTTP security headers and clean image allowlist

**Files:**
- Modify: `next.config.ts`

**Why:** No security headers means browsers won't enforce click-jacking protection, MIME sniffing protection, or restrict resource origins. Removing `maps.googleapis.com` from the image allowlist closes an unused door.

- [ ] **Step 1: Add headers and fix allowlist**

Replace the contents of `next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval required by Next.js dev mode
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://upload.wikimedia.org https://images.unsplash.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://*.supabase.co https://api.groq.com https://api.telegram.org https://api.tavily.com https://api.unsplash.com https://en.wikipedia.org https://api.open-meteo.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },  // Google profile photos
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "upload.wikimedia.org" },       // Wikipedia photos
      { protocol: "https", hostname: "images.unsplash.com" },        // Unsplash fallback
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Manual test**

Run `npm run dev`. Open DevTools → Network → click any request → Response Headers. Confirm `x-frame-options: SAMEORIGIN` and `x-content-type-options: nosniff` are present. Navigate through the app and confirm nothing is broken (no CSP console errors for normal usage).

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: add HTTP security headers and tighten image allowlist"
```

---

## Task 5: Document accepted risks

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a Security section to CHANGELOG.md**

Under the `## Phase Status` table, add:

```markdown
## Known Accepted Risks

| Risk | Severity | Reason accepted |
|---|---|---|
| PostCSS XSS in CSS output (`GHSA-qx2v-qp2m-jg93`) | Moderate | Build-time only — not a runtime attack surface. Fix would downgrade Next.js to 9.3.3 (breaking). Monitor for a non-breaking fix. |
| No per-route rate limiting on AI endpoints | Low | Vercel DDoS protection + auth guard prevent anonymous abuse. Per-IP rate limiting is Phase 13+. |
| CSP `unsafe-eval` in script-src | Low | Required by Next.js dev mode. In production (Vercel), Next.js compiles ahead of time — consider tightening post-deploy. |
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: document accepted security risks"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] POST to `/api/ai/recommendations` without a session cookie → 401
- [ ] POST to `/api/ai/trip-story` without a session cookie → 401
- [ ] Navigate to `/dashboard` in incognito → redirected to `/login`
- [ ] Log in → all tabs (Timeline, Discover, Summary, etc.) work normally
- [ ] Public share page `/share/[tripId]` is accessible without login
- [ ] Response headers include `x-frame-options` and `x-content-type-options`
- [ ] No CSP errors in browser console during normal usage
- [ ] Summary page AI story still generates correctly
