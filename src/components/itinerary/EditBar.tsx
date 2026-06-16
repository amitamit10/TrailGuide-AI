"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export function EditBar({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cmd = value.trim();
    if (!cmd || loading) return;
    setLoading(true);
    setValue("");

    try {
      const res = await fetch("/api/ai/edit-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, editCommand: cmd }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 z-10">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 max-w-2xl mx-auto"
      >
        <div className="flex items-center gap-2 flex-1 rounded-2xl border border-border bg-card px-4 py-2.5">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='Edit itinerary… "make day 3 more relaxed"'
            disabled={loading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
