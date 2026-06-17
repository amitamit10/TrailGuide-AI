# TrailGuide AI — Phase 50: Public Trip Sharing & Social

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users make trips public (readable by anyone with the link, no login required), add a public trip browser/explore feed, and allow "forking" someone else's public trip into your own account. Completes Phase E and rounds out the web app before the mobile phase.

**Architecture:** `trips.is_public` boolean (already exists). A Go public endpoint `GET /public/trips/:id` returns trip data without auth. Next.js public trip view at `/t/:id` (no layout auth requirement). A "Discover" page at `/discover` shows recently made-public trips. "Fork" button calls `POST /api/v1/trips/:id/fork` which clones the public trip to the logged-in user's account.

**Tech Stack:** Go (public endpoints, fork handler), Next.js (public view, discover page).

**Prerequisite:** Phase 19 (Go backend with trips/days/activities). Phase 49 (OG images for sharing).

## Global Constraints
- Public trip view shows timeline read-only — no edit, no complete, no delete.
- Fork copies trip + days + activities but NOT expenses, packing items, photos, or members.
- `GET /public/trips/:id` has no auth — anyone can access if `is_public=true`.
- The discover feed shows the 20 most recently publicized trips (no search in this phase).
- Making a trip public requires confirmation: "Anyone with the link can view your itinerary."

---

## Task 1: Go — public trip endpoints

- [ ] **Step 1: Create `backend/internal/handlers/public.go`**

```go
package handlers

import (
    "context"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

type PublicHandler struct{ db *pgxpool.Pool }
func NewPublicHandler(db *pgxpool.Pool) *PublicHandler { return &PublicHandler{db: db} }

// GetTrip — public, no auth. Returns trip + days + activities for public trips.
func (h *PublicHandler) GetTrip(c *gin.Context) {
    tripID := c.Param("id")

    var trip struct {
        ID, Title, Destination, StartDate, EndDate, TripStyle, Budget string
        Travelers int
        IsPublic  bool
    }
    err := h.db.QueryRow(c.Request.Context(),
        `SELECT id, title, destination, start_date, end_date, trip_style, budget, travelers, is_public
         FROM trips WHERE id=$1`, tripID).
        Scan(&trip.ID, &trip.Title, &trip.Destination, &trip.StartDate, &trip.EndDate,
            &trip.TripStyle, &trip.Budget, &trip.Travelers, &trip.IsPublic)
    if err != nil || !trip.IsPublic {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
        return
    }

    rows, _ := h.db.Query(c.Request.Context(),
        `SELECT d.id, d.date, d.day_number,
                a.id, a.title, a.description, a.time, a.duration, a.cost, a.category, a.address, a.photo_url, a.sort_order
         FROM days d
         LEFT JOIN activities a ON a.day_id = d.id
         WHERE d.trip_id=$1
         ORDER BY d.day_number, a.sort_order`, tripID)
    defer rows.Close()

    days := map[string]map[string]interface{}{}
    for rows.Next() {
        var dayID, dayDate string; var dayNum int
        var actID, actTitle, actDesc, actTime, actDur, actCat, actAddr, actPhoto *string
        var actCost *float64; var actOrder *int
        rows.Scan(&dayID, &dayDate, &dayNum, &actID, &actTitle, &actDesc, &actTime,
            &actDur, &actCost, &actCat, &actAddr, &actPhoto, &actOrder)
        if _, ok := days[dayID]; !ok {
            days[dayID] = map[string]interface{}{"id":dayID,"date":dayDate,"day_number":dayNum,"activities":[]map[string]interface{}{}}
        }
        if actID != nil {
            act := map[string]interface{}{
                "id": *actID, "title": str(actTitle), "description": str(actDesc),
                "time": str(actTime), "duration": str(actDur),
                "cost": actCost, "category": str(actCat), "address": str(actAddr),
                "photo_url": str(actPhoto), "sort_order": actOrder,
            }
            days[dayID]["activities"] = append(days[dayID]["activities"].([]map[string]interface{}), act)
        }
    }

    var dayList []map[string]interface{}
    for _, d := range days { dayList = append(dayList, d) }
    // sort by day_number
    sort.Slice(dayList, func(i,j int) bool {
        return dayList[i]["day_number"].(int) < dayList[j]["day_number"].(int)
    })

    c.JSON(http.StatusOK, gin.H{"data": gin.H{
        "trip": trip, "days": dayList,
    }})
}

// Discover — returns 20 most recently publicized trips
func (h *PublicHandler) Discover(c *gin.Context) {
    rows, _ := h.db.Query(c.Request.Context(),
        `SELECT id, title, destination, start_date, end_date, trip_style, budget
         FROM trips WHERE is_public=true ORDER BY updated_at DESC LIMIT 20`)
    defer rows.Close()
    var trips []map[string]interface{}
    for rows.Next() {
        var id, title, dest, start, end, style, budget string
        rows.Scan(&id, &title, &dest, &start, &end, &style, &budget)
        trips = append(trips, map[string]interface{}{
            "id":id,"title":title,"destination":dest,"start_date":start,"end_date":end,
            "trip_style":style,"budget":budget,
        })
    }
    if trips == nil { trips = []map[string]interface{}{} }
    c.JSON(http.StatusOK, gin.H{"data": trips})
}

// Fork — copies a public trip to the authenticated user's account
func (h *PublicHandler) Fork(c *gin.Context) {
    tripID := c.Param("id")
    userID := c.GetString("user_id")

    // Verify trip is public
    var isPublic bool
    h.db.QueryRow(c.Request.Context(), `SELECT is_public FROM trips WHERE id=$1`, tripID).Scan(&isPublic)
    if !isPublic {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
        return
    }

    // Clone trips → days → activities (same pattern as Template.Clone)
    var newTripID string
    h.db.QueryRow(c.Request.Context(),
        `INSERT INTO trips (user_id, title, destination, start_date, end_date, travelers, trip_style, interests, transport_mode, budget, currency, is_public)
         SELECT $1, title, destination, start_date, end_date, travelers, trip_style, interests, transport_mode, budget, currency, false
         FROM trips WHERE id=$2 RETURNING id`, userID, tripID).Scan(&newTripID)

    h.db.Exec(c.Request.Context(),
        `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1,$2,'owner')`, newTripID, userID)

    // Copy days and activities
    dayRows, _ := h.db.Query(c.Request.Context(),
        `SELECT id, date, day_number FROM days WHERE trip_id=$1 ORDER BY day_number`, tripID)
    defer dayRows.Close()
    for dayRows.Next() {
        var oldDayID, date string; var dayNum int
        dayRows.Scan(&oldDayID, &date, &dayNum)
        var newDayID string
        h.db.QueryRow(c.Request.Context(),
            `INSERT INTO days (trip_id, date, day_number) VALUES ($1,$2,$3) RETURNING id`,
            newTripID, date, dayNum).Scan(&newDayID)
        h.db.Exec(c.Request.Context(),
            `INSERT INTO activities (day_id, trip_id, title, description, time, duration, cost, category, address, photo_query, sort_order)
             SELECT $1, $2, title, description, time, duration, cost, category, address, photo_query, sort_order
             FROM activities WHERE day_id=$3`, newDayID, newTripID, oldDayID)
    }

    c.JSON(http.StatusCreated, gin.H{"data": gin.H{"trip_id": newTripID}})
}

func str(s *string) string { if s == nil { return "" }; return *s }
```

