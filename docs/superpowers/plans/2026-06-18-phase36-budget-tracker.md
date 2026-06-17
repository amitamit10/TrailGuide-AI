# TrailGuide AI — Phase 36: Budget & Expense Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let travelers log actual expenses during a trip (with category, amount, note, date), see a running total vs. their planned budget, and view a breakdown by category. Available on the trip's Budget tab.

**Architecture:** New `expenses` table in PostgreSQL. Go handlers for CRUD on expenses (scoped to trip_id). Budget summary query aggregates by category. Next.js `BudgetClient` shows: total spent vs. budget, category breakdown (horizontal bar chart in CSS), and a scrollable expense log with inline add/delete.

**Tech Stack:** PostgreSQL, Go, Next.js. No new external APIs.

**Prerequisite:** Phase 19 (Go backend running). Phase 27 (TypeScript types).

## Global Constraints
- Expenses are private to trip members (owner + editors can add/delete; viewers can view).
- Budget is already set on the `trips.budget` field ("low"/"medium"/"high") — this phase adds a `budget_amount` numeric column to trips and an `expenses` table.
- Currency is trips.currency — all expenses are in the trip's currency (no conversion in this phase).
- No receipt photo in this phase — that's Phase 21 (Photo Journal) extended.

---

## Task 1: Database schema

- [ ] **Step 1: Create `supabase/migrations/008_expenses.sql`**

```sql
-- Add numeric budget to trips
alter table trips add column if not exists budget_amount numeric(10,2);

-- Expense log
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  category text not null check (category in ('food','transport','accommodation','activities','shopping','other')),
  note text default '',
  expense_date date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists expenses_trip_id_idx on expenses(trip_id);

alter table expenses enable row level security;
create policy "members can view expenses" on expenses
  for select using (
    exists (select 1 from trip_members where trip_id = expenses.trip_id and user_id = auth.uid())
  );
create policy "editors can insert expenses" on expenses
  for insert with check (
    exists (select 1 from trip_members where trip_id = expenses.trip_id and user_id = auth.uid() and role in ('owner','editor'))
    and user_id = auth.uid()
  );
create policy "editors can delete own expenses" on expenses
  for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_expenses.sql
git commit -m "feat: add expenses table and budget_amount column for expense tracker"
```

---

## Task 2: Go — expense handlers

- [ ] **Step 1: Add to Go models: `backend/internal/models/models.go`**

```go
type Expense struct {
    ID          string  `json:"id"`
    TripID      string  `json:"trip_id"`
    UserID      string  `json:"user_id"`
    Amount      float64 `json:"amount"`
    Category    string  `json:"category"`
    Note        string  `json:"note"`
    ExpenseDate string  `json:"expense_date"`
    CreatedAt   string  `json:"created_at"`
}

type BudgetSummary struct {
    TotalSpent    float64             `json:"total_spent"`
    BudgetAmount  *float64            `json:"budget_amount"`
    Currency      string              `json:"currency"`
    ByCategory    map[string]float64  `json:"by_category"`
    Expenses      []Expense           `json:"expenses"`
}
```

- [ ] **Step 2: Create `backend/internal/handlers/expenses.go`**

