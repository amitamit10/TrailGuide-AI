import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapPin, Calendar, Users, Plane, Hotel, ChevronRight } from "lucide-react";
import { CountdownTimer } from "@/components/trip/CountdownTimer";
import { WeatherWidget } from "@/components/trip/WeatherWidget";
import { BudgetTracker } from "@/components/trip/BudgetTracker";
import { ActivityCard } from "@/components/itinerary/ActivityCard";
import type { Trip, ItineraryDay, Activity } from "@/types";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function TripDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const t = trip as Trip;

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("*, activities(*)")
    .eq("trip_id", id)
    .order("day_number", { ascending: true });

  const typedDays = (days ?? []) as Array<
    ItineraryDay & { activities: Activity[] }
  >;

  const allActivities: Activity[] = typedDays.flatMap((d) =>
    (d.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    )
  );

  const today = new Date().toISOString().split("T")[0];
  const todayDay = typedDays.find((d) => d.date === today);
  const todayActivities = todayDay?.activities?.slice(0, 3) ?? [];
  const nextActivities = allActivities
    .filter((a) => !a.is_completed)
    .slice(0, 3);

  const previewActivities = todayActivities.length
    ? todayActivities
    : nextActivities;

  const flightActivity = allActivities.find((a) => a.category === "flight");
  const hotelActivity = allActivities.find((a) => a.category === "hotel");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="bg-primary rounded-2xl p-5 text-white">
        <h2 className="text-xl font-bold">{t.destination}</h2>
        <div className="flex flex-wrap gap-3 mt-2 text-white/80 text-sm">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(t.start_date)} – {formatDate(t.end_date)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {t.travelers_count} traveler{t.travelers_count !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {typedDays.length} days
          </span>
        </div>
        <CountdownTimer startDate={t.start_date} />
      </div>

      {t.destination_lat && t.destination_lng && (
        <WeatherWidget
          lat={t.destination_lat}
          lng={t.destination_lng}
          destination={t.destination}
        />
      )}

      {previewActivities.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              {todayActivities.length ? "Today's Plan" : "Up Next"}
            </h3>
            <Link
              href={`/trips/${id}/timeline`}
              className="text-xs text-primary font-medium flex items-center gap-0.5"
            >
              Full timeline <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-card rounded-2xl p-4">
            {previewActivities.map((a, i) => (
              <ActivityCard
                key={a.id}
                activity={a}
                isLast={i === previewActivities.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {flightActivity && (
        <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
            <Plane className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Flight</p>
            <p className="font-semibold text-sm">{flightActivity.title}</p>
            {flightActivity.start_time && (
              <p className="text-xs text-muted-foreground">
                {flightActivity.start_time}
                {flightActivity.location_name
                  ? ` · ${flightActivity.location_name}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {hotelActivity && (
        <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Hotel className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Accommodation</p>
            <p className="font-semibold text-sm">{hotelActivity.title}</p>
            {hotelActivity.address && (
              <p className="text-xs text-muted-foreground">
                {hotelActivity.address}
              </p>
            )}
          </div>
        </div>
      )}

      {t.budget_total && (
        <BudgetTracker
          activities={allActivities}
          budgetTotal={t.budget_total}
          currency={t.budget_currency ?? "USD"}
        />
      )}
    </div>
  );
}
