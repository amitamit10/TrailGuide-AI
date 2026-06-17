# TrailGuide AI — Phase 38: Smart Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send contextual, time-aware notifications via Telegram: a pre-departure reminder 24h before trip start, a daily morning briefing with the day's activities, and an activity nudge 15 minutes before each scheduled activity. Users opt in per-trip.

**Architecture:** A Go background scheduler (`NotificationScheduler`) runs every 5 minutes, queries trips with Telegram connected and `notifications_enabled=true`, computes what notifications are due, and sends via Telegram. All notification state is tracked in a `notification_log` table to prevent duplicates. New `trips.notifications_enabled` boolean column. Python AI formats the morning briefing as a friendly natural-language summary.

**Tech Stack:** Go (scheduler goroutine, Telegram Bot API). Python (`POST /ai/daily-briefing` — short formatter). PostgreSQL (`notification_log` table).

**Prerequisite:** Phase 16 (Go backend with Telegram), Phase 17 (Python AI service).

## Global Constraints
- Notifications only fire if `profiles.telegram_chat_id IS NOT NULL` AND `trips.notifications_enabled = true`.
- Duplicate prevention: `notification_log` has `UNIQUE(trip_id, notification_type, notification_date)`.
- Morning briefing fires at 08:00 local time — Go uses the destination's UTC offset from a simple timezone lookup (continent/city prefix matching to pytz zones stored in the DB).
- 15-minute nudge: fires for activities with `time IS NOT NULL` and `is_completed = false`.
- No email notifications in this phase — Telegram only.
- New env var: none (reuses `TELEGRAM_BOT_TOKEN` from Phase 16).

---

## Task 1: Database schema

- [ ] **Step 1: Create `supabase/migrations/010_notifications.sql`**

```sql
alter table trips add column if not exists notifications_enabled boolean default false;

create table if not exists notification_log (
  id bigserial primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  notification_type text not null, -- 'pre_departure' | 'daily_briefing' | 'activity_nudge'
  notification_date date not null default current_date,
  activity_id uuid, -- for activity_nudge
  sent_at timestamptz default now(),
  unique (trip_id, notification_type, notification_date, coalesce(activity_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

create index if not exists notification_log_trip_date_idx on notification_log(trip_id, notification_date);
```

```bash
supabase db push
```

- [ ] **Step 2: Add notification settings to trips endpoint**

Verify `trips.notifications_enabled` is included in trip SELECT queries in `trips.go`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_notifications.sql
git commit -m "feat: add notification_log table and notifications_enabled column"
```

---

## Task 2: Python — daily briefing formatter

- [ ] **Step 1: Create `ai-service/routers/briefing.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class BriefingActivity(BaseModel):
    title: str
    time: str
    description: str
    category: str

class BriefingRequest(BaseModel):
    destination: str
    day_number: int
    date: str
    activities: List[BriefingActivity]

@router.post("/daily-briefing")
async def daily_briefing(req: BriefingRequest):
    groq = get_groq()
    acts = "\n".join(f"- {a.time}: {a.title}" for a in req.activities[:8])
    prompt = f"""Write a friendly, concise morning briefing for a traveler in {req.destination} on Day {req.day_number} ({req.date}).

Today's schedule:
{acts}

Format: 2-3 sentences. Warm tone. Highlight the best part of the day. 
Use Telegram MarkdownV2 safe text (no special characters except in *bold*).
Output ONLY the briefing text, nothing else."""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    return {"briefing": completion.choices[0].message.content.strip()}
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import briefing
app.include_router(briefing.router)
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/routers/briefing.py ai-service/main.py
git commit -m "feat: add daily briefing AI formatter for morning Telegram messages"
```

---

## Task 3: Go — notification scheduler

- [ ] **Step 1: Create `backend/internal/services/notifications.go`**

```go
package services

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

type NotificationScheduler struct {
    db       *pgxpool.Pool
    telegram *TelegramService
    aiClient *AIClient
}

