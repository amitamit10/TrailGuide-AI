# TrailGuide AI — Phase 16: Go Backend (CRUD + Auth + Telegram)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Go REST API that handles all data operations (trips, days, activities, profiles) and the Telegram bot webhook — replacing the Next.js API routes for these concerns.

**Architecture:** Gin HTTP router. pgx/v5 connects directly to Supabase PostgreSQL (bypasses Supabase client library entirely — app-layer auth instead of RLS). Auth middleware validates Supabase-issued JWTs using the project JWT secret (HS256). AI calls are proxied to the Python AI service (Phase 17) via an HTTP client. All handlers are thin — parse request, run query, return JSON.

**Tech Stack:** Go 1.22+, `github.com/gin-gonic/gin`, `github.com/jackc/pgx/v5`, `github.com/golang-jwt/jwt/v5`, `github.com/joho/godotenv`.

## Global Constraints

- Go module path: `github.com/trailguide/backend`
- All routes are under `/api/v1/` prefix.
- Auth: extract `Authorization: Bearer <token>` header, validate HS256 JWT with `SUPABASE_JWT_SECRET`, set `user_id` in Gin context.
- Database auth: every query has explicit `WHERE user_id = $N` — no RLS. Service role used only for Telegram webhook.
- Telegram webhook: parse raw JSON, call Bot API via plain HTTP — no Telegram library dependency.
- Return JSON with `{ "data": ... }` wrapper on success, `{ "error": "..." }` on failure.
- New environment variables (Go backend only): `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `AI_SERVICE_URL`, `INTERNAL_API_SECRET`, `TELEGRAM_BOT_TOKEN`, `PORT` (default 8080).

---

## File Map

```
backend/
├── go.mod
├── go.sum
├── main.go                            entry point, router wiring
├── .env.example
└── internal/
    ├── config/
    │   └── config.go                  env loading
    ├── db/
    │   └── db.go                      pgx pool init
    ├── middleware/
    │   └── auth.go                    JWT validation → sets user_id in context
    ├── models/
    │   └── models.go                  Trip, Day, Activity, Profile structs
    ├── handlers/
    │   ├── trips.go                   GET/POST/DELETE trips
    │   ├── days.go                    GET/POST days
    │   ├── activities.go              POST/PUT/DELETE/PATCH activities
    │   ├── profile.go                 GET/PATCH profile + telegram link
    │   ├── telegram.go                Telegram webhook handler
    │   └── ai.go                      proxy to Python AI service
    └── services/
        └── ai_client.go               HTTP client for Python AI service
```

---

## Task 1: Bootstrap Go module, Gin router, health endpoint

**Files:**
- Create: `backend/go.mod`
- Create: `backend/main.go`
- Create: `backend/internal/config/config.go`

- [ ] **Step 1: Create the `backend/` directory and initialise Go module**

```bash
mkdir -p backend
cd backend
go mod init github.com/trailguide/backend
go get github.com/gin-gonic/gin@v1.10.0
go get github.com/jackc/pgx/v5@v5.7.0
go get github.com/golang-jwt/jwt/v5@v5.2.1
go get github.com/joho/godotenv@v1.5.1
```

- [ ] **Step 2: Create `backend/internal/config/config.go`**

```go
package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	SupabaseJWTSecret  string
	AIServiceURL       string
	InternalAPISecret  string
	TelegramBotToken   string
}

func Load() *Config {
	_ = godotenv.Load()
	c := &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       mustEnv("DATABASE_URL"),
		SupabaseJWTSecret: mustEnv("SUPABASE_JWT_SECRET"),
		AIServiceURL:      getEnv("AI_SERVICE_URL", "http://localhost:8081"),
		InternalAPISecret: mustEnv("INTERNAL_API_SECRET"),
		TelegramBotToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
	}
	return c
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}
```

- [ ] **Step 3: Create `backend/main.go`**

```go
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trailguide/backend/internal/config"
)

