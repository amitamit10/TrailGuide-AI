# Phase 9 — Packing & Pre-Trip Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give travelers an AI-generated packing list and pre-trip checklist tailored to their destination, weather forecast, trip length, and travel style — all checkable in-app.

**Architecture:** New `checklist_items` table in Supabase. A "Pack" tab on each trip hosts a `PackingClient` that on first load calls `/api/ai/packing-list` (Groq) to generate items, persists them to the DB, and renders them as checkable rows grouped by category. A separate "Visa & Entry" section uses Tavily to fetch real-time entry requirements. Items can be manually added or deleted.

**Tech Stack:** Supabase (new `checklist_items` table) · Groq `llama-3.3-70b-versatile` (packing list generation) · Tavily (visa/entry requirements lookup) · Open-Meteo (destination weather forecast, already used in Companion) · Next.js API routes

## Global Constraints

- `nvm` required: prefix all `npm` commands with `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" &&`
- New DB table via `supabase/migrations/004_checklist.sql` — run in Supabase SQL editor
- `export const maxDuration = 60` on the packing-list generation route (Groq call)
- Tavily API key already in `.env.local` as `TAVILY_API_KEY`
- Open-Meteo is free, no API key needed
- Do not install a new AI library — use `groq-sdk` already in `package.json`
- Never commit `.env.local`

---

### Task 1: Database migration — checklist_items table

**Files:**
- Create: `supabase/migrations/004_checklist.sql`

**Interfaces:**
- Produces: `checklist_items` table with RLS, fields: `id`, `trip_id`, `user_id`, `label`, `category`, `is_checked`, `source` (`ai` | `manual`), `created_at`

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/004_checklist.sql`:

  ```sql
  create table if not exists checklist_items (
    id uuid primary key default uuid_generate_v4(),
    trip_id uuid references trips(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete cascade not null,
    label text not null,
    category text not null default 'general',
    is_checked boolean not null default false,
    source text not null default 'ai',
    created_at timestamptz not null default now()
  );

  alter table checklist_items enable row level security;

  drop policy if exists "Users can manage own checklist" on checklist_items;
  create policy "Users can manage own checklist" on checklist_items for all
    using (auth.uid() = user_id);

  create index if not exists checklist_trip_id_idx on checklist_items(trip_id);
  ```

- [ ] **Step 2: Run in Supabase SQL editor**

  Go to https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql — paste and run.

  Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE INDEX`.

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/migrations/004_checklist.sql
  git commit -m "feat: add checklist_items table with RLS"
  ```

---

### Task 2: AI packing list generation API

**Files:**
- Create: `src/app/api/ai/packing-list/route.ts`

**Interfaces:**
- `POST /api/ai/packing-list` body: `{ tripId, destination, startDate, endDate, travelStyle, interests, travelers }`
- Returns: `{ items: Array<{ label: string; category: string }> }`
- Persists generated items to `checklist_items` table before returning

- [ ] **Step 1: Create the route**

  Create `src/app/api/ai/packing-list/route.ts`:

  ```typescript
  export const maxDuration = 60;
  import { NextRequest, NextResponse } from "next/server";
  import Groq from "groq-sdk";
  import { createClient } from "@/lib/supabase/server";

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  export async function POST(req: NextRequest) {
    const { tripId, destination, startDate, endDate, travelStyle, interests, travelers } = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if items already generated for this trip
    const { data: existing } = await supabase
      .from("checklist_items")
      .select("id")
      .eq("trip_id", tripId)
      .eq("source", "ai")
      .limit(1);

    if (existing?.length) {
      const { data: items } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("category")
        .order("created_at");
      return NextResponse.json({ items: items ?? [] });
    }

    // Fetch weather forecast for destination dates
    let weatherNote = "";
    try {
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`);
      const geoData = await geoRes.json();
      const loc = geoData.results?.[0];
      if (loc) {
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,precipitation_sum&forecast_days=${Math.min(days + 1, 16)}&timezone=auto`
        );
        const wx = await wxRes.json();
        const temps = wx.daily?.temperature_2m_max ?? [];
        const rain = wx.daily?.precipitation_sum ?? [];
        const maxTemp = Math.max(...temps);
        const minTemp = Math.min(...temps);
        const rainDays = rain.filter((r: number) => r > 1).length;
        weatherNote = `Weather forecast: ${minTemp}–${maxTemp}°C, ${rainDays} rainy day${rainDays !== 1 ? "s" : ""} expected.`;
      }
    } catch { /* weather is optional, don't fail */ }

    const nightsCount = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You generate practical packing lists for trips. Return ONLY valid JSON.