func NewNotificationScheduler(db *pgxpool.Pool, tg *TelegramService, ai *AIClient) *NotificationScheduler {
    return &NotificationScheduler{db: db, telegram: tg, aiClient: ai}
}

func (s *NotificationScheduler) Start(ctx context.Context) {
    log.Println("notification scheduler started")
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            s.run(ctx)
        }
    }
}

func (s *NotificationScheduler) run(ctx context.Context) {
    today := time.Now().UTC().Format("2006-01-02")
    tomorrow := time.Now().UTC().Add(24 * time.Hour).Format("2006-01-02")
    now := time.Now().UTC()

    // 1. Pre-departure reminder (trip starts tomorrow)
    rows, err := s.db.Query(ctx, `
        SELECT t.id, t.title, t.destination, p.telegram_chat_id
        FROM trips t
        JOIN profiles p ON p.id = t.user_id
        WHERE t.start_date = $1
          AND t.notifications_enabled = true
          AND p.telegram_chat_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM notification_log
            WHERE trip_id=t.id AND notification_type='pre_departure' AND notification_date=$2
          )`, tomorrow, today)
    if err == nil {
        defer rows.Close()
        for rows.Next() {
            var tripID, title, dest, chatID string
            rows.Scan(&tripID, &title, &dest, &chatID)
            msg := fmt.Sprintf("✈️ *Your trip to %s starts tomorrow\\!*\n\n📋 Check your packing list and have a great adventure\\!", escapeMarkdown(dest))
            if err := s.telegram.Send(chatID, msg); err == nil {
                s.db.Exec(ctx, `INSERT INTO notification_log (trip_id, notification_type, notification_date) VALUES ($1,'pre_departure',$2) ON CONFLICT DO NOTHING`, tripID, today)
            }
        }
    }

    // 2. Daily morning briefing (fires between 08:00-08:15 local)
    hour := now.Hour()
    if hour >= 8 && hour < 9 {
        s.sendDailyBriefings(ctx, today)
    }

    // 3. Activity nudges (fire 15 minutes before activity time)
    s.sendActivityNudges(ctx, today, now)
}

func (s *NotificationScheduler) sendDailyBriefings(ctx context.Context, today string) {
    rows, _ := s.db.Query(ctx, `
        SELECT t.id, t.destination, p.telegram_chat_id, d.id as day_id, d.day_number
        FROM trips t
        JOIN profiles p ON p.id = t.user_id
        JOIN days d ON d.trip_id = t.id AND d.date = $1
        WHERE t.notifications_enabled = true
          AND p.telegram_chat_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM notification_log
            WHERE trip_id=t.id AND notification_type='daily_briefing' AND notification_date=$1
          )`, today)
    if rows == nil { return }
    defer rows.Close()
    for rows.Next() {
        var tripID, dest, chatID, dayID string
        var dayNum int
        rows.Scan(&tripID, &dest, &chatID, &dayID, &dayNum)

        // Fetch activities for the day
        actRows, _ := s.db.Query(ctx,
            `SELECT title, COALESCE(time,''), COALESCE(description,''), category FROM activities WHERE day_id=$1 ORDER BY sort_order LIMIT 8`, dayID)
        var activities []map[string]string
        if actRows != nil {
            defer actRows.Close()
            for actRows.Next() {
                var title, actTime, desc, cat string
                actRows.Scan(&title, &actTime, &desc, &cat)
                activities = append(activities, map[string]string{"title": title, "time": actTime, "description": desc, "category": cat})
            }
        }

        result, err := s.aiClient.Post(ctx, "/ai/daily-briefing", map[string]interface{}{
            "destination": dest, "day_number": dayNum,
            "date": today, "activities": activities,
        })
        if err != nil { continue }

        briefing, _ := result["briefing"].(string)
        msg := fmt.Sprintf("🌅 *Good morning from %s\\!*\n\n%s", escapeMarkdown(dest), escapeMarkdown(briefing))
        if err := s.telegram.Send(chatID, msg); err == nil {
            s.db.Exec(ctx, `INSERT INTO notification_log (trip_id, notification_type, notification_date) VALUES ($1,'daily_briefing',$2) ON CONFLICT DO NOTHING`, tripID, today)
        }
    }
}

