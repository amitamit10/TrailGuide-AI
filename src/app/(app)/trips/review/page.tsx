"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, MapPin, Calendar, Users, Check,
  X, Clock, DollarSign, ArrowRight, Sparkles, ExternalLink,
  UtensilsCrossed, Landmark, Bus, Hotel, Plane, Leaf,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import type { TripConfig, GeneratedItinerary, GeneratedActivity, GeneratedDay } from "@/types";

function ActivityHeroPhoto({ query, title }: { query: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { setFailed(false); setPreview(false); }, [query]);
  if (failed) return null;
  const src = `/api/places/photo?query=${encodeURIComponent(query)}&w=600`;
  return (
    <>
      <div
        className="w-full h-44 rounded-xl overflow-hidden bg-muted mb-4 cursor-zoom-in"
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

function gmapsUrl(a: GeneratedActivity): string {
  if (a.lat && a.lng) return `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  const q = encodeURIComponent([a.location_name, a.address].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const CATEGORY_META = {
  food:       { icon: UtensilsCrossed, color: "bg-orange-100 text-orange-600" },
  attraction: { icon: Landmark,        color: "bg-blue-100 text-blue-600"     },
  transport:  { icon: Bus,             color: "bg-gray-100 text-gray-600"     },
  hotel:      { icon: Hotel,           color: "bg-purple-100 text-purple-600" },
  flight:     { icon: Plane,           color: "bg-sky-100 text-sky-600"       },
  free:       { icon: Leaf,            color: "bg-green-100 text-green-600"   },
};

const SUGGESTIONS = [
  { label: "Something more adventurous", emoji: "🧗" },
  { label: "A hidden gem instead",       emoji: "💎" },
  { label: "Better food option",         emoji: "🍜" },
  { label: "More budget-friendly",       emoji: "💰" },
  { label: "Historical site nearby",     emoji: "🏛️" },
  { label: "Free time / relax",          emoji: "🌿" },
];

interface Selected {
  activity: GeneratedActivity;
  dayIndex: number;
  activityIndex: number;
  day: GeneratedDay;
}

export default function TripReviewPage() {
  const router = useRouter();
  const [config, setConfig] = useState<TripConfig | null>(null);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_trip");
    if (!raw) { router.push("/trips/new"); return; }
    const { config, itinerary } = JSON.parse(raw);
    setConfig(config);
    setItinerary(itinerary);
  }, [router]);

  async function saveTrip() {
    if (!config || !itinerary) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        title: `Trip to ${config.destination}`,
        destination: config.destination,
        destination_lat: config.destination_lat,
        destination_lng: config.destination_lng,
        start_date: config.start_date,
        end_date: config.end_date,
        travelers_count: config.travelers_count,
        traveler_ages: config.traveler_ages,
        budget_total: config.budget_total,
        budget_currency: config.budget_currency ?? "USD",
        travel_style: config.travel_style,
        interests: config.interests,
        flights_booked: config.flights_booked ?? false,
        hotels_booked: config.hotels_booked ?? false,
        status: "planning",
      })
      .select()
      .single();

    if (tripError || !trip) { setSaving(false); return; }

    for (const day of itinerary.days) {
      const { data: dayRow } = await supabase
        .from("itinerary_days")
        .insert({ trip_id: trip.id, day_number: day.day_number, date: day.date })
        .select()
        .single();
      if (!dayRow) continue;
      await supabase.from("activities").insert(
        day.activities.map((a, idx) => ({
          trip_id: trip.id, day_id: dayRow.id,
          title: a.title, description: a.description, category: a.category,
          start_time: a.start_time, end_time: a.end_time,
          duration_minutes: a.duration_minutes, location_name: a.location_name,
          address: a.address, lat: a.lat, lng: a.lng,
          estimated_cost: a.estimated_cost, photo_query: a.photo_query,
          sort_order: idx,
        }))
      );
    }

    sessionStorage.removeItem("pending_trip");
    router.push(`/trips/${trip.id}`);
  }

  function replaceInMemory(dayIndex: number, activityIndex: number, newActivity: GeneratedActivity) {
    setItinerary((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d, di) => {
        if (di !== dayIndex) return d;
        const activities = d.activities.map((a, ai) =>
          ai === activityIndex ? newActivity : a
        );
        return { ...d, activities };
      });
      const next = { days };
      sessionStorage.setItem("pending_trip", JSON.stringify({ config, itinerary: next }));
      return next;
    });
  }

  if (!config || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const dayCount = itinerary.days.length;
  const totalActivities = itinerary.days.reduce((s, d) => s + d.activities.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-white sticky top-0 z-10">
        <Link href="/trips/new" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-base">Your Itinerary is Ready</h1>
          <p className="text-xs text-muted-foreground">Tap any activity to preview or swap it</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-28">
        {/* Hero card */}
        <div className="bg-primary rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-1">{config.destination}</h2>
          <div className="flex flex-wrap gap-4 mt-3 text-white/80 text-sm">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {config.start_date} – {config.end_date}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {config.travelers_count} traveler{config.travelers_count !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {dayCount} days · {totalActivities} activities
            </span>
          </div>
        </div>

        {/* Day cards */}
        {itinerary.days.map((day, di) => {
          const isExpanded = expandedDays.has(di);
          const visibleActivities = isExpanded ? day.activities : day.activities.slice(0, 4);
          const hiddenCount = day.activities.length - 4;
          return (
            <div key={day.day_number} className="bg-card rounded-2xl overflow-hidden border border-border">
              <div className="px-4 py-3 border-b border-border bg-muted/40">
                <h3 className="font-semibold text-sm">
                  Day {day.day_number}
                  <span className="text-muted-foreground font-normal ml-2">{day.date}</span>
                </h3>
              </div>
              <div className="divide-y divide-border">
                {visibleActivities.map((a, ai) => {
                  const meta = CATEGORY_META[a.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.attraction;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={ai}
                      onClick={() => setSelected({ activity: a, dayIndex: di, activityIndex: ai, day })}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors active:bg-primary/10"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{a.title}</p>
                        {a.location_name && (
                          <p className="text-xs text-muted-foreground truncate">{a.location_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{a.start_time}</span>
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setExpandedDays((prev) => {
                      const next = new Set(prev);
                      if (isExpanded) next.delete(di); else next.add(di);
                      return next;
                    })}
                    className="w-full px-4 py-2.5 text-xs text-primary font-medium text-center hover:bg-primary/5 transition-colors"
                  >
                    {isExpanded ? "Show less" : `+${hiddenCount} more activities`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Save button */}
        <button
          onClick={saveTrip}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70 hover:bg-primary/90 transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? "Saving trip..." : "Save & View Full Itinerary"}
        </button>
      </div>

      {/* Activity detail + replace sheet */}
      <ActivitySheet
        selected={selected}
        config={config}
        itinerary={itinerary}
        onClose={() => setSelected(null)}
        onReplace={(newActivity) => {
          if (!selected) return;
          replaceInMemory(selected.dayIndex, selected.activityIndex, newActivity);
          setSelected(null);
        }}
      />
    </div>
  );
}

/* ── Activity detail + AI replace sheet ── */
function ActivitySheet({ selected, config, itinerary, onClose, onReplace }: {
  selected: Selected | null;
  config: TripConfig;
  itinerary: GeneratedItinerary;
  onClose: () => void;
  onReplace: (a: GeneratedActivity) => void;
}) {
  const [view, setView] = useState<"detail" | "replace">("detail");
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = !!selected;

  useEffect(() => {
    if (selected) { setView("detail"); setRequest(""); setDone(false); setError(null); }
  }, [selected?.activity.title]);

  useEffect(() => {
    if (view === "replace") setTimeout(() => inputRef.current?.focus(), 300);
  }, [view]);

  async function replace(text: string) {
    if (!selected || !text.trim() || loading) return;
    setLoading(true);
    setError(null);

    const neighbors = selected.day.activities
      .filter((_, i) => i !== selected.activityIndex)
      .map(a => ({ title: a.title, start_time: a.start_time }));

    try {
      const res = await fetch("/api/ai/preview-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: config.destination,
          travelStyle: config.travel_style,
          interests: config.interests,
          activity: selected.activity,
          neighbors,
          userRequest: text.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      const newActivity = await res.json() as GeneratedActivity;
      setDone(true);
      setTimeout(() => { onReplace(newActivity); setDone(false); }, 800);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  const activity = selected?.activity;
  const meta = activity
    ? (CATEGORY_META[activity.category as keyof typeof CATEGORY_META] ?? CATEGORY_META.attraction)
    : CATEGORY_META.attraction;
  const Icon = meta.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-xl border-t border-border transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-8">
          {/* Handle */}
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            {view === "replace" ? (
              <button onClick={() => setView("detail")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Hero photo */}
          {view === "detail" && activity?.photo_query && (
            <ActivityHeroPhoto query={activity.photo_query} title={activity.title} />
          )}

          {/* Activity title */}
          <h3 className="font-bold text-foreground text-lg leading-tight mb-4">
            {activity?.title ?? ""}
          </h3>

          {/* Detail view */}
          {view === "detail" && activity && (
            <div className="flex flex-col gap-4">
              {/* Meta row */}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {activity.start_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {activity.start_time}{activity.end_time ? ` – ${activity.end_time}` : ""}
                  </span>
                )}
                {activity.duration_minutes > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 opacity-0" />
                    {activity.duration_minutes} min
                  </span>
                )}
                {activity.location_name && (
                  <a
                    href={gmapsUrl(activity)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {activity.location_name}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                )}
                {activity.estimated_cost > 0 && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    ~${activity.estimated_cost} per person
                  </span>
                )}
              </div>

              {/* Description */}
              {activity.description && (
                <p className="text-sm text-foreground leading-relaxed bg-card border border-border rounded-xl p-3">
                  {activity.description}
                </p>
              )}

              {/* Address */}
              {activity.address && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {activity.address}
                </p>
              )}

              {/* Replace button */}
              <button
                onClick={() => setView("replace")}
                className="w-full h-12 rounded-xl border-2 border-primary text-primary font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Replace with AI
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Replace view */}
          {view === "replace" && (
            <div className="flex flex-col gap-4">
              {done ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">Activity replaced!</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">What would you like instead?</p>

                  {/* Quick chips */}
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => replace(s.label)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-40 active:scale-95"
                      >
                        <span>{s.emoji}</span> {s.label}
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
                        onKeyDown={(e) => e.key === "Enter" && replace(request)}
                        placeholder="Describe what you want instead..."
                        disabled={loading}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <button
                      onClick={() => replace(request)}
                      disabled={loading || !request.trim()}
                      className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