Format: {"items": [{"label": "item name", "category": "clothing|toiletries|documents|electronics|health|gear|other"}]}
Be specific to the destination and trip type. Do not include items the traveler obviously already has (phone, wallet).
Aim for 30-45 items total across all categories.`,
        },
        {
          role: "user",
          content: `Generate a packing list for:
Destination: ${destination}
Duration: ${nightsCount} nights
Travel style: ${travelStyle}
Interests: ${(interests as string[]).join(", ")}
Travelers: ${travelers}
${weatherNote}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? '{"items":[]}';
    const { items } = JSON.parse(text) as { items: Array<{ label: string; category: string }> };

    // Persist to DB
    if (items.length > 0) {
      await supabase.from("checklist_items").insert(
        items.map((item) => ({
          trip_id: tripId,
          user_id: user.id,
          label: item.label,
          category: item.category,
          source: "ai",
        }))
      );
    }

    const { data: saved } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("category")
      .order("created_at");

    return NextResponse.json({ items: saved ?? [] });
  }
  ```

- [ ] **Step 2: Smoke test**

  ```bash
  # Replace TRIP_ID with a real trip id from your DB
  curl -X POST http://localhost:3000/api/ai/packing-list \
    -H "Content-Type: application/json" \
    -d '{"tripId":"TRIP_ID","destination":"Tokyo","startDate":"2026-07-01","endDate":"2026-07-08","travelStyle":"explorer","interests":["food","culture"],"travelers":2}'
  ```

  Expected: JSON with 30-45 items across categories.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/ai/packing-list/
  git commit -m "feat: AI packing list generation route"
  ```

---

### Task 3: Visa & entry requirements API

**Files:**
- Create: `src/app/api/visa/route.ts`

**Interfaces:**
- `GET /api/visa?destination=Tokyo,Japan` → `{ summary: string; source: string }`
- Uses Tavily to search real-time entry requirements

- [ ] **Step 1: Create the route**

  Create `src/app/api/visa/route.ts`:

  ```typescript
  export const maxDuration = 30;
  import { NextRequest, NextResponse } from "next/server";

  export async function GET(req: NextRequest) {
    const destination = req.nextUrl.searchParams.get("destination");
    if (!destination) return NextResponse.json({ error: "destination required" }, { status: 400 });

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: `entry requirements visa ${destination} 2025 tourism`,
          search_depth: "basic",
          max_results: 3,
          include_answer: true,
        }),
      });
      const data = await res.json();
      return NextResponse.json(
        {
          summary: data.answer ?? "Check official government travel advisory for entry requirements.",
          source: data.results?.[0]?.url ?? "",
        },
        { headers: { "Cache-Control": "public, max-age=86400" } }
      );
    } catch {
      return NextResponse.json({ summary: "Unable to fetch requirements. Check your government's travel advisory.", source: "" });
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/visa/
  git commit -m "feat: visa and entry requirements API via Tavily"
  ```

---

### Task 4: PackingClient UI

**Files:**
- Create: `src/components/packing/PackingClient.tsx`
- Create: `src/app/(app)/trips/[id]/pack/page.tsx`
- Modify: `src/components/trip/TripTabNav.tsx` — add Pack tab

**Interfaces:**
- Consumes: `POST /api/ai/packing-list`, `PATCH /api/checklist/check`, `DELETE /api/checklist/item`, `GET /api/visa`
- Produces: interactive packing checklist at `/trips/[id]/pack`

