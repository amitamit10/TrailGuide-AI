import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Recommendation } from "@/app/api/ai/recommendations/route";
import { aiRatelimit } from "@/lib/ratelimit";

// POST /api/ai/add-discovery
// Appends a discovered recommendation to the last day of the trip
export async function POST(req: NextRequest) {
  const { tripId, recommendation }: { tripId: string; recommendation: Recommendation } = await req.json();
  if (!tripId || !recommendation) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  // Validate that client-supplied coordinates and cost are safe numbers before
  // inserting them into the database.
  const recLat = Number(recommendation.lat);
  const recLng = Number(recommendation.lng);
  const recCost = Number(recommendation.estimated_cost ?? 0);
  if (
    !Number.isFinite(recLat) || recLat < -90 || recLat > 90 ||
    !Number.isFinite(recLng) || recLng < -180 || recLng > 180 ||
    !Number.isFinite(recCost) || recCost < 0
  ) {
    return NextResponse.json({ error: "Invalid recommendation data" }, { status: 400 });
  }
  if (!recommendation.title || typeof recommendation.title !== "string" || recommendation.title.length > 500) {
    return NextResponse.json({ error: "Invalid recommendation title" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { success } = await aiRatelimit.limit(user.id);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Verify ownership
  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get the last day
  const { data: lastDay } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: false })
    .limit(1)
    .single();

  if (!lastDay) return NextResponse.json({ error: "No days found" }, { status: 404 });

  // Get the current max sort_order for that day
  const { data: lastActivity } = await supabase
    .from("activities")
    .select("sort_order")
    .eq("day_id", lastDay.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (lastActivity?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("activities").insert({
    trip_id: tripId,
    day_id: lastDay.id,
    title: recommendation.title,
    description: recommendation.description,
    category: recommendation.category,
    location_name: recommendation.location_name,
    address: recommendation.address,
    lat: recommendation.lat,
    lng: recommendation.lng,
    estimated_cost: recommendation.estimated_cost,
    duration_minutes: recommendation.duration_minutes,
    photo_query: recommendation.photo_query,
    sort_order: nextOrder,
    is_completed: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
