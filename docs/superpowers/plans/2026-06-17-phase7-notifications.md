# Phase 7 — Notifications & Trip Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep users engaged before, during, and after their trip through automated Telegram briefings, pre-trip email reminders, and automatic trip status transitions (planning → active → completed).

**Architecture:** Three moving parts — (1) Vercel Cron Jobs trigger scheduled tasks at `/api/cron/*` routes, (2) Resend sends transactional emails with trip summaries, (3) the existing Telegram bot sends daily morning briefings. Trip status auto-advances based on date comparison to avoid users needing to manually mark trips active/complete.

**Tech Stack:** Vercel Cron Jobs · Resend (email API, free tier 3 000 emails/month) · grammy (existing Telegram bot) · Supabase (existing) · Groq (existing, for morning briefing text)

## Global Constraints

- `nvm` required: prefix all `npm` commands with `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" &&`
- New API routes under `/src/app/api/cron/` must export `export const maxDuration = 60`
- Cron routes must check `Authorization: Bearer ${CRON_SECRET}` header to prevent unauthorized triggering
- Add `CRON_SECRET` and `RESEND_API_KEY` to `.env.local` and Vercel env vars
- Never commit `.env.local`
- Telegram bot already built at `src/app/api/telegram/webhook/route.ts` — extend `makeBot()` there, do not create a new bot instance

---

### Task 1: Install Resend and add env vars

**Files:**
- `package.json` — add `resend` dependency
- `.env.local` — add `RESEND_API_KEY` and `CRON_SECRET`

**Interfaces:**
- Produces: `import { Resend } from 'resend'` available in API routes

- [ ] **Step 1: Install Resend**

  ```bash
  export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm install resend
  ```

  Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Sign up for Resend and get API key**

  Go to https://resend.com → create account → API Keys → Create API Key.

  Name it `trailguide-production`. Copy the key (shown once).

- [ ] **Step 3: Add to .env.local**

  Append to `.env.local`:
  ```
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
  CRON_SECRET=a-long-random-string-you-make-up-now
  ```

  The `CRON_SECRET` can be any long random string — generate one with:
  ```bash
  openssl rand -hex 32
  ```

