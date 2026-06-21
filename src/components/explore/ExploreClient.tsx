"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Users, Compass, Loader2, Copy } from "lucide-react";
import Link from "next/link";

interface PublicTrip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  trip_style: string;
  interests: string[];
}

export function ExploreClient({ trips }: { trips: PublicTrip[] }) {
  const router = useRouter();
  const [cloning, setCloning] = useState<string | null>(null);

  async function handleClone(tripId: string) {
    setCloning(tripId);
    try {
      const res = await fetch("/api/trips/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTripId: tripId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const { newTripId } = await res.json();
      router.push(`/trips/${newTripId}/timeline`);
    } finally {
      setCloning(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Compass className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-base">Explore Trips</h1>
        <Link
          href="/dashboard"
          className="ml-auto text-sm text-muted-foreground hover:text-foreground"
        >
          My trips
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">
          {trips.length} community itinerarie{trips.length !== 1 ? "s" : ""}
        </p>

        <div className="flex flex-col gap-3">
          {trips.map((trip) => {
            const nights = Math.ceil(
              (new Date(trip.end_date).getTime() -
                new Date(trip.start_date).getTime()) /
                86400000
            );
            return (
              <div
                key={trip.id}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight">
                      {trip.title}
                    </h3>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {trip.destination}
                    </div>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize flex-shrink-0">
                    {trip.trip_style}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {nights} night{nights !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {trip.travelers} traveler{trip.travelers !== 1 ? "s" : ""}
                  </span>
                </div>

                {trip.interests?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {trip.interests.slice(0, 4).map((i) => (
                      <span
                        key={i}
                        className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize"
                      >
                        {i}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/share/${trip.id}`}
                    className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    View itinerary
                  </Link>
                  <button
                    onClick={() => handleClone(trip.id)}
                    disabled={cloning === trip.id}
                    className="flex-1 h-9 rounded-xl bg-primary text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {cloning === trip.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Clone trip
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {trips.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No public trips yet. Share yours from the Summary tab!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
