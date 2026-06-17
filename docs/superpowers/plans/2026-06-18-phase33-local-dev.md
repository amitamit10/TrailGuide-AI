# TrailGuide AI — Phase 33: Local Development Experience

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-command startup of all three services (`make dev`), seed data script (creates a test user + 2 trips with days and activities), and a database reset command (`make db-reset`). Makes onboarding a new developer or AI agent from zero to running app take under 5 minutes.

**Architecture:** Root `Makefile` orchestrates all services. A Python seed script creates repeatable test data via the Go API (so seed data goes through the same validation as real data). A `.env.local.example` file contains ALL required env vars. A `scripts/` directory holds seed, reset, and health-check scripts.

**Tech Stack:** GNU Make, Python 3 (seed script — uses `requests` library), bash scripts.

**Prerequisite:** Phase 16-18 complete (all three services exist).

## Global Constraints
- `make dev` must work from the repo root without changing directories.
- Seed script uses the Go API (not direct DB access) — this verifies the API works end-to-end.
- Never commit `.env.local` or `backend/.env` — only `.example` files.
- `make help` prints all available targets with descriptions.

---

## Task 1: Root Makefile

- [ ] **Step 1: Create `Makefile` at repo root**

```makefile
.PHONY: dev stop backend frontend ai-service test seed db-reset gen-types help

# Load .env.local if it exists (for make commands run directly)
-include .env.local

export NVM_DIR ?= $(HOME)/.nvm
SHELL := /bin/bash

## help: Show this help
help:
	@grep -h "^##" $(MAKEFILE_LIST) | sed 's/## //'

## dev: Start all three services (Go backend, Python AI, Next.js)
dev:
	@echo "Starting TrailGuide dev stack..."
	@$(MAKE) -j3 backend ai-service frontend

## backend: Start Go backend on :8080
backend:
	@source $(NVM_DIR)/nvm.sh 2>/dev/null; \
	cd backend && go run main.go

## ai-service: Start Python AI service on :8081
ai-service:
	@cd ai-service && \
	[ -d .venv ] || python3 -m venv .venv && \
	source .venv/bin/activate && \
	pip install -r requirements.txt -q && \
	uvicorn main:app --host 0.0.0.0 --port 8081 --reload

## frontend: Start Next.js dev server on :3000
frontend:
	@source $(NVM_DIR)/nvm.sh 2>/dev/null; \
	npm run dev

## test: Run all test suites
test: test-go test-python test-ts

## test-go: Run Go backend tests
test-go:
	@cd backend && go test ./... -v

## test-python: Run Python AI service tests
test-python:
	@cd ai-service && source .venv/bin/activate && pytest -v

## test-ts: TypeScript type check
test-ts:
	@source $(NVM_DIR)/nvm.sh 2>/dev/null; \
	npx tsc --noEmit

## seed: Seed the database with test data (requires all services running)
seed:
	@cd scripts && python3 seed.py

## db-reset: Delete all seed data from the database
db-reset:
	@cd scripts && python3 seed.py --reset

## gen-types: Regenerate TypeScript types from OpenAPI spec
gen-types:
	@cd backend && swag init -g main.go -o docs/swagger --outputTypes yaml 2>/dev/null; \
	cp docs/swagger/swagger.yaml ../docs/openapi.yaml; \
	cd .. && npm run gen-types

## health: Check all services are healthy
health:
	@echo "Checking services..."
	@curl -sf http://localhost:8080/health && echo " ✓ Go backend :8080" || echo " ✗ Go backend :8080 (not running)"
	@curl -sf http://localhost:8081/health && echo " ✓ Python AI :8081" || echo " ✗ Python AI :8081 (not running)"
	@curl -sf http://localhost:3000 -o /dev/null && echo " ✓ Next.js :3000" || echo " ✗ Next.js :3000 (not running)"

## docker-up: Start all services via docker-compose
docker-up:
	@docker-compose up --build

## docker-down: Stop docker-compose services
docker-down:
	@docker-compose down
```