- [ ] **Step 1: Add checklist toggle and delete routes**

  Create `src/app/api/checklist/check/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function PATCH(req: NextRequest) {
    const { id, checked } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { error } = await supabase.from("checklist_items").update({ is_checked: checked }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  ```

  Create `src/app/api/checklist/item/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function POST(req: NextRequest) {
    const { tripId, label, category } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase
      .from("checklist_items")
      .insert({ trip_id: tripId, user_id: user.id, label, category: category ?? "other", source: "manual" })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await supabase.from("checklist_items").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 2: Add Pack tab to TripTabNav**

  In `src/components/trip/TripTabNav.tsx`:

  ```typescript
  import { ..., Backpack } from "lucide-react";
  // After Expenses tab:
  { label: "Pack", href: "pack", icon: Backpack },
  ```

- [ ] **Step 3: Create the page**

  Create `src/app/(app)/trips/[id]/pack/page.tsx`:

  ```typescript
  import { redirect } from "next/navigation";
  import { createClient } from "@/lib/supabase/server";
  import { PackingClient } from "@/components/packing/PackingClient";

  export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: trip } = await supabase
      .from("trips")
      .select("id, title, destination, start_date, end_date, travel_style, interests, travelers_count")
      .eq("id", id).eq("user_id", user.id).single();

    if (!trip) redirect("/dashboard");
    return <PackingClient trip={trip} />;
  }
  ```

- [ ] **Step 4: Create PackingClient**

  Create `src/components/packing/PackingClient.tsx`:

  ```typescript
  "use client";
  import { useState, useEffect } from "react";
  import { Loader2, Plus, Trash2, Backpack, CheckCircle2, ExternalLink } from "lucide-react";

  interface ChecklistItem {
    id: string; label: string; category: string; is_checked: boolean; source: string;
  }
  interface Trip {
    id: string; destination: string; start_date: string; end_date: string;
    travel_style: string; interests: string[]; travelers_count: number;
  }

  const CATEGORY_ORDER = ["documents", "clothing", "toiletries", "electronics", "health", "gear", "other"];

  export function PackingClient({ trip }: { trip: Trip }) {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newLabel, setNewLabel] = useState("");
    const [visa, setVisa] = useState<{ summary: string; source: string } | null>(null);

    useEffect(() => {
      // Generate / load packing list
      fetch("/api/ai/packing-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: trip.id,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelStyle: trip.travel_style,
          interests: trip.interests,
          travelers: trip.travelers_count,
        }),
      })
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []))
        .finally(() => setLoading(false));

      // Load visa info
      fetch(`/api/visa?destination=${encodeURIComponent(trip.destination)}`)
        .then((r) => r.json())
        .then(setVisa)
        .catch(() => {});
    }, [trip]);

    const checkedCount = items.filter((i) => i.is_checked).length;

    async function toggle(id: string, checked: boolean) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_checked: checked } : i));
      await fetch("/api/checklist/check", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checked }),
      });
    }

    async function addItem() {
      if (!newLabel.trim()) return;
      const res = await fetch("/api/checklist/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, label: newLabel.trim(), category: "other" }),
      });
      const { item } = await res.json();
      setItems((prev) => [...prev, item]);
      setNewLabel("");
    }

    async function deleteItem(id: string) {
      await fetch(`/api/checklist/item?id=${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    }

    const byCategory = CATEGORY_ORDER.map((cat) => ({
      cat,
      items: items.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 flex flex-col gap-4">

        {/* Progress */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Backpack className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Packing for {trip.destination}</span>
            </div>
            <span className="text-sm text-muted-foreground">{checkedCount}/{items.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: items.length ? `${(checkedCount / items.length) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {/* Visa info */}
        {visa?.summary && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Visa & Entry Requirements</p>
            <p className="text-sm text-amber-900 leading-relaxed">{visa.summary}</p>
            {visa.source && (
              <a href={visa.source} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 mt-2">
                Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Add item */}
        <div className="flex gap-2">
          <input
            placeholder="Add an item…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="flex-1 h-11 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={addItem}
            disabled={!newLabel.trim()}
            className="h-11 w-11 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating your packing list…
          </div>
        )}

        {/* Checklist by category */}
        {!loading && byCategory.map(({ cat, items: catItems }) => (
          <div key={cat} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide capitalize">{cat}</p>
            </div>
            <div className="divide-y divide-border">
              {catItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggle(item.id, !item.is_checked)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.is_checked ? "bg-primary border-primary text-white" : "border-border"
                    }`}
                  >
                    {item.is_checked && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.is_checked ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    );
  }
  ```

- [ ] **Step 5: Test**

  Open a trip → Pack tab. Expected: loading spinner for ~5 seconds, then 30-45 checkable items grouped by category. Visa card appears above checklist.

  Check/uncheck items. Refresh — state persists. Add a custom item — appears under "other".

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/(app)/trips/[id]/pack/ src/app/api/ai/packing-list/ src/app/api/visa/ src/app/api/checklist/ src/components/packing/ src/components/trip/TripTabNav.tsx
  git commit -m "feat: AI packing list and visa requirements tab"
  ```
