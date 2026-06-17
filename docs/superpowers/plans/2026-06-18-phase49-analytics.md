# TrailGuide AI — Phase 49: Analytics & Growth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track key product metrics (trip creation funnel, AI generation success rate, feature adoption), build a share-a-trip feature with OG image generation, and add a referral system with invite codes.

**Architecture:** Client-side event tracking via a lightweight wrapper around `window.umami` (Umami Analytics — self-hosted, GDPR-friendly, no cookie banner needed). OG images generated server-side using `@vercel/og` with trip destination + cover photo. Referral: `profiles.referral_code` (6-char), `?ref=ABC123` tracked on signup.

**Tech Stack:** Umami Analytics (self-hosted, free), `@vercel/og` for OG images, Next.js Route Handlers for OG endpoint.

**Prerequisite:** Phase 18 (Next.js frontend). Phase 19 (Go backend). Phase 48 (premium tier — needed for conversion funnel).

## Global Constraints
- GDPR-compliant: Umami collects no personal data, no cookies. Add a one-line privacy notice.
- OG image URL: `GET /api/og?tripId=...` — server-side rendered, cached with `Cache-Control: public, max-age=3600`.
- Referral codes are 6 characters (A-Z0-9). One code per user, generated on signup.
- Referral reward: both referrer and referred get 30 extra premium days (tracked in `referral_rewards` table).
- Share URL: `https://trailguide.app/t/{tripId}` — public trip view (Phase 39 templates pattern, but user trip).

---

## Task 1: Analytics setup (Umami)

- [ ] **Step 1: Set up Umami (self-hosted on Railway or use cloud.umami.is)**

Option A: Umami Cloud (easiest)
```
1. Sign up at cloud.umami.is (free tier: 3 websites, 10k events/month)
2. Add website: "TrailGuide" → get tracking script
3. Note the website ID
```

Option B: Self-hosted on Railway
```bash
railway new umami
# Follow: https://umami.is/docs/railway
```

- [ ] **Step 2: Add Umami tracking script to `src/app/layout.tsx`**

```tsx
<Script
  src="https://analytics.umami.is/script.js"
  data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
  strategy="lazyOnload"
  async
/>
```

- [ ] **Step 3: Create `src/lib/analytics.ts` — typed event wrapper**

```typescript
declare global {
  interface Window { umami?: { track: (event: string, data?: Record<string, unknown>) => void } }
}

export function track(event: string, data?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.umami) {
    window.umami.track(event, data);
  }
}

// Named events for type safety:
export const analytics = {
  tripCreated: (style: string, budget: string) => track("trip_created", { style, budget }),
  aiGenerated: (destination: string, success: boolean) => track("ai_generated", { destination, success }),
  aiChatMessage: (destination: string) => track("ai_chat_message", { destination }),
  templateCloned: (destination: string) => track("template_cloned", { destination }),
  voiceUsed: () => track("voice_used"),
  upgradePromptShown: (reason: string) => track("upgrade_prompt_shown", { reason }),
  upgradePurchased: () => track("upgrade_purchased"),
  referralSignup: (code: string) => track("referral_signup", { code }),
  tripShared: (tripId: string) => track("trip_shared", { tripId }),
};
```

- [ ] **Step 4: Add tracking calls to key events**

```typescript
// In trip creation wizard, after generation completes:
analytics.aiGenerated(destination, success);

// In AI chat, on each message sent:
analytics.aiChatMessage(trip.destination);

// In upgrade modal, when shown:
analytics.upgradePromptShown(reason);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts src/app/layout.tsx
git commit -m "feat: add Umami analytics with typed event tracker for key user actions"
```

---

## Task 2: OG image generation

