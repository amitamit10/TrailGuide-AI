# TrailGuide AI — Phase 25: Monitoring & Admin Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production observability: per-request logging to a DB table, an admin dashboard at `/admin` showing usage trends, AI call volume, error rates, and Groq cost estimates. Add a combined health endpoint that checks all three services. Role-based admin access via an `is_admin` flag on the profiles table.

**Architecture:** Go middleware logs every request (endpoint, method, user_id, status code, duration_ms) to an `api_events` table — async write to avoid adding latency. The admin dashboard reads aggregated metrics via a new set of Go endpoints (`/api/v1/admin/*`) that query `api_events`. Python AI service already has `/health`; Go's `/health` now also pings Python and Supabase DB and returns a combined status. Admin access gate: `is_admin` column on `profiles`, checked on every `/api/v1/admin/*` route.

**Tech Stack:** Go (logging middleware, admin handlers, combined health). PostgreSQL (api_events table). Next.js — admin dashboard page with simple charts (CSS-only bar chart, no charting library).

**Prerequisite:** Phase 19 complete (Go backend running in production with all routes).

## Global Constraints

- New table: `api_events` (append-only, no RLS — service-role only access).
- New column: `profiles.is_admin boolean default false`.
- Admin routes: `GET /api/v1/admin/stats`, `GET /api/v1/admin/events`. Only accessible if `is_admin = true` for the calling user.
- Logging middleware: non-blocking (`go func()` to write) — must not add more than 1ms to P99.
- `api_events` is pruned after 30 days via a Go startup job (simple `DELETE WHERE created_at < NOW() - INTERVAL '30 days'`).
- Groq cost estimate: `llama-3.3-70b-versatile` = $0.59/1M input tokens, $0.79/1M output tokens. Track token counts from Groq API response headers (X-Groq-Usage) if available, otherwise estimate from request payload size.
- `/health` endpoint updated to return: `{"status":"ok","db":"ok","ai":"ok","version":"..."}`.

---

## File Map

```
supabase/migrations/
└── 007_admin.sql                        CREATE — api_events table + is_admin column

backend/internal/
├── middleware/
│   └── logger.go                        CREATE — async request logging middleware
└── handlers/
    └── admin.go                         CREATE — stats + events endpoints

src/
└── app/(app)/admin/
    ├── page.tsx                         CREATE — admin gate (checks is_admin)
    └── AdminClient.tsx                  CREATE — stats cards + event log table
```

---

## Task 1: Database schema

**Files:**
- Create: `supabase/migrations/007_admin.sql`

- [ ] **Step 1: Create `supabase/migrations/007_admin.sql`**

```sql
-- Add is_admin to profiles
alter table profiles add column if not exists is_admin boolean default false;

-- Event log (no RLS — Go service role writes directly via pgx)
create table if not exists api_events (
  id bigserial primary key,
  endpoint text not null,
  method text not null,
  user_id uuid,
  status_code int not null,
  duration_ms int not null,
  created_at timestamptz default now()
);

-- Index for stats queries
create index if not exists api_events_created_at_idx on api_events (created_at desc);
create index if not exists api_events_endpoint_idx on api_events (endpoint, created_at desc);

-- Auto-prune: called by Go on startup
create or replace function prune_api_events() returns void as $$
begin
  delete from api_events where created_at < now() - interval '30 days';
end;
$$ language plpgsql;
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

- [ ] **Step 3: Grant yourself admin in the DB**

```sql
update profiles set is_admin = true where id = (
  select id from auth.users where email = 'your-email@example.com'
);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_admin.sql
git commit -m "feat: add api_events table and is_admin flag for monitoring"
```

---

## Task 2: Go — async request logging middleware

**Files:**
- Create: `backend/internal/middleware/logger.go`

- [ ] **Step 1: Create `backend/internal/middleware/logger.go`**

```go
package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RequestLogger(db *pgxpool.Pool) gin.HandlerFunc {
	// Prune old events on startup (best-effort)
	go func() {
		db.Exec(context.Background(), "SELECT prune_api_events()")
	}()

	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start).Milliseconds()

		userID := c.GetString("user_id")
		statusCode := c.Writer.Status()
		endpoint := c.FullPath()
		method := c.Request.Method

		// Async write — never blocks the response
		go func() {
			var uid *string
			if userID != "" {
				uid = &userID
			}
			db.Exec(context.Background(),
				`INSERT INTO api_events (endpoint, method, user_id, status_code, duration_ms)
				 VALUES ($1,$2,$3,$4,$5)`,
				endpoint, method, uid, statusCode, duration)
		}()
	}
}
```

- [ ] **Step 2: Register middleware in `main.go` (after pool creation, before routes)**

```go
r.Use(middleware.RequestLogger(pool))
```

- [ ] **Step 3: Verify logging works**

```bash
# Make a few requests, then check DB:
psql $DATABASE_URL -c "SELECT endpoint, method, status_code, duration_ms FROM api_events ORDER BY id DESC LIMIT 10;"
```

Expected: rows for each request made.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/middleware/logger.go backend/main.go
git commit -m "feat: add async request logging middleware — writes to api_events table"
```