- [ ] **Step 4: Add sending domain (or use Resend's sandbox)**

  For testing, Resend allows sending to your own verified email from `onboarding@resend.dev` (sandbox). No domain needed yet.

  For production, add your domain in Resend → Domains → Add Domain and follow DNS instructions.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "feat: add resend for transactional email"
  ```

---

### Task 2: Auto-advance trip status via cron

**Files:**
- Create: `src/app/api/cron/advance-trip-status/route.ts`
- `vercel.json` — create at project root with cron schedule

**Interfaces:**
- Consumes: `createServiceClient()` from `src/lib/supabase/server.ts`
- Produces: trips auto-move `planning → active` on start_date, `active → completed` on day after end_date

- [ ] **Step 1: Create the cron route**

  Create `src/app/api/cron/advance-trip-status/route.ts`:

  ```typescript
  export const maxDuration = 60;
  import { NextRequest, NextResponse } from "next/server";
  import { createServiceClient } from "@/lib/supabase/server";

  export async function GET(req: NextRequest) {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // planning → active: start_date is today or earlier, end_date is today or later
    const { data: toActivate } = await supabase
      .from("trips")
      .update({ status: "active" })
      .eq("status", "planning")
      .lte("start_date", today)
      .gte("end_date", today)
      .select("id, title, user_id");

    // active → completed: end_date was yesterday
    const { data: toComplete } = await supabase
      .from("trips")
      .update({ status: "completed" })
      .eq("status", "active")
      .lt("end_date", today)
      .select("id, title, user_id");

    return NextResponse.json({
      activated: toActivate?.length ?? 0,
      completed: toComplete?.length ?? 0,
    });
  }
  ```

- [ ] **Step 2: Create vercel.json**

  Create `vercel.json` at the project root:

  ```json
  {
    "crons": [
      {
        "path": "/api/cron/advance-trip-status",
        "schedule": "0 6 * * *"
      },
      {
        "path": "/api/cron/daily-briefing",
        "schedule": "0 7 * * *"
      },
      {
        "path": "/api/cron/pre-trip-reminder",
        "schedule": "0 8 * * *"
      }
    ]
  }
  ```

  This runs all three crons daily (status at 06:00 UTC, briefing at 07:00 UTC, reminder at 08:00 UTC).

- [ ] **Step 3: Smoke test locally**

  ```bash
  curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
    http://localhost:3000/api/cron/advance-trip-status
  ```

  Expected:
  ```json
  {"activated": 0, "completed": 0}
  ```
  (Numbers may be non-zero if you have trips matching the date criteria.)

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/cron/advance-trip-status/route.ts vercel.json
  git commit -m "feat: auto-advance trip status via daily cron"
  ```

---

### Task 3: Telegram daily morning briefing

**Files:**
- Create: `src/app/api/cron/daily-briefing/route.ts`

**Interfaces:**
- Consumes: `createServiceClient()`, Telegram Bot API (via fetch, not grammy — no need for the full bot in a cron), `TELEGRAM_BOT_TOKEN`
- Produces: active-trip users receive a Telegram message at 07:00 UTC with today's activities

- [ ] **Step 1: Create the cron route**

  Create `src/app/api/cron/daily-briefing/route.ts`:

  ```typescript
  export const maxDuration = 60;
  import { NextRequest, NextResponse } from "next/server";
  import { createServiceClient } from "@/lib/supabase/server";

  async function sendTelegram(chatId: string, text: string) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  }

  export async function GET(req: NextRequest) {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const today = new Date().toISOString().split("T")[0];

    // Find all active trips whose users have telegram_chat_id set
    const { data: trips } = await supabase
      .from("trips")
      .select("id, title, destination, user_id, profiles!inner(telegram_chat_id)")
      .eq("status", "active")
      .not("profiles.telegram_chat_id", "is", null);

    let sent = 0;
    for (const trip of trips ?? []) {
      const profile = trip.profiles as unknown as { telegram_chat_id: string };
      const chatId = profile.telegram_chat_id;

      const { data: day } = await supabase
        .from("itinerary_days")
        .select("id")
        .eq("trip_id", trip.id)
        .eq("date", today)
        .single();

      if (!day) continue;

      const { data: activities } = await supabase
        .from("activities")
        .select("title, start_time, location_name, is_completed")
        .eq("day_id", day.id)
        .order("sort_order", { ascending: true });

      if (!activities?.length) continue;

      const lines = activities.map((a) =>
        `${a.is_completed ? "✅" : "⏰"} *${a.title}*${a.start_time ? ` — ${a.start_time}` : ""}${a.location_name ? `\n   📍 ${a.location_name}` : ""}`
      );

      await sendTelegram(
        chatId,
        `☀️ *Good morning! Today in ${trip.destination}*\n\n${lines.join("\n\n")}\n\nHave a great day!`
      );
      sent++;
    }

    return NextResponse.json({ sent });
  }
  ```

- [ ] **Step 2: Smoke test (manually trigger)**

  With dev server running and polling script active:
  ```bash
  curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
    http://localhost:3000/api/cron/daily-briefing
  ```

  Expected: Telegram message received on your phone (if you have an active trip today).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/cron/daily-briefing/route.ts
  git commit -m "feat: Telegram daily morning briefing cron"
  ```

---

### Task 4: Pre-trip email reminder

**Files:**
- Create: `src/app/api/cron/pre-trip-reminder/route.ts`

**Interfaces:**
- Consumes: `Resend` from `resend`, `createServiceClient()`
- Produces: users receive an email 3 days before their trip starts, and another the day before

- [ ] **Step 1: Create the cron route**

  Create `src/app/api/cron/pre-trip-reminder/route.ts`:

  ```typescript
  export const maxDuration = 60;
  import { NextRequest, NextResponse } from "next/server";
  import { Resend } from "resend";
  import { createServiceClient } from "@/lib/supabase/server";

  const resend = new Resend(process.env.RESEND_API_KEY);

  export async function GET(req: NextRequest) {
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const today = new Date();
    const in3Days = new Date(today.getTime() + 3 * 86400000).toISOString().split("T")[0];
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().split("T")[0];

    // Find planning trips starting in 3 days or tomorrow
    const { data: trips } = await supabase
      .from("trips")
      .select("id, title, destination, start_date, end_date, user_id, profiles!inner(full_name), auth.users!inner(email)")
      .eq("status", "planning")
      .in("start_date", [in3Days, tomorrow]);

    let sent = 0;
    for (const trip of trips ?? []) {
      const profile = trip.profiles as unknown as { full_name: string };
      const user = (trip as unknown as { "auth.users": { email: string } })["auth.users"];
      if (!user?.email) continue;

      const daysUntil = trip.start_date === tomorrow ? 1 : 3;
      const name = profile.full_name?.split(" ")[0] || "Traveler";

      await resend.emails.send({
        from: "TrailGuide AI <onboarding@resend.dev>",
        to: user.email,
        subject: `${daysUntil === 1 ? "Tomorrow" : "3 days"} until ${trip.destination}! ✈️`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2d6a4f;">Hi ${name}! Your trip is almost here 🌍</h2>
            <p>You're heading to <strong>${trip.destination}</strong> in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong>.</p>
            <p><strong>Trip dates:</strong> ${trip.start_date} → ${trip.end_date}</p>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://trailguide-ai.vercel.app"}/trips/${trip.id}/timeline"
               style="display:inline-block; background:#2d6a4f; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; margin-top:16px;">
              View your itinerary →
            </a>
            <p style="margin-top:24px; color:#888; font-size:12px;">TrailGuide AI · You're receiving this because you have a trip planned.</p>
          </div>
        `,
      });
      sent++;
    }

    return NextResponse.json({ sent });
  }
  ```

- [ ] **Step 2: Add NEXT_PUBLIC_SITE_URL to .env.local**

  Append to `.env.local`:
  ```
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```

  In Vercel, set this to the production URL after deploy.

- [ ] **Step 3: Smoke test**

  Create a test trip with `start_date` = 3 days from today. Then:

  ```bash
  curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
    http://localhost:3000/api/cron/pre-trip-reminder
  ```

  Expected: `{"sent": 1}` and email arrives in your inbox within 1 minute.

  Note: in Resend sandbox mode the email can only go to your own verified address.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/cron/pre-trip-reminder/route.ts .env.local
  git commit -m "feat: pre-trip email reminders 3 days and 1 day before departure"
  ```

---

### Task 5: Activity swipe-to-complete on Timeline

**Files:**
- Modify: `src/components/itinerary/ActivityCard.tsx`
- Modify: `src/components/itinerary/TimelineClient.tsx`
- Create: `src/app/api/activities/complete/route.ts`

**Interfaces:**
- Consumes: `Activity.id`, `Activity.is_completed` from `src/types/index.ts`
- Produces: `PATCH /api/activities/complete` toggles `is_completed` in DB; card shows checkmark immediately (optimistic)

- [ ] **Step 1: Create the toggle API route**

  Create `src/app/api/activities/complete/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function PATCH(req: NextRequest) {
    const { activityId, completed } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("activities")
      .update({ is_completed: completed })
      .eq("id", activityId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 2: Add check-off button to ActivityCard**

  In `src/components/itinerary/ActivityCard.tsx`, add `onToggleComplete` to `ActivityCardProps`:

  ```typescript
  interface ActivityCardProps {
    activity: Activity;
    isLast?: boolean;
    onReplace?: () => void;
    onToggleComplete?: (id: string, completed: boolean) => void;
  }
  ```

  Inside the card, next to the title:

  ```typescript
  {onToggleComplete && (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleComplete(activity.id, !activity.is_completed); }}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        activity.is_completed
          ? "bg-primary border-primary text-white"
          : "border-border text-transparent hover:border-primary/50"
      }`}
      title={activity.is_completed ? "Mark incomplete" : "Mark complete"}
    >
      <Check className="w-3 h-3" />
    </button>
  )}
  ```

  Also add `import { Check } from "lucide-react"` to the imports.

  Dim the card when completed:
  ```typescript
  <div className={`flex-1 pb-6 ${activity.is_completed ? "opacity-50" : ""}`}>
  ```

- [ ] **Step 3: Wire up optimistic toggle in TimelineClient**

  In `src/components/itinerary/TimelineClient.tsx`, add optimistic state:

  ```typescript
  const [completedOverrides, setCompletedOverrides] = useState<Record<string, boolean>>({});

  async function handleToggle(activityId: string, completed: boolean) {
    setCompletedOverrides((prev) => ({ ...prev, [activityId]: completed }));
    await fetch("/api/activities/complete", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, completed }),
    });
  }
  ```

  Pass to each card:
  ```typescript
  <ActivityCard
    activity={{
      ...activity,
      is_completed: completedOverrides[activity.id] ?? activity.is_completed,
    }}
    isLast={i === day.activities.length - 1}
    onReplace={() => setSelected({ activity, dayId: day.id })}
    onToggleComplete={handleToggle}
  />
  ```

- [ ] **Step 4: Test**

  Open Timeline. Tap the circle on any activity — it should turn green with a checkmark instantly. Refresh the page — completed state should persist.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/activities/ src/components/itinerary/ActivityCard.tsx src/components/itinerary/TimelineClient.tsx
  git commit -m "feat: activity check-off on timeline with optimistic UI"
  ```

---

### Task 6: Update deploy checklist and add Vercel env vars

**Files:**
- `DEPLOY_CHECKLIST.md` — update with new env vars and cron notes

- [ ] **Step 1: Update DEPLOY_CHECKLIST.md**

  Add to the Environment Variables section:
  ```
  RESEND_API_KEY=
  CRON_SECRET=
  NEXT_PUBLIC_SITE_URL=https://yourapp.vercel.app
  ```

  Add a new section:
  ```markdown
  ## 7. Cron Jobs (automatic after Vercel deploy)
  Vercel reads `vercel.json` and registers the crons automatically on deploy.
  Verify they appear at: Vercel Dashboard → Project → Settings → Cron Jobs
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add DEPLOY_CHECKLIST.md
  git commit -m "chore: update deploy checklist for Phase 7 env vars and crons"
  ```
