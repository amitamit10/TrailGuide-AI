# TrailGuide AI — Phase 23: Language & Culture Toolkit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Local Info" tab to every trip showing AI-generated essential phrases, real-time currency conversion, local customs (tipping, etiquette, dress code), emergency numbers, and a Tavily-powered visa requirements check. All data is cached in the database to avoid redundant AI calls.

**Architecture:** Python AI service gets a new `POST /ai/culture-pack` route that generates the full culture pack for a destination using Groq. Results are stored in a new `culture_cache` table (keyed by destination, with a 7-day TTL). Currency rates come from ExchangeRate-API (free tier, 1500 req/month) — Go proxies this with a 1-hour cache in the `currency_cache` table. The Next.js "Local Info" tab fetches from Go on load; fast because it hits the DB cache, not the AI.

**Tech Stack:** Python (FastAPI, Groq, Tavily) — culture pack generation. Go (Gin, pgx) — cache-first proxy for culture pack + currency. ExchangeRate-API (free, no key needed for basic rates). Next.js — Local Info tab UI.

**Prerequisite:** Phase 19 complete (Go backend + Python AI service running).

## Global Constraints

- New tables: `culture_cache` and `currency_cache` (see Task 1 schema).
- Culture pack TTL: 7 days (destination info rarely changes). Regenerate only if `cached_at < NOW() - INTERVAL '7 days'`.
- Currency cache TTL: 1 hour.
- ExchangeRate-API base URL: `https://open.er-api.com/v6/latest/{base_currency}` — free, no API key.
- New Go routes: `GET /api/v1/trips/:id/culture-pack`, `GET /api/v1/currency?from=USD&to=JPY`.
- New Python route: `POST /ai/culture-pack`.
- Trip's `currency` field (already in the `trips` table) is used as the default base currency.

---

## File Map

```
supabase/migrations/
└── 006_culture_currency_cache.sql     CREATE — culture_cache + currency_cache tables

backend/internal/handlers/
└── culture.go                         CREATE — cache-first culture pack + currency proxy

ai-service/routers/
└── culture.py                         CREATE — POST /ai/culture-pack (Groq + Tavily)

src/
└── app/(app)/trips/[id]/
    └── info/
        ├── page.tsx                   CREATE — Local Info tab server page
        └── InfoClient.tsx             CREATE — phrases, currency, customs, emergency UI
```

---

## Task 1: Database schema

**Files:**
- Create: `supabase/migrations/006_culture_currency_cache.sql`

- [ ] **Step 1: Create migration**

```sql
create table if not exists culture_cache (
  destination text primary key,
  data jsonb not null,
  cached_at timestamptz default now()
);

create table if not exists currency_cache (
  base_currency text primary key,
  rates jsonb not null,
  cached_at timestamptz default now()
);
```

> No RLS needed — these are shared caches, not user data. They contain no PII.

- [ ] **Step 2: Apply migration and commit**

```bash
supabase db push
git add supabase/migrations/006_culture_currency_cache.sql
git commit -m "feat: add culture_cache and currency_cache tables"
```

---

## Task 2: Python — culture pack generation route

**Files:**
- Create: `ai-service/routers/culture.py`

- [ ] **Step 1: Create `ai-service/routers/culture.py`**