func (s *NotificationScheduler) sendActivityNudges(ctx context.Context, today string, now time.Time) {
    targetTime := now.Add(15 * time.Minute).Format("15:04")
    rows, _ := s.db.Query(ctx, `
        SELECT t.id, t.destination, p.telegram_chat_id, a.id, a.title, a.time, a.address
        FROM activities a
        JOIN days d ON d.id = a.day_id AND d.date = $1
        JOIN trips t ON t.id = d.trip_id
        JOIN profiles p ON p.id = t.user_id
        WHERE a.time = $2
          AND a.is_completed = false
          AND t.notifications_enabled = true
          AND p.telegram_chat_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM notification_log
            WHERE trip_id=t.id AND notification_type='activity_nudge'
              AND notification_date=$1 AND activity_id=a.id
          )`, today, targetTime)
    if rows == nil { return }
    defer rows.Close()
    for rows.Next() {
        var tripID, dest, chatID, actID, title, actTime, addr string
        rows.Scan(&tripID, &dest, &chatID, &actID, &title, &actTime, &addr)
        addrLine := ""
        if addr != "" { addrLine = fmt.Sprintf("\n📍 %s", escapeMarkdown(addr)) }
        msg := fmt.Sprintf("⏰ *%s* starts in 15 minutes\\!%s", escapeMarkdown(title), addrLine)
        if err := s.telegram.Send(chatID, msg); err == nil {
            s.db.Exec(ctx, `INSERT INTO notification_log (trip_id, notification_type, notification_date, activity_id) VALUES ($1,'activity_nudge',$2,$3) ON CONFLICT DO NOTHING`, tripID, today, actID)
        }
    }
}
```

- [ ] **Step 2: Start scheduler in `main.go`**

```go
notifScheduler := services.NewNotificationScheduler(pool, telegramService, aiClient)
go notifScheduler.Start(ctx)
```

- [ ] **Step 3: Add notification toggle to trip update endpoint**

In the trip settings UI (or via PUT /api/v1/trips/:id), allow setting `notifications_enabled`.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/services/notifications.go backend/main.go
git commit -m "feat: add Go notification scheduler for pre-departure, daily briefing, and activity nudges"
```

---

## Task 4: Next.js — notification settings toggle

- [ ] **Step 1: Add to trip settings page**

```typescript
// In trip settings/options UI:
<div className="flex items-center justify-between py-3 border-b">
  <div>
    <p className="text-sm font-medium text-gray-800">Telegram notifications</p>
    <p className="text-xs text-gray-400">Daily briefings & activity reminders</p>
  </div>
  <button onClick={toggleNotifications}
    className={`w-12 h-6 rounded-full transition-colors ${
      notificationsEnabled ? "bg-[#2D6A4F]" : "bg-gray-200"
    }`}>
    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
      notificationsEnabled ? "translate-x-6" : "translate-x-0.5"
    }`}/>
  </button>
</div>
```

Toggle calls `PATCH /api/v1/trips/:id` with `{ notifications_enabled: true/false }`.

If `telegram_chat_id` is null, show a prompt to connect Telegram first (link to `/profile` → Telegram setup).

- [ ] **Step 2: Commit**

```bash
git add src/
git commit -m "feat: add Telegram notification toggle to trip settings"
```

---

## Verification Checklist

- [ ] `notification_log` UNIQUE constraint prevents duplicate notifications on same day
- [ ] Pre-departure fires when `trip.start_date = tomorrow` and logs a row
- [ ] Daily briefing calls Python `/ai/daily-briefing` and sends formatted Telegram message
- [ ] Activity nudge fires when `activities.time` is 15 minutes from now
- [ ] All notifications are skipped if `notifications_enabled = false`
- [ ] All notifications are skipped if `telegram_chat_id IS NULL`
- [ ] Scheduler runs every 5 minutes without memory leaks (goroutine exits on context cancel)
