"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles, MapPin, Clock, Cloud, Navigation,
  CheckCircle2, RefreshCw, Loader2, ChevronRight,
  Thermometer, Zap, Compass,
} from "lucide-react";
import Link from "next/link";
import type { NudgeCard } from "@/app/api/ai/companion/route";

const NUDGE_STYLES = {
  timing:     { bg: "bg-blue-50   border-blue-200",   icon: Clock,        iconColor: "text-blue-500"   },
  weather:    { bg: "bg-sky-50    border-sky-200",     icon: Cloud,        iconColor: "text-sky-500"    },
  discovery:  { bg: "bg-amber-50  border-amber-200",   icon: Compass,      iconColor: "text-amber-500"  },
  navigation: { bg: "bg-green-50  border-green-200",   icon: Navigation,   iconColor: "text-green-500"  },
};

function useClockTick() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatCountdown(target: string): string {
  const [h, m] = target.split(":").map(Number);
  const now = new Date();
  const targetMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
  const diff = targetMs - now.getTime();
  if (diff <= 0) return "Now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function CompanionPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const router = useRouter();
  const now = useClockTick();

  const [weather, setWeather] = useState<string | null>(null);
  const [nextActivity, setNextActivity] = useState<{ title: string; location_name: string; start_time: string } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [nudges, setNudges] = useState<NudgeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNudges = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS unavailable — API falls back to destination coords */ }

      const res = await fetch("/api/ai/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          lat,
          lng,
          currentTime: now.toTimeString().slice(0, 5),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setWeather(data.weather);
      setNextActivity(data.nextActivity);
      setRemaining(data.remainingToday);
      setNudges(data.nudges ?? []);
      setDismissed(new Set());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, now]);

  // Load on mount + poll every 15 min
  useEffect(() => {
    fetchNudges();
    pollRef.current = setInterval(() => fetchNudges(), 15 * 60 * 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const visibleNudges = nudges.filter((_, i) => !dismissed.has(i));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Clock hero */}
        <div className="bg-primary rounded-2xl p-6 text-white">
          <p className="text-white/70 text-sm">{dateStr}</p>
          <p className="text-5xl font-bold mt-1 tabular-nums">{timeStr}</p>

          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-2 mt-4 text-white/80 text-sm">
              <Thermometer className="w-4 h-4" />
              <span>{weather}</span>
            </div>
          )}
        </div>

        {/* Next activity card */}
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Finding your next activity…</p>
          </div>
        ) : nextActivity ? (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Up next</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground leading-tight">{nextActivity.title}</h3>
                {nextActivity.location_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {nextActivity.location_name}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-primary tabular-nums">
                  {formatCountdown(nextActivity.start_time)}
                </span>
                <span className="text-xs text-muted-foreground">{nextActivity.start_time}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Link
                href={`/trips/${tripId}/navigate?lat=${nextActivity.location_name}&dest=${encodeURIComponent(nextActivity.location_name ?? "")}`}
                className="flex-1 h-10 rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" /> Navigate
              </Link>
              <button className="flex-1 h-10 rounded-xl bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted/80 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark done
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="font-semibold text-foreground">All done for today!</p>
            <p className="text-sm text-muted-foreground mt-1">No more activities scheduled</p>
          </div>
        )}

        {/* Remaining count */}
        {remaining > 1 && (
          <Link
            href={`/trips/${tripId}/timeline`}
            className="flex items-center justify-between bg-muted/60 rounded-xl px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{remaining - 1}</span> more {remaining - 1 === 1 ? "activity" : "activities"} today
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        )}

        {/* AI Nudge cards */}
        {visibleNudges.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Suggestions</p>
              <button
                onClick={() => fetchNudges(true)}
                disabled={refreshing}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {visibleNudges.map((nudge, i) => {
              const style = NUDGE_STYLES[nudge.type] ?? NUDGE_STYLES.timing;
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${style.bg} transition-all`}
                >
                  <div className={`w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center flex-shrink-0 ${style.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{nudge.message}</p>
                    {nudge.action_label && nudge.action_url && (
                      <Link href={nudge.action_url} className="text-xs font-semibold text-primary mt-1 inline-block hover:underline">
                        {nudge.action_label} →
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => setDismissed((prev) => new Set([...prev, i]))}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state for nudges */}
        {!loading && visibleNudges.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">All clear</p>
              <p className="text-xs text-muted-foreground mt-0.5">No suggestions right now — enjoy your trip!</p>
            </div>
            <button
              onClick={() => fetchNudges(true)}
              disabled={refreshing}
              className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Ask AI for suggestions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