```python
import json
import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

try:
    from tavily import TavilyClient
    _tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
except Exception:
    _tavily = None

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class CultureRequest(BaseModel):
    destination: str
    traveler_nationality: str = "international"

@router.post("/culture-pack")
async def culture_pack(req: CultureRequest):
    groq = get_groq()

    # Optional: use Tavily to look up visa requirements
    visa_context = ""
    if _tavily:
        try:
            results = _tavily.search(
                query=f"visa requirements {req.destination} {req.traveler_nationality} tourists 2026",
                max_results=2, search_depth="basic",
            )
            visa_context = " ".join(r.get("content", "")[:300] for r in results.get("results", []))
        except Exception:
            pass

    prompt = f"""You are a cultural travel expert. Generate a comprehensive local guide for travelers visiting {req.destination}.

{f'Visa context from web: {visa_context[:600]}' if visa_context else ''}

Return ONLY valid JSON in this exact format:
{{
  "language": {{
    "name": "Local language name",
    "script": "Latin / Arabic / etc",
    "phrases": [
      {{"phrase": "Hello", "local": "Konnichiwa", "pronunciation": "kon-ee-chee-wah"}},
      {{"phrase": "Thank you", "local": "Arigatou", "pronunciation": "ah-ree-gah-toh"}},
      {{"phrase": "Where is...?", "local": "...wa doko desu ka?", "pronunciation": "...wa doko des ka"}},
      {{"phrase": "How much?", "local": "Ikura desu ka?", "pronunciation": "ee-koo-rah des ka"}},
      {{"phrase": "Help!", "local": "Tasukete!", "pronunciation": "tah-soo-keh-teh"}},
      {{"phrase": "I don't understand", "local": "Wakarimasen", "pronunciation": "wah-kah-ree-mah-sen"}},
      {{"phrase": "Do you speak English?", "local": "Eigo ga hanasemasu ka?", "pronunciation": "ay-go ga ha-na-seh-mas ka"}},
      {{"phrase": "Excuse me", "local": "Sumimasen", "pronunciation": "sue-mee-mah-sen"}}
    ]
  }},
  "customs": {{
    "tipping": "string — tipping culture explained in 1-2 sentences",
    "dress_code": "string — what to wear / avoid at religious sites etc",
    "etiquette": ["string (do)", "string (don't)", "string (do)", "string (don't)"],
    "greetings": "string — how locals greet each other"
  }},
  "practical": {{
    "electricity": {{"voltage": "220V", "plug_type": "Type A/B", "adapter_needed": true}},
    "currency_name": "Japanese Yen",
    "currency_code": "JPY",
    "cash_culture": "string — is cash preferred or cards widely accepted?",
    "water_safety": "string — tap water safe to drink?",
    "internet": "string — SIM card / eSIM / WiFi situation"
  }},
  "emergency": {{
    "police": "110",
    "ambulance": "119",
    "fire": "119",
    "tourist_helpline": "string or null",
    "notes": "string — any important safety notes"
  }},
  "visa": {{
    "summary": "string — general visa situation for most Western travelers",
    "on_arrival": true,
    "duration_days": 90,
    "notes": "string — any important caveats"
  }}
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        temperature=0.3,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import culture
app.include_router(culture.router)
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST http://localhost:8081/ai/culture-pack \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret" \
  -d '{"destination":"Tokyo, Japan"}' | python3 -m json.tool | head -30
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/culture.py ai-service/main.py
git commit -m "feat: add AI culture pack route (phrases, customs, emergency, visa)"
```

---

## Task 3: Go — cache-first culture pack + currency handlers

**Files:**
- Create: `backend/internal/handlers/culture.go`

- [ ] **Step 1: Create `backend/internal/handlers/culture.go`**

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CultureHandler struct {
	db                *pgxpool.Pool
	aiServiceURL      string
	internalAPISecret string
}

func NewCultureHandler(db *pgxpool.Pool, aiServiceURL, internalAPISecret string) *CultureHandler {
	return &CultureHandler{db: db, aiServiceURL: aiServiceURL, internalAPISecret: internalAPISecret}
}

func (h *CultureHandler) GetCulturePack(c *gin.Context) {
	tripID := c.Param("tripId")
	userID := c.GetString("user_id")

	// Get trip destination
	var destination string
	err := h.db.QueryRow(context.Background(),
		`SELECT t.destination FROM trips t
		 JOIN trip_members m ON m.trip_id = t.id
		 WHERE t.id=$1 AND m.user_id=$2`, tripID, userID).Scan(&destination)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
		return
	}

	// Check cache (7-day TTL)
	var cached json.RawMessage
	var cachedAt time.Time
	cacheErr := h.db.QueryRow(context.Background(),
		`SELECT data, cached_at FROM culture_cache WHERE destination=$1`, destination).
		Scan(&cached, &cachedAt)

	if cacheErr == nil && time.Since(cachedAt) < 7*24*time.Hour {
		c.JSON(http.StatusOK, gin.H{"data": cached, "cached": true})
		return
	}

	// Call Python AI
	payload, _ := json.Marshal(map[string]string{"destination": destination})
	req, _ := http.NewRequestWithContext(c.Request.Context(),
		http.MethodPost, h.aiServiceURL+"/ai/culture-pack", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", h.internalAPISecret)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{"error": "culture pack generation failed"})
		return
	}
	defer resp.Body.Close()

	var pack json.RawMessage
	json.NewDecoder(resp.Body).Decode(&pack)

	// Upsert cache
	h.db.Exec(context.Background(),
		`INSERT INTO culture_cache (destination, data, cached_at) VALUES ($1,$2,NOW())
		 ON CONFLICT (destination) DO UPDATE SET data=EXCLUDED.data, cached_at=NOW()`,
		destination, pack)

	c.JSON(http.StatusOK, gin.H{"data": pack, "cached": false})
}