func main() {
	cfg := config.Load()

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.Run(":" + cfg.Port)
}
```

- [ ] **Step 4: Create `backend/.env.example`**

```bash
PORT=8080
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard
AI_SERVICE_URL=http://localhost:8081
INTERNAL_API_SECRET=generate-a-random-32-char-string
TELEGRAM_BOT_TOKEN=123456789:ABC...
```

- [ ] **Step 5: Run and verify**

```bash
cd backend
cp .env.example .env   # fill in your values
go run main.go
```

Expected output:
```
[GIN-debug] GET    /health                   --> main.main.func1 (3 handlers)
[GIN-debug] Listening and serving HTTP on :8080
```

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: bootstrap Go backend with Gin router and health endpoint"
```

---

## Task 2: Database pool and models

**Files:**
- Create: `backend/internal/db/db.go`
- Create: `backend/internal/models/models.go`

- [ ] **Step 1: Create `backend/internal/db/db.go`**

```go
package db

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(databaseURL string) *pgxpool.Pool {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	log.Println("database connected")
	return pool
}
```

- [ ] **Step 2: Create `backend/internal/models/models.go`**

```go
package models

import "time"

type Profile struct {
	ID             string  `json:"id"`
	FullName       string  `json:"full_name"`
	AvatarURL      string  `json:"avatar_url"`
	TelegramChatID *string `json:"telegram_chat_id"`
}

type Trip struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	Title         string    `json:"title"`
	Destination   string    `json:"destination"`
	StartDate     string    `json:"start_date"`
	EndDate       string    `json:"end_date"`
	Travelers     int       `json:"travelers"`
	TripStyle     string    `json:"trip_style"`
	Interests     []string  `json:"interests"`
	TransportMode string    `json:"transport_mode"`
	FlightInfo    string    `json:"flight_info"`
	HotelInfo     string    `json:"hotel_info"`
	Budget        string    `json:"budget"`
	Currency      string    `json:"currency"`
	IsPublic      bool      `json:"is_public"`
	CreatedAt     time.Time `json:"created_at"`
}

type Day struct {
	ID         string       `json:"id"`
	TripID     string       `json:"trip_id"`
	Date       string       `json:"date"`
	DayNumber  int          `json:"day_number"`
	Activities []Activity   `json:"activities,omitempty"`
}

type Activity struct {
	ID          string  `json:"id"`
	DayID       string  `json:"day_id"`
	TripID      string  `json:"trip_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Time        string  `json:"time"`
	Duration    string  `json:"duration"`
	Cost        float64 `json:"cost"`
	Category    string  `json:"category"`
	Address     string  `json:"address"`
	PhotoURL    string  `json:"photo_url"`
	PhotoQuery  string  `json:"photo_query"`
	IsCompleted bool    `json:"is_completed"`
	SortOrder   int     `json:"sort_order"`
}
```

- [ ] **Step 3: Wire pool into `main.go`**

Update `backend/main.go`:

```go
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trailguide/backend/internal/config"
	"github.com/trailguide/backend/internal/db"
)

func main() {
	cfg := config.Load()
	pool := db.NewPool(cfg.DatabaseURL)
	defer pool.Close()

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "db": "connected"})
	})

	r.Run(":" + cfg.Port)
}
```

- [ ] **Step 4: Verify database connects**

```bash
cd backend && go run main.go
# Expected: "database connected" then "Listening and serving HTTP on :8080"
curl http://localhost:8080/health
# {"status":"ok","db":"connected"}
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add pgx database pool and domain models"
```

---

## Task 3: JWT auth middleware

**Files:**
- Create: `backend/internal/middleware/auth.go`

- [ ] **Step 1: Create `backend/internal/middleware/auth.go`**

```go
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type SupabaseClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims := &SupabaseClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("user_id", claims.Sub)
		c.Next()
	}
}
```

- [ ] **Step 2: Wire middleware into `main.go` and add the `v1` route group**

Update `main.go`:

```go
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trailguide/backend/internal/config"
	"github.com/trailguide/backend/internal/db"
	"github.com/trailguide/backend/internal/middleware"
)

