# TrailGuide AI — Phase 22: Flight Tracker & Live Transport Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real-time flight status on the trip dashboard (delays, gate changes, terminal info) and send Telegram notifications when a flight status changes. Users link their flight by entering a flight number + date.

**Architecture:** Flight data comes from the AviationStack API (free tier: 100 req/month — sufficient for checking a few flights per trip day). A new `flight_alerts` table stores the flight number, last-known status, and when we last checked. The Go backend has a background goroutine that checks all "today's flights" every 30 minutes and sends Telegram messages when status changes. The dashboard flight card fetches the latest cached status from the DB (no live API call on every page load).

**Tech Stack:** AviationStack API (free, HTTP). Go (background goroutine + pgx). Telegram Bot API (already wired in Phase 16). Next.js — flight card UI.

**Prerequisite:** Phase 16 (Go backend), Phase 4 (Telegram bot — for notifications).

## Global Constraints

- New table: `flight_alerts` (see Task 1 schema).
- AviationStack free tier: 100 req/month. Cache results for 30 minutes in DB. Never call the API more than once per 30 minutes per flight.
- New env var (Go backend): `AVIATIONSTACK_API_KEY` (free at aviationstack.com).
- Go background worker starts on `main.go` startup: `go flightChecker.Start(ctx)` — runs every 30 minutes, exits when context is cancelled.
- Telegram notification format: "✈️ Flight update: [UA234] [New York → Tokyo] is now [DELAYED 45min]. New departure: 14:35."
- Flight status values from AviationStack: `scheduled`, `active`, `landed`, `cancelled`, `incident`, `diverted`.

---

## File Map

```
supabase/migrations/
└── 005_flight_alerts.sql               CREATE — flight_alerts table

backend/internal/
├── handlers/
│   └── flights.go                      CREATE — link/get/list flight handlers
└── services/
    ├── aviationstack.go                CREATE — AviationStack API client
    └── flight_checker.go               CREATE — background polling worker

src/
└── components/
    └── dashboard/
        └── FlightTrackerCard.tsx       CREATE — live flight status card
```

---

## Task 1: Database schema

**Files:**
- Create: `supabase/migrations/005_flight_alerts.sql`

- [ ] **Step 1: Create `supabase/migrations/005_flight_alerts.sql`**

```sql
create table if not exists flight_alerts (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  flight_number text not null,
  flight_date date not null,
  airline_name text,
  departure_airport text,
  arrival_airport text,
  scheduled_departure timestamptz,
  scheduled_arrival timestamptz,
  last_status text default 'scheduled',
  last_terminal text,
  last_gate text,
  actual_departure timestamptz,
  estimated_arrival timestamptz,
  delay_minutes int default 0,
  last_checked_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz default now(),
  unique(trip_id, flight_number, flight_date)
);

alter table flight_alerts enable row level security;

drop policy if exists "Users can manage their flight alerts" on flight_alerts;
create policy "Users can manage their flight alerts" on flight_alerts
  for all using (
    trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_flight_alerts.sql
git commit -m "feat: add flight_alerts table for real-time flight tracking"
```

---

## Task 2: Go — AviationStack client and background checker

**Files:**
- Create: `backend/internal/services/aviationstack.go`
- Create: `backend/internal/services/flight_checker.go`

- [ ] **Step 1: Create `backend/internal/services/aviationstack.go`**

