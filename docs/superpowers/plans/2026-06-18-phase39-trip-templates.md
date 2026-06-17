# TrailGuide AI — Phase 39: Trip Templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide 20 pre-built trip templates for popular destinations (Tokyo, Bali, Paris, NYC, etc.). Users can browse templates on a "Templates" tab, preview the itinerary, and clone it to their account with one click — instantly getting a ready-made trip they can customize.

**Architecture:** Templates are stored as JSON seed files in `backend/templates/`. A Go startup routine loads them into a `trip_templates` table if not present. Two Go endpoints: `GET /api/v1/templates` (browse) and `POST /api/v1/templates/:id/clone` (copies template to user's trips + days + activities). Next.js Templates page with cards and a preview drawer.

**Tech Stack:** Go, PostgreSQL, Next.js. No AI calls for this phase — templates are pre-written.

**Prerequisite:** Phase 19 (Go backend with trips/days/activities CRUD).

## Global Constraints
- Templates are GLOBAL (not per-user). Only admins can create/update templates (via DB directly for now).
- Clone creates a real trip + days + activities owned by the cloning user. Start date defaults to 2 weeks from now.
- Template preview shows the first 3 activities from day 1 as a teaser.
- Templates have a `difficulty` field: "easy" | "moderate" | "adventurous".

---

## Task 1: Database + seed data

- [ ] **Step 1: Create `supabase/migrations/011_templates.sql`**

```sql
create table if not exists trip_templates (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  destination text not null,
  country text not null,
  duration_days int not null,
  trip_style text not null,
  difficulty text check (difficulty in ('easy','moderate','adventurous')) default 'moderate',
  tagline text not null,
  highlights text[] default '{}',
  photo_query text not null,
  interests text[] default '{}',
  transport_mode text default 'public',
  budget text default 'medium',
  template_data jsonb not null,  -- { days: [{ day_number, activities: [] }] }
  created_at timestamptz default now()
);

create index if not exists templates_destination_idx on trip_templates(destination);
```

```bash
supabase db push
```

- [ ] **Step 2: Create `backend/templates/tokyo.json`** (representative sample — create 20 total)

```json
{
  "title": "Tokyo Explorer",
  "destination": "Tokyo, Japan",
  "country": "Japan",
  "duration_days": 7,
  "trip_style": "explorer",
  "difficulty": "easy",
  "tagline": "Temples, ramen, and neon lights in the world's most exciting city",
  "highlights": ["Senso-ji Temple", "Shibuya Crossing", "TeamLab Borderless", "Tsukiji Market"],
  "photo_query": "Tokyo skyline night lights",
  "interests": ["culture", "food", "technology"],
  "transport_mode": "public",
  "budget": "medium",
  "template_data": {
    "days": [
      {
        "day_number": 1,
        "activities": [
          {"title":"Senso-ji Temple at Sunrise","description":"Beat the crowds at Tokyo's oldest temple. Arrive before 8am for the magical morning light.","time":"07:00","duration":"2 hours","cost":0,"category":"attraction","address":"2-3-1 Asakusa, Taito City","photo_query":"Senso-ji Temple sunrise"},
          {"title":"Asakusa Street Breakfast","description":"Try freshly made ningyo-yaki (sweet cakes) from street stalls outside the temple.","time":"09:00","duration":"30 mins","cost":5,"category":"food","address":"Nakamise Shopping Street, Asakusa"},
          {"title":"Tokyo Skytree","description":"Panoramic views of the city from 450m up. Book tickets in advance.","time":"10:30","duration":"2 hours","cost":25,"category":"attraction","address":"1-1-2 Oshiage, Sumida"},
          {"title":"Ueno Park & Museums","description":"Visit the Tokyo National Museum or the Ueno Zoo, depending on your interests.","time":"14:00","duration":"3 hours","cost":10,"category":"attraction","address":"Uenokoen, Taito City"},
          {"title":"Ramen at Ichiran Shibuya","description":"Solo dining experience in the famous private booth ramen shop.","time":"19:00","duration":"1 hour","cost":15,"category":"food","address":"1 Chome-22-7 Jinnan, Shibuya"}
        ]
      }
    ]
  }
}
```

Create similar JSON files for: Bali, Paris, Barcelona, New York, Rome, Amsterdam, Lisbon, Bangkok, Singapore, Sydney, Marrakech, Cape Town, Mexico City, Prague, Vienna, Kyoto, Dubai, Reykjavik, Santorini (19 more).

For expedience during implementation: generate 5-activity day 1 for each. Later phases can expand to full multi-day templates.

- [ ] **Step 3: Create Go template seeder `backend/internal/services/template_seeder.go`**

```go
package services

import (
    "context"
    "encoding/json"
    "os"
    "path/filepath"
    "log"

    "github.com/jackc/pgx/v5/pgxpool"
)

func SeedTemplates(ctx context.Context, db *pgxpool.Pool, dir string) {
    var count int
    db.QueryRow(ctx, `SELECT COUNT(*) FROM trip_templates`).Scan(&count)
    if count > 0 { return } // Already seeded

    entries, err := os.ReadDir(dir)
    if err != nil { log.Printf("template seeder: %v", err); return }

    for _, e := range entries {
        if filepath.Ext(e.Name()) != ".json" { continue }
        data, err := os.ReadFile(filepath.Join(dir, e.Name()))
        if err != nil { continue }

        var t struct {
            Title        string          `json:"title"`
            Destination  string          `json:"destination"`
            Country      string          `json:"country"`
            DurationDays int             `json:"duration_days"`
            TripStyle    string          `json:"trip_style"`
            Difficulty   string          `json:"difficulty"`
            Tagline      string          `json:"tagline"`
            Highlights   []string        `json:"highlights"`
            PhotoQuery   string          `json:"photo_query"`
            Interests    []string        `json:"interests"`
            TransportMode string         `json:"transport_mode"`
            Budget       string          `json:"budget"`
            TemplateData json.RawMessage `json:"template_data"`
        }
        if err := json.Unmarshal(data, &t); err != nil { continue }

        db.Exec(ctx,
            `INSERT INTO trip_templates (title, destination, country, duration_days, trip_style, difficulty, tagline, highlights, photo_query, interests, transport_mode, budget, template_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            t.Title, t.Destination, t.Country, t.DurationDays, t.TripStyle, t.Difficulty,
            t.Tagline, t.Highlights, t.PhotoQuery, t.Interests, t.TransportMode, t.Budget, t.TemplateData)
        log.Printf("seeded template: %s", t.Title)
    }
}
```

Call in `main.go`:
```go
go services.SeedTemplates(ctx, pool, "./templates")
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_templates.sql backend/templates/ backend/internal/services/template_seeder.go
git commit -m "feat: add trip_templates table and JSON seed files for 20 destinations"
```

---

## Task 2: Go — template handlers

- [ ] **Step 1: Create `backend/internal/handlers/templates.go`**

```go
package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

