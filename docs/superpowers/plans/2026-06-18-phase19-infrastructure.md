# TrailGuide AI — Phase 19: Infrastructure, Docker & Deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerise all three services (Go backend, Python AI service, Next.js frontend) with Docker, wire them together with Docker Compose for local development, add a GitHub Actions CI pipeline, and document the production deployment to Railway (Go + Python) + Vercel (Next.js).

**Architecture:** Each service has its own `Dockerfile`. `docker-compose.yml` at the repo root starts all three services plus exposes their ports. GitHub Actions runs `go build`, `pip install + pytest`, and `npm run build` on every push. Production: Railway free tier for Go and Python (both stateless), Vercel for Next.js (already there from Phase 6).

**Tech Stack:** Docker, Docker Compose v2, GitHub Actions, Railway CLI.

## Global Constraints

- Go binary is built in a multi-stage Dockerfile (`golang:1.22-alpine` builder → `alpine:3.19` runtime). Final image should be under 20 MB.
- Python image uses `python:3.12-slim`. No system packages required beyond what pip installs.
- Next.js uses the official `node:20-alpine` base with `output: "standalone"` in `next.config.ts`.
- `.env.local`, `backend/.env`, `ai-service/.env` are gitignored and never baked into images. Secrets are always passed via environment at runtime.
- Services communicate on an internal Docker network: `backend` calls `ai-service` at `http://ai-service:8081`.
- Production ports: Go → 8080, Python → 8081, Next.js → 3000.

---

## File Map

```
(repo root)
├── docker-compose.yml            CREATE — local dev orchestration
├── .dockerignore                 CREATE — shared ignore rules
├── backend/
│   └── Dockerfile                CREATE — multi-stage Go build
├── ai-service/
│   └── Dockerfile                CREATE — Python slim build
├── src/ (Next.js)
│   └── (no new files — just next.config.ts tweak)
├── next.config.ts                MODIFY — add output: "standalone"
└── .github/
    └── workflows/
        └── ci.yml                CREATE — build + test all three services
```

---

## Task 1: Dockerfiles for Go backend and Python AI service

**Files:**
- Create: `backend/Dockerfile`
- Create: `ai-service/Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Cache deps before copying source
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /backend ./main.go

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /backend /app/backend

EXPOSE 8080
CMD ["/app/backend"]
```

- [ ] **Step 2: Create `ai-service/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Cache requirements separately
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8081
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
```

- [ ] **Step 3: Create `.dockerignore` (repo root)**

```
node_modules
.next
backend/.env
ai-service/.env
.env.local
**/*.env
ai-service/.venv
__pycache__
*.pyc
.git
docs
*.md
```

- [ ] **Step 4: Test Go Dockerfile builds**

```bash
cd backend
docker build -t trailguide-backend:local .
docker images trailguide-backend:local
```

Expected: image under 25 MB.

```bash
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="..." \
  -e SUPABASE_JWT_SECRET="..." \
  -e AI_SERVICE_URL="http://host.docker.internal:8081" \
  -e INTERNAL_API_SECRET="test" \
  trailguide-backend:local
curl http://localhost:8080/health
# {"status":"ok"}
```

- [ ] **Step 5: Test Python Dockerfile builds**

```bash
cd ai-service
docker build -t trailguide-ai:local .
docker run --rm -p 8081:8081 \
  -e GROQ_API_KEY="..." \
  -e INTERNAL_API_SECRET="test" \
  trailguide-ai:local
curl http://localhost:8081/health
# {"status":"ok"}
```

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile ai-service/Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfiles for Go backend and Python AI service"
```

---

## Task 2: Docker Compose for local development

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
name: trailguide

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      PORT: "8080"
      DATABASE_URL: ${DATABASE_URL}
      SUPABASE_JWT_SECRET: ${SUPABASE_JWT_SECRET}
      AI_SERVICE_URL: "http://ai-service:8081"
      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      - ai-service
    restart: unless-stopped

  ai-service:
    build:
      context: ./ai-service
      dockerfile: Dockerfile
    ports:
      - "8081:8081"
    environment:
      PORT: "8081"
      GROQ_API_KEY: ${GROQ_API_KEY}
      TAVILY_API_KEY: ${TAVILY_API_KEY}
      UNSPLASH_ACCESS_KEY: ${UNSPLASH_ACCESS_KEY}
      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      NEXT_PUBLIC_API_URL: "http://localhost:8080"
      NEXT_PUBLIC_AI_URL: "http://localhost:8081"
    depends_on:
      - backend
    restart: unless-stopped
```

> **Note:** For local development, run Next.js with `npm run dev` (outside Docker) and only containerise the backend services. Use `docker compose up backend ai-service` to start just the Go + Python pair.

- [ ] **Step 2: Create a `.env.docker` template** (root level, for Docker Compose)

```bash
# Copy this to .env and fill in values — used by docker-compose.yml
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_JWT_SECRET=
INTERNAL_API_SECRET=
TELEGRAM_BOT_TOKEN=
GROQ_API_KEY=
TAVILY_API_KEY=
UNSPLASH_ACCESS_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Test the backend + AI service pair with Docker Compose**

```bash
cp .env.docker .env   # fill in your values
docker compose up backend ai-service --build
```

In another terminal:
```bash
curl http://localhost:8080/health   # {"status":"ok"}
curl http://localhost:8081/health   # {"status":"ok"}
```

Then start Next.js dev server normally pointing at the Docker services:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
```

