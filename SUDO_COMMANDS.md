# Sudo Commands — Local Environment Setup

Run these in order. Each section explains what it unlocks.

---

## 1. Install Go 1.22 (required for the Go backend)

```bash
# Download Go 1.22
wget https://go.dev/dl/go1.22.5.linux-amd64.tar.gz -O /tmp/go.tar.gz

# Install to /usr/local
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf /tmp/go.tar.gz

# Add to PATH permanently
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify
go version
# Expected: go version go1.22.5 linux/amd64
```

After Go is installed, start the backend:

```bash
cd TrailGuide-AI/backend
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_JWT_SECRET, INTERNAL_API_SECRET, AI_SERVICE_URL
go mod tidy
go run main.go
# Expected: "database connected" then "Listening and serving HTTP on :8080"
```

---

## 2. Python AI Service — First-Time Setup

```bash
cd TrailGuide-AI/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in GROQ_API_KEY, TAVILY_API_KEY, UNSPLASH_ACCESS_KEY, INTERNAL_API_SECRET
uvicorn main:app --port 8081 --reload
# Expected: "Uvicorn running on http://0.0.0.0:8081"
```

---

## 3. Install Docker (optional — containerised local dev)

```bash
# Add Docker's official GPG key and repo
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow running docker without sudo
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

Then start all three services at once:
```bash
cd TrailGuide-AI
docker compose up
```

---

## 4. backend/.env (not committed — local only)

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.nlqxnaktnvfomrcjlxmo.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=<Supabase → Settings → API → JWT Settings → JWT Secret>
AI_SERVICE_URL=http://localhost:8081
INTERNAL_API_SECRET=<generate any random 32-char string>
CORS_ALLOW_ORIGIN=http://localhost:3000
PORT=8080
```

---

## 5. ai-service/.env (not committed — local only)

```bash
GROQ_API_KEY=<same as .env.local>
TAVILY_API_KEY=<same as .env.local>
UNSPLASH_ACCESS_KEY=<same as .env.local>
INTERNAL_API_SECRET=<same value as backend .env>
PORT=8081
```

---

## 6. .env.local additions (when using Go backend)

Add to `.env.local` in the project root AND to Vercel env vars:

```bash
BACKEND_URL=http://localhost:8080
```

---

## 7. Where to find SUPABASE_JWT_SECRET

Go to: [supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/settings/api](https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/settings/api)

Scroll to **JWT Settings** → copy the **JWT Secret** (not the anon key).

---

## 8. Install Railway CLI (deploys Go + Python to production)

```bash
npm install -g @railway/cli
railway login
```

After login, from the project root:
```bash
railway init
```

---

## 9. Start All 3 Services Locally

```bash
# Terminal 1 — Go backend
cd TrailGuide-AI/backend && go run main.go

# Terminal 2 — Python AI service
cd TrailGuide-AI/ai-service && source .venv/bin/activate && uvicorn main:app --port 8081 --reload

# Terminal 3 — Next.js frontend
cd TrailGuide-AI && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — full stack running through Go + Python when `BACKEND_URL` is set.
