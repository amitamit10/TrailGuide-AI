import type { Activity } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-orange-400",
  attraction: "bg-blue-400",
  transport: "bg-gray-400",
  hotel: "bg-purple-400",
  flight: "bg-sky-400",
  free: "bg-green-400",
};

interface BudgetTrackerProps {
  activities: Activity[];
  budgetTotal: number | null;
  currency: string;
}

export function BudgetTracker({
  activities,
  budgetTotal,
  currency,
}: BudgetTrackerProps) {
  const completed = activities.filter((a) => a.is_completed);
  const spent = completed.reduce((sum, a) => sum + (a.estimated_cost ?? 0), 0);
  const pct = budgetTotal ? Math.min(100, (spent / budgetTotal) * 100) : 0;

  const byCategory = activities.reduce<Record<string, number>>((acc, a) => {
    if (a.estimated_cost && a.estimated_cost > 0) {
      acc[a.category] = (acc[a.category] ?? 0) + a.estimated_cost;
    }
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3">Budget Tracker</h3>

      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted-foreground">Spent</span>
        <span className="font-semibold">
          {currency} {spent.toFixed(0)}
          {budgetTotal ? ` / ${budgetTotal.toLocaleString()}` : ""}
        </span>
      </div>

      {budgetTotal && (
        <div className="w-full h-2 bg-muted rounded-full mb-4">
          <div
            className={`h-2 rounded-full transition-all ${
              pct > 90 ? "bg-red-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(byCategory).map(([cat, total]) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[cat] ?? "bg-gray-400"}`}
            />
            <span className="capitalize text-muted-foreground">{cat}</span>
            <span className="font-medium">
              {currency} {total.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
