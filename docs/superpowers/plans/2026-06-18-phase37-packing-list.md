# TrailGuide AI — Phase 37: AI Packing List

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a personalized packing list via AI based on the trip's destination, dates, style, and activities. Items are stored per-trip, checkable, and categorized. Shareable with trip collaborators.

**Architecture:** Python route `POST /ai/packing-list` generates a categorized list. Go stores items in a `packing_items` table (one row per item, with checked state). Next.js Packing tab shows items by category, with "Generate with AI" button and manual add/delete. All trip members can check/uncheck items; editors can add/delete.

**Tech Stack:** Python (Groq llama-3.1-8b-instant), Go (CRUD), Next.js.

**Prerequisite:** Phase 19 (Go backend), Phase 17 (Python AI service).

## Global Constraints
- Items are stored per trip (not per user) — shared packing list.
- Category order: documents, clothing, toiletries, electronics, medications, activities, other.
- "Generate with AI" replaces ALL existing items (with confirmation prompt).
- Items are soft-sorted by category — no drag-to-reorder in this phase.

---

## Task 1: Python — packing list route

- [ ] **Step 1: Create `ai-service/routers/packing.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class PackingRequest(BaseModel):
    destination: str
    start_date: str
    end_date: str
    trip_style: str
    travelers: int
    interests: List[str] = []
    activities_preview: List[str] = []  # First 10 activity titles

CATEGORIES = ["documents", "clothing", "toiletries", "electronics", "medications", "activities", "other"]

@router.post("/packing-list")
async def generate_packing_list(req: PackingRequest):
    groq = get_groq()
    from datetime import date
    start = date.fromisoformat(req.start_date)
    end = date.fromisoformat(req.end_date)
    nights = (end - start).days
    activities_str = ", ".join(req.activities_preview[:10]) if req.activities_preview else "general sightseeing"
    prompt = f"""Generate a packing list for this trip:
Destination: {req.destination}
Duration: {nights} nights
Style: {req.trip_style}
Travelers: {req.travelers}
Planned activities: {activities_str}

Rules:
- Be specific and practical (e.g. "power adapter (Type C)" not just "adapter")
- Include ONLY items relevant to THIS destination and style
- Do NOT include common sense items everyone owns (phone, wallet, keys)
- Suggested quantity for clothing based on {nights} nights

Return ONLY valid JSON:
{{
  "items": [
    {{"name": "item name", "category": "one of: {', '.join(CATEGORIES)}", "quantity": "1 pair / 3 shirts / etc", "note": "optional short note"}}
  ]
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1500,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import packing
app.include_router(packing.router)
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST http://localhost:8081/ai/packing-list \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan","start_date":"2026-08-01","end_date":"2026-08-07","trip_style":"explorer","travelers":2,"interests":["food","technology"]}' \
  | python3 -m json.tool | head -40
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/packing.py ai-service/main.py
git commit -m "feat: add AI packing list generation route (Groq llama-3.1-8b)"
```

---

## Task 2: Database + Go handlers

- [ ] **Step 1: Create `supabase/migrations/009_packing.sql`**

```sql
create table if not exists packing_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  category text not null,
  quantity text default '1',
  note text default '',
  is_packed boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index if not exists packing_items_trip_idx on packing_items(trip_id, category);

alter table packing_items enable row level security;
create policy "members can view packing items" on packing_items
  for select using (
    exists (select 1 from trip_members where trip_id = packing_items.trip_id and user_id = auth.uid())
  );
create policy "members can update packing items" on packing_items
  for update using (
    exists (select 1 from trip_members where trip_id = packing_items.trip_id and user_id = auth.uid())
  );
create policy "editors can insert packing items" on packing_items
  for insert with check (
    exists (select 1 from trip_members where trip_id = packing_items.trip_id and user_id = auth.uid() and role in ('owner','editor'))
  );
create policy "editors can delete packing items" on packing_items
  for delete using (
    exists (select 1 from trip_members where trip_id = packing_items.trip_id and user_id = auth.uid() and role in ('owner','editor'))
  );
```

```bash
supabase db push
```

- [ ] **Step 2: Create `backend/internal/handlers/packing.go`**

