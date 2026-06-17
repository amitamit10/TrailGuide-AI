"use client";
import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Loader2, ArrowRight, MapPin, ExternalLink } from "lucide-react";
import type { Activity } from "@/types";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";

function ActivityHeroPhoto({ query, title }: { query?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { setFailed(false); setPreview(false); }, [query]);
  if (!query || failed) return null;
  const src = `/api/places/photo?query=${encodeURIComponent(query)}&w=600`;
  return (
    <>
      <div
        className="w-full h-40 rounded-xl overflow-hidden bg-muted mb-4 cursor-zoom-in"
        onClick={() => setPreview(true)}
      >
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
      {preview && <PhotoLightbox src={src} alt={title} onClose={() => setPreview(false)} />}
    </>
  );
}

function mapsUrl(a: Activity): string {
  if (a.lat && a.lng) return `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  const q = encodeURIComponent([a.location_name, a.address].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const SUGGESTIONS = [
  { label: "Something more adventurous", emoji: "🧗" },
  { label: "A hidden gem instead",       emoji: "💎" },
  { label: "Better food option",         emoji: "🍜" },
  { label: "More budget-friendly",       emoji: "💰" },
  { label: "Historical site nearby",     emoji: "🏛️" },
  { label: "Free time / relax",          emoji: "🌿" },
];

interface Props {
  activity: Activity | null;
  tripId: string;
  dayId: string;
  onClose: () => void;
  onReplaced: () => void;
}

export function ReplaceActivitySheet({ activity, tripId, dayId, onClose, onReplaced }: Props) {
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = !!activity;

  // Reset state when a new activity is selected
  useEffect(() => {
    if (activity) {
      setRequest("");
      setDone(false);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [activity?.id]);

  async function submit(text: string) {
    if (!activity || !text.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/replace-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          activityId: activity.id,
          dayId,
          userRequest: text.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setTimeout(() => {
        onReplaced();
        onClose();
      }, 900);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-xl border-t border-border transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-w-lg mx-auto px-4 pt-3 pb-8">
          {/* Handle */}
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                {done ? "Replaced!" : "Replace activity"}
              </p>
              <h3 className="font-bold text-foreground leading-tight line-clamp-2">
                {activity?.title ?? ""}
              </h3>
              {activity?.location_name && (
                <a
                  href={mapsUrl(activity)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  <MapPin className="w-3 h-3" />
                  {activity.location_name}
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 ml-3 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ActivityHeroPhoto query={activity?.photo_query} title={activity?.title ?? ""} />

          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">Activity replaced!</p>
              <p className="text-sm text-muted-foreground">Updating your itinerary...</p>
            </div>
          ) : (
            <>
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => submit(s.label)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-40 active:scale-95"
                  >
                    <span>{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    ref={inputRef}
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit(request)}
                    placeholder="Or describe what you want instead..."
                    disabled={loading}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  onClick={() => submit(request)}
                  disabled={loading || !request.trim()}
                  className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-xs text-destructive mt-2">{error}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