- [ ] **Step 2: Test make help**

```bash
make help
```

Expected: lists all targets with descriptions.

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "build: add root Makefile with dev, test, seed, health targets"
```

---

## Task 2: Seed data script

- [ ] **Step 1: Create `scripts/seed.py`**

```python
#!/usr/bin/env python3
"""
Seed the TrailGuide database with test data via the Go API.
Usage:
  python3 seed.py           # Create seed data
  python3 seed.py --reset   # Delete all seed data
"""
import sys
import os
import json
import time
import requests

API_URL = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:8080")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SEED_EMAIL = "seed@trailguide.test"
SEED_PASSWORD = "SeedPassword123!"

# ---- Auth ----

def sign_in():
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
        headers={"apikey": SUPABASE_KEY},
    )
    if resp.status_code == 200:
        return resp.json()["access_token"]
    # Try sign up first
    sign_up = requests.post(
        f"{SUPABASE_URL}/auth/v1/signup",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
        headers={"apikey": SUPABASE_KEY},
    )
    if sign_up.status_code not in (200, 201):
        print(f"Failed to create seed user: {sign_up.text}")
        sys.exit(1)
    time.sleep(2)  # Wait for trigger to create profile
    resp = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
        headers={"apikey": SUPABASE_KEY},
    )
    return resp.json()["access_token"]

# ---- Data ----

TRIPS = [
    {
        "title": "Tokyo Adventure",
        "destination": "Tokyo, Japan",
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "travelers": 2,
        "trip_style": "explorer",
        "interests": ["food", "technology", "culture"],
        "transport_mode": "public",
        "budget": "medium",
        "currency": "USD",
    },
    {
        "title": "Lisbon Food Tour",
        "destination": "Lisbon, Portugal",
        "start_date": "2026-10-15",
        "end_date": "2026-10-20",
        "travelers": 1,
        "trip_style": "foodie",
        "interests": ["food", "wine", "history"],
        "transport_mode": "walking",
        "budget": "low",
        "currency": "EUR",
    },
]

ACTIVITIES = [
    {
        "title": "Senso-ji Temple",
        "description": "Visit Tokyo's oldest and most significant Buddhist temple.",
        "time": "09:00",
        "duration": "2 hours",
        "cost": 0,
        "category": "attraction",
        "address": "2-3-1 Asakusa, Taito City, Tokyo",
        "photo_query": "Senso-ji Temple Tokyo morning",
        "is_completed": False,
        "sort_order": 1,
    },
    {
        "title": "Ramen at Ichiran",
        "description": "Solo ramen dining experience in private booth.",
        "time": "12:00",
        "duration": "1 hour",
        "cost": 15,
        "category": "food",
        "address": "1 Chome-22-7 Jinnan, Shibuya City",
        "photo_query": "Ichiran ramen Tokyo",
        "is_completed": False,
        "sort_order": 2,
    },
]