```go
package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

type FlightStatus struct {
	FlightNumber       string
	AirlineName        string
	DepartureAirport   string
	ArrivalAirport     string
	Status             string
	Terminal           string
	Gate               string
	ScheduledDeparture time.Time
	ActualDeparture    *time.Time
	EstimatedArrival   *time.Time
	DelayMinutes       int
}

type AviationStackClient struct {
	apiKey string
}

func NewAviationStackClient(apiKey string) *AviationStackClient {
	return &AviationStackClient{apiKey: apiKey}
}

func (c *AviationStackClient) GetFlight(flightNumber, date string) (*FlightStatus, error) {
	params := url.Values{
		"access_key":    {c.apiKey},
		"flight_iata":  {flightNumber},
		"flight_date":  {date},
	}
	resp, err := http.Get("http://api.aviationstack.com/v1/flights?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			FlightStatus string `json:"flight_status"`
			Airline      struct{ Name string `json:"name"` } `json:"airline"`
			Departure    struct {
				Airport     string `json:"airport"`
				Terminal    string `json:"terminal"`
				Gate        string `json:"gate"`
				Scheduled   string `json:"scheduled"`
				Actual      string `json:"actual"`
				Delay       int    `json:"delay"`
			} `json:"departure"`
			Arrival struct {
				Airport   string `json:"airport"`
				Estimated string `json:"estimated"`
			} `json:"arrival"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || len(result.Data) == 0 {
		return nil, fmt.Errorf("flight not found: %s on %s", flightNumber, date)
	}

	d := result.Data[0]
	fs := &FlightStatus{
		FlightNumber:     flightNumber,
		AirlineName:      d.Airline.Name,
		DepartureAirport: d.Departure.Airport,
		ArrivalAirport:   d.Arrival.Airport,
		Status:           d.FlightStatus,
		Terminal:         d.Departure.Terminal,
		Gate:             d.Departure.Gate,
		DelayMinutes:     d.Departure.Delay,
	}
	if t, err := time.Parse(time.RFC3339, d.Departure.Scheduled); err == nil {
		fs.ScheduledDeparture = t
	}
	if d.Departure.Actual != "" {
		if t, err := time.Parse(time.RFC3339, d.Departure.Actual); err == nil {
			fs.ActualDeparture = &t
		}
	}
	if d.Arrival.Estimated != "" {
		if t, err := time.Parse(time.RFC3339, d.Arrival.Estimated); err == nil {
			fs.EstimatedArrival = &t
		}
	}
	return fs, nil
}
```

- [ ] **Step 2: Create `backend/internal/services/flight_checker.go`**

```go
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type FlightChecker struct {
	db           *pgxpool.Pool
	aviation     *AviationStackClient
	botToken     string
	checkInterval time.Duration
}

func NewFlightChecker(db *pgxpool.Pool, aviation *AviationStackClient, botToken string) *FlightChecker {
	return &FlightChecker{
		db: db, aviation: aviation, botToken: botToken,
		checkInterval: 30 * time.Minute,
	}
}

func (fc *FlightChecker) Start(ctx context.Context) {
	log.Println("flight checker started")
	ticker := time.NewTicker(fc.checkInterval)
	defer ticker.Stop()
	fc.check(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			fc.check(ctx)
		}
	}
}

func (fc *FlightChecker) check(ctx context.Context) {
	rows, err := fc.db.Query(ctx,
		`SELECT f.id, f.trip_id, f.flight_number, f.flight_date::text,
		        f.last_status, p.telegram_chat_id
		 FROM flight_alerts f
		 JOIN profiles p ON p.id = f.user_id
		 WHERE f.flight_date = CURRENT_DATE
		   AND (f.last_checked_at IS NULL OR f.last_checked_at < NOW() - INTERVAL '28 minutes')
		   AND f.last_status NOT IN ('landed','cancelled')`)
	if err != nil {
		log.Printf("flight checker query error: %v", err)
		return
	}
	defer rows.Close()

	type flightRow struct {
		ID           string
		TripID       string
		FlightNumber string
		FlightDate   string
		LastStatus   string
		TelegramID   *string
	}

	var flights []flightRow
	for rows.Next() {
		var f flightRow
		rows.Scan(&f.ID, &f.TripID, &f.FlightNumber, &f.FlightDate, &f.LastStatus, &f.TelegramID)
		flights = append(flights, f)
	}
	rows.Close()

	for _, f := range flights {
		status, err := fc.aviation.GetFlight(f.FlightNumber, f.FlightDate)
		if err != nil {
			log.Printf("could not fetch %s: %v", f.FlightNumber, err)
			continue
		}

		statusChanged := status.Status != f.LastStatus

		fc.db.Exec(ctx,
			`UPDATE flight_alerts SET
			  last_status=$1, last_terminal=$2, last_gate=$3,
			  delay_minutes=$4, actual_departure=$5, estimated_arrival=$6,
			  last_checked_at=NOW()
			 WHERE id=$7`,
			status.Status, status.Terminal, status.Gate, status.DelayMinutes,
			status.ActualDeparture, status.EstimatedArrival, f.ID)

		if statusChanged && f.TelegramID != nil {
			msg := fc.buildNotification(f.FlightNumber, status)
			fc.sendTelegram(*f.TelegramID, msg)
			fc.db.Exec(ctx, `UPDATE flight_alerts SET notified_at=NOW() WHERE id=$1`, f.ID)
		}
	}
}

