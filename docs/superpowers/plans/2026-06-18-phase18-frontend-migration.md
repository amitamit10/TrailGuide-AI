# TrailGuide AI — Phase 18: Next.js Frontend Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip Next.js down to a pure frontend — remove all API routes, point every fetch call at the Go backend (Phase 16) or Python AI service (Phase 17), and keep only the Supabase auth flow (login/signup/callback) in Next.js.

**Architecture:** Next.js sends `Authorization: Bearer <supabase_access_token>` on every request to the Go backend. The Python AI service is called directly from the browser for streaming routes (chat) or via the Go backend for non-streaming routes. A thin `src/lib/api.ts` client handles auth header injection. `src/middleware.ts` (Phase 12) stays untouched — it still refreshes Supabase sessions. Supabase browser client stays for auth only.

**Tech Stack:** TypeScript, Next.js 16.2.9. No new packages.

## Global Constraints

- New environment variables in Next.js: `NEXT_PUBLIC_API_URL` (Go backend, default `http://localhost:8080`), `NEXT_PUBLIC_AI_URL` (Python AI service, default `http://localhost:8081`).
- Remove from Next.js `.env.local`: `GROQ_API_KEY`, `TAVILY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` — these now belong to the backend services.
- The auth flow (`/auth/callback`, `/login`, `/signup`) stays in Next.js entirely — do not move it.
- Delete API routes only after confirming the replacement works end-to-end in the browser.
- Keep `supabase/migrations/` — the schema doesn't change.
- Read `node_modules/next/dist/docs/01-app/` before touching routing or layout files.

---

## File Map

```
src/
├── lib/
│   ├── api.ts                  CREATE — typed API client (injects auth header)
│   └── supabase/
│       └── client.ts           KEEP — still used for auth session
└── app/
    ├── (auth)/                 KEEP ENTIRELY — login, signup, callback unchanged
    ├── api/                    DELETE all routes after migration (per task)
    └── (app)/                  UPDATE — replace fetch('/api/...') calls

.env.local                      UPDATE — add API URLs, remove backend secrets
```

---

## Task 1: Create the API client helper

**Files:**
- Create: `src/lib/api.ts`

This module wraps `fetch` to:
1. Inject the Supabase access token as `Authorization: Bearer <token>`
2. Route calls to the correct backend (Go or Python AI)
3. Throw on non-OK responses with the server error message

- [ ] **Step 1: Create `src/lib/api.ts`**