```go
package handlers

import (
    "context"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

type ExpenseHandler struct{ db *pgxpool.Pool }

func NewExpenseHandler(db *pgxpool.Pool) *ExpenseHandler { return &ExpenseHandler{db: db} }

func (h *ExpenseHandler) isMember(ctx context.Context, tripID, userID string) bool {
    var ok bool
    h.db.QueryRow(ctx,
        `SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2)`,
        tripID, userID).Scan(&ok)
    return ok
}

func (h *ExpenseHandler) isEditor(ctx context.Context, tripID, userID string) bool {
    var ok bool
    h.db.QueryRow(ctx,
        `SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id=$1 AND user_id=$2 AND role IN ('owner','editor'))`,
        tripID, userID).Scan(&ok)
    return ok
}

// GetSummary returns total spent + category breakdown + expense list
func (h *ExpenseHandler) GetSummary(c *gin.Context) {
    tripID := c.Param("tripId")
    userID := c.GetString("user_id")
    if !h.isMember(c.Request.Context(), tripID, userID) {
        c.JSON(http.StatusNotFound, gin.H{"error": "trip not found"})
        return
    }

    var summary struct {
        TotalSpent   float64  `json:"total_spent"`
        BudgetAmount *float64 `json:"budget_amount"`
        Currency     string   `json:"currency"`
    }
    h.db.QueryRow(c.Request.Context(),
        `SELECT COALESCE(SUM(e.amount),0), t.budget_amount, t.currency
         FROM trips t LEFT JOIN expenses e ON e.trip_id=t.id
         WHERE t.id=$1 GROUP BY t.budget_amount, t.currency`, tripID).
        Scan(&summary.TotalSpent, &summary.BudgetAmount, &summary.Currency)

    byCategory := map[string]float64{}
    rows, _ := h.db.Query(c.Request.Context(),
        `SELECT category, SUM(amount) FROM expenses WHERE trip_id=$1 GROUP BY category`, tripID)
    defer rows.Close()
    for rows.Next() {
        var cat string
        var amt float64
        rows.Scan(&cat, &amt)
        byCategory[cat] = amt
    }

    var expenses []map[string]interface{}
    eRows, _ := h.db.Query(c.Request.Context(),
        `SELECT id, user_id, amount, category, note, expense_date, created_at
         FROM expenses WHERE trip_id=$1 ORDER BY expense_date DESC, created_at DESC`, tripID)
    defer eRows.Close()
    for eRows.Next() {
        var e struct {
            ID, UserID, Category, Note, ExpenseDate, CreatedAt string
            Amount float64
        }
        eRows.Scan(&e.ID, &e.UserID, &e.Amount, &e.Category, &e.Note, &e.ExpenseDate, &e.CreatedAt)
        expenses = append(expenses, map[string]interface{}{
            "id": e.ID, "user_id": e.UserID, "amount": e.Amount,
            "category": e.Category, "note": e.Note,
            "expense_date": e.ExpenseDate, "created_at": e.CreatedAt,
        })
    }
    if expenses == nil { expenses = []map[string]interface{}{} }

    c.JSON(http.StatusOK, gin.H{"data": gin.H{
        "total_spent": summary.TotalSpent,
        "budget_amount": summary.BudgetAmount,
        "currency": summary.Currency,
        "by_category": byCategory,
        "expenses": expenses,
    }})
}

// Add creates a new expense
func (h *ExpenseHandler) Add(c *gin.Context) {
    tripID := c.Param("tripId")
    userID := c.GetString("user_id")
    if !h.isEditor(c.Request.Context(), tripID, userID) {
        c.JSON(http.StatusForbidden, gin.H{"error": "editors only"})
        return
    }
    var body struct {
        Amount      float64 `json:"amount" binding:"required,gt=0"`
        Category    string  `json:"category" binding:"required"`
        Note        string  `json:"note"`
        ExpenseDate string  `json:"expense_date"`
    }
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if body.ExpenseDate == "" { body.ExpenseDate = "current_date" }
    var id string
    h.db.QueryRow(c.Request.Context(),
        `INSERT INTO expenses (trip_id, user_id, amount, category, note, expense_date)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        tripID, userID, body.Amount, body.Category, body.Note, body.ExpenseDate).Scan(&id)
    c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}})
}

