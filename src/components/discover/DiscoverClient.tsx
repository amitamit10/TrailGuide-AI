"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, MapPin, Clock, DollarSign,
  UtensilsCrossed, Landmark, Leaf, RefreshCw,
  Plus, Check, ExternalLink, Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { Recommendation } from "@/app/api/ai/recommendations/route";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";

const CATEGORIES = [
  { id: "",           label: "All",         emoji: "✨" },
  { id: "attraction", label: "Attractions", emoji: "🏛️" },
  { id: "food",       label: "Food",        emoji: "🍜" },
  { id: "free",       label: "Free",        emoji: "🌿" },
];

const CAT_META = {
  food:       { icon: UtensilsCrossed, color: "bg-orange-100 text-orange-600" },
  attraction: { icon: Landmark,        color: "bg-blue-100 text-blue-600"     },
  free:       { icon: Leaf,            color: "bg-green-100 text-green-600"   },
};

function gmapsUrl(r: Recommendation) {
  if (r.lat && r.lng) return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.location_name)}`;
}

function PlacePhoto({ query, title }: { query: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  if (failed) return <div className="w-full h-full bg-muted" />;
  const src = `/api/places/photo?query=${encodeURIComponent(query)}&w=400`;
  return (
    <>
      <img
        src={src}
        alt={title}
        className="w-full h-full object-cover cursor-zoom-in"
        onError={() => setFailed(true)}
        onClick={(e) => { e.stopPropagation(); setPreview(true); }}
      />
      {preview && <PhotoLightbox src={src} alt={title} onClose={() => setPreview(false)} />}
    </>
  );
}

interface Props {
  tripId: string;
  destination: string;
  interests: string[];
  travelStyle: string;
  existingTitles: string[];
}

export function DiscoverClient({ tripId, destination, interests, travelStyle, existingTitles }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Recommendation | null>(null);

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          interests,
          travelStyle,
          existingTitles,
          category: cat || undefined,
          count: 9,
        }),
      });
      const data = await res.json();
      setRecs(data.recommendations ?? []);
    } catch {
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }, [destination, interests, travelStyle, existingTitles]);

  useEffect(() => { load(category); }, [category, load]);

  async function addToTrip(rec: Recommendation) {
    if (adding || added.has(rec.title)) return;
    setAdding(rec.title);
    try {
      const res = await fetch("/api/ai/add-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, recommendation: rec }),
      });
      if (res.ok) {
        setAdded((prev) => new Set([...prev, rec.title]));
        router.refresh();
      }
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/trips/${tripId}`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-base">Discover</h1>
            <p className="text-xs text-muted-foreground">{destination}</p>
          </div>
          <button
            onClick={() => load(category)}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                category === c.id
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Finding great spots</p>
              <p className="text-sm text-muted-foreground mt-1">AI is curating picks for {destination}</p>
            </div>
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="font-medium">No results found</p>
            <button onClick={() => load(category)} className="mt-3 text-sm text-primary hover:underline">Try again</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {recs.map((rec) => {
              const meta = CAT_META[rec.category as keyof typeof CAT_META] ?? CAT_META.attraction;
              const Icon = meta.icon;
              const isAdded = added.has(rec.title);
              const isAdding = adding === rec.title;
              return (
                <div
                  key={rec.title}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  {/* Photo */}
                  <div
                    className="h-44 overflow-hidden cursor-pointer"
                    onClick={() => setSelected(rec)}
                  >
                    <PlacePhoto query={rec.photo_query} title={rec.title} />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <h3
                          className="font-semibold text-sm leading-tight cursor-pointer hover:text-primary transition-colors"
                          onClick={() => setSelected(rec)}
                        >
                          {rec.title}
                        </h3>
                      </div>
                      <button
                        onClick={() => addToTrip(rec)}
                        disabled={isAdded || isAdding}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          isAdded
                            ? "bg-primary/10 text-primary"
                            : "bg-primary text-white hover:bg-primary/90 active:scale-95"
                        } disabled:opacity-60`}
                      >
                        {isAdding ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isAdded ? (
                          <><Check className="w-3 h-3" /> Added</>
                        ) : (
                          <><Plus className="w-3 h-3" /> Add</>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-primary/80 italic mb-2 leading-snug">{rec.reason}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rec.description}</p>

                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <a
                        href={gmapsUrl(rec)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        {rec.location_name}
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                      {rec.duration_minutes > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rec.duration_minutes} min
                        </span>
                      )}
                      {rec.estimated_cost > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ~${rec.estimated_cost}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <DetailSheet rec={selected} onClose={() => setSelected(null)} onAdd={addToTrip} added={added} adding={adding} />
    </div>
  );
}

function DetailSheet({ rec, onClose, onAdd, added, adding }: {
  rec: Recommendation | null;
  onClose: () => void;
  onAdd: (r: Recommendation) => void;
  added: Set<string>;
  adding: string | null;
}) {
  const open = !!rec;
  const isAdded = rec ? added.has(rec.title) : false;
  const isAdding = rec ? adding === rec.title : false;
  const meta = rec ? (CAT_META[rec.category as keyof typeof CAT_META] ?? CAT_META.attraction) : CAT_META.attraction;
  const Icon = meta.icon;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-xl border-t border-border transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="max-w-lg mx-auto pt-3 pb-8">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />

          {rec && (
            <>
              {/* Hero photo */}
              <div className="h-52 overflow-hidden mb-4">
                <PlacePhoto query={rec.photo_query} title={rec.title} />
              </div>

              <div className="px-4 flex flex-col gap-3">
                {/* Title + category */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg leading-tight">{rec.title}</h3>
                </div>

                {/* AI reason */}
                <p className="text-sm text-primary italic">{rec.reason}</p>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <a
                    href={gmapsUrl(rec)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    {rec.location_name}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  {rec.duration_minutes > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {rec.duration_minutes} min
                    </span>
                  )}
                  {rec.estimated_cost > 0 && (
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4" />
                      ~${rec.estimated_cost} per person
                    </span>
                  )}
                </div>

                {/* Add button */}
                <button
                  onClick={() => onAdd(rec)}
                  disabled={isAdded || isAdding}
                  className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                    isAdded
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-primary text-white hover:bg-primary/90 active:scale-95"
                  } disabled:opacity-60`}
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAdded ? (
                    <><Check className="w-4 h-4" /> Added to trip</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Add to trip</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
