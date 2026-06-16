import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripMap } from "@/components/maps/TripMap";
import type { Trip, ItineraryDay, Activity } from "@/types";

export default async function MapPage({
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

  for (const day of typedDays) {
    day.activities = (day.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  const centerLat = t.destination_lat ?? 0;
  const centerLng = t.destination_lng ?? 0;

  return (
    <div style={{ height: "calc(100vh - 112px)" }}>
      <TripMap days={typedDays} centerLat={centerLat} centerLng={centerLng} />
    </div>
  );
}