def seed(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    created = {"trips": [], "days": []}

    for trip_data in TRIPS:
        r = requests.post(f"{API_URL}/api/v1/trips", json=trip_data, headers=headers)
        if r.status_code not in (200, 201):
            print(f"Failed to create trip: {r.text}")
            continue
        trip_id = r.json()["data"]["id"]
        created["trips"].append(trip_id)
        print(f"  Created trip: {trip_data['title']} ({trip_id})")

        # Create 1 day + 2 activities for the first trip
        if trip_data == TRIPS[0]:
            day_r = requests.post(
                f"{API_URL}/api/v1/trips/{trip_id}/days",
                json={"date": trip_data["start_date"], "day_number": 1},
                headers=headers,
            )
            if day_r.status_code in (200, 201):
                day_id = day_r.json()["data"]["id"]
                created["days"].append(day_id)
                for act in ACTIVITIES:
                    act_data = {**act, "day_id": day_id, "trip_id": trip_id}
                    requests.post(
                        f"{API_URL}/api/v1/days/{day_id}/activities",
                        json=act_data,
                        headers=headers,
                    )
                print(f"    Created 1 day + {len(ACTIVITIES)} activities")

    print(f"\n✓ Seed complete: {len(created['trips'])} trips created")
    print(f"  Email: {SEED_EMAIL}")
    print(f"  Password: {SEED_PASSWORD}")
    print(f"  Sign in at: http://localhost:3000/login")

def reset(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{API_URL}/api/v1/trips", headers=headers)
    trips = r.json().get("data", [])
    for trip in trips:
        requests.delete(f"{API_URL}/api/v1/trips/{trip['id']}", headers=headers)
    print(f"✓ Reset complete: deleted {len(trips)} trips")

if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set")
        sys.exit(1)
    print("Authenticating seed user...")
    token = sign_in()
    if "--reset" in sys.argv:
        print("Resetting seed data...")
        reset(token)
    else:
        print("Creating seed data...")
        seed(token)
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/seed.py
```

- [ ] **Step 3: Test seed (requires all services running)**

```bash
# With all services running:
make seed
# Expected:
# Authenticating seed user...
# Creating seed data...
#   Created trip: Tokyo Adventure (uuid...)
#     Created 1 day + 2 activities
#   Created trip: Lisbon Food Tour (uuid...)
# ✓ Seed complete: 2 trips created
#   Email: seed@trailguide.test
#   Password: SeedPassword123!
#   Sign in at: http://localhost:3000/login
```

- [ ] **Step 4: Test reset**

```bash
make db-reset
# Expected: ✓ Reset complete: deleted 2 trips
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ Makefile
git commit -m "build: add seed data script and db-reset command via Go API"
```

---

## Task 3: `.env.local.example` update

- [ ] **Step 1: Read the existing file**

```bash
cat .env.local.example 2>/dev/null || echo "(not found)"
```

- [ ] **Step 2: Update `.env.local.example` with all required vars**

```bash
cat .env.local.example
```

Ensure it contains ALL env vars from ALL three services:

```bash
# TrailGuide AI — Environment Variables
# Copy to .env.local and fill in your values.
# See docs/contracts/ for what each variable is used for.

# ---- Supabase (required for all services) ----
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# ---- Go Backend (:8080) ----
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
PORT=8080
APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:8080

# ---- Python AI Service (:8081) ----
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
UNSPLASH_ACCESS_KEY=your-unsplash-key
NEXT_PUBLIC_AI_URL=http://localhost:8081

# ---- Shared secrets ----
INTERNAL_API_SECRET=generate-a-32-char-secret-here

# ---- Optional features ----
TELEGRAM_BOT_TOKEN=your-bot-token
AVIATIONSTACK_API_KEY=your-aviationstack-key
SENTRY_DSN=
LOG_LEVEL=info
```

- [ ] **Step 3: Add setup instructions to README or AGENTS.md**

In root `AGENTS.md`, add:
```markdown
## Quick Start

```bash
cp .env.local.example .env.local
# Fill in your Supabase credentials and API keys

make dev        # Starts all 3 services
make seed       # Creates test user + 2 sample trips
make health     # Verify all services are healthy
```
```

- [ ] **Step 4: Commit**

```bash
git add -f .env.local.example AGENTS.md
git commit -m "docs: update .env.local.example with all env vars + quick start guide"
```

---

## Verification Checklist

- [ ] `make help` lists all targets with descriptions
- [ ] `make dev` starts all 3 services (Go :8080, Python :8081, Next.js :3000)
- [ ] `make health` shows ✓ for all 3 services when running
- [ ] `make seed` creates 2 trips + 1 day + 2 activities via the Go API
- [ ] `make db-reset` deletes the seed trips
- [ ] `make test` runs all 3 test suites and reports results
- [ ] `.env.local.example` has every env var needed by all 3 services with clear comments
