# TrailGuide AI — Phase 43: Advanced Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-text search across all trips and activities, accessible via a search bar on the dashboard. Results show matching trips and activities with highlighted text. Filter by date range and trip status (upcoming/past/all).

**Architecture:** PostgreSQL full-text search (`tsvector` + `to_tsquery`) for trips and activities tables. A Go handler `GET /api/v1/search?q=...&filter=upcoming|past|all` queries both tables and returns merged results. Next.js search overlay (Command-K opens, Escape closes) with real-time results as the user types (300ms debounce).

**Tech Stack:** PostgreSQL `tsvector`, Go, Next.js.

**Prerequisite:** Phase 19 (Go backend with trips/activities). Phase 18 (Next.js frontend).

## Global Constraints
- Search is scoped to the requesting user's trips (and trips they're a member of).
- Results are returned in relevance order (PostgreSQL `ts_rank`).
- Minimum query length: 2 characters.
- Maximum results: 10 trips + 10 activities.
- The search overlay is opened by `Cmd/Ctrl+K` and by a search icon in the header.

---

## Task 1: PostgreSQL full-text search setup

- [ ] **Step 1: Create `supabase/migrations/013_search.sql`**

```sql
-- Full-text search vectors for trips
alter table trips add column if not exists search_vector tsvector;

update trips set search_vector =
  setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('english', coalesce(destination,'')), 'A') ||
  setweight(to_tsvector('english', coalesce(trip_style,'')), 'B') ||
  setweight(to_tsvector('english', array_to_string(coalesce(interests,'{}'), ' ')), 'C');

create index if not exists trips_search_idx on trips using gin(search_vector);

-- Auto-update trigger for trips
create or replace function trips_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.destination,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.trip_style,'')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.interests,'{}'), ' ')), 'C');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trips_search_update on trips;
create trigger trips_search_update
  before insert or update of title, destination, trip_style, interests on trips
  for each row execute function trips_search_trigger();

-- Full-text search vectors for activities
alter table activities add column if not exists search_vector tsvector;

update activities set search_vector =
  setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
  setweight(to_tsvector('english', coalesce(description,'')), 'B') ||
  setweight(to_tsvector('english', coalesce(address,'')), 'C') ||
  setweight(to_tsvector('english', coalesce(category,'')), 'D');

create index if not exists activities_search_idx on activities using gin(search_vector);

create or replace function activities_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.address,'')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.category,'')), 'D');
  return new;
end;
$$ language plpgsql;

drop trigger if exists activities_search_update on activities;
create trigger activities_search_update
  before insert or update of title, description, address, category on activities
  for each row execute function activities_search_trigger();
```

```bash
supabase db push
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/013_search.sql
git commit -m "feat: add PostgreSQL full-text search vectors and triggers for trips and activities"
```

---

## Task 2: Go — search handler

- [ ] **Step 1: Create `backend/internal/handlers/search.go`**

```go
package handlers

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

type SearchHandler struct{ db *pgxpool.Pool }
func NewSearchHandler(db *pgxpool.Pool) *SearchHandler { return &SearchHandler{db: db} }

type SearchResult struct {
    Type        string  `json:"type"`     // "trip" or "activity"
    ID          string  `json:"id"`
    TripID      string  `json:"trip_id"`
    Title       string  `json:"title"`
    Subtitle    string  `json:"subtitle"` // destination for trips, trip title for activities
    Date        string  `json:"date"`
    Category    string  `json:"category,omitempty"`
    Rank        float32 `json:"rank"`
}

func (h *SearchHandler) Search(c *gin.Context) {
    q := strings.TrimSpace(c.Query("q"))
    filter := c.DefaultQuery("filter", "all") // upcoming|past|all
    userID := c.GetString("user_id")

    if len(q) < 2 {
        c.JSON(http.StatusOK, gin.H{"data": gin.H{"trips": []interface{}{}, "activities": []interface{}{}}})
        return
    }

    // Build filter clause
    filterSQL := ""
    switch filter {
    case "upcoming":
        filterSQL = "AND t.end_date >= CURRENT_DATE"
    case "past":
        filterSQL = "AND t.end_date < CURRENT_DATE"
    }

    tsQuery := "plainto_tsquery('english', $2)"

    // Search trips
    tripRows, err := h.db.Query(c.Request.Context(), `
        SELECT t.id, t.title, t.destination, t.start_date,
               ts_rank(t.search_vector, `+tsQuery+`) as rank
        FROM trips t
        WHERE t.id IN (SELECT trip_id FROM trip_members WHERE user_id=$1)
          AND t.search_vector @@ `+tsQuery+`
          `+filterSQL+`
        ORDER BY rank DESC
        LIMIT 10`, userID, q)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "search failed"})
        return
    }
    defer tripRows.Close()

    var trips []SearchResult
    for tripRows.Next() {
        var r SearchResult
        var rank float32
        tripRows.Scan(&r.ID, &r.Title, &r.Subtitle, &r.Date, &rank)
        r.Type = "trip"
        r.TripID = r.ID
        r.Rank = rank
        trips = append(trips, r)
    }
    if trips == nil { trips = []SearchResult{} }

    // Search activities
    actRows, err := h.db.Query(c.Request.Context(), `
        SELECT a.id, a.trip_id, a.title, t.destination, a.category,
               d.date, ts_rank(a.search_vector, `+tsQuery+`) as rank
        FROM activities a
        JOIN days d ON d.id = a.day_id
        JOIN trips t ON t.id = a.trip_id
        WHERE t.id IN (SELECT trip_id FROM trip_members WHERE user_id=$1)
          AND a.search_vector @@ `+tsQuery+`
          `+filterSQL+`
        ORDER BY rank DESC
        LIMIT 10`, userID, q)
    if err == nil {
        defer actRows.Close()
    }

    var activities []SearchResult
    if actRows != nil {
        for actRows.Next() {
            var r SearchResult
            actRows.Scan(&r.ID, &r.TripID, &r.Title, &r.Subtitle, &r.Category, &r.Date, &r.Rank)
            r.Type = "activity"
            activities = append(activities, r)
        }
    }
    if activities == nil { activities = []SearchResult{} }

    c.JSON(http.StatusOK, gin.H{"data": gin.H{
        "trips": trips, "activities": activities,
        "query": q, "total": len(trips) + len(activities),
    }})
}
```