func (fc *FlightChecker) buildNotification(flightNum string, s *FlightStatus) string {
	statusEmoji := map[string]string{
		"scheduled": "🕐", "active": "✈️", "landed": "🛬",
		"cancelled": "❌", "incident": "⚠️", "diverted": "🔄",
	}
	emoji := statusEmoji[s.Status]
	if emoji == "" { emoji = "✈️" }

	msg := fmt.Sprintf("%s Flight update: *%s* (%s → %s) is now *%s*",
		emoji, flightNum, s.DepartureAirport, s.ArrivalAirport, s.Status)
	if s.DelayMinutes > 0 {
		msg += fmt.Sprintf("\nDelay: %d minutes", s.DelayMinutes)
	}
	if s.Terminal != "" {
		msg += fmt.Sprintf("\nTerminal: %s", s.Terminal)
	}
	if s.Gate != "" {
		msg += fmt.Sprintf(" · Gate: %s", s.Gate)
	}
	return msg
}

func (fc *FlightChecker) sendTelegram(chatID, text string) {
	body, _ := json.Marshal(map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", fc.botToken)
	http.Post(url, "application/json", bytes.NewReader(body)) //nolint:errcheck
}
```

- [ ] **Step 3: Wire checker into `main.go`**

```go
import (
    "context"
    "os/signal"
    "syscall"
    "github.com/trailguide/backend/internal/services"
)

// After creating pool, before r.Run():
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()

aviation := services.NewAviationStackClient(cfg.AviationStackAPIKey)
flightChecker := services.NewFlightChecker(pool, aviation, cfg.TelegramBotToken)
go flightChecker.Start(ctx)
```

Add `AviationStackAPIKey` to `config.go`:
```go
AviationStackAPIKey: os.Getenv("AVIATIONSTACK_API_KEY"), // optional
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/services/ backend/main.go backend/internal/config/
git commit -m "feat: add AviationStack flight checker background worker with Telegram alerts"
```

---

## Task 3: Go — flight link/get handlers

**Files:**
- Create: `backend/internal/handlers/flights.go`

- [ ] **Step 1: Create `backend/internal/handlers/flights.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/services"
)

type FlightHandler struct {
	db       *pgxpool.Pool
	aviation *services.AviationStackClient
}

func NewFlightHandler(db *pgxpool.Pool, aviation *services.AviationStackClient) *FlightHandler {
	return &FlightHandler{db: db, aviation: aviation}
}

func (h *FlightHandler) Link(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")

	var body struct {
		FlightNumber string `json:"flight_number"`
		FlightDate   string `json:"flight_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch initial status
	status, err := h.aviation.GetFlight(body.FlightNumber, body.FlightDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "flight not found — check flight number and date"})
		return
	}

	var id string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO flight_alerts
		  (trip_id, user_id, flight_number, flight_date, airline_name,
		   departure_airport, arrival_airport, scheduled_departure,
		   last_status, last_terminal, last_gate, delay_minutes, last_checked_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
		 ON CONFLICT (trip_id, flight_number, flight_date)
		 DO UPDATE SET last_checked_at=NOW() RETURNING id`,
		tripID, userID, body.FlightNumber, body.FlightDate,
		status.AirlineName, status.DepartureAirport, status.ArrivalAirport,
		status.ScheduledDeparture, status.Status, status.Terminal,
		status.Gate, status.DelayMinutes).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id, "status": status}})
}

