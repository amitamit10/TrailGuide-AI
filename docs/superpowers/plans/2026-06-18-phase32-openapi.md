# TrailGuide AI — Phase 32: OpenAPI Spec + Type Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an OpenAPI 3.1 spec from Go handler annotations using `swaggo/swag`, then auto-generate TypeScript types from that spec so the frontend types are always in sync with the backend without manual maintenance.

**Architecture:** Go handlers get `// @Summary`, `// @Tags`, `// @Param`, `// @Success`, `// @Router` annotations. `swag init` produces `docs/openapi.yaml`. A CI step runs `openapi-typescript` to generate `src/types/generated.ts` from that spec. Phase 27's hand-written `src/types/api.ts` is replaced by the generated file. The Python AI service already auto-generates an OpenAPI spec at `/openapi.json` via FastAPI — Phase 32 also exports that to `docs/ai-openapi.yaml`.

**Tech Stack:** `github.com/swaggo/swag` (Go), `openapi-typescript` npm package, FastAPI's built-in spec generation.

**Prerequisite:** Phase 27 complete (TypeScript types exist, will be replaced). Phase 28 (Go tests pass, means handler structure is stable).

## Global Constraints
- Generated file `src/types/generated.ts` is checked into git — regenerate by running `make gen-types`.
- Hand-written `src/types/api.ts` is DELETED after verification that generated types cover all fields.
- The OpenAPI spec lives at `docs/openapi.yaml` (Go) and `docs/ai-openapi.yaml` (Python).
- Run `swag init` from `backend/` directory, not from repo root.

---

## Task 1: Go — swaggo annotations + spec generation

- [ ] **Step 1: Install swag CLI**

```bash
cd backend
go install github.com/swaggo/swag/cmd/swag@v1.16.3
go get github.com/swaggo/swag@v1.16.3
go get github.com/swaggo/gin-swagger@v1.6.0
go get github.com/swaggo/files@v1.0.1
```

- [ ] **Step 2: Add main.go annotations**

```go
// @title TrailGuide API
// @version 1.0
// @description TrailGuide trip planning backend
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
package main
```

- [ ] **Step 3: Annotate all handlers**

Example for `trips.go`:
```go
// List godoc
// @Summary List user's trips
// @Tags trips
// @Security BearerAuth
// @Success 200 {object} map[string][]models.Trip
// @Failure 401 {object} map[string]string
// @Router /trips [get]
func (h *TripHandler) List(c *gin.Context) {
```

```go
// Get godoc
// @Summary Get a trip by ID
// @Tags trips
// @Security BearerAuth
// @Param id path string true "Trip ID (UUID)"
// @Success 200 {object} map[string]models.Trip
// @Failure 404 {object} map[string]string
// @Router /trips/{id} [get]
func (h *TripHandler) Get(c *gin.Context) {
```

```go
// Create godoc
// @Summary Create a new trip
// @Tags trips
// @Security BearerAuth
// @Param trip body models.Trip true "Trip data"
// @Success 201 {object} map[string]map[string]string
// @Router /trips [post]
func (h *TripHandler) Create(c *gin.Context) {
```

Add similar annotations to ALL handler methods (days, activities, members, photos, flights, culture, admin).

- [ ] **Step 4: Annotate model structs**

In `backend/internal/models/models.go`, add `example` tags:
```go
type Trip struct {
	ID          string   `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserID      string   `json:"user_id" example:"550e8400-e29b-41d4-a716-446655440001"`
	Title       string   `json:"title" example:"Tokyo Adventure"`
	Destination string   `json:"destination" example:"Tokyo, Japan"`
	StartDate   string   `json:"start_date" example:"2026-08-01"`
	EndDate     string   `json:"end_date" example:"2026-08-07"`
	Travelers   int      `json:"travelers" example:"2"`
}
```

- [ ] **Step 5: Generate the OpenAPI spec**

```bash
cd backend
swag init -g main.go -o docs/swagger --outputTypes yaml,json
cp docs/swagger/swagger.yaml ../../docs/openapi.yaml
```

Verify:
```bash
cat ../docs/openapi.yaml | head -30
# Should show: openapi: "3.0.1", paths: /trips: get: ...
```

- [ ] **Step 6: Add swagger UI endpoint (dev only)**

```go
import (
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
    _ "github.com/trailguide/backend/docs/swagger"
)