- [ ] **Step 2: Wire route**

```go
v1.GET("/search", searchHandler.Search)
```

- [ ] **Step 3: Test**

```bash
TOKEN="..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/search?q=tokyo&filter=all" | python3 -m json.tool
```

Expected: `{ "data": { "trips": [...], "activities": [...], "total": N } }`

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/search.go backend/main.go
git commit -m "feat: add PostgreSQL full-text search handler (trips + activities, filter by date)"
```

---

## Task 3: Next.js — Search overlay

- [ ] **Step 1: Create `src/components/search/SearchOverlay.tsx`**

```typescript
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SearchResult {
  type: "trip" | "activity";
  id: string; trip_id: string; title: string; subtitle: string;
  date: string; category?: string;
}
interface SearchData { trips: SearchResult[]; activities: SearchResult[]; total: number; }

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get<{ data: SearchData }>(`/api/v1/search?q=${encodeURIComponent(q)}&filter=${filter}`);
        setResults(r.data);
      } finally { setLoading(false); }
    }, 300);
  }, [q, filter]);

  function go(result: SearchResult) {
    if (result.type === "trip") router.push(`/trips/${result.id}/timeline`);
    else router.push(`/trips/${result.trip_id}/timeline?highlight=${result.id}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative z-10 max-w-lg w-full mx-auto mt-16 bg-white dark:bg-surface-2 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search trips and activities…"
            className="flex-1 text-sm bg-transparent outline-none text-on-surface placeholder-on-surface-2"/>
          <button onClick={onClose} className="text-xs text-gray-400 border rounded px-1.5 py-0.5">Esc</button>
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-4 py-2 border-b border-border">
          {["all","upcoming","past"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                filter === f ? "bg-[#2D6A4F] text-white" : "text-on-surface-2 hover:bg-surface"
              }`}>{f}</button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto py-2">
          {loading && <div className="text-center py-8 text-on-surface-2 text-sm">Searching…</div>}
          {!loading && results && results.total === 0 && (
            <div className="text-center py-8 text-on-surface-2 text-sm">No results for "{q}"</div>
          )}
          {!loading && results && results.total > 0 && (
            <>
              {results.trips.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-semibold text-on-surface-2 uppercase tracking-wide">Trips</p>
                  {results.trips.map(r => (
                    <button key={r.id} onClick={() => go(r)}
                      className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-surface text-left">
                      <span className="text-xl">✈️</span>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{r.title}</p>
                        <p className="text-xs text-on-surface-2">{r.subtitle} · {r.date}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.activities.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-semibold text-on-surface-2 uppercase tracking-wide">Activities</p>
                  {results.activities.map(r => (
                    <button key={r.id} onClick={() => go(r)}
                      className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-surface text-left">
                      <span className="text-xl">
                        {r.category === "food" ? "🍽️" : r.category === "transport" ? "🚌" : "📍"}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-on-surface">{r.title}</p>
                        <p className="text-xs text-on-surface-2">{r.subtitle} · {r.date}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {q.length < 2 && (
            <div className="text-center py-8 text-on-surface-2 text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add keyboard shortcut and trigger to layout/header**

```typescript
// In header component or root layout:
"use client";
import { useState, useEffect } from "react";
import { SearchOverlay } from "@/components/search/SearchOverlay";

// Add keyboard shortcut:
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === "Escape") setSearchOpen(false);
  }
  window.addEventListener("keydown", handleKey);
  return () => window.removeEventListener("keydown", handleKey);
}, []);
```

Search icon in header:
```tsx
<button onClick={() => setSearchOpen(true)} className="p-2 rounded-full hover:bg-surface">
  <svg className="w-5 h-5 text-on-surface-2">...</svg>
  <span className="sr-only">Search (Cmd+K)</span>
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/search/ src/app/
git commit -m "feat: add Cmd+K search overlay with full-text trip and activity search"
```

---

## Verification Checklist

- [ ] `GET /api/v1/search?q=tokyo` returns trips with "Tokyo" in title or destination
- [ ] `GET /api/v1/search?q=ramen` returns activities with "ramen" in title
- [ ] `filter=upcoming` excludes past trips from results
- [ ] User A cannot see User B's trips in search results
- [ ] Cmd+K opens search overlay
- [ ] Escape closes it
- [ ] 300ms debounce (no request on every keystroke)
- [ ] Query < 2 chars shows hint message instead of error
- [ ] Clicking a trip result navigates to its timeline
