"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Receipt, Download } from "lucide-react";
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
        <div className="flex items-center gap-2">
          <a
            href={`/api/expenses/export?tripId=${trip.id}`}
            className="h-10 px-3 rounded-xl border border-border text-sm flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add expense
          </button>
        </div>
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