func main() {
	cfg := config.Load()
	pool := db.NewPool(cfg.DatabaseURL)
	defer pool.Close()

	r := gin.Default()
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")
	v1.Use(middleware.Auth(cfg.SupabaseJWTSecret))
	// handlers wired in later tasks

	r.Run(":" + cfg.Port)
}
```

- [ ] **Step 3: Manual test — auth rejection**

```bash
curl -s http://localhost:8080/api/v1/trips
# {"error":"missing authorization header"}

curl -s -H "Authorization: Bearer bad-token" http://localhost:8080/api/v1/trips
# {"error":"invalid token"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/middleware/
git commit -m "feat: add JWT auth middleware for Supabase tokens"
```

---

## Task 4: Trips CRUD handlers

**Files:**
- Create: `backend/internal/handlers/trips.go`

- [ ] **Step 1: Create `backend/internal/handlers/trips.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/models"
)

type TripHandler struct{ db *pgxpool.Pool }

func NewTripHandler(db *pgxpool.Pool) *TripHandler { return &TripHandler{db: db} }

func (h *TripHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	rows, err := h.db.Query(context.Background(),
		`SELECT id, user_id, title, destination, start_date, end_date, travelers,
		        trip_style, interests, transport_mode, flight_info, hotel_info,
		        budget, currency, is_public, created_at
		 FROM trips WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var trips []models.Trip
	for rows.Next() {
		var t models.Trip
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Destination,
			&t.StartDate, &t.EndDate, &t.Travelers, &t.TripStyle, &t.Interests,
			&t.TransportMode, &t.FlightInfo, &t.HotelInfo, &t.Budget,
			&t.Currency, &t.IsPublic, &t.CreatedAt); err != nil {
			continue
		}
		trips = append(trips, t)
	}
	if trips == nil {
		trips = []models.Trip{}
	}
	c.JSON(http.StatusOK, gin.H{"data": trips})
}

func (h *TripHandler) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")

	var t models.Trip
	err := h.db.QueryRow(context.Background(),
		`SELECT id, user_id, title, destination, start_date, end_date, travelers,
		        trip_style, interests, transport_mode, flight_info, hotel_info,
		        budget, currency, is_public, created_at
		 FROM trips WHERE id=$1 AND user_id=$2`, id, userID).
		Scan(&t.ID, &t.UserID, &t.Title, &t.Destination, &t.StartDate, &t.EndDate,
			&t.Travelers, &t.TripStyle, &t.Interests, &t.TransportMode,
			&t.FlightInfo, &t.HotelInfo, &t.Budget, &t.Currency, &t.IsPublic, &t.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": t})
}

func (h *TripHandler) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	var body models.Trip
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO trips (user_id, title, destination, start_date, end_date, travelers,
		  trip_style, interests, transport_mode, flight_info, hotel_info, budget, currency)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id`,
		userID, body.Title, body.Destination, body.StartDate, body.EndDate,
		body.Travelers, body.TripStyle, body.Interests, body.TransportMode,
		body.FlightInfo, body.HotelInfo, body.Budget, body.Currency).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}})
}

