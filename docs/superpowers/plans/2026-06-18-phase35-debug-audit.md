# TrailGuide AI — Phase 35: Debug Session + Production Readiness Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically test every user-facing flow end-to-end in the local stack, find and fix bugs, run a security audit, and verify the app meets a production readiness checklist before executing Group E phases (new features).

**Architecture:** This phase is a structured debugging and audit session — no new features. It produces a bug log, a set of fixes, and a production readiness sign-off. Work through each flow in order: auth → trip creation → timeline → AI chat → collaboration → photos → flights → culture.

**Tech Stack:** Browser DevTools, `curl`, `psql` / Supabase SQL editor, Go logs (zerolog), Sentry (Phase 31).

**Prerequisite:** All phases 16-34 planned or complete. Services running locally via `make dev`.

## Global Constraints
- Document every bug found in `docs/debug-log.md` with: symptom, root cause, fix, verification.
- Security audit must check the OWASP Top 10 for each service.
- Do NOT ship this phase until all P0 (crash) and P1 (data loss / auth bypass) bugs are fixed.
- P2 (visual/UX) bugs go into GitHub Issues, not this phase.
- Every fix gets its own commit with `fix:` prefix.

---

## Task 1: Create debug log

- [ ] **Step 1: Create `docs/debug-log.md`**

```markdown
# Debug Log

**Date:** 2026-06-18
**Services tested:** Go backend :8080, Python AI :8081, Next.js :3000
**Test user:** seed@trailguide.test / SeedPassword123!

## Bug Template
**ID:** BUG-XXX
**Severity:** P0 (crash) / P1 (data loss/auth) / P2 (UX)
**Flow:** Which user flow
**Symptom:** What the user sees
**Root cause:** What the code does wrong
**Fix:** What was changed
**Verification:** How to confirm it's fixed

---
## Bugs Found

(fill in as bugs are discovered)
```

- [ ] **Step 2: Commit empty log**

```bash
git add docs/debug-log.md
git commit -m "docs: add debug-log.md for Phase 35 audit session"
```

---

## Task 2: Auth flow audit

- [ ] **Step 1: Test sign-up**

```bash
# Open browser: http://localhost:3000/signup
# Create a new account
# Verify: redirects to dashboard
# Check DB: profile row created
psql $DATABASE_URL -c "SELECT id, full_name, created_at FROM profiles ORDER BY created_at DESC LIMIT 3;"
```

- [ ] **Step 2: Test sign-in / sign-out**

```bash
# Sign in → dashboard loads
# Sign out → redirects to /login
# Navigate directly to /dashboard while signed out → redirects to /login
```

- [ ] **Step 3: Test JWT validation (Go)**

```bash
# Send request with no token:
curl -s http://localhost:8080/api/v1/trips | python3 -m json.tool
# Expected: {"error":"missing or malformed JWT"}

# Send request with expired token:
EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid"
curl -s -H "Authorization: Bearer $EXPIRED_TOKEN" http://localhost:8080/api/v1/trips
# Expected: {"error":"token is expired"}
```

- [ ] **Step 4: Test CSRF — Go uses JWTs (stateless) so no CSRF needed, but verify no session cookies**

```bash
# DevTools → Application → Cookies
# Should see: sb-xxx-auth-token (Supabase JWT) set by Next.js middleware
# Should NOT see: any backend session cookies
```

- [ ] **Step 5: Document and fix any auth bugs found**

---

## Task 3: Trip CRUD flow

- [ ] **Step 1: Create trip via UI**

```
1. Navigate to /trips/new
2. Complete all 8 wizard steps
3. Click Generate
4. Verify: redirects to /trips/{id}/timeline
5. Verify: at least 5 activities visible
```

- [ ] **Step 2: Verify data in DB**

```bash
psql $DATABASE_URL -c "
  SELECT t.title, COUNT(d.id) as days, COUNT(a.id) as activities
  FROM trips t
  LEFT JOIN days d ON d.trip_id = t.id
  LEFT JOIN activities a ON a.day_id = d.id
  GROUP BY t.id, t.title
  ORDER BY t.created_at DESC LIMIT 5;
"
```

- [ ] **Step 3: Test trip isolation — user A cannot see user B's trips**

```bash
# Get token for seed user:
SEED_TOKEN=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -d '{"email":"seed@trailguide.test","password":"SeedPassword123!"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get your own token (from browser DevTools → Application → Local Storage → supabase.auth.token)
MY_TOKEN="..."

# Try to access seed user's trip with your token:
SEED_TRIP_ID=$(curl -s -H "Authorization: Bearer $SEED_TOKEN" http://localhost:8080/api/v1/trips | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
curl -s -H "Authorization: Bearer $MY_TOKEN" http://localhost:8080/api/v1/trips/$SEED_TRIP_ID
# Expected: {"error":"trip not found"} — not {"error":"forbidden"}
# (returning 404 not 403 is intentional — don't leak trip existence)
```

- [ ] **Step 4: Test activity reordering**

```
1. On timeline, drag activity to different position
2. Refresh page
3. Verify: order persisted
```

- [ ] **Step 5: Document and fix any trip CRUD bugs found**

---

## Task 4: AI features audit

