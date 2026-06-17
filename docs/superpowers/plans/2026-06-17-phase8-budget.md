# Phase 8 — Budget & Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let travelers track real spending against their trip budget — add expenses manually, scan receipts, see budget-vs-actual in a dashboard, and export to CSV.

**Architecture:** New `expenses` table in Supabase with RLS. An "Expenses" tab on each trip renders an `ExpensesClient` component. Receipt scanning reuses the existing document-import Groq Vision flow to extract amount + category + merchant from a photo. A `/api/expenses` CRUD route handles create/read/delete. The budget comparison chart is a pure CSS bar — no chart library needed.

**Tech Stack:** Supabase (new table) · Next.js API routes · Groq Vision (existing `llama-3.1-8b-instant`) · `src/lib/ai.ts` (extend `GeminiService`) · Tailwind CSS (bar chart)

## Global Constraints

- `nvm` required: prefix all `npm` commands with `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" &&`
- New DB table must be added via a migration file: `supabase/migrations/003_expenses.sql`
- Expense amounts are stored as `numeric` in the trip's `budget_currency`
- Do not add a chart library — implement budget bar as a CSS `div` with percentage width
- Extend `GeminiService` in `src/lib/ai.ts` — do not create a second AI service file
- Never commit `.env.local`

---

### Task 1: Database migration — expenses table

**Files:**
- Create: `supabase/migrations/003_expenses.sql`

**Interfaces:**
- Produces: `expenses` table with RLS, accessible via `createClient()` for authenticated users

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/003_expenses.sql`:

  ```sql
  create table if not exists expenses (
    id uuid primary key default uuid_generate_v4(),
    trip_id uuid references trips(id) on delete cascade not null,
    user_id uuid references profiles(id) on delete cascade not null,
    title text not null,
    amount numeric not null,
    category text not null default 'other',
    note text,
    date date not null default current_date,
    receipt_url text,
    created_at timestamptz not null default now()
  );

  alter table expenses enable row level security;

  drop policy if exists "Users can manage own expenses" on expenses;
  create policy "Users can manage own expenses" on expenses for all
    using (auth.uid() = user_id);

  create index if not exists expenses_trip_id_idx on expenses(trip_id);
  ```

- [ ] **Step 2: Run in Supabase SQL editor**

  Go to https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql

  Paste and run the migration above.

  Expected: `CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `CREATE INDEX` — no errors.