Open the app and verify the full flow works.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.docker
git commit -m "feat: add Docker Compose for local backend + AI service orchestration"
```

---

## Task 3: Next.js standalone Docker build (optional — for full containerisation)

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile.web`

- [ ] **Step 1: Add `output: "standalone"` to `next.config.ts`**

Inside `nextConfig`:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",  // ADD THIS
  // ... rest of config unchanged
};
```

- [ ] **Step 2: Create `Dockerfile.web`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Test Next.js Docker build**

```bash
docker build -f Dockerfile.web -t trailguide-web:local \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 \
  .
docker run --rm -p 3000:3000 trailguide-web:local
```

Open `http://localhost:3000` — confirm the app loads.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts Dockerfile.web
git commit -m "feat: add Next.js standalone Docker build"
```

---

## Task 4: GitHub Actions CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  go-backend:
    name: Go backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
          cache: true
      - name: Download modules
        run: go mod download
      - name: Build
        run: go build ./...
      - name: Vet
        run: go vet ./...

  python-ai:
    name: Python AI service
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ai-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Check imports
        run: python -c "import main; import routers.generate; import routers.chat; print('imports ok')"
        env:
          GROQ_API_KEY: placeholder
          INTERNAL_API_SECRET: placeholder

  nextjs:
    name: Next.js frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - name: Install
        run: npm ci
      - name: Type check
        run: npx tsc --noEmit
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          NEXT_PUBLIC_API_URL: http://localhost:8080
          NEXT_PUBLIC_AI_URL: http://localhost:8081

  docker-build:
    name: Docker builds
    runs-on: ubuntu-latest
    needs: [go-backend, python-ai]
    steps:
      - uses: actions/checkout@v4
      - name: Build Go image
        run: docker build -t trailguide-backend:ci ./backend
      - name: Build Python image
        run: docker build -t trailguide-ai:ci ./ai-service
```

- [ ] **Step 2: Push and verify CI passes**

```bash
git add .github/
git commit -m "ci: add GitHub Actions pipeline for Go, Python, and Next.js"
git push origin main
```

Open the repo on GitHub → Actions tab → confirm all 4 jobs pass.

- [ ] **Step 3: Add CI badge to README.md**

In `README.md`, after the title line, add:
```markdown
![CI](https://github.com/amitamit10/TrailGuide-AI/actions/workflows/ci.yml/badge.svg)
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add CI status badge to README"
```

---

## Task 5: Production deployment guide

**Files:**
- Modify: `DEPLOY_CHECKLIST.md`

- [ ] **Step 1: Add the full multi-service deployment section to `DEPLOY_CHECKLIST.md`**

Append to the file:

```markdown
## Multi-Service Deployment (Phase 19+)

After the architecture migration (Phases 16-18), deploy three services:

### Go Backend → Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. `railway login`
3. `cd backend && railway init` — create new project "trailguide-backend"
4. `railway up` — deploys from `backend/Dockerfile`
5. In Railway Dashboard, add environment variables:
   - `DATABASE_URL` (Supabase direct connection string)
   - `SUPABASE_JWT_SECRET`
   - `AI_SERVICE_URL` (Python service Railway URL — set after Python deploys)
   - `INTERNAL_API_SECRET`
   - `TELEGRAM_BOT_TOKEN`
6. Copy the Railway service URL (e.g. `https://trailguide-backend.railway.app`)

### Python AI Service → Railway

1. `cd ai-service && railway init` — create "trailguide-ai"
2. `railway up`
3. Add environment variables: `GROQ_API_KEY`, `TAVILY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `INTERNAL_API_SECRET`, `PORT=8081`
4. Copy service URL

### Update Go backend

Set `AI_SERVICE_URL` in Railway to the Python service URL.

### Next.js → Vercel (unchanged from Phase 6)

Update environment variables in Vercel:
- `NEXT_PUBLIC_API_URL` = Go backend Railway URL
- `NEXT_PUBLIC_AI_URL` = Python service Railway URL (not needed if Go proxies everything)

Remove from Vercel (no longer needed):
- `GROQ_API_KEY`, `TAVILY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`

### Register Telegram webhook (update to Go backend URL)

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://trailguide-backend.railway.app/api/telegram/webhook"
```

### Post-deploy verification

- [ ] `GET https://trailguide-backend.railway.app/health` → `{"status":"ok"}`
- [ ] `GET https://trailguide-ai.railway.app/health` → `{"status":"ok"}`
- [ ] App at Vercel URL → login works, trips load, AI generates
- [ ] Telegram bot responds to /start
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY_CHECKLIST.md
git commit -m "docs: add multi-service production deployment guide to DEPLOY_CHECKLIST"
git push origin main
```

---

## Verification Checklist

- [ ] `docker build ./backend` succeeds, image under 25 MB
- [ ] `docker build ./ai-service` succeeds
- [ ] `docker compose up backend ai-service` starts both services
- [ ] `GET localhost:8080/health` and `GET localhost:8081/health` both return OK
- [ ] GitHub Actions CI: all 4 jobs pass on push to main
- [ ] CI badge visible in README
- [ ] `DEPLOY_CHECKLIST.md` has Railway deployment steps
