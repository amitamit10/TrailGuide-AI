# TrailGuide AI — Phase 24: AI Destination Discovery

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Inspire Me" screen where users with no trip in mind can get AI-generated destination suggestions tailored to their preferences (budget, travel style, season, interests). Each suggestion has a hero photo, cost estimate, best time to visit, and a "Plan this trip" button that pre-fills the trip wizard.

**Architecture:** Python AI service gets `POST /ai/inspire` — takes user preferences, uses Tavily to search current travel trends, and returns 5 destination cards with rich detail. Results are not persisted (ephemeral, regenerated each time). Go proxies the call. Next.js shows a new `/explore` screen accessible from the dashboard — a card grid of suggestions with a re-generate button and direct "Plan this trip" CTAs.

**Tech Stack:** Python (FastAPI, Groq llama-3.3-70b, Tavily). Go (proxy, no new logic). Next.js — `/explore` route, DestinationCard component, pre-fill wizard.

**Prerequisite:** Phase 17 (Python AI service), Phase 18 (frontend migrated to Go backend).

## Global Constraints

- `POST /ai/inspire` is proxied through Go's `/api/v1/ai/inspire` — same internal-token proxy pattern as all other AI routes.
- Suggestions are ephemeral — not stored in the DB. Each click of "Re-inspire me" fetches fresh suggestions.
- "Plan this trip" navigates to `/trips/new?destination=...&style=...&budget=...` pre-filling wizard state via URL params.
- Hero photo uses the existing photo proxy (`/api/places/photo?query=...`) — no new photo infrastructure.
- Suggestions include Wikipedia attribution where Tavily sources are used.

---

## File Map

```
ai-service/routers/
└── inspire.py                      CREATE — POST /ai/inspire

src/
├── app/(app)/explore/
│   ├── page.tsx                    CREATE — /explore server page
│   └── ExploreClient.tsx           CREATE — suggestion cards, re-generate button
├── components/explore/
│   └── DestinationCard.tsx         CREATE — hero image, key info, Plan CTA
└── app/(app)/trips/new/
    └── page.tsx                    MODIFY — read URL params to pre-fill wizard
```

---

## Task 1: Python — destination inspiration route

**Files:**
- Create: `ai-service/routers/inspire.py`

- [ ] **Step 1: Create `ai-service/routers/inspire.py`**

```python
import json
import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

try:
    from tavily import TavilyClient
    _tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
except Exception:
    _tavily = None

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class InspireRequest(BaseModel):
    budget: str = "medium"
    travel_style: str = "explorer"
    interests: List[str] = []
    duration_days: int = 7
    departure_month: Optional[str] = None
    avoid: List[str] = []

@router.post("/inspire")
async def inspire(req: InspireRequest):
    groq = get_groq()

    # Tavily: current travel trends for context
    web_context = ""
    if _tavily:
        try:
            query = f"best travel destinations {req.departure_month or '2026'} {req.travel_style} budget {req.budget} {' '.join(req.interests[:2])}"
            results = _tavily.search(query=query, max_results=3, search_depth="basic")
            web_context = " ".join(r.get("content", "")[:250] for r in results.get("results", []))[:600]
        except Exception:
            pass

    avoid_str = f"Do NOT suggest: {', '.join(req.avoid)}." if req.avoid else ""
    interests_str = ", ".join(req.interests) if req.interests else "general travel"
    month_str = f"Best for travel in {req.departure_month}." if req.departure_month else ""

    prompt = f"""You are a world-class travel inspiration AI. Suggest 5 diverse, specific travel destinations.

Traveler profile:
- Budget: {req.budget} (low = hostels/budget hotels, medium = 3-star, high = 4-5 star)
- Style: {req.travel_style}
- Interests: {interests_str}
- Trip duration: {req.duration_days} days
- {month_str}
- {avoid_str}

{f'Current travel trends context: {web_context}' if web_context else ''}

Rules:
- Mix continents — no two destinations on the same continent
- Include one unexpected/underrated pick
- Be SPECIFIC (not "Europe" — say "Ljubljana, Slovenia")

Return ONLY valid JSON:
{{
  "destinations": [
    {{
      "name": "City, Country",
      "tagline": "One evocative sentence about why it's special",
      "why_now": "1 sentence — why this destination is great for {req.departure_month or 'travel now'}",
      "highlights": ["thing 1", "thing 2", "thing 3"],
      "estimated_daily_cost_usd": 120,
      "currency_code": "EUR",
      "best_for": "{req.travel_style}",
      "photo_query": "descriptive search term for a hero photo",
      "suggested_duration_days": {req.duration_days},
      "suggested_start_date": "YYYY-MM-DD or null",
      "trip_style": "relaxed|explorer|cultural|adventure|foodie",
      "interests": ["tag1", "tag2"],
      "budget_tier": "{req.budget}"
    }}
  ]
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        temperature=0.85,
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
from routers import inspire
app.include_router(inspire.router)
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST http://localhost:8081/ai/inspire \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret" \
  -d '{"budget":"medium","travel_style":"explorer","interests":["food","history"],"duration_days":7,"departure_month":"August"}' \
  | python3 -m json.tool
```