```typescript
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8081";

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function request<T>(
  base: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Go backend — authenticated data operations
export const api = {
  get: <T>(path: string) => request<T>(API_URL, path),
  post: <T>(path: string, body: unknown) =>
    request<T>(API_URL, path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(API_URL, path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(API_URL, path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) =>
    request<T>(API_URL, path, { method: "DELETE" }),
};

// Python AI service — AI + proxy routes (internal token handled server-side via Go proxy)
// For client-side streaming (chat), call Go's /api/v1/ai/chat which proxies with internal token
export const aiApi = {
  post: <T>(path: string, body: unknown) =>
    request<T>(API_URL, `/api/v1/ai${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// Streaming chat — returns ReadableStream
export async function streamChat(
  body: { messages: { role: string; content: string }[]; tripContext?: string }
): Promise<ReadableStream<Uint8Array>> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error("Chat stream failed");
  return res.body;
}
```

> **Note:** The Go backend proxies AI calls to the Python service with the internal token — client code only needs the user JWT. Go's `/api/v1/ai/*` routes forward to Python's `/ai/*` routes.

- [ ] **Step 2: Update `.env.local`**

Add:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_AI_URL=http://localhost:8081
```

Remove (move to `backend/.env` and `ai-service/.env`):
```
GROQ_API_KEY
TAVILY_API_KEY
UNSPLASH_ACCESS_KEY
TELEGRAM_BOT_TOKEN
SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts .env.local.example
git commit -m "feat: add typed API client helper with auth header injection"
```

---

## Task 2: Add AI proxy routes to Go backend

**Files:**
- Create: `backend/internal/handlers/ai.go`

The Go backend proxies AI calls to Python, adding the internal token. This keeps the Python service off the public internet.

- [ ] **Step 1: Create `backend/internal/handlers/ai.go`**

```go
package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AIProxyHandler struct {
	aiServiceURL      string
	internalAPISecret string
}

func NewAIProxyHandler(aiServiceURL, internalAPISecret string) *AIProxyHandler {
	return &AIProxyHandler{aiServiceURL: aiServiceURL, internalAPISecret: internalAPISecret}
}

func (h *AIProxyHandler) Proxy(c *gin.Context) {
	// Read body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// Build upstream URL: strip /api/v1/ai prefix → /ai/<rest>
	upstreamPath := "/ai" + c.Param("path")
	upstreamURL := fmt.Sprintf("%s%s", h.aiServiceURL, upstreamPath)

	req, err := http.NewRequestWithContext(c.Request.Context(),
		c.Request.Method, upstreamURL, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", h.internalAPISecret)

	// Copy query params
	req.URL.RawQuery = c.Request.URL.RawQuery

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "AI service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Stream response back (handles SSE for chat)
	c.Status(resp.StatusCode)
	for k, v := range resp.Header {
		for _, vv := range v {
			c.Header(k, vv)
		}
	}
	io.Copy(c.Writer, resp.Body)
}
```

- [ ] **Step 2: Wire proxy routes in `main.go`**

```go
aiProxy := handlers.NewAIProxyHandler(cfg.AIServiceURL, cfg.InternalAPISecret)
// Catch all /api/v1/ai/* and proxy to Python
v1.Any("/ai/*path", aiProxy.Proxy)

// Also proxy photo and weather (no auth needed)
r.GET("/api/places/photo", func(c *gin.Context) {
    c.Redirect(http.StatusTemporaryRedirect,
        cfg.AIServiceURL+"/places/photo?"+c.Request.URL.RawQuery)
})
r.GET("/api/weather", func(c *gin.Context) {
    c.Redirect(http.StatusTemporaryRedirect,
        cfg.AIServiceURL+"/weather?"+c.Request.URL.RawQuery)
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/handlers/ai.go backend/main.go
git commit -m "feat: add AI proxy handler — Go forwards /api/v1/ai/* to Python service"
```

---

## Task 3: Migrate trip creation and dashboard

**Files:**
- Modify: `src/app/(app)/trips/new/page.tsx` (or its client component)
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Update `dashboard/page.tsx` to fetch from Go backend**

Find every `supabase.from('trips').select(...)` call in the dashboard page/component. Replace with:

```typescript
import { api } from "@/lib/api";

// Before (Supabase direct):
const { data: trips } = await supabase.from("trips").select("*").eq("user_id", user.id);

// After (Go backend):
const { data: trips } = await api.get<{ data: Trip[] }>("/api/v1/trips");
```

- [ ] **Step 2: Update trip creation in `trips/new/` wizard**

Find where the wizard submits and calls `/api/ai/generate-itinerary`. Replace:

```typescript
// Before:
const res = await fetch("/api/ai/generate-itinerary", { method: "POST", body: JSON.stringify(payload) });

// After — Go backend proxies to Python:
import { aiApi } from "@/lib/api";
const result = await aiApi.post("/generate-itinerary", payload);
```

And where it saves the trip to Supabase:
```typescript
// Before:
await supabase.from("trips").insert({ ...tripData });

// After:
const { data } = await api.post<{ data: { id: string } }>("/api/v1/trips", tripData);
const tripId = data.id;
```

- [ ] **Step 3: Delete the old API routes once verified working**

```bash
rm -rf src/app/api/ai/generate-itinerary/
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/
git commit -m "feat: migrate dashboard and trip creation to Go backend + Python AI"
```

---

## Task 4: Migrate timeline, activities, and chat

**Files:**
- Modify: `src/components/itinerary/TimelineClient.tsx`
- Modify: `src/components/chat/ChatInputPanel.tsx`
- Modify: `src/app/api/ai/chat/route.ts` → delete after migration

- [ ] **Step 1: Update TimelineClient to use Go backend for activity operations**

Find calls like:
```typescript
await supabase.from("activities").update({ is_completed: true }).eq("id", activityId);
```

Replace with:
```typescript
import { api } from "@/lib/api";
await api.patch(`/api/v1/activities/${activityId}/complete`, { completed: true });
```

Find calls to fetch days/activities:
```typescript
const { data: days } = await supabase.from("days").select("*, activities(*)").eq("trip_id", tripId);
```

Replace with:
```typescript
const { data: days } = await api.get<{ data: Day[] }>(`/api/v1/trips/${tripId}/days`);
```

- [ ] **Step 2: Update chat to use streaming through Go proxy**

Find where chat sends messages (likely in `ChatInputPanel.tsx` or similar). Replace the fetch call:

```typescript
// Before:
const res = await fetch("/api/ai/chat", { method: "POST", ... });

// After:
import { streamChat } from "@/lib/api";
const stream = await streamChat({ messages, tripContext });
const reader = stream.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setResponse(prev => prev + decoder.decode(value));
}
```

- [ ] **Step 3: Delete migrated API routes**

```bash
rm -rf src/app/api/ai/chat/
rm -rf src/app/api/ai/replace-activity/
rm -rf src/app/api/ai/add-discovery/
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: migrate timeline, activity ops, and chat to Go/Python backends"
```

---

## Task 5: Migrate remaining routes and delete all Next.js API routes

**Files:**
- Modify: remaining components in `src/components/`
- Delete: all remaining `src/app/api/` directories

- [ ] **Step 1: Migrate recommendations (Discover tab)**

```typescript
// Before:
fetch("/api/ai/recommendations", { method: "POST", body: JSON.stringify(payload) })

// After:
aiApi.post("/recommendations", payload)
```

- [ ] **Step 2: Migrate trip story (Summary tab)**

```typescript
// Before:
fetch("/api/ai/trip-story", { method: "POST", ... })

// After:
aiApi.post("/trip-story", payload)
```

- [ ] **Step 3: Migrate photo proxy calls**

Photo proxy URLs like `/api/places/photo?query=...` now point to the Go backend which redirects to Python:
```typescript
// No code change needed in components — the URL stays /api/places/photo
// Go backend at the same domain proxies to Python
// OR update to point directly to the Go backend:
const photoUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/places/photo?query=${encodeURIComponent(query)}`;
```

- [ ] **Step 4: Migrate document import**

```typescript
// Before:
fetch("/api/documents/import", { method: "POST", ... })

// After:
aiApi.post<{ extracted: DocumentData }>("/documents/import", payload)
// Note: the aiApi path maps to /api/v1/ai/... — adjust to use raw api.post for /documents/ route
```

Since document import is at `/documents/import` not `/ai/`, add a specific route in Go:
```go
v1.POST("/documents/import", aiProxy.ProxyDocuments)
```

And add `ProxyDocuments` to the Go handler that forwards to `http://python:8081/documents/import`.

- [ ] **Step 5: Delete all remaining Next.js API routes**

```bash
rm -rf src/app/api/ai/
rm -rf src/app/api/documents/
rm -rf src/app/api/places/
rm -rf src/app/api/weather/
rm -rf src/app/api/telegram/
```

Confirm `src/app/api/` only contains the iCal export route from Phase 15 (or that route is also moved to Go).

- [ ] **Step 6: Update `next.config.ts` `connect-src` CSP directive**

Add the Go and Python backend URLs to `connect-src`:
```typescript
`connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} ${process.env.NEXT_PUBLIC_AI_URL} https://*.supabase.co`,
```

- [ ] **Step 7: Full end-to-end test**

Start all three services:
```bash
# Terminal 1
cd backend && go run main.go

# Terminal 2
cd ai-service && source .venv/bin/activate && uvicorn main:app --port 8081 --reload

# Terminal 3
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm run dev
```

Walk through the full flow:
1. Sign in → dashboard loads trips from Go backend ✅
2. Create new trip → wizard → Go saves to DB ✅
3. AI generates itinerary → Go proxies to Python ✅
4. Timeline loads → activities from Go ✅
5. Chat works with streaming ✅
6. Discover tab loads recommendations ✅
7. Activity photos load via proxy chain ✅

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: Phase 18 complete — Next.js is pure frontend, all API routes removed"
```

---

## Verification Checklist

- [ ] `src/app/api/` is empty (or contains only Phase 15 iCal export route)
- [ ] `GROQ_API_KEY` is NOT in `src/.env.local`
- [ ] Dashboard loads trips from Go backend (check Network tab — calls go to `localhost:8080`)
- [ ] Creating a trip saves to DB via Go backend
- [ ] AI itinerary generates (Go proxies to Python)
- [ ] Chat streaming works
- [ ] Activity photos load
- [ ] Telegram bot still works (now handled by Go, not Next.js)
- [ ] Login / signup / OAuth callback still work (untouched — Supabase auth)
- [ ] `npm run build` succeeds with no unused import errors
