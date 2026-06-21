import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { sourceTripId } = await req.json();
  if (!sourceTripId) return NextResponse.json({ error: "sourceTripId required" }, { status: 400 });

  const supabase = await createClient();
  const serviceSupabase = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Read source trip via service role so public trips are always readable
  const { data: source } = await serviceSupabase
    .from("trips")
    .select("*, itinerary_days(*, activities(*))")
    .eq("id", sourceTripId)
    .eq("is_public", true)
    .single();

  if (!source) return NextResponse.json({ error: "Trip not found or not public" }, { status: 404 });

  const { data: newTrip, error: tripErr } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      title: `${source.title} (copy)`,
      destination: source.destination,
      destination_lat: source.destination_lat,
      destination_lng: source.destination_lng,
      departure_city: source.departure_city,
      start_date: source.start_date,
      end_date: source.end_date,
      travelers_count: source.travelers_count,
      traveler_ages: source.traveler_ages,
      budget_total: source.budget_total,
      budget_currency: source.budget_currency,
      travel_style: source.travel_style,
      interests: source.interests,
      transport_mode: source.transport_mode,
      max_walk_minutes: source.max_walk_minutes,
      break_minutes: source.break_minutes,
      status: "planning",
      is_public: false,
    })
    .select()
    .single();

  if (tripErr || !newTrip) return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });

  for (const day of source.itinerary_days ?? []) {
    const { data: newDay } = await supabase
      .from("itinerary_days")
      .insert({ trip_id: newTrip.id, day_number: day.day_number, date: day.date, notes: day.notes })
      .select()
      .single();

    if (!newDay) continue;

    if (day.activities?.length) {
      await supabase.from("activities").insert(
        day.activities.map((a: Record<string, unknown>) => ({
          trip_id: newTrip.id,
          day_id: newDay.id,
          title: a.title,
          description: a.description,
          category: a.category,
          location_name: a.location_name,
          address: a.address,
          lat: a.lat,
          lng: a.lng,
          start_time: a.start_time,
          end_time: a.end_time,
          duration_minutes: a.duration_minutes,
          estimated_cost: a.estimated_cost,
          photo_query: a.photo_query,
          sort_order: a.sort_order,
          is_completed: false,
        }))
      );
    }
  }

  return NextResponse.json({ newTripId: newTrip.id });
}