- [ ] **Step 1: Test AI generation (itinerary)**

```bash
# Time how long generation takes:
time curl -s -X POST http://localhost:8081/ai/generate-itinerary \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Barcelona","startDate":"2026-08-01","endDate":"2026-08-05","travelers":2,"tripStyle":"explorer","interests":["food","architecture"],"transportMode":"public","budget":"medium","currency":"USD"}' \
  | python3 -m json.tool | head -30
# Expected: < 8 seconds, valid JSON with "days" array
```

- [ ] **Step 2: Test AI chat streaming**

```bash
curl -s -N -X POST http://localhost:8081/ai/chat \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What should I eat in Barcelona?"}],"destination":"Barcelona"}' 
# Expected: streaming text response (tokens appear one by one)
```

- [ ] **Step 3: Test culture pack**

```bash
curl -s -X POST http://localhost:8081/ai/culture-pack \
  -H "X-Internal-Token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Tokyo, Japan"}' | python3 -m json.tool | head -40
# Expected: JSON with language_phrases, customs, emergency_numbers, visa_info
```

- [ ] **Step 4: Test Groq error handling**

```bash
# Temporarily set a wrong GROQ_API_KEY in ai-service/.env and restart
# Make a generate-itinerary call
# Expected: 502 Bad Gateway with {"error":"AI service unavailable"} — NOT a stack trace
# Restore correct key
```

- [ ] **Step 5: Document and fix any AI bugs found**

---

## Task 5: Security audit (OWASP Top 10)

- [ ] **Check A01: Broken Access Control**

```bash
# All /api/v1/* routes require JWT — verify with curl (done above)
# Trip queries include WHERE user_id = $user_id — check in handler code
grep -n "user_id" backend/internal/handlers/trips.go | head -10
```

- [ ] **Check A02: Cryptographic Failures**

```bash
# JWT uses HS256 with SUPABASE_JWT_SECRET — verify in auth middleware
grep -n "HS256\|SigningMethodHS256" backend/internal/middleware/auth.go
# Database URL must use SSL — check
echo $DATABASE_URL | grep -c "sslmode=require"
```

- [ ] **Check A03: Injection**

```bash
# All DB queries use parameterized queries ($1, $2...) — verify
grep -n "Sprintf.*SELECT\|Sprintf.*INSERT\|Sprintf.*UPDATE" backend/internal/handlers/*.go
# Should return 0 results (no string-formatted SQL)
```

- [ ] **Check A05: Security Misconfiguration**

```bash
# CORS — verify Go only allows the Next.js domain
grep -n "AllowOrigins\|CORS" backend/main.go
# /swagger/ endpoint only in dev mode
grep -n "swagger\|Swagger" backend/main.go
# APP_ENV check present
```

- [ ] **Check A07: Identification and Authentication Failures**

```bash
# Ensure INTERNAL_API_SECRET is at least 32 characters
echo -n "$INTERNAL_API_SECRET" | wc -c
# Should be >= 32
```

- [ ] **Check A09: Security Logging**

```bash
# Verify 401/403 responses are logged
# Make a few unauthorized requests, check logs:
# Expected: zerolog output with level=warn, request_id, endpoint
```

- [ ] **Step: Fix all security issues found and document in debug-log.md**

---

## Task 6: Production readiness checklist

- [ ] **Infrastructure**
  - [ ] All three services start cleanly from a fresh clone: `git clone && make dev`
  - [ ] `docker-compose up` starts all three services
  - [ ] `GET /health` returns 200 for Go + Python

- [ ] **Data**
  - [ ] All DB migrations are idempotent (run twice without error)
  - [ ] `supabase/migrations/` files are numbered sequentially
  - [ ] RLS policies are enabled on all tables with user data

- [ ] **Secrets**
  - [ ] `.env.local` is in `.gitignore`
  - [ ] `git log --all -- "*.env"` returns no results (no secrets ever committed)
  - [ ] All env vars are documented in `.env.local.example`

- [ ] **Reliability**
  - [ ] Groq rate limit / error → 502 with JSON error body (not 500 with stack trace)
  - [ ] Missing trip → 404 (not 500)
  - [ ] AviationStack down → flight alert shows last-known status, not crash

- [ ] **Performance**
  - [ ] `/api/v1/trips` response time < 200ms (check with `time curl`)
  - [ ] AI itinerary generation < 10s
  - [ ] Timeline with 7 days + 35 activities loads < 500ms

- [ ] **Step: Fix all P0/P1 issues. Document all P2 issues as GitHub Issues.**

- [ ] **Step: Final commit**

```bash
git add docs/debug-log.md
git commit -m "docs: complete Phase 35 debug session and production readiness audit"
```

---

## Verification Checklist

- [ ] `docs/debug-log.md` documents all bugs found (even if P2)
- [ ] All P0 and P1 bugs are fixed and marked in the log
- [ ] Security audit completed — no A01/A03 (access control / injection) issues
- [ ] No SQL injection possible — all queries parameterized
- [ ] JWT validation rejects expired, missing, and invalid tokens
- [ ] User A cannot access User B's trips
- [ ] All DB migrations apply cleanly on a fresh database
- [ ] `make health` shows ✓ for all 3 services