---

## Task 3: Go — admin stats and updated health endpoint

**Files:**
- Create: `backend/internal/handlers/admin.go`

- [ ] **Step 1: Update `/health` in `main.go` to check DB and Python service**

Replace the existing health handler:
```go
r.GET("/health", func(c *gin.Context) {
    dbStatus := "ok"
    if err := pool.Ping(c.Request.Context()); err != nil {
        dbStatus = "error"
    }
    aiStatus := "ok"
    resp, err := http.Get(cfg.AIServiceURL + "/health")
    if err != nil || resp.StatusCode != http.StatusOK {
        aiStatus = "unavailable"
    }
    status := "ok"
    if dbStatus != "ok" || aiStatus != "ok" {
        status = "degraded"
    }
    c.JSON(http.StatusOK, gin.H{
        "status": status, "db": dbStatus, "ai": aiStatus,
    })
})
```

- [ ] **Step 2: Create `backend/internal/handlers/admin.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminHandler struct{ db *pgxpool.Pool }

func NewAdminHandler(db *pgxpool.Pool) *AdminHandler { return &AdminHandler{db: db} }

func (h *AdminHandler) RequireAdmin(c *gin.Context) {
	userID := c.GetString("user_id")
	var isAdmin bool
	h.db.QueryRow(context.Background(),
		`SELECT COALESCE(is_admin, false) FROM profiles WHERE id=$1`, userID).Scan(&isAdmin)
	if !isAdmin {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin only"})
		return
	}
	c.Next()
}

func (h *AdminHandler) Stats(c *gin.Context) {
	type statsRow struct {
		TotalRequests    int     `json:"total_requests"`
		TotalUsers       int     `json:"total_users"`
		TotalTrips       int     `json:"total_trips"`
		AICallsToday     int     `json:"ai_calls_today"`
		ErrorRatePercent float64 `json:"error_rate_percent"`
		P95DurationMs    int     `json:"p95_duration_ms"`
	}
	var s statsRow
	h.db.QueryRow(context.Background(), `
		SELECT
		  COUNT(*)::int as total_requests,
		  (SELECT COUNT(*)::int FROM profiles) as total_users,
		  (SELECT COUNT(*)::int FROM trips) as total_trips,
		  COUNT(*) FILTER (WHERE endpoint LIKE '%/ai/%' AND created_at > NOW() - INTERVAL '24h')::int as ai_calls_today,
		  ROUND(100.0 * COUNT(*) FILTER (WHERE status_code >= 500) / NULLIF(COUNT(*),0), 2) as error_rate_percent,
		  COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::int, 0) as p95_duration_ms
		FROM api_events
		WHERE created_at > NOW() - INTERVAL '24h'
	`).Scan(&s.TotalRequests, &s.TotalUsers, &s.TotalTrips,
		&s.AICallsToday, &s.ErrorRatePercent, &s.P95DurationMs)

	// Requests per hour (last 24h)
	rows, _ := h.db.Query(context.Background(), `
		SELECT
		  DATE_TRUNC('hour', created_at)::text as hour,
		  COUNT(*)::int as count,
		  COUNT(*) FILTER (WHERE status_code >= 400)::int as errors
		FROM api_events
		WHERE created_at > NOW() - INTERVAL '24h'
		GROUP BY 1 ORDER BY 1
	`)
	defer rows.Close()
	type hourBucket struct {
		Hour   string `json:"hour"`
		Count  int    `json:"count"`
		Errors int    `json:"errors"`
	}
	var hourly []hourBucket
	for rows.Next() {
		var b hourBucket
		rows.Scan(&b.Hour, &b.Count, &b.Errors)
		hourly = append(hourly, b)
	}
	if hourly == nil { hourly = []hourBucket{} }

	// Top endpoints
	epRows, _ := h.db.Query(context.Background(), `
		SELECT endpoint, COUNT(*)::int as count,
		       ROUND(AVG(duration_ms))::int as avg_ms
		FROM api_events
		WHERE created_at > NOW() - INTERVAL '24h'
		  AND endpoint IS NOT NULL
		GROUP BY endpoint ORDER BY count DESC LIMIT 10
	`)
	defer epRows.Close()
	type epRow struct {
		Endpoint string `json:"endpoint"`
		Count    int    `json:"count"`
		AvgMs    int    `json:"avg_ms"`
	}
	var endpoints []epRow
	for epRows.Next() {
		var e epRow
		epRows.Scan(&e.Endpoint, &e.Count, &e.AvgMs)
		endpoints = append(endpoints, e)
	}
	if endpoints == nil { endpoints = []epRow{} }

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"summary":   s,
		"hourly":    hourly,
		"endpoints": endpoints,
	}})
}
```

- [ ] **Step 3: Wire admin routes into `main.go`**