Expected: JSON with `destinations` array containing 5 items each with `name`, `tagline`, `highlights`, etc.

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/inspire.py ai-service/main.py
git commit -m "feat: add AI destination inspiration route (Groq + Tavily web grounding)"
```

---

## Task 2: Next.js — Explore screen

**Files:**
- Create: `src/app/(app)/explore/page.tsx`
- Create: `src/app/(app)/explore/ExploreClient.tsx`
- Create: `src/components/explore/DestinationCard.tsx`

- [ ] **Step 1: Create `src/components/explore/DestinationCard.tsx`**

```typescript
"use client";
import { useRouter } from "next/navigation";

interface Destination {
  name: string;
  tagline: string;
  why_now: string;
  highlights: string[];
  estimated_daily_cost_usd: number;
  photo_query: string;
  suggested_duration_days: number;
  trip_style: string;
  interests: string[];
  budget_tier: string;
  suggested_start_date: string | null;
}

export function DestinationCard({ dest }: { dest: Destination }) {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const photoUrl = `${apiBase}/api/places/photo?query=${encodeURIComponent(dest.photo_query)}`;

  function handlePlan() {
    const params = new URLSearchParams({
      destination: dest.name,
      style: dest.trip_style,
      budget: dest.budget_tier,
      interests: dest.interests.join(","),
      days: String(dest.suggested_duration_days),
      ...(dest.suggested_start_date ? { startDate: dest.suggested_start_date } : {}),
    });
    router.push(`/trips/new?${params.toString()}`);
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Hero photo */}
      <div className="relative h-44 bg-gray-100">
        <img
          src={photoUrl}
          alt={dest.name}
          className="w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-white font-bold text-lg leading-tight">{dest.name}</h3>
          <p className="text-white/80 text-xs mt-0.5">{dest.tagline}</p>
        </div>
      </div>

      <div className="p-4">
        {/* Why now */}
        <p className="text-xs text-[#2D6A4F] font-medium mb-2">{dest.why_now}</p>

        {/* Highlights */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {dest.highlights.map((h, i) => (
            <span key={i} className="text-xs bg-[#F5F0E8] text-gray-700 rounded-full px-2 py-0.5">
              {h}
            </span>
          ))}
        </div>

        {/* Cost + duration */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>~${dest.estimated_daily_cost_usd}/day</span>
          <span>{dest.suggested_duration_days} days suggested</span>
        </div>

        <button onClick={handlePlan}
          className="w-full bg-[#2D6A4F] text-white text-sm font-medium py-2.5 rounded-xl">
          Plan this trip →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/explore/ExploreClient.tsx`**

```typescript
"use client";
import { useState } from "react";
import { DestinationCard } from "@/components/explore/DestinationCard";
import { aiApi } from "@/lib/api";

const BUDGET_OPTIONS = ["low", "medium", "high"] as const;
const STYLE_OPTIONS = ["relaxed", "explorer", "cultural", "adventure", "foodie"] as const;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface Destination {
  name: string;
  tagline: string;
  why_now: string;
  highlights: string[];
  estimated_daily_cost_usd: number;
  photo_query: string;
  suggested_duration_days: number;
  trip_style: string;
  interests: string[];
  budget_tier: string;
  suggested_start_date: string | null;
}

export function ExploreClient() {
  const [budget, setBudget] = useState<typeof BUDGET_OPTIONS[number]>("medium");
  const [style, setStyle] = useState<typeof STYLE_OPTIONS[number]>("explorer");
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [results, setResults] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleInspire() {
    setLoading(true);
    try {
      const { destinations } = await aiApi.post<{ destinations: Destination[] }>("/inspire", {
        budget, travel_style: style, departure_month: month, duration_days: 7,
        interests: [],
      });
      setResults(destinations ?? []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-20">
      {/* Preferences */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Where should I go?</h2>

        <div className="flex gap-2">
          {BUDGET_OPTIONS.map(b => (
            <button key={b} onClick={() => setBudget(b)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium capitalize border transition ${
                budget === b ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "text-gray-600 border-gray-200"
              }`}>
              {b}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {STYLE_OPTIONS.map(s => (
            <button key={s} onClick={() => setStyle(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize border transition ${
                style === s ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "text-gray-600 border-gray-200"
              }`}>
              {s}
            </button>
          ))}
        </div>

        <select value={month} onChange={e => setMonth(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700">
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>

        <button onClick={handleInspire} disabled={loading}
          className="w-full bg-[#2D6A4F] text-white font-medium py-3 rounded-xl text-sm disabled:opacity-60">
          {loading ? "Finding destinations…" : "✨ Inspire me"}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full" />
        </div>
      )}
      <div className="space-y-4">
        {results.map((d, i) => <DestinationCard key={i} dest={d} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/explore/page.tsx`**

```typescript
import { ExploreClient } from "./ExploreClient";

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] pt-6">
      <div className="max-w-lg mx-auto px-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Explore</h1>
        <p className="text-sm text-gray-500 mt-1">AI picks destinations just for you</p>
      </div>
      <ExploreClient />
    </div>
  );
}
```

- [ ] **Step 4: Update the trip wizard to read URL pre-fill params**

In `src/app/(app)/trips/new/page.tsx`, read searchParams and pre-fill wizard state:

```typescript
export default function NewTripPage({
  searchParams,
}: {
  searchParams: { destination?: string; style?: string; budget?: string; interests?: string; days?: string; startDate?: string };
}) {
  return (
    <TripWizard
      prefill={{
        destination: searchParams.destination,
        tripStyle: searchParams.style,
        budget: searchParams.budget,
        interests: searchParams.interests?.split(",").filter(Boolean) ?? [],
        days: searchParams.days ? parseInt(searchParams.days) : undefined,
        startDate: searchParams.startDate,
      }}
    />
  );
}
```

In the wizard component, accept and apply the `prefill` prop to initial state.

- [ ] **Step 5: Add Explore to main navigation**

In the bottom navigation or sidebar component, add:
```tsx
{ label: "Explore", href: "/explore", icon: "🌍" }
```

- [ ] **Step 6: Commit**

```bash
git add ai-service/ src/app/(app)/explore/ src/components/explore/ src/app/(app)/trips/new/
git commit -m "feat: add AI destination discovery screen with Groq + Tavily inspiration"
```

---

## Verification Checklist

- [ ] `POST /api/v1/ai/inspire` via Go proxy returns 5 destinations
- [ ] Each destination card shows hero photo from the photo proxy
- [ ] "Plan this trip" navigates to `/trips/new` with URL params pre-filled
- [ ] Wizard reads pre-fill params and populates destination field
- [ ] Changing budget/style/month and clicking "Inspire me" returns different suggestions
- [ ] Explore tab is accessible from the main navigation
- [ ] Loading spinner shows during AI generation (~3-5s)
