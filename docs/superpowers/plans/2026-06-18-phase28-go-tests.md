# TrailGuide AI — Phase 28: Go Backend Test Suite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a comprehensive Go test suite for all HTTP handlers using `net/http/httptest` and a real test database (Supabase staging or local PostgreSQL). Achieve ≥ 80% coverage on handler code.

**Architecture:** Tests use `httptest.NewRecorder()` + a real `pgxpool` connected to a test database (pointed at via `TEST_DATABASE_URL`). No mocking of the DB — integration tests against real PostgreSQL give more confidence and match actual query behavior. A `testutil` package provides helpers: `newTestRouter()`, `makeAuthHeader()`, `seedTrip()`, `cleanDB()`. Table-driven tests cover happy path, auth failure, and not-found cases for each handler.

**Tech Stack:** Go standard `testing` package, `net/http/httptest`, `testify/assert`, `testify/require`.

**Prerequisite:** Phase 16 complete (Go backend exists).

## Global Constraints
- New env var: `TEST_DATABASE_URL` — points to a separate test schema or staging DB. Never run tests against production.
- Each test file runs `cleanDB(t, pool)` in `t.Cleanup()` to remove test data.
- Tests do NOT call external APIs (Telegram, AviationStack) — those handlers are tested with a mock HTTP server.
- Target: `go test ./... -cover` shows ≥ 80% coverage on `internal/handlers/`.
- Run: `cd backend && go test ./... -v -count=1`

---

## Task 1: Test utilities

- [ ] **Step 1: Create `backend/internal/testutil/testutil.go`**

```go
package testutil

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/trailguide/backend/internal/db"
	"github.com/trailguide/backend/internal/middleware"
)

func NewPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping integration test")
	}
	pool := db.NewPool(url)
	t.Cleanup(func() { pool.Close() })
	return pool
}

func NewRouter(jwtSecret string, registerRoutes func(*gin.RouterGroup)) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	v1 := r.Group("/api/v1")
	v1.Use(middleware.Auth(jwtSecret))
	registerRoutes(v1)
	return r
}

func MakeToken(t *testing.T, secret, userID string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to create test token: %v", err)
	}
	return token
}

func AuthHeader(token string) http.Header {
	h := http.Header{}
	h.Set("Authorization", "Bearer "+token)
	return h
}

func SeedProfile(t *testing.T, pool *pgxpool.Pool, userID string) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		`INSERT INTO profiles (id, full_name) VALUES ($1, 'Test User')
		 ON CONFLICT (id) DO NOTHING`, userID)
	if err != nil {
		t.Fatalf("seed profile: %v", err)
	}
}

func SeedTrip(t *testing.T, pool *pgxpool.Pool, userID string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO trips (user_id, title, destination, start_date, end_date, travelers, trip_style, budget, currency)
		 VALUES ($1, 'Test Trip', 'Tokyo, Japan', '2026-08-01', '2026-08-07', 2, 'explorer', 'medium', 'USD')
		 RETURNING id`, userID).Scan(&id)
	if err != nil {
		t.Fatalf("seed trip: %v", err)
	}
	// Also add to trip_members
	pool.Exec(context.Background(),
		`INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'owner')
		 ON CONFLICT DO NOTHING`, id, userID)
	return id
}

func CleanDB(t *testing.T, pool *pgxpool.Pool, userID string) {
	t.Helper()
	pool.Exec(context.Background(), `DELETE FROM trips WHERE user_id=$1`, userID)
	pool.Exec(context.Background(), `DELETE FROM profiles WHERE id=$1`, userID)
}

