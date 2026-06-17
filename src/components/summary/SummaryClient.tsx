"use client";
import { useState, useRef, useEffect } from "react";
import {
  Calendar, Users, DollarSign, MapPin, CheckCircle2,
  Share2, Download, Loader2, Sparkles, Clock,
} from "lucide-react";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";

interface Activity {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  location_name?: string | null;
  estimated_cost?: number | null;
  duration_minutes?: number | null;
  photo_query?: string | null;
  is_completed: boolean;
  day_number: number;
  date: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  travelers_count: number;
  budget_currency: string;
}

interface Stats {
  totalCost: number;
  completedCount: number;
  daysCount: number;
  totalCount: number;
}

interface Props {
  trip: Trip;
  activities: Activity[];
  stats: Stats;
}

function ActivityPhoto({ query, title }: { query?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!query || failed) return null;
  const src = `/api/places/photo?query=${encodeURIComponent(query)}&w=400`;
  return (
    <>
      <div
        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted cursor-zoom-in"
        onClick={(e) => { e.stopPropagation(); setPreview(true); }}
      >
        <img src={src} alt={title} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      </div>
      {preview && <PhotoLightbox src={src} alt={title} onClose={() => setPreview(false)} />}
    </>
  );
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SummaryClient({ trip, activities, stats }: Props) {
  const [story, setStory] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activities.length === 0) return;
    setStoryLoading(true);
    const forAI = activities.slice(0, 20).map((a) => ({
      title: a.title,
      description: a.description,
      day: a.day_number,
    }));
    fetch("/api/ai/trip-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        activities: forAI,
      }),
    })
      .then((r) => r.json())
      .then((d) => setStory(d.story ?? null))
      .catch(() => setStory(null))
      .finally(() => setStoryLoading(false));
  }, [trip, activities]);

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2, backgroundColor: "#f9f7f3" });
      const link = document.createElement("a");
      link.download = `${trip.title.replace(/\s+/g, "-")}-summary.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/share/${trip.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Group activities by day
  const byDay = activities.reduce<Record<number, Activity[]>>((acc, a) => {
    (acc[a.day_number] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">

      {/* Action buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleShare}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {copied ? "Link copied!" : "Share trip"}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save image
        </button>
      </div>

      {/* Shareable card */}
      <div ref={cardRef} className="flex flex-col gap-4 animate-fade-up">

        {/* Header */}
        <div className="bg-primary rounded-2xl px-6 py-8 text-white">
          <p className="text-primary-foreground/70 text-sm font-medium mb-1">Trip Summary</p>
          <h1 className="text-2xl font-bold mb-1">{trip.title}</h1>
          <div className="flex items-center gap-1.5 text-primary-foreground/80 text-sm">
            <MapPin className="w-3.5 h-3.5" />
            {trip.destination}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Calendar,      label: "Days",       value: stats.daysCount.toString()                                 },
            { icon: Users,         label: "Travelers",  value: trip.travelers_count.toString()                            },
            { icon: CheckCircle2,  label: "Completed",  value: `${stats.completedCount}/${stats.totalCount} activities`   },
            { icon: DollarSign,    label: "Est. spend",  value: stats.totalCost > 0 ? `${trip.budget_currency} ${stats.totalCost}` : "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dates */}
        <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">{formatDate(trip.start_date)}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">{formatDate(trip.end_date)}</span>
        </div>

        {/* AI Story */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Your travel story</p>
          </div>
          {storyLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Writing your story…
            </div>
          ) : story ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{story}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No activities yet to generate a story.</p>
          )}
        </div>

        {/* Activities by day */}
        {Object.entries(byDay)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([dayNum, acts]) => (
            <div key={dayNum} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center">
                  {dayNum}
                </div>
                <p className="text-sm font-semibold">{formatDate(acts[0].date)}</p>
              </div>
              <div className="divide-y divide-border">
                {acts.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <ActivityPhoto query={a.photo_query} title={a.title} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium leading-tight ${a.is_completed ? "line-through text-muted-foreground" : ""}`}>
                          {a.title}
                        </p>
                        {a.is_completed && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                      </div>
                      {a.location_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{a.location_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {a.duration_minutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{a.duration_minutes} min
                          </span>
                        )}
                        {a.estimated_cost != null && a.estimated_cost > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />{a.estimated_cost}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No activities yet — generate an itinerary to see your summary.
          </div>
        )}

      </div>
    </div>
  );
}