// In main.go, outside auth group:
if os.Getenv("APP_ENV") != "production" {
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
}
```

Now visit `http://localhost:8080/swagger/index.html` to browse the API.

- [ ] **Step 7: Commit**

```bash
git add backend/ docs/openapi.yaml
git commit -m "feat: add swaggo OpenAPI annotations to all Go handlers"
```

---

## Task 2: Python — export FastAPI spec

- [ ] **Step 1: Export OpenAPI spec from FastAPI**

FastAPI auto-generates the spec. Export it:

```bash
cd ai-service && source .venv/bin/activate
python3 -c "
import json
from main import app
spec = app.openapi()
import yaml
with open('../docs/ai-openapi.yaml', 'w') as f:
    yaml.dump(spec, f, default_flow_style=False)
print('Exported ai-openapi.yaml')
"
```

Install pyyaml if needed:
```bash
pip install pyyaml
```

- [ ] **Step 2: Add spec export to Makefile (Task 3 will create the Makefile)**

Note for Makefile Task 3: Add `make export-ai-spec` as a target.

- [ ] **Step 3: Commit**

```bash
git add docs/ai-openapi.yaml
git commit -m "docs: export FastAPI OpenAPI spec to docs/ai-openapi.yaml"
```

---

## Task 3: TypeScript — generate types from Go spec

- [ ] **Step 1: Install openapi-typescript**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh"
npm install -D openapi-typescript
```

- [ ] **Step 2: Generate types**

```bash
npx openapi-typescript ../docs/openapi.yaml -o src/types/generated.ts
```

Check output:
```bash
head -50 src/types/generated.ts
# Should show: export interface Trip { id: string; user_id: string; ... }
```

- [ ] **Step 3: Update imports to use generated types**

Search for uses of hand-written types:
```bash
grep -rn "from \"@/types/api\"" src/ --include="*.ts" --include="*.tsx"
```

For each import, update to use generated types:
```typescript
// Before:
import type { Trip, Day, Activity } from "@/types/api";

// After:
import type { Trip, Day, Activity } from "@/types/generated";
```

- [ ] **Step 4: Delete the hand-written types file**

Only after verifying imports all work:
```bash
npx tsc --noEmit  # zero errors
rm src/types/api.ts
git add -A
```

- [ ] **Step 5: Add `gen-types` to package.json scripts**

```json
{
  "scripts": {
    "gen-types": "openapi-typescript ../docs/openapi.yaml -o src/types/generated.ts"
  }
}
```

- [ ] **Step 6: Add to CI**

In `.github/workflows/ci.yml`, add a type consistency check:
```yaml
- name: Check types are up-to-date
  run: |
    # Regen from spec
    cd backend && swag init -g main.go -o docs/swagger --outputTypes yaml
    cp docs/swagger/swagger.yaml ../docs/openapi.yaml
    cd .. && npm run gen-types
    # Fail if generated types differ from committed types
    git diff --exit-code src/types/generated.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/types/generated.ts src/types/ package.json .github/
git commit -m "feat: replace hand-written API types with openapi-typescript generated types"
```

---

## Verification Checklist

- [ ] `http://localhost:8080/swagger/index.html` shows the full API (dev mode)
- [ ] `docs/openapi.yaml` contains paths for `/trips`, `/trips/{id}`, `/days`, `/activities`, etc.
- [ ] `docs/ai-openapi.yaml` contains all 10+ Python AI routes
- [ ] `npx tsc --noEmit` exits 0 after switching to generated types
- [ ] `npm run gen-types` regenerates `src/types/generated.ts` deterministically
- [ ] CI fails if a Go handler annotation changes but `src/types/generated.ts` is not updated
- [ ] `src/types/api.ts` is deleted