func (h *TripHandler) Delete(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	_, err := h.db.Exec(context.Background(),
		`DELETE FROM trips WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}
```

- [ ] **Step 2: Wire trips into `main.go`**

Add inside the `v1` group in `main.go`:
```go
import "github.com/trailguide/backend/internal/handlers"

// inside main(), after v1 := r.Group(...)
trips := handlers.NewTripHandler(pool)
v1.GET("/trips", trips.List)
v1.GET("/trips/:id", trips.Get)
v1.POST("/trips", trips.Create)
v1.DELETE("/trips/:id", trips.Delete)
```

- [ ] **Step 3: Manual test with a real Supabase JWT**

Get a JWT from your browser: DevTools → Application → Local Storage → find `supabase.auth.token` → copy `access_token`.

```bash
TOKEN=paste_your_access_token_here
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/trips
# {"data":[...your trips...]}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/trips.go backend/main.go
git commit -m "feat: add trips CRUD handlers (list, get, create, delete)"
```

---

## Task 5: Days and Activities handlers

**Files:**
- Create: `backend/internal/handlers/days.go`
- Create: `backend/internal/handlers/activities.go`

- [ ] **Step 1: Create `backend/internal/handlers/days.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/models"
)

type DayHandler struct{ db *pgxpool.Pool }

func NewDayHandler(db *pgxpool.Pool) *DayHandler { return &DayHandler{db: db} }

func (h *DayHandler) ListForTrip(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")

	// verify trip belongs to user
	var count int
	h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM trips WHERE id=$1 AND user_id=$2`, tripID, userID).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}

	rows, err := h.db.Query(context.Background(),
		`SELECT d.id, d.trip_id, d.date, d.day_number,
		        a.id, a.day_id, a.trip_id, a.title, a.description, a.time,
		        a.duration, a.cost, a.category, a.address, a.photo_url,
		        a.photo_query, a.is_completed, a.sort_order
		 FROM days d
		 LEFT JOIN activities a ON a.day_id = d.id
		 WHERE d.trip_id=$1
		 ORDER BY d.day_number, a.sort_order`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	dayMap := map[string]*models.Day{}
	var dayOrder []string
	for rows.Next() {
		var d models.Day
		var a models.Activity
		var aID, aDayID, aTripID *string
		var aTitle, aDesc, aTime, aDur, aCat, aAddr, aPhoto, aQuery *string
		var aCost *float64
		var aCompleted *bool
		var aSort *int
		if err := rows.Scan(&d.ID, &d.TripID, &d.Date, &d.DayNumber,
			&aID, &aDayID, &aTripID, &aTitle, &aDesc, &aTime, &aDur,
			&aCost, &aCat, &aAddr, &aPhoto, &aQuery, &aCompleted, &aSort); err != nil {
			continue
		}
		if _, ok := dayMap[d.ID]; !ok {
			dayMap[d.ID] = &models.Day{ID: d.ID, TripID: d.TripID, Date: d.Date, DayNumber: d.DayNumber}
			dayOrder = append(dayOrder, d.ID)
		}
		if aID != nil {
			act := models.Activity{
				ID: *aID, DayID: *aDayID, TripID: *aTripID,
				Title: strVal(aTitle), Description: strVal(aDesc),
				Time: strVal(aTime), Duration: strVal(aDur),
				Cost: floatVal(aCost), Category: strVal(aCat),
				Address: strVal(aAddr), PhotoURL: strVal(aPhoto),
				PhotoQuery: strVal(aQuery), IsCompleted: boolVal(aCompleted),
				SortOrder: intVal(aSort),
			}
			dayMap[d.ID].Activities = append(dayMap[d.ID].Activities, act)
		}
	}

	result := make([]models.Day, 0, len(dayOrder))
	for _, id := range dayOrder {
		result = append(result, *dayMap[id])
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

func (h *DayHandler) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")

	var body struct {
		Date      string `json:"date"`
		DayNumber int    `json:"day_number"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var count int
	h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM trips WHERE id=$1 AND user_id=$2`, tripID, userID).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var id string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO days (trip_id, date, day_number) VALUES ($1,$2,$3) RETURNING id`,
		tripID, body.Date, body.DayNumber).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}})
}

func strVal(s *string) string {
	if s == nil { return "" }
	return *s
}
func floatVal(f *float64) float64 {
	if f == nil { return 0 }
	return *f
}
func boolVal(b *bool) bool {
	if b == nil { return false }
	return *b
}
func intVal(i *int) int {
	if i == nil { return 0 }
	return *i
}
```

- [ ] **Step 2: Create `backend/internal/handlers/activities.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/models"
)

type ActivityHandler struct{ db *pgxpool.Pool }

func NewActivityHandler(db *pgxpool.Pool) *ActivityHandler { return &ActivityHandler{db: db} }

func (h *ActivityHandler) Create(c *gin.Context) {
	userID := c.GetString("user_id")
	dayID := c.Param("dayId")

	var body models.Activity
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// verify ownership via trip
	var tripID string
	err := h.db.QueryRow(context.Background(),
		`SELECT d.trip_id FROM days d JOIN trips t ON t.id=d.trip_id
		 WHERE d.id=$1 AND t.user_id=$2`, dayID, userID).Scan(&tripID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var id string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO activities (day_id, trip_id, title, description, time, duration,
		  cost, category, address, photo_url, photo_query, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
		dayID, tripID, body.Title, body.Description, body.Time, body.Duration,
		body.Cost, body.Category, body.Address, body.PhotoURL, body.PhotoQuery, body.SortOrder).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}})
}

func (h *ActivityHandler) Update(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")

	var body models.Activity
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.db.Exec(context.Background(),
		`UPDATE activities SET title=$1, description=$2, time=$3, duration=$4,
		  cost=$5, category=$6, address=$7, photo_url=$8, sort_order=$9
		 WHERE id=$10 AND trip_id IN (SELECT id FROM trips WHERE user_id=$11)`,
		body.Title, body.Description, body.Time, body.Duration, body.Cost,
		body.Category, body.Address, body.PhotoURL, body.SortOrder, id, userID)
	if err != nil || res.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "activity not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}})
}

func (h *ActivityHandler) Delete(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	h.db.Exec(context.Background(),
		`DELETE FROM activities WHERE id=$1
		 AND trip_id IN (SELECT id FROM trips WHERE user_id=$2)`, id, userID)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}

func (h *ActivityHandler) SetComplete(c *gin.Context) {
	userID := c.GetString("user_id")
	id := c.Param("id")
	var body struct{ Completed bool `json:"completed"` }
	c.ShouldBindJSON(&body)
	h.db.Exec(context.Background(),
		`UPDATE activities SET is_completed=$1 WHERE id=$2
		 AND trip_id IN (SELECT id FROM trips WHERE user_id=$3)`,
		body.Completed, id, userID)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"is_completed": body.Completed}})
}
```

- [ ] **Step 3: Wire into `main.go`**

```go
days := handlers.NewDayHandler(pool)
activities := handlers.NewActivityHandler(pool)

v1.GET("/trips/:tripId/days", days.ListForTrip)
v1.POST("/trips/:tripId/days", days.Create)
v1.POST("/days/:dayId/activities", activities.Create)
v1.PUT("/activities/:id", activities.Update)
v1.DELETE("/activities/:id", activities.Delete)
v1.PATCH("/activities/:id/complete", activities.SetComplete)
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/
git commit -m "feat: add days and activities CRUD handlers"
```

---

## Task 6: Profile handler and Telegram link endpoint

**Files:**
- Create: `backend/internal/handlers/profile.go`

- [ ] **Step 1: Create `backend/internal/handlers/profile.go`**

```go
package handlers

import (
	"context"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/models"
)

type ProfileHandler struct{ db *pgxpool.Pool }

func NewProfileHandler(db *pgxpool.Pool) *ProfileHandler { return &ProfileHandler{db: db} }

func (h *ProfileHandler) Get(c *gin.Context) {
	userID := c.GetString("user_id")
	var p models.Profile
	err := h.db.QueryRow(context.Background(),
		`SELECT id, COALESCE(full_name,''), COALESCE(avatar_url,''), telegram_chat_id
		 FROM profiles WHERE id=$1`, userID).
		Scan(&p.ID, &p.FullName, &p.AvatarURL, &p.TelegramChatID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "profile not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": p})
}

func (h *ProfileHandler) LinkTelegram(c *gin.Context) {
	userID := c.GetString("user_id")
	var body struct{ ChatID string `json:"chatId"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if !regexp.MustCompile(`^\d+$`).MatchString(body.ChatID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat ID — must be numeric"})
		return
	}
	_, err := h.db.Exec(context.Background(),
		`UPDATE profiles SET telegram_chat_id=$1, updated_at=NOW() WHERE id=$2`,
		body.ChatID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"linked": true}})
}
```

- [ ] **Step 2: Wire into `main.go`**

```go
profile := handlers.NewProfileHandler(pool)
v1.GET("/profile", profile.Get)
v1.POST("/profile/telegram", profile.LinkTelegram)
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/profile.go backend/main.go
git commit -m "feat: add profile get and Telegram linking endpoint"
```

---

## Task 7: Telegram webhook handler (pure Go, no library)

**Files:**
- Create: `backend/internal/handlers/telegram.go`

- [ ] **Step 1: Create `backend/internal/handlers/telegram.go`**

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TelegramHandler struct {
	db       *pgxpool.Pool
	botToken string
}

func NewTelegramHandler(db *pgxpool.Pool, botToken string) *TelegramHandler {
	return &TelegramHandler{db: db, botToken: botToken}
}

type tgUpdate struct {
	Message *tgMessage `json:"message"`
}
type tgMessage struct {
	Chat tgChat `json:"chat"`
	Text string `json:"text"`
}
type tgChat struct {
	ID int64 `json:"id"`
}

func (h *TelegramHandler) Webhook(c *gin.Context) {
	var update tgUpdate
	if err := c.ShouldBindJSON(&update); err != nil || update.Message == nil {
		c.Status(http.StatusOK)
		return
	}
	chatID := update.Message.Chat.ID
	text := strings.TrimSpace(update.Message.Text)
	cmd := strings.Fields(text)
	if len(cmd) == 0 {
		c.Status(http.StatusOK)
		return
	}

	switch cmd[0] {
	case "/start":
		h.send(chatID, fmt.Sprintf(
			"👋 Welcome to *TrailGuide AI*\\!\n\nYour Telegram ID is:\n`%d`\n\nCopy it, then open the app → *Settings → Connect Telegram* and paste it there\\.",
			chatID))
	case "/trip":
		h.handleTrip(chatID)
	case "/next":
		h.handleNext(chatID)
	case "/status":
		h.handleStatus(chatID)
	}
	c.Status(http.StatusOK)
}

func (h *TelegramHandler) handleTrip(chatID int64) {
	rows, err := h.db.Query(context.Background(),
		`SELECT t.title, t.destination, t.start_date, t.end_date
		 FROM trips t JOIN profiles p ON p.id=t.user_id
		 WHERE p.telegram_chat_id=$1 ORDER BY t.start_date DESC LIMIT 5`,
		fmt.Sprintf("%d", chatID))
	if err != nil {
		h.send(chatID, "Error fetching trips\\.")
		return
	}
	defer rows.Close()

	var lines []string
	for rows.Next() {
		var title, dest, start, end string
		rows.Scan(&title, &dest, &start, &end)
		lines = append(lines, fmt.Sprintf("✈️ *%s* — %s\n_%s → %s_",
			escapeMarkdown(title), escapeMarkdown(dest), start, end))
	}
	if len(lines) == 0 {
		h.send(chatID, "No trips found\\. Link your account first with /start\\.")
		return
	}
	h.send(chatID, strings.Join(lines, "\n\n"))
}

func (h *TelegramHandler) handleNext(chatID int64) {
	var title, actTime, destination string
	err := h.db.QueryRow(context.Background(),
		`SELECT a.title, a.time, t.destination
		 FROM activities a
		 JOIN days d ON d.id=a.day_id
		 JOIN trips t ON t.id=d.trip_id
		 JOIN profiles p ON p.id=t.user_id
		 WHERE p.telegram_chat_id=$1
		   AND d.date=CURRENT_DATE
		   AND a.is_completed=false
		 ORDER BY a.sort_order LIMIT 1`,
		fmt.Sprintf("%d", chatID)).Scan(&title, &actTime, &destination)
	if err != nil {
		h.send(chatID, "No upcoming activities found for today\\.")
		return
	}
	h.send(chatID, fmt.Sprintf("⏭️ Next up: *%s*\n🕐 %s — %s",
		escapeMarkdown(title), actTime, escapeMarkdown(destination)))
}

func (h *TelegramHandler) handleStatus(chatID int64) {
	rows, err := h.db.Query(context.Background(),
		`SELECT a.title, a.time FROM activities a
		 JOIN days d ON d.id=a.day_id
		 JOIN trips t ON t.id=d.trip_id
		 JOIN profiles p ON p.id=t.user_id
		 WHERE p.telegram_chat_id=$1
		   AND d.date=CURRENT_DATE
		   AND a.is_completed=false
		 ORDER BY a.sort_order LIMIT 10`,
		fmt.Sprintf("%d", chatID))
	if err != nil {
		h.send(chatID, "Error fetching status\\.")
		return
	}
	defer rows.Close()
	var lines []string
	for rows.Next() {
		var title, t string
		rows.Scan(&title, &t)
		lines = append(lines, fmt.Sprintf("• %s — %s", t, escapeMarkdown(title)))
	}
	if len(lines) == 0 {
		h.send(chatID, "All activities for today are done\\! 🎉")
		return
	}
	h.send(chatID, "📋 *Remaining today:*\n"+strings.Join(lines, "\n"))
}

func (h *TelegramHandler) send(chatID int64, text string) {
	body, _ := json.Marshal(map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "MarkdownV2",
	})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", h.botToken)
	http.Post(url, "application/json", bytes.NewReader(body)) //nolint:errcheck
}

func escapeMarkdown(s string) string {
	replacer := strings.NewReplacer(
		"_", "\\_", "*", "\\*", "[", "\\[", "]", "\\]",
		"(", "\\(", ")", "\\)", "~", "\\~", "`", "\\`",
		">", "\\>", "#", "\\#", "+", "\\+", "-", "\\-",
		"=", "\\=", "|", "\\|", "{", "\\{", "}", "\\}",
		".", "\\.", "!", "\\!",
	)
	return replacer.Replace(s)
}
```

- [ ] **Step 2: Wire into `main.go` (outside the auth group — Telegram calls without user JWT)**

```go
tg := handlers.NewTelegramHandler(pool, cfg.TelegramBotToken)
r.POST("/api/telegram/webhook", tg.Webhook)
```

- [ ] **Step 3: Register webhook with Telegram**

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://your-go-backend.railway.app/api/telegram/webhook"
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/telegram.go backend/main.go
git commit -m "feat: add Telegram webhook handler in Go (no library dependency)"
```

---

## Verification Checklist

- [ ] `go run main.go` starts without errors
- [ ] `GET /health` → `{"status":"ok"}`
- [ ] `GET /api/v1/trips` without token → 401
- [ ] `GET /api/v1/trips` with valid token → list of trips
- [ ] `POST /api/v1/trips` → creates trip, returns `{"data":{"id":"..."}}`
- [ ] `GET /api/v1/trips/:id/days` → days with nested activities
- [ ] `PATCH /api/v1/activities/:id/complete` → toggles is_completed
- [ ] `POST /profile/telegram` with non-numeric chatId → 400
- [ ] Telegram `/start` → bot replies with numeric chat ID
- [ ] Telegram `/trip` → lists trips for linked account