- [ ] **Step 1: Install `@vercel/og`**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install @vercel/og
```

- [ ] **Step 2: Create `src/app/api/og/route.tsx`**

```typescript
import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const destination = searchParams.get("destination") ?? "Amazing Destination";
  const title = searchParams.get("title") ?? "My Trip";
  const dates = searchParams.get("dates") ?? "";

  return new ImageResponse(
    <div
      style={{
        width: "1200px", height: "630px", display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg, #1a4731 0%, #2D6A4F 50%, #52b788 100%)",
        fontFamily: "sans-serif", padding: "80px", justifyContent: "flex-end",
      }}
    >
      {/* Logo */}
      <div style={{ position: "absolute", top: 60, left: 80, color: "white", fontSize: 24, fontWeight: 700, opacity: 0.9 }}>
        ✈️ TrailGuide AI
      </div>
      {/* Content */}
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 28, marginBottom: 16 }}>{dates}</div>
      <div style={{ color: "white", fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
        {title}
      </div>
      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 36 }}>
        📍 {destination}
      </div>
      <div style={{ position: "absolute", bottom: 60, right: 80, color: "rgba(255,255,255,0.5)", fontSize: 20 }}>
        AI-Planned · trailguide.app
      </div>
    </div>,
    {
      width: 1200, height: 630,
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    }
  );
}
```

- [ ] **Step 3: Add OG meta tags to trip pages**

In `src/app/[locale]/(app)/trips/[id]/layout.tsx`:
```typescript
export async function generateMetadata({ params }: { params: { id: string } }) {
  const trip = await fetchTrip(params.id);
  const ogUrl = `/api/og?title=${encodeURIComponent(trip.title)}&destination=${encodeURIComponent(trip.destination)}&dates=${trip.start_date}+to+${trip.end_date}`;
  return {
    title: `${trip.title} | TrailGuide`,
    openGraph: {
      title: trip.title, description: `AI-planned trip to ${trip.destination}`,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [ogUrl] },
  };
}
```

- [ ] **Step 4: Add "Share trip" button**

```typescript
// Share button in trip header:
async function share() {
  const url = `${window.location.origin}/trips/${tripId}/timeline`;
  if (navigator.share) {
    await navigator.share({ title: trip.title, url });
  } else {
    await navigator.clipboard.writeText(url);
    toast("Link copied!");
  }
  analytics.tripShared(tripId);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/og/route.tsx src/app/\[locale\]/\(app\)/trips/\[id\]/layout.tsx
git commit -m "feat: add OG image generation for trip shares and trip share button"
```

---

## Task 3: Referral system

- [ ] **Step 1: Add migration**

```sql
-- supabase/migrations/016_referrals.sql
alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by text; -- referral code of the referrer

-- Generate codes for existing users
update profiles
set referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where referral_code is null;

create table if not exists referral_rewards (
  id bigserial primary key,
  referrer_id uuid references profiles(id),
  referred_id uuid references profiles(id),
  extra_days int default 30,
  applied_at timestamptz default now()
);
```

- [ ] **Step 2: Handle `?ref=` on signup**

In `src/app/(auth)/signup/page.tsx`:
```typescript
// Read ?ref=ABC123 from URL
const refCode = searchParams.get("ref");
// After successful signup, POST to Go:
if (refCode) {
  await api.post("/api/v1/referral/apply", { referral_code: refCode });
}
```

Go handler:
```go
// POST /api/v1/referral/apply
// Finds the referrer by referral_code, adds 30 days to both
```

- [ ] **Step 3: Add referral code to profile page**

```typescript
// In profile settings:
<div className="bg-white rounded-2xl p-4">
  <p className="text-sm font-medium mb-1">Your referral code</p>
  <p className="text-xs text-gray-400 mb-3">Share this link — you and your friend each get 30 bonus Premium days</p>
  <div className="flex gap-2">
    <code className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono">
      {profile.referral_code}
    </code>
    <button onClick={() => copy(`https://trailguide.app?ref=${profile.referral_code}`)}
      className="bg-[#2D6A4F] text-white px-4 rounded-lg text-sm">
      Copy
    </button>
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_referrals.sql src/ backend/
git commit -m "feat: add referral system — unique codes, signup attribution, 30-day premium reward"
```

---

## Verification Checklist

- [ ] Umami receives events: open dashboard, click "Create Trip" → `trip_created` event appears
- [ ] `/api/og?destination=Tokyo&title=Tokyo+Adventure` returns a 1200x630 image
- [ ] Pasting trip URL in Slack/WhatsApp shows the OG image preview
- [ ] "Share trip" button uses Web Share API on mobile, clipboard on desktop
- [ ] `?ref=ABC123` on signup → referrer gains 30 premium days after new user's first week
- [ ] Referral code visible in profile page
- [ ] Analytics events for: trip_created, ai_generated, upgrade_prompt_shown