```go
package handlers

import (
    "context"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

type PackingHandler struct{ db *pgxpool.Pool; aiClient *AIClient }

func NewPackingHandler(db *pgxpool.Pool, ai *AIClient) *PackingHandler {
    return &PackingHandler{db: db, aiClient: ai}
}

func (h *PackingHandler) isMember(ctx context.Context, tripID, userID string) bool {
    var ok bool
    h.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2)`, tripID, userID).Scan(&ok)
    return ok
}

func (h *PackingHandler) List(c *gin.Context) {
    tripID := c.Param("tripId")
    userID := c.GetString("user_id")
    if !h.isMember(c.Request.Context(), tripID, userID) {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
        return
    }
    rows, err := h.db.Query(c.Request.Context(),
        `SELECT id, name, category, quantity, note, is_packed, sort_order
         FROM packing_items WHERE trip_id=$1 ORDER BY category, sort_order`, tripID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
        return
    }
    defer rows.Close()
    var items []map[string]interface{}
    for rows.Next() {
        var id, name, cat, qty, note string
        var packed bool
        var order int
        rows.Scan(&id, &name, &cat, &qty, &note, &packed, &order)
        items = append(items, map[string]interface{}{
            "id": id, "name": name, "category": cat, "quantity": qty,
            "note": note, "is_packed": packed, "sort_order": order,
        })
    }
    if items == nil { items = []map[string]interface{}{} }
    c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *PackingHandler) Generate(c *gin.Context) {
    tripID := c.Param("tripId")
    userID := c.GetString("user_id")
    if !h.isMember(c.Request.Context(), tripID, userID) {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
        return
    }
    // Fetch trip details for AI context
    var trip struct{ Destination, StartDate, EndDate, TripStyle string; Travelers int }
    h.db.QueryRow(c.Request.Context(),
        `SELECT destination, start_date, end_date, trip_style, travelers FROM trips WHERE id=$1`, tripID).
        Scan(&trip.Destination, &trip.StartDate, &trip.EndDate, &trip.TripStyle, &trip.Travelers)

    // Fetch first 10 activity titles
    actRows, _ := h.db.Query(c.Request.Context(),
        `SELECT a.title FROM activities a JOIN days d ON d.id=a.day_id WHERE d.trip_id=$1 LIMIT 10`, tripID)
    defer actRows.Close()
    var activities []string
    for actRows.Next() {
        var t string; actRows.Scan(&t); activities = append(activities, t)
    }

    result, err := h.aiClient.Post(c.Request.Context(), "/ai/packing-list", map[string]interface{}{
        "destination": trip.Destination, "start_date": trip.StartDate,
        "end_date": trip.EndDate, "trip_style": trip.TripStyle,
        "travelers": trip.Travelers, "activities_preview": activities,
    })
    if err != nil {
        c.JSON(http.StatusBadGateway, gin.H{"error": "AI service unavailable"})
        return
    }

    // Replace all existing items for this trip
    h.db.Exec(c.Request.Context(), `DELETE FROM packing_items WHERE trip_id=$1`, tripID)
    items, _ := result["items"].([]interface{})
    for i, item := range items {
        m, _ := item.(map[string]interface{})
        name, _ := m["name"].(string)
        cat, _ := m["category"].(string)
        qty, _ := m["quantity"].(string)
        note, _ := m["note"].(string)
        if qty == "" { qty = "1" }
        h.db.Exec(c.Request.Context(),
            `INSERT INTO packing_items (trip_id, name, category, quantity, note, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
            tripID, name, cat, qty, note, i)
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"generated": len(items)}})
}

func (h *PackingHandler) Toggle(c *gin.Context) {
    itemID := c.Param("itemId")
    userID := c.GetString("user_id")
    var body struct{ IsPacked bool `json:"is_packed"` }
    c.ShouldBindJSON(&body)
    // Verify membership via join
    result, _ := h.db.Exec(c.Request.Context(),
        `UPDATE packing_items SET is_packed=$1
         WHERE id=$2 AND trip_id IN (
           SELECT trip_id FROM trip_members WHERE user_id=$3
         )`, body.IsPacked, itemID, userID)
    if result.RowsAffected() == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}})
}

func (h *PackingHandler) Delete(c *gin.Context) {
    itemID := c.Param("itemId")
    userID := c.GetString("user_id")
    result, _ := h.db.Exec(c.Request.Context(),
        `DELETE FROM packing_items WHERE id=$1 AND trip_id IN (
           SELECT trip_id FROM trip_members WHERE user_id=$2 AND role IN ('owner','editor')
         )`, itemID, userID)
    if result.RowsAffected() == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "item not found"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}
```

- [ ] **Step 3: Wire routes in `main.go`**

```go
packHandler := handlers.NewPackingHandler(pool, aiClient)
v1.GET("/trips/:tripId/packing", packHandler.List)
v1.POST("/trips/:tripId/packing/generate", packHandler.Generate)
v1.PATCH("/trips/:tripId/packing/:itemId/toggle", packHandler.Toggle)
v1.DELETE("/trips/:tripId/packing/:itemId", packHandler.Delete)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_packing.sql backend/internal/handlers/packing.go backend/main.go
git commit -m "feat: add packing list CRUD handlers with AI generation via Python"
```

---

## Task 3: Next.js — Packing tab

- [ ] **Step 1: Create `src/app/(app)/trips/[id]/packing/PackingClient.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const CATEGORIES = ["documents","clothing","toiletries","electronics","medications","activities","other"];

interface PackingItem {
  id: string; name: string; category: string;
  quantity: string; note: string; is_packed: boolean;
}

export function PackingClient({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<PackingItem[]>([]);
  const [generating, setGenerating] = useState(false);

  async function load() {
    const r = await api.get<{ data: PackingItem[] }>(`/api/v1/trips/${tripId}/packing`);
    setItems(r.data ?? []);
  }
  useEffect(() => { void load(); }, [tripId]);

  async function generate() {
    if (items.length > 0 && !confirm("This will replace your current packing list. Continue?")) return;
    setGenerating(true);
    await api.post(`/api/v1/trips/${tripId}/packing/generate`, {});
    await load();
    setGenerating(false);
  }

  async function toggle(id: string, current: boolean) {
    await api.patch(`/api/v1/trips/${tripId}/packing/${id}/toggle`, { is_packed: !current });
    setItems(items.map(i => i.id === id ? {...i, is_packed: !current} : i));
  }

  async function del(id: string) {
    await api.del(`/api/v1/trips/${tripId}/packing/${id}`);
    setItems(items.filter(i => i.id !== id));
  }

  const packedCount = items.filter(i => i.is_packed).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">{packedCount}/{items.length} packed</p>
          <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1">
            <div className="h-1.5 bg-[#2D6A4F] rounded-full transition-all"
              style={{ width: items.length ? `${(packedCount/items.length)*100}%` : "0%" }}/>
          </div>
        </div>
        <button onClick={generate} disabled={generating}
          className="bg-[#2D6A4F] text-white text-sm px-4 py-2 rounded-xl disabled:opacity-60">
          {generating ? "Generating…" : "✨ AI Pack List"}
        </button>
      </div>

      {CATEGORIES.map(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat} className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">{cat}</h3>
            <div className="space-y-1.5">
              {catItems.map(item => (
                <div key={item.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <button onClick={() => toggle(item.id, item.is_packed)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.is_packed ? "bg-[#2D6A4F] border-[#2D6A4F]" : "border-gray-300"
                    }`}>
                    {item.is_packed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${item.is_packed ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {item.name}
                    </p>
                    {(item.quantity !== "1" || item.note) && (
                      <p className="text-xs text-gray-400">{[item.quantity !== "1" && item.quantity, item.note].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <button onClick={() => del(item.id)} className="text-gray-200 hover:text-red-400 text-lg">×</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎒</p>
          <p className="text-sm">Click "AI Pack List" to generate a personalized packing list</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create page file + add tab to nav**

```typescript
// src/app/(app)/trips/[id]/packing/page.tsx
import { PackingClient } from "./PackingClient";
export default function PackingPage({ params }: { params: { id: string } }) {
  return <PackingClient tripId={params.id} />;
}
```

Add packing tab to trip navigation: `{ label: "Packing", href: `/trips/${id}/packing`, icon: "🎒" }`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/trips/\[id\]/packing/
git commit -m "feat: add packing list tab with AI generation, category grouping, check-off UI"
```

---

## Verification Checklist

- [ ] `POST /api/v1/trips/:id/packing/generate` calls Python, stores items in DB
- [ ] `GET /api/v1/trips/:id/packing` returns items grouped by category
- [ ] Clicking the check circle toggles `is_packed` and persists after reload
- [ ] "AI Pack List" button shows confirmation when items already exist
- [ ] Progress bar updates as items are checked off
- [ ] Viewer role cannot delete items (403)
- [ ] Items sorted: documents first, other last