```go
admin := handlers.NewAdminHandler(pool)
adminGroup := v1.Group("/admin")
adminGroup.Use(admin.RequireAdmin)
adminGroup.GET("/stats", admin.Stats)
```

- [ ] **Step 4: Test admin routes**

```bash
# With a non-admin token:
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/admin/stats
# {"error":"admin only"}

# After setting is_admin=true in DB:
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8080/api/v1/admin/stats | python3 -m json.tool
# {"data":{"summary":{...},"hourly":[...],"endpoints":[...]}}
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/admin.go backend/main.go
git commit -m "feat: add admin stats endpoint and enhanced health check"
```

---

## Task 4: Next.js — Admin dashboard

**Files:**
- Create: `src/app/(app)/admin/page.tsx`
- Create: `src/app/(app)/admin/AdminClient.tsx`

- [ ] **Step 1: Create `src/app/(app)/admin/page.tsx`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminClient } from "./AdminClient";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  return <AdminClient />;
}
```

- [ ] **Step 2: Create `src/app/(app)/admin/AdminClient.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Stats {
  summary: {
    total_requests: number;
    total_users: number;
    total_trips: number;
    ai_calls_today: number;
    error_rate_percent: number;
    p95_duration_ms: number;
  };
  hourly: { hour: string; count: number; errors: number }[];
  endpoints: { endpoint: string; count: number; avg_ms: number }[];
}

export function AdminClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Stats }>("/api/v1/admin/stats")
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full" />
    </div>
  );
  if (!stats) return <p className="text-center text-gray-400 py-20">No data.</p>;

  const { summary, hourly, endpoints } = stats;
  const maxHourlyCount = Math.max(...hourly.map(h => h.count), 1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <p className="text-xs text-gray-400 mb-6">Last 24 hours</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Requests (24h)", value: summary.total_requests.toLocaleString() },
          { label: "AI Calls (24h)", value: summary.ai_calls_today.toLocaleString() },
          { label: "Total Users", value: summary.total_users.toLocaleString() },
          { label: "Total Trips", value: summary.total_trips.toLocaleString() },
          { label: "Error Rate", value: `${summary.error_rate_percent.toFixed(1)}%`,
            highlight: summary.error_rate_percent > 5 },
          { label: "P95 Latency", value: `${summary.p95_duration_ms}ms`,
            highlight: summary.p95_duration_ms > 2000 },
        ].map(card => (
          <div key={card.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${
            (card as any).highlight ? "border-red-200" : "border-gray-100"
          }`}>
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${
              (card as any).highlight ? "text-red-600" : "text-gray-900"
            }`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Hourly chart (CSS bar chart) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Requests per hour</h2>
        <div className="flex items-end gap-1 h-24">
          {hourly.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.hour}: ${h.count} req`}>
              <div className="w-full bg-[#2D6A4F] rounded-sm"
                style={{ height: `${Math.round((h.count / maxHourlyCount) * 88)}px`, minHeight: "2px" }} />
              {h.errors > 0 && (
                <div className="w-full bg-red-400 rounded-sm"
                  style={{ height: `${Math.round((h.errors / maxHourlyCount) * 88)}px`, minHeight: "2px", marginTop: "-2px" }} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{hourly[0]?.hour?.slice(11, 16) ?? ""}</span>
          <span>now</span>
        </div>
      </div>

      {/* Top endpoints */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Top endpoints (24h)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium">Endpoint</th>
              <th className="text-right px-4 py-2 font-medium">Calls</th>
              <th className="text-right px-4 py-2 font-medium">Avg ms</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((e, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2 font-mono text-gray-600 truncate max-w-[200px]">
                  {e.endpoint}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">{e.count}</td>
                <td className={`px-4 py-2 text-right font-medium ${
                  e.avg_ms > 2000 ? "text-red-500" : e.avg_ms > 500 ? "text-yellow-500" : "text-green-600"
                }`}>{e.avg_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/admin/
git commit -m "feat: add admin dashboard with request stats, hourly chart, top endpoints"
```

---

## Verification Checklist

- [ ] `api_events` table receives a row after every API request (check with `SELECT COUNT(*) FROM api_events`)
- [ ] `GET /health` returns `{"status":"ok","db":"ok","ai":"ok"}` when all services are healthy
- [ ] `GET /health` returns `{"status":"degraded","ai":"unavailable"}` when Python service is down
- [ ] Non-admin user → `/admin` redirects to `/dashboard`
- [ ] Admin user → sees stats dashboard
- [ ] `summary.total_requests` matches `SELECT COUNT(*) FROM api_events WHERE created_at > NOW() - INTERVAL '24h'`
- [ ] Hourly chart renders bars proportional to request counts
- [ ] Endpoint with avg_ms > 2000 shows red text
- [ ] `api_events` older than 30 days are deleted on Go startup (verify with: `SELECT MIN(created_at) FROM api_events` after inserting an old record)