func (h *CultureHandler) GetCurrencyRates(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from and to are required"})
		return
	}

	// Check 1-hour cache
	var rates json.RawMessage
	var cachedAt time.Time
	cacheErr := h.db.QueryRow(context.Background(),
		`SELECT rates, cached_at FROM currency_cache WHERE base_currency=$1`, from).
		Scan(&rates, &cachedAt)

	if cacheErr != nil || time.Since(cachedAt) > time.Hour {
		// Fetch fresh rates
		resp, err := http.Get(fmt.Sprintf("https://open.er-api.com/v6/latest/%s", from))
		if err != nil || resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadGateway, gin.H{"error": "currency service unavailable"})
			return
		}
		defer resp.Body.Close()
		var result struct {
			Rates json.RawMessage `json:"rates"`
		}
		json.NewDecoder(resp.Body).Decode(&result)
		h.db.Exec(context.Background(),
			`INSERT INTO currency_cache (base_currency, rates, cached_at) VALUES ($1,$2,NOW())
			 ON CONFLICT (base_currency) DO UPDATE SET rates=EXCLUDED.rates, cached_at=NOW()`,
			from, result.Rates)
		rates = result.Rates
	}

	// Extract just the "to" rate
	var allRates map[string]float64
	json.Unmarshal(rates, &allRates)
	rate, ok := allRates[to]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("currency %s not found", to)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"from": from, "to": to, "rate": rate,
	}, "headers": gin.H{"Cache-Control": "public, max-age=3600"}})
}
```

- [ ] **Step 2: Wire routes into `main.go`**

```go
culture := handlers.NewCultureHandler(pool, cfg.AIServiceURL, cfg.InternalAPISecret)
v1.GET("/trips/:tripId/culture-pack", culture.GetCulturePack)
r.GET("/api/currency", culture.GetCurrencyRates)  // no auth — public
```

- [ ] **Step 3: Test**

```bash
# Culture pack (first call ~3s — generates AI; second call instant — cached)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/trips/$TRIP_ID/culture-pack | python3 -m json.tool | head -20

# Currency
curl -s "http://localhost:8080/api/currency?from=USD&to=JPY"
# {"data":{"from":"USD","rate":157.43,"to":"JPY"}}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/culture.go backend/main.go
git commit -m "feat: add cache-first culture pack and currency rate handlers"
```

---

## Task 4: Next.js — Local Info tab

**Files:**
- Create: `src/app/(app)/trips/[id]/info/page.tsx`
- Create: `src/app/(app)/trips/[id]/info/InfoClient.tsx`

- [ ] **Step 1: Create `src/app/(app)/trips/[id]/info/page.tsx`**

```typescript
import { InfoClient } from "./InfoClient";

export default function InfoPage({ params }: { params: { id: string } }) {
  return <InfoClient tripId={params.id} />;
}
```

- [ ] **Step 2: Create `src/app/(app)/trips/[id]/info/InfoClient.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CulturePack {
  language: {
    name: string;
    phrases: { phrase: string; local: string; pronunciation: string }[];
  };
  customs: {
    tipping: string;
    dress_code: string;
    etiquette: string[];
    greetings: string;
  };
  practical: {
    electricity: { voltage: string; plug_type: string; adapter_needed: boolean };
    currency_name: string;
    currency_code: string;
    cash_culture: string;
    water_safety: string;
    internet: string;
  };
  emergency: {
    police: string;
    ambulance: string;
    fire: string;
    tourist_helpline: string | null;
    notes: string;
  };
  visa: {
    summary: string;
    on_arrival: boolean;
    duration_days: number;
    notes: string;
  };
}