func (h *FlightHandler) ListForTrip(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, flight_number, flight_date::text, airline_name,
		        departure_airport, arrival_airport, last_status,
		        last_terminal, last_gate, delay_minutes,
		        scheduled_departure::text, estimated_arrival::text
		 FROM flight_alerts
		 WHERE trip_id=$1 AND user_id=$2 ORDER BY flight_date, scheduled_departure`,
		tripID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type row struct {
		ID                 string  `json:"id"`
		FlightNumber       string  `json:"flight_number"`
		FlightDate         string  `json:"flight_date"`
		AirlineName        string  `json:"airline_name"`
		DepartureAirport   string  `json:"departure_airport"`
		ArrivalAirport     string  `json:"arrival_airport"`
		Status             string  `json:"status"`
		Terminal           *string `json:"terminal"`
		Gate               *string `json:"gate"`
		DelayMinutes       int     `json:"delay_minutes"`
		ScheduledDeparture *string `json:"scheduled_departure"`
		EstimatedArrival   *string `json:"estimated_arrival"`
	}
	var flights []row
	for rows.Next() {
		var r row
		rows.Scan(&r.ID, &r.FlightNumber, &r.FlightDate, &r.AirlineName,
			&r.DepartureAirport, &r.ArrivalAirport, &r.Status,
			&r.Terminal, &r.Gate, &r.DelayMinutes,
			&r.ScheduledDeparture, &r.EstimatedArrival)
		flights = append(flights, r)
	}
	if flights == nil { flights = []row{} }
	c.JSON(http.StatusOK, gin.H{"data": flights})
}
```

- [ ] **Step 2: Wire routes into `main.go`**

```go
flightHandler := handlers.NewFlightHandler(pool, aviation)
v1.POST("/trips/:tripId/flights", flightHandler.Link)
v1.GET("/trips/:tripId/flights", flightHandler.ListForTrip)
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/flights.go backend/main.go
git commit -m "feat: add flight link and list handlers"
```

---

## Task 4: Next.js — flight tracker card

**Files:**
- Create: `src/components/dashboard/FlightTrackerCard.tsx`

- [ ] **Step 1: Create `src/components/dashboard/FlightTrackerCard.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Flight {
  id: string;
  flight_number: string;
  flight_date: string;
  airline_name: string;
  departure_airport: string;
  arrival_airport: string;
  status: string;
  terminal: string | null;
  gate: string | null;
  delay_minutes: number;
  scheduled_departure: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  scheduled: { label: "On Time",   color: "text-green-600  bg-green-50",  emoji: "🕐" },
  active:    { label: "In Flight", color: "text-blue-600   bg-blue-50",   emoji: "✈️" },
  landed:    { label: "Landed",    color: "text-gray-600   bg-gray-100",  emoji: "🛬" },
  cancelled: { label: "Cancelled", color: "text-red-600    bg-red-50",    emoji: "❌" },
  diverted:  { label: "Diverted",  color: "text-orange-600 bg-orange-50", emoji: "🔄" },
};

export function FlightTrackerCard({ tripId }: { tripId: string }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [adding, setAdding] = useState(false);
  const [flightNum, setFlightNum] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ data: Flight[] }>(`/api/v1/trips/${tripId}/flights`)
      .then(r => setFlights(r.data))
      .catch(() => {});
  }, [tripId]);

  async function handleLink() {
    setLinking(true);
    setError("");
    try {
      const { data } = await api.post<{ data: Flight }>(`/api/v1/trips/${tripId}/flights`, {
        flight_number: flightNum.toUpperCase(),
        flight_date: date,
      });
      setFlights(prev => [...prev, data as unknown as Flight]);
      setAdding(false);
      setFlightNum("");
    } catch (e: any) {
      setError(e.message ?? "Flight not found");
    } finally {
      setLinking(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayFlights = flights.filter(f => f.flight_date === today);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">✈️ Flights</h3>
        <button onClick={() => setAdding(a => !a)}
          className="text-xs text-[#2D6A4F] font-medium">
          {adding ? "Cancel" : "+ Track flight"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 flex gap-2">
          <input value={flightNum} onChange={e => setFlightNum(e.target.value)}
            placeholder="UA234" maxLength={8}
            className="flex-1 border rounded-lg px-2 py-1.5 text-sm uppercase" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={handleLink} disabled={!flightNum || linking}
            className="bg-[#2D6A4F] text-white rounded-lg px-3 text-sm font-medium disabled:opacity-50">
            {linking ? "…" : "Track"}
          </button>
        </div>
      )}
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      {todayFlights.length === 0 && !adding && (
        <p className="text-xs text-gray-400">No flights today.</p>
      )}

      {todayFlights.map(f => {
        const cfg = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.scheduled;
        return (
          <div key={f.id} className="border border-gray-100 rounded-xl p-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-sm">{f.flight_number}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                {cfg.emoji} {cfg.label}
                {f.delay_minutes > 0 && ` (+${f.delay_minutes}min)`}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {f.departure_airport} → {f.arrival_airport}
              {f.terminal && <span className="ml-2">Terminal {f.terminal}</span>}
              {f.gate && <span className="ml-1">· Gate {f.gate}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add `FlightTrackerCard` to the trip dashboard**

In the dashboard page, import and add:
```tsx
import { FlightTrackerCard } from "@/components/dashboard/FlightTrackerCard";
<FlightTrackerCard tripId={tripId} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/FlightTrackerCard.tsx src/app/(app)/trips/[id]/dashboard/
git commit -m "feat: add flight tracker card to dashboard with real-time status + Telegram alerts"
```

---

## Verification Checklist

- [ ] `flight_alerts` table created
- [ ] `POST /api/v1/trips/:id/flights` with a real flight number → returns status from AviationStack
- [ ] Invalid flight number → 400 "flight not found"
- [ ] Flight card renders on dashboard with correct status badge
- [ ] Status updates on page reload (Go serves cached DB value)
- [ ] Background checker logs "flight checker started" on Go startup
- [ ] Telegram notification sent when status changes (test by manually updating `last_status` in DB)
- [ ] With no `AVIATIONSTACK_API_KEY` set, checker skips gracefully (empty string = skip)