// Delete removes an expense (own expense only)
func (h *ExpenseHandler) Delete(c *gin.Context) {
    userID := c.GetString("user_id")
    expenseID := c.Param("expenseId")
    result, _ := h.db.Exec(c.Request.Context(),
        `DELETE FROM expenses WHERE id=$1 AND user_id=$2`, expenseID, userID)
    if result.RowsAffected() == 0 {
        c.JSON(http.StatusNotFound, gin.H{"error": "expense not found"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}
```

- [ ] **Step 3: Wire routes in `main.go`**

```go
expHandler := handlers.NewExpenseHandler(pool)
v1.GET("/trips/:tripId/budget", expHandler.GetSummary)
v1.POST("/trips/:tripId/expenses", expHandler.Add)
v1.DELETE("/trips/:tripId/expenses/:expenseId", expHandler.Delete)
```

- [ ] **Step 4: Test with curl**

```bash
TOKEN="..." TRIP_ID="..."
# Add an expense:
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost:8080/api/v1/trips/$TRIP_ID/expenses \
  -d '{"amount":25.50,"category":"food","note":"Ramen lunch","expense_date":"2026-08-01"}' | python3 -m json.tool

# Get summary:
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/trips/$TRIP_ID/budget | python3 -m json.tool
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/expenses.go backend/internal/models/models.go backend/main.go
git commit -m "feat: add expense CRUD handlers (add, delete, budget summary by category)"
```

---

## Task 3: Next.js — Budget tab

- [ ] **Step 1: Create `src/app/(app)/trips/[id]/budget/BudgetClient.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const CATEGORIES = ["food","transport","accommodation","activities","shopping","other"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-400", transport: "bg-blue-400",
  accommodation: "bg-purple-400", activities: "bg-green-400",
  shopping: "bg-pink-400", other: "bg-gray-400",
};

interface Expense { id: string; amount: number; category: string; note: string; expense_date: string; }
interface Summary {
  total_spent: number; budget_amount: number | null;
  currency: string; by_category: Record<string, number>; expenses: Expense[];
}

export function BudgetClient({ tripId }: { tripId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "food", note: "", expense_date: "" });

  async function load() {
    const r = await api.get<{ data: Summary }>(`/api/v1/trips/${tripId}/budget`);
    setSummary(r.data);
  }
  useEffect(() => { void load(); }, [tripId]);

  async function addExpense() {
    if (!form.amount) return;
    setAdding(true);
    await api.post(`/api/v1/trips/${tripId}/expenses`, {
      amount: parseFloat(form.amount),
      category: form.category,
      note: form.note,
      expense_date: form.expense_date || new Date().toISOString().slice(0,10),
    });
    setForm({ amount: "", category: "food", note: "", expense_date: "" });
    await load();
    setAdding(false);
  }

  async function deleteExpense(id: string) {
    await api.del(`/api/v1/trips/${tripId}/expenses/${id}`);
    await load();
  }

  if (!summary) return <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full"/></div>;

  const currency = summary.currency || "USD";
  const maxCat = Math.max(...Object.values(summary.by_category), 1);
  const pct = summary.budget_amount ? Math.min(100, (summary.total_spent / summary.budget_amount) * 100) : 0;

  return (
    <div className="max-w-lg mx-auto px-4 pb-20 pt-4">
      {/* Summary card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-2xl font-bold text-gray-900">
            {summary.total_spent.toFixed(2)} {currency}
          </span>
          {summary.budget_amount && (
            <span className="text-sm text-gray-400">of {summary.budget_amount.toFixed(2)}</span>
          )}
        </div>
        {summary.budget_amount && (
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${pct > 90 ? "bg-red-500" : "bg-[#2D6A4F]"}`}
              style={{ width: `${pct}%` }}/>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">By category</h3>
        {CATEGORIES.map(cat => {
          const amt = summary.by_category[cat] ?? 0;
          if (amt === 0) return null;
          return (
            <div key={cat} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-500 w-24 capitalize">{cat}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${CATEGORY_COLORS[cat]}`}
                  style={{ width: `${(amt/maxCat)*100}%` }}/>
              </div>
              <span className="text-xs text-gray-600 w-16 text-right">{amt.toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      {/* Add expense */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add expense</h3>
        <div className="flex gap-2 mb-2">
          <input type="number" placeholder="Amount" value={form.amount}
            onChange={e => setForm(f => ({...f, amount: e.target.value}))}
            className="flex-1 border rounded-lg px-3 py-2 text-sm" step="0.01" min="0"/>
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
            className="border rounded-lg px-3 py-2 text-sm capitalize">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input type="text" placeholder="Note (optional)" value={form.note}
          onChange={e => setForm(f => ({...f, note: e.target.value}))}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"/>
        <button onClick={addExpense} disabled={adding || !form.amount}
          className="w-full bg-[#2D6A4F] text-white text-sm py-2.5 rounded-xl disabled:opacity-60">
          {adding ? "Adding…" : "Add expense"}
        </button>
      </div>

      {/* Expense list */}
      <div className="space-y-2">
        {summary.expenses.map(e => (
          <div key={e.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`w-2 h-8 rounded-full ${CATEGORY_COLORS[e.category] ?? "bg-gray-300"}`}/>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{e.note || e.category}</p>
              <p className="text-xs text-gray-400">{e.expense_date}</p>
            </div>
            <span className="text-sm font-bold text-gray-800">{e.amount.toFixed(2)}</span>
            <button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/trips/[id]/budget/page.tsx`**

```typescript
import { BudgetClient } from "./BudgetClient";

export default function BudgetPage({ params }: { params: { id: string } }) {
  return <BudgetClient tripId={params.id} />;
}
```

- [ ] **Step 3: Add Budget tab to trip navigation**

In the trip nav component, add:
```tsx
{ label: "Budget", href: `/trips/${id}/budget`, icon: "💰" }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/trips/\[id\]/budget/ src/
git commit -m "feat: add budget tracker tab — expense log, category breakdown, vs-budget progress bar"
```

---

## Verification Checklist

- [ ] `POST /api/v1/trips/:id/expenses` creates an expense (amount, category, note, date)
- [ ] `GET /api/v1/trips/:id/budget` returns total_spent, budget_amount, by_category map, expenses array
- [ ] `DELETE /api/v1/trips/:id/expenses/:expId` deletes own expense; cannot delete others'
- [ ] Budget tab shows category bars proportional to spend
- [ ] Progress bar turns red when over 90% of budget
- [ ] Viewer role can see expenses but cannot add/delete (403)