export function InfoClient({ tripId }: { tripId: string }) {
  const [pack, setPack] = useState<CulturePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ data: CulturePack }>(`/api/v1/trips/${tripId}/culture-pack`)
      .then(r => {
        setPack(r.data);
        // Fetch currency rate for this destination
        if (r.data.practical.currency_code !== "USD") {
          fetch(`/api/currency?from=USD&to=${r.data.practical.currency_code}`)
            .then(res => res.json())
            .then(d => setRate(d.data?.rate ?? null));
        }
      })
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full" />
    </div>
  );
  if (!pack) return <p className="text-center text-gray-400 py-12">No data available.</p>;

  return (
    <div className="max-w-lg mx-auto px-4 pb-20 space-y-6">
      {/* Essential Phrases */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-3">Essential {pack.language.name} Phrases</h2>
        <div className="bg-white rounded-2xl divide-y divide-gray-100 shadow-sm">
          {pack.language.phrases.map((p, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">{p.phrase}</span>
                <span className="text-sm font-medium text-gray-900">{p.local}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{p.pronunciation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Currency Converter */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-3">
          Currency · {pack.practical.currency_name}
        </h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-400">USD</label>
              <input type="number" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border-0 text-xl font-semibold text-gray-800 focus:outline-none" />
            </div>
            <span className="text-gray-300 text-xl">=</span>
            <div className="flex-1 text-right">
              <label className="text-xs text-gray-400">{pack.practical.currency_code}</label>
              <p className="text-xl font-semibold text-[#2D6A4F]">
                {rate ? (parseFloat(amount) * rate).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{pack.practical.cash_culture}</p>
        </div>
      </section>

      {/* Customs */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-3">Local Customs</h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div><span className="text-xs font-medium text-gray-400 uppercase">Tipping</span>
            <p className="text-sm text-gray-700 mt-0.5">{pack.customs.tipping}</p></div>
          <div><span className="text-xs font-medium text-gray-400 uppercase">Dress Code</span>
            <p className="text-sm text-gray-700 mt-0.5">{pack.customs.dress_code}</p></div>
          <div><span className="text-xs font-medium text-gray-400 uppercase">Do & Don't</span>
            <ul className="mt-1 space-y-1">
              {pack.customs.etiquette.map((e, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span>{i % 2 === 0 ? "✅" : "❌"}</span>{e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Emergency */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-3">Emergency Numbers</h2>
        <div className="bg-red-50 rounded-2xl p-4 shadow-sm grid grid-cols-3 gap-3">
          {[
            { label: "Police",    number: pack.emergency.police },
            { label: "Ambulance", number: pack.emergency.ambulance },
            { label: "Fire",      number: pack.emergency.fire },
          ].map(e => (
            <a key={e.label} href={`tel:${e.number}`}
              className="flex flex-col items-center bg-white rounded-xl p-3 shadow-sm">
              <span className="text-lg font-bold text-red-600">{e.number}</span>
              <span className="text-xs text-gray-500 mt-0.5">{e.label}</span>
            </a>
          ))}
        </div>
        {pack.emergency.notes && (
          <p className="text-xs text-gray-500 mt-2 px-1">{pack.emergency.notes}</p>
        )}
      </section>

      {/* Visa */}
      <section>
        <h2 className="font-semibold text-gray-800 mb-3">Visa</h2>
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              pack.visa.on_arrival ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {pack.visa.on_arrival ? "Visa on arrival" : "Visa required"}
            </span>
            {pack.visa.duration_days && (
              <span className="text-xs text-gray-400">Up to {pack.visa.duration_days} days</span>
            )}
          </div>
          <p className="text-sm text-gray-700">{pack.visa.summary}</p>
          {pack.visa.notes && <p className="text-xs text-gray-400 mt-1">{pack.visa.notes}</p>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add "Info" tab to the trip navigation**

In the trip tab nav component, add:
```tsx
{ label: "Info", href: `/trips/${tripId}/info`, icon: "🌐" }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/trips/
git commit -m "feat: add Local Info tab with AI culture pack, currency converter, emergency numbers"
```

---

## Verification Checklist

- [ ] `culture_cache` and `currency_cache` tables exist
- [ ] `GET /api/v1/trips/:id/culture-pack` first call generates and caches, second call returns cached
- [ ] `GET /api/currency?from=USD&to=JPY` returns correct rate
- [ ] "Local Info" tab appears in trip navigation
- [ ] Phrases section shows local script + pronunciation
- [ ] Currency converter updates as user types
- [ ] Emergency numbers are tappable (`tel:` links)
- [ ] Visa badge shows correct color (green = on arrival, yellow = required)
