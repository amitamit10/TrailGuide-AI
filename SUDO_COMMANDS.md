# Sudo Commands — Run These When You're Back

Run these in order. Each section explains what it unlocks.

---

## 1. Install Go 1.22 (unblocks Phase 16 — Go backend)

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

After Go is installed, run the backend:
```bash
cd "/home/amit/travel app/backend"
cp .env.example .env
# Fill in DATABASE_URL, SUPABASE_JWT_SECRET, INTERNAL_API_SECRET, TELEGRAM_BOT_TOKEN
go mod tidy
go run main.go
# Expected: "database connected" then "Listening and serving HTTP on :8080"
```

---

## 2. Install Docker (unblocks Phase 19 — containerisation)

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

---

## 3. New env vars to add to .env.local and Vercel

After Phase 16 and 17 are built, add these to `.env.local` AND Vercel env vars:

```bash
# Go backend URL (local dev)
NEXT_PUBLIC_API_URL=http://localhost:8080

# Python AI service URL (local dev)
NEXT_PUBLIC_AI_URL=http://localhost:8081
```

For backend/.env (NOT committed, local only):
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.nlqxnaktnvfomrcjlxmo.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=<from Supabase Dashboard → Settings → API → JWT Secret>
AI_SERVICE_URL=http://localhost:8081
INTERNAL_API_SECRET=<generate any random 32-char string>
TELEGRAM_BOT_TOKEN=<your bot token from .env.local>
PORT=8080
```

For ai-service/.env (NOT committed, local only):
```
PORT=8081
GROQ_API_KEY=<from .env.local>
TAVILY_API_KEY=<from .env.local>
UNSPLASH_ACCESS_KEY=<from .env.local>
INTERNAL_API_SECRET=<same value as backend>
```

---

## 4. Where to get SUPABASE_JWT_SECRET

Go to: https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/settings/api

Scroll to **JWT Settings** → copy the **JWT Secret** (not the anon key — the actual JWT secret).

---

## 5. Install Railway CLI (deploys Go + Python to production — no sudo needed)

```bash
npm install -g @railway/cli
railway login
```

After login, run from the project root:
```bash
railway init
```

---

## 6. After everything is installed — start all 3 services together

```bash
# Terminal 1 — Go backend
cd "/home/amit/travel app/backend" && go run main.go

# Terminal 2 — Python AI service
cd "/home/amit/travel app/ai-service" && source .venv/bin/activate && uvicorn main:app --port 8081 --reload

# Terminal 3 — Next.js frontend
cd "/home/amit/travel app" && export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && npm run dev
```

Then open http://localhost:3000 — should work end-to-end through Go + Python.