- [ ] **Step 3: Verify**

  Run in SQL editor:
  ```sql
  select column_name, data_type from information_schema.columns
  where table_name = 'expenses' order by ordinal_position;
  ```

  Expected: `id`, `trip_id`, `user_id`, `title`, `amount`, `category`, `note`, `date`, `receipt_url`, `created_at`.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/003_expenses.sql
  git commit -m "feat: add expenses table with RLS"
  ```

---

### Task 2: Expenses CRUD API route

**Files:**
- Create: `src/app/api/expenses/route.ts`

**Interfaces:**
- `GET /api/expenses?tripId=<id>` → `{ expenses: Expense[] }`
- `POST /api/expenses` body: `{ tripId, title, amount, category, note?, date }` → `{ expense: Expense }`
- `DELETE /api/expenses?id=<id>` → `{ ok: true }`
- Produces: `Expense` type used by `ExpensesClient`

- [ ] **Step 1: Create the route**

  Create `src/app/api/expenses/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export interface Expense {
    id: string;
    trip_id: string;
    title: string;
    amount: number;
    category: string;
    note?: string | null;
    date: string;
    created_at: string;
  }

  export async function GET(req: NextRequest) {
    const tripId = req.nextUrl.searchParams.get("tripId");
    if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expenses: data ?? [] });
  }

  export async function POST(req: NextRequest) {
    const body = await req.json();
    const { tripId, title, amount, category, note, date } = body;
    if (!tripId || !title || amount == null) {
      return NextResponse.json({ error: "tripId, title, amount required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("expenses")
      .insert({ trip_id: tripId, user_id: user.id, title, amount, category: category ?? "other", note, date: date ?? new Date().toISOString().split("T")[0] })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expense: data });
  }

  export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 2: Smoke test**

  With dev server running:
  ```bash
  curl -b "$(cat /tmp/cookies)" "http://localhost:3000/api/expenses?tripId=<any-trip-id>"
  ```

  Expected: `{"expenses":[]}` (empty, no expenses yet — or 401 if not logged in, which is correct).

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/expenses/
  git commit -m "feat: expenses CRUD API route"
  ```

---

### Task 3: ExpensesClient UI — add, list, delete

**Files:**
- Create: `src/components/expenses/ExpensesClient.tsx`
- Create: `src/app/(app)/trips/[id]/expenses/page.tsx`
- Modify: `src/components/trip/TripTabNav.tsx` — add Expenses tab

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/expenses`, `Expense` type from `src/app/api/expenses/route.ts`
- Produces: interactive expenses page at `/trips/[id]/expenses`

- [ ] **Step 1: Add the tab to TripTabNav**

  In `src/components/trip/TripTabNav.tsx`, add to TABS array after Summary:

  ```typescript
  import { LayoutDashboard, List, Calendar, Map, Upload, Compass, Sparkles, ScrollText, Receipt } from "lucide-react";

  // In TABS array, after { label: "Summary", href: "summary", icon: ScrollText }:
  { label: "Expenses", href: "expenses", icon: Receipt },
  ```

- [ ] **Step 2: Create the page**

  Create `src/app/(app)/trips/[id]/expenses/page.tsx`:

  ```typescript
  import { redirect } from "next/navigation";
  import { createClient } from "@/lib/supabase/server";
  import { ExpensesClient } from "@/components/expenses/ExpensesClient";

  export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: trip } = await supabase
      .from("trips")
      .select("id, title, budget_total, budget_currency")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!trip) redirect("/dashboard");
    return <ExpensesClient trip={trip} />;
  }
  ```

- [ ] **Step 3: Create ExpensesClient**

  Create `src/components/expenses/ExpensesClient.tsx`:

  ```typescript
  "use client";
  import { useState, useEffect } from "react";
  import { Plus, Trash2, Loader2, Receipt, DollarSign } from "lucide-react";
  import type { Expense } from "@/app/api/expenses/route";

  const CATEGORIES = ["food", "transport", "accommodation", "attraction", "shopping", "other"];

  interface Trip { id: string; title: string; budget_total: number | null; budget_currency: string; }

  export function ExpensesClient({ trip }: { trip: Trip }) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ title: "", amount: "", category: "food", note: "", date: new Date().toISOString().split("T")[0] });
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
      fetch(`/api/expenses?tripId=${trip.id}`)
        .then((r) => r.json())
        .then((d) => setExpenses(d.expenses ?? []))
        .finally(() => setLoading(false));
    }, [trip.id]);

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const budget = trip.budget_total ?? 0;
    const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
    const over = budget > 0 && total > budget;

    async function handleAdd() {
      if (!form.title || !form.amount) return;
      setAdding(true);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id, ...form, amount: parseFloat(form.amount) }),
      });
      const { expense } = await res.json();
      setExpenses((prev) => [expense, ...prev]);
      setForm({ title: "", amount: "", category: "food", note: "", date: new Date().toISOString().split("T")[0] });
      setShowForm(false);
      setAdding(false);
    }

    async function handleDelete(id: string) {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }

    const byCategory = CATEGORIES.map((cat) => ({
      cat,
      total: expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    })).filter((c) => c.total > 0);

    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 flex flex-col gap-4">

        {/* Budget bar */}
        {budget > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">Budget</span>
              <span className={over ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {trip.budget_currency} {total.toFixed(0)} / {budget}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {over && <p className="text-xs text-destructive mt-1">Over budget by {trip.budget_currency} {(total - budget).toFixed(0)}</p>}
          </div>
        )}

        {/* Total + add button */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total spent</p>
            <p className="text-2xl font-bold">{trip.budget_currency} {total.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add expense
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 animate-fade-up">
            <input
              placeholder="What did you spend on?"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-11 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="flex-1 h-11 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="flex-1 h-11 rounded-xl border border-border px-3 text-sm focus:outline-none bg-background"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="h-11 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !form.title || !form.amount}
              className="h-11 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save expense"}
            </button>
          </div>
        )}

        {/* By category breakdown */}
        {byCategory.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By category</p>
            </div>
            <div className="divide-y divide-border">
              {byCategory.sort((a, b) => b.total - a.total).map(({ cat, total: catTotal }) => (
                <div key={cat} className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm capitalize">{cat}</p>
                  <p className="text-sm font-semibold">{trip.budget_currency} {catTotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expense list */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All expenses</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Receipt className="w-8 h-8 opacity-30" />
              <p className="text-sm">No expenses yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {expenses.map((e) => (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{e.category} · {e.date}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-semibold">{trip.budget_currency} {Number(e.amount).toFixed(2)}</p>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    );
  }
  ```

- [ ] **Step 4: Test**

  Open any trip → Expenses tab. Add an expense. Expected: appears immediately in list, budget bar updates.

  Delete an expense. Expected: removed immediately.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/(app)/trips/[id]/expenses/ src/components/expenses/ src/components/trip/TripTabNav.tsx
  git commit -m "feat: expense tracking tab with budget vs actual"
  ```

---

### Task 4: CSV export

**Files:**
- Create: `src/app/api/expenses/export/route.ts`
- Modify: `src/components/expenses/ExpensesClient.tsx` — add Export button

**Interfaces:**
- `GET /api/expenses/export?tripId=<id>` → `text/csv` file download

- [ ] **Step 1: Create export route**

  Create `src/app/api/expenses/export/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function GET(req: NextRequest) {
    const tripId = req.nextUrl.searchParams.get("tripId");
    if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: expenses } = await supabase
      .from("expenses")
      .select("date,title,category,amount,note")
      .eq("trip_id", tripId)
      .order("date", { ascending: true });

    const rows = [
      ["Date", "Title", "Category", "Amount", "Note"],
      ...(expenses ?? []).map((e) => [e.date, e.title, e.category, e.amount, e.note ?? ""]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${tripId}.csv"`,
      },
    });
  }
  ```

- [ ] **Step 2: Add Export button in ExpensesClient**

  In `src/components/expenses/ExpensesClient.tsx`, add to the Total row:

  ```typescript
  import { Plus, Trash2, Loader2, Receipt, DollarSign, Download } from "lucide-react";
  // ...
  <a
    href={`/api/expenses/export?tripId=${trip.id}`}
    className="h-10 px-3 rounded-xl border border-border text-sm flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
  >
    <Download className="w-3.5 h-3.5" /> CSV
  </a>
  ```

- [ ] **Step 3: Test**

  Add 3 expenses across 2 categories. Click CSV button. Expected: file downloads with correct data and headers.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/expenses/export/ src/components/expenses/ExpensesClient.tsx
  git commit -m "feat: CSV export for trip expenses"
  ```