func Do(t *testing.T, router *gin.Engine, method, path string, header http.Header, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if body != nil {
		req = httptest.NewRequest(method, path, httptest.NewRequest("", "", nil).Body)
	}
	for k, v := range header {
		req.Header[k] = v
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

const TestJWTSecret = "test-secret-32-chars-exactly-ok!"
const TestUserID = "00000000-0000-0000-0000-000000000001"
```

- [ ] **Step 2: Commit**

```bash
git add backend/internal/testutil/
git add backend/go.mod  # testify dependency
go get github.com/stretchr/testify@v1.9.0
git commit -m "test: add Go test utilities (pool, router, token helpers, seeders)"
```

---

## Task 2: Trip handler tests

- [ ] **Step 1: Create `backend/internal/handlers/trips_test.go`**

```go
package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/trailguide/backend/internal/handlers"
	"github.com/trailguide/backend/internal/testutil"
)

func TestTripList(t *testing.T) {
	pool := testutil.NewPool(t)
	testutil.SeedProfile(t, pool, testutil.TestUserID)
	tripID := testutil.SeedTrip(t, pool, testutil.TestUserID)
	t.Cleanup(func() { testutil.CleanDB(t, pool, testutil.TestUserID) })

	h := handlers.NewTripHandler(pool)
	r := testutil.NewRouter(testutil.TestJWTSecret, func(v1 *gin.RouterGroup) {
		v1.GET("/trips", h.List)
	})
	token := testutil.MakeToken(t, testutil.TestJWTSecret, testutil.TestUserID)

	t.Run("returns trips for authenticated user", func(t *testing.T) {
		w := testutil.Do(t, r, "GET", "/api/v1/trips", testutil.AuthHeader(token), nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct{ Data []map[string]interface{} }
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.Len(t, resp.Data, 1)
		assert.Equal(t, tripID, resp.Data[0]["id"])
	})

	t.Run("rejects unauthenticated request", func(t *testing.T) {
		w := testutil.Do(t, r, "GET", "/api/v1/trips", nil, nil)
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("returns empty list for new user", func(t *testing.T) {
		newUserToken := testutil.MakeToken(t, testutil.TestJWTSecret, "other-user-id-000000000002")
		w := testutil.Do(t, r, "GET", "/api/v1/trips", testutil.AuthHeader(newUserToken), nil)
		assert.Equal(t, http.StatusOK, w.Code)
		var resp struct{ Data []interface{} }
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.Empty(t, resp.Data)
	})
}

func TestTripGet(t *testing.T) {
	pool := testutil.NewPool(t)
	testutil.SeedProfile(t, pool, testutil.TestUserID)
	tripID := testutil.SeedTrip(t, pool, testutil.TestUserID)
	t.Cleanup(func() { testutil.CleanDB(t, pool, testutil.TestUserID) })

	h := handlers.NewTripHandler(pool)
	r := testutil.NewRouter(testutil.TestJWTSecret, func(v1 *gin.RouterGroup) {
		v1.GET("/trips/:id", h.Get)
	})
	token := testutil.MakeToken(t, testutil.TestJWTSecret, testutil.TestUserID)

	tests := []struct {
		name       string
		id         string
		wantStatus int
	}{
		{"existing trip", tripID, http.StatusOK},
		{"non-existent trip", "00000000-0000-0000-0000-999999999999", http.StatusNotFound},
		{"other user's trip", "other-trip", http.StatusNotFound},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := testutil.Do(t, r, "GET", fmt.Sprintf("/api/v1/trips/%s", tc.id),
				testutil.AuthHeader(token), nil)
			assert.Equal(t, tc.wantStatus, w.Code)
		})
	}
}
```

- [ ] **Step 2: Run tests**

```bash
cd backend
TEST_DATABASE_URL="postgresql://..." go test ./internal/handlers/ -v -run TestTrip
```

Expected output:
```
--- PASS: TestTripList/returns_trips_for_authenticated_user
--- PASS: TestTripList/rejects_unauthenticated_request
--- PASS: TestTripList/returns_empty_list_for_new_user
--- PASS: TestTripGet/existing_trip
--- PASS: TestTripGet/non-existent_trip
PASS
```

- [ ] **Step 3: Add similar tests for auth middleware**

```go
// backend/internal/middleware/auth_test.go
func TestAuthMiddleware(t *testing.T) {
	// ... test missing header, invalid token, expired token, valid token
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/trips_test.go backend/internal/middleware/auth_test.go
git commit -m "test: add Go handler tests for trip CRUD and auth middleware"
```

---

## Task 3: Coverage report and CI integration

- [ ] **Step 1: Add coverage to CI (`.github/workflows/ci.yml`)**

```yaml
- name: Test with coverage
  run: |
    go test ./... -coverprofile=coverage.out -count=1
    go tool cover -func=coverage.out | grep total | awk '{print $3}'
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

- [ ] **Step 2: Check current coverage**

```bash
cd backend
TEST_DATABASE_URL="..." go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
# Open coverage.html in browser — review uncovered lines
```

- [ ] **Step 3: Write tests for any handler below 70% coverage**

For each uncovered handler (days, activities, members, profile), write a test file following the same pattern as `trips_test.go`.

- [ ] **Step 4: Commit**

```bash
git add backend/ .github/workflows/ci.yml
git commit -m "ci: add Go test coverage to CI pipeline (target 80%)"
```

---

## Verification Checklist

- [ ] `cd backend && go test ./... -v` passes all tests (requires `TEST_DATABASE_URL`)
- [ ] Coverage ≥ 80% on `internal/handlers/`
- [ ] Auth middleware tests: missing header → 401, invalid token → 401, valid token → passes
- [ ] Trip handler tests: list, get (found + not found), unauthenticated
- [ ] CI `.github/workflows/ci.yml` runs tests and prints coverage %
- [ ] `testutil.SeedTrip` creates trip + trip_members owner row
