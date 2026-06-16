import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripCalendar } from "@/components/calendar/TripCalendar";
import type { ItineraryDay, Activity } from "@/types";

export default async function CalendarPage({
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
    .select("id, start_date, end_date, destination")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("*, activities(*)")
    .eq("trip_id", id)
    .order("day_number", { ascending: true });

  const typedDays = (days ?? []) as Array<
    ItineraryDay & { activities: Activity[] }
  >;

  for (const day of typedDays) {
    day.activities = (day.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <TripCalendar
        days={typedDays}
        startDate={trip.start_date}
        endDate={trip.end_date}
        tripId={id}
      />
    </div>
  );
}
