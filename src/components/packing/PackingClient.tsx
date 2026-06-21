"use client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Backpack, CheckCircle2, ExternalLink } from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  is_checked: boolean;
  source: string;
}

interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travel_style: string;
  interests: string[];
  travelers_count: number;
}

const CATEGORY_ORDER = [
  "documents",
  "clothing",
  "toiletries",
  "electronics",
  "health",
  "gear",
  "other",
];

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
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_checked: checked } : i))
    );
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
    if (item) setItems((prev) => [...prev, item]);
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
          <span className="text-sm text-muted-foreground">
            {checkedCount}/{items.length}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{
              width: items.length ? `${(checkedCount / items.length) * 100}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* Visa info */}
      {visa?.summary && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Visa &amp; Entry Requirements
          </p>
          <p className="text-sm text-amber-900 leading-relaxed">{visa.summary}</p>
          {visa.source && (
            <a
              href={visa.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 mt-2"
            >
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
      {!loading &&
        byCategory.map(({ cat, items: catItems }) => (
          <div key={cat} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide capitalize">
                {cat}
              </p>
            </div>
            <div className="divide-y divide-border">
              {catItems.map((item) => (
                <div key={item.id} className="group flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggle(item.id, !item.is_checked)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.is_checked
                        ? "bg-primary border-primary text-white"
                        : "border-border"
                    }`}
                  >
                    {item.is_checked && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      item.is_checked ? "line-through text-muted-foreground" : ""
                    }`}
                  >
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