type TemplateHandler struct{ db *pgxpool.Pool }
func NewTemplateHandler(db *pgxpool.Pool) *TemplateHandler { return &TemplateHandler{db: db} }

func (h *TemplateHandler) List(c *gin.Context) {
    rows, err := h.db.Query(c.Request.Context(),
        `SELECT id, title, destination, country, duration_days, trip_style, difficulty, tagline, highlights, photo_query, interests, budget
         FROM trip_templates ORDER BY title`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
        return
    }
    defer rows.Close()
    var templates []map[string]interface{}
    for rows.Next() {
        var id, title, dest, country, style, diff, tagline, photoQ, budget string
        var days int
        var highlights, interests []string
        rows.Scan(&id, &title, &dest, &country, &days, &style, &diff, &tagline, &highlights, &photoQ, &interests, &budget)
        templates = append(templates, map[string]interface{}{
            "id": id, "title": title, "destination": dest, "country": country,
            "duration_days": days, "trip_style": style, "difficulty": diff,
            "tagline": tagline, "highlights": highlights, "photo_query": photoQ,
            "interests": interests, "budget": budget,
        })
    }
    if templates == nil { templates = []map[string]interface{}{} }
    c.JSON(http.StatusOK, gin.H{"data": templates})
}

func (h *TemplateHandler) Clone(c *gin.Context) {
    templateID := c.Param("id")
    userID := c.GetString("user_id")

    var tmpl struct {
        Title, Destination, TripStyle, TransportMode, Budget string
        DurationDays int
        Interests, Highlights []string
        TemplateData json.RawMessage
    }
    err := h.db.QueryRow(c.Request.Context(),
        `SELECT title, destination, trip_style, transport_mode, budget, duration_days, interests, highlights, template_data
         FROM trip_templates WHERE id=$1`, templateID).
        Scan(&tmpl.Title, &tmpl.Destination, &tmpl.TripStyle, &tmpl.TransportMode, &tmpl.Budget,
            &tmpl.DurationDays, &tmpl.Interests, &tmpl.Highlights, &tmpl.TemplateData)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "template not found"})
        return
    }

    // Default start date: 14 days from now
    startDate := time.Now().UTC().AddDate(0, 0, 14).Format("2006-01-02")
    endDate := time.Now().UTC().AddDate(0, 0, 14+tmpl.DurationDays).Format("2006-01-02")

    // Create trip
    var tripID string
    h.db.QueryRow(c.Request.Context(),
        `INSERT INTO trips (user_id, title, destination, start_date, end_date, travelers, trip_style, interests, transport_mode, budget, currency)
         VALUES ($1,$2,$3,$4,$5,2,$6,$7,$8,$9,'USD') RETURNING id`,
        userID, tmpl.Title, tmpl.Destination, startDate, endDate,
        tmpl.TripStyle, tmpl.Interests, tmpl.TransportMode, tmpl.Budget).Scan(&tripID)

    // Add to trip_members
    h.db.Exec(c.Request.Context(),
        `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1,$2,'owner')`, tripID, userID)

    // Create days + activities from template_data
    var templateData struct {
        Days []struct {
            DayNumber  int    `json:"day_number"`
            Activities []struct {
                Title, Description, Time, Duration, Category, Address, PhotoQuery string
                Cost float64
            } `json:"activities"`
        } `json:"days"`
    }
    json.Unmarshal(tmpl.TemplateData, &templateData)

    for _, day := range templateData.Days {
        date := time.Now().UTC().AddDate(0, 0, 14+day.DayNumber-1).Format("2006-01-02")
        var dayID string
        h.db.QueryRow(c.Request.Context(),
            `INSERT INTO days (trip_id, date, day_number) VALUES ($1,$2,$3) RETURNING id`,
            tripID, date, day.DayNumber).Scan(&dayID)
        for i, act := range day.Activities {
            h.db.Exec(c.Request.Context(),
                `INSERT INTO activities (day_id, trip_id, title, description, time, duration, cost, category, address, photo_query, sort_order)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                dayID, tripID, act.Title, act.Description, act.Time, act.Duration,
                act.Cost, act.Category, act.Address, act.PhotoQuery, i)
        }
    }

    c.JSON(http.StatusCreated, gin.H{"data": gin.H{"trip_id": tripID}})
}
```

- [ ] **Step 2: Wire routes**

```go
// Public — no auth needed for browsing
r.GET("/api/v1/templates", templateHandler.List)
// Auth required for cloning
v1.POST("/templates/:id/clone", templateHandler.Clone)
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/templates.go backend/main.go
git commit -m "feat: add template list and clone endpoints"
```

---

## Task 3: Next.js — Templates browser

- [ ] **Step 1: Create `src/app/(app)/templates/page.tsx` and `TemplatesClient.tsx`**

Templates page shows a 2-column grid of cards. Each card: hero photo (via photo proxy), destination name, duration, difficulty badge, tagline, and "Use this template →" button. Clicking opens a bottom drawer with the first day's activities as a preview, then a "Clone trip" CTA.

Key component structure:
```typescript
// TemplateCard: image + destination + duration + difficulty badge + tagline
// TemplateDrawer: slides up from bottom, shows Day 1 activities, Clone button
// TemplatesClient: fetch /api/v1/templates (public, no auth), render grid
```

After clone: navigate to `/trips/${newTripId}/timeline`.

- [ ] **Step 2: Add Templates to main navigation**

```tsx
{ label: "Templates", href: "/templates", icon: "📋" }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/templates/
git commit -m "feat: add templates browser page with preview drawer and one-click clone"
```

---

## Verification Checklist

- [ ] `GET /api/v1/templates` returns 20 templates without auth
- [ ] `POST /api/v1/templates/:id/clone` creates a trip + days + activities for the calling user
- [ ] Cloned trip appears on the dashboard with the correct destination and dates
- [ ] Template seeder runs on Go startup and skips if templates already exist
- [ ] Template cards show hero photo from the photo proxy
- [ ] Preview drawer shows Day 1 activities
- [ ] Clone navigates to the new trip's timeline