- [ ] **Step 2: Wire routes**

```go
// Public — no auth
pub := r.Group("/public")
pub.GET("/trips/:id", publicHandler.GetTrip)
pub.GET("/trips", publicHandler.Discover)

// Authenticated — fork a public trip
v1.POST("/trips/:id/fork", publicHandler.Fork)

// Toggle visibility (add to trip handler)
v1.PATCH("/trips/:id/visibility", tripHandler.SetVisibility)
```

- [ ] **Step 3: Add visibility toggle to trip handler**

```go
func (h *TripHandler) SetVisibility(c *gin.Context) {
    tripID := c.Param("id")
    userID := c.GetString("user_id")
    var body struct{ IsPublic bool `json:"is_public"` }
    c.ShouldBindJSON(&body)
    result, _ := h.db.Exec(c.Request.Context(),
        `UPDATE trips SET is_public=$1, updated_at=NOW() WHERE id=$2 AND id IN (SELECT trip_id FROM trip_members WHERE user_id=$3 AND role='owner')`,
        body.IsPublic, tripID, userID)
    if result.RowsAffected() == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found or not owner"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"is_public": body.IsPublic}})
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/public.go backend/main.go
git commit -m "feat: add public trip view, discover feed, and fork endpoints"
```

---

## Task 2: Next.js — public trip view + discover

- [ ] **Step 1: Create `src/app/t/[id]/page.tsx`** — public, no auth gate

```typescript
// Fetches from /public/trips/:id (no auth)
// Shows read-only timeline
// "Fork this trip" button (requires login — redirects to /login?redirect=/t/id if not authenticated)
// OG meta tags for sharing
```

- [ ] **Step 2: Create `src/app/(app)/discover/page.tsx`**

```typescript
// Fetches /public/trips (no auth)
// Shows grid of 20 public trips
// Each card: destination, title, duration, style
// Click → /t/:id
```

- [ ] **Step 3: Add "Make public" toggle to trip settings**

In trip settings panel:
```typescript
async function togglePublic() {
  if (!trip.is_public) {
    if (!confirm("Anyone with the link can view your full itinerary. Make this trip public?")) return;
  }
  await api.patch(`/api/v1/trips/${tripId}/visibility`, { is_public: !trip.is_public });
  refetch();
}
```

- [ ] **Step 4: Add "Fork trip" button on public trip view**

```typescript
async function fork() {
  if (!session) { router.push(`/login?redirect=/t/${tripId}`); return; }
  const r = await api.post<{ data: { trip_id: string } }>(`/api/v1/trips/${tripId}/fork`, {});
  router.push(`/trips/${r.data.trip_id}/timeline`);
  analytics.track("trip_forked", { source_trip: tripId });
}
```

- [ ] **Step 5: Add Discover to navigation**

```tsx
{ label: "Discover", href: "/discover", icon: "🌐" }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/t/ src/app/\(app\)/discover/ src/
git commit -m "feat: add public trip view, discover feed, make-public toggle, and fork trip"
```

---

## Verification Checklist

- [ ] `GET /public/trips/:id` returns trip+days+activities for public trips, 404 for private
- [ ] `/t/:tripId` renders read-only timeline without requiring login
- [ ] Pasting `/t/:tripId` in Slack shows OG image (destination + title)
- [ ] "Fork trip" creates a copy in authenticated user's account
- [ ] Private trip → 404 on public endpoint
- [ ] Discover page shows 20 most recent public trips
- [ ] "Make public" toggle shows confirmation before exposing trip
- [ ] `is_public=false` is the default for all new trips
