"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, MapPin, Calendar, Users, Check } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TripConfig, GeneratedItinerary } from "@/types";

export default function TripReviewPage() {
  const router = useRouter();
  const [config, setConfig] = useState<TripConfig | null>(null);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_trip");
    if (!raw) {
      router.push("/trips/new");
      return;
    }
    const { config, itinerary } = JSON.parse(raw);
    setConfig(config);
    setItinerary(itinerary);
  }, [router]);

  async function saveTrip() {
    if (!config || !itinerary) return;
    setSaving(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    if (tripError || !trip) {
      setSaving(false);
      return;
    }

    for (const day of itinerary.days) {
      const { data: dayRow } = await supabase
        .from("itinerary_days")
        .insert({
          trip_id: trip.id,
          day_number: day.day_number,
          date: day.date,
        })
        .select()
        .single();

      if (!dayRow) continue;

      const activitiesPayload = day.activities.map((a, idx) => ({
        trip_id: trip.id,
        day_id: dayRow.id,
        title: a.title,
        description: a.description,
        category: a.category,
        start_time: a.start_time,
        end_time: a.end_time,
        duration_minutes: a.duration_minutes,
        location_name: a.location_name,
        address: a.address,
        lat: a.lat,
        lng: a.lng,
        estimated_cost: a.estimated_cost,
        photo_query: a.photo_query,
        sort_order: idx,
      }));

      await supabase.from("activities").insert(activitiesPayload);
    }

    sessionStorage.removeItem("pending_trip");
    router.push(`/trips/${trip.id}`);
  }

  if (!config || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const dayCount = itinerary.days.length;
  const totalActivities = itinerary.days.reduce(
    (sum, d) => sum + d.activities.length,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-border bg-white sticky top-0 z-10">
        <Link href="/trips/new" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold text-base">Your Itinerary is Ready</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="bg-primary rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-1">{config.destination}</h2>
          <div className="flex flex-wrap gap-4 mt-3 text-primary-foreground/80 text-sm">
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

        <div className="space-y-3">
          {itinerary.days.map((day) => (
            <div key={day.day_number} className="bg-card rounded-2xl p-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                Day {day.day_number} · {day.date}
              </h3>
              <div className="space-y-2">
                {day.activities.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground mt-0.5 text-xs w-10 flex-shrink-0">
                      {a.start_time}
                    </span>
                    <span className="font-medium">{a.title}</span>
                  </div>
                ))}
                {day.activities.length > 4 && (
                  <p className="text-xs text-muted-foreground ml-12">
                    +{day.activities.length - 4} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={saveTrip}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-primary text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {saving ? "Saving trip..." : "Save & View Full Itinerary"}
        </button>
      </div>
    </div>
  );
}
