export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedItinerary, GeneratedDay, GeneratedActivity, ItineraryDay, Activity } from "@/types";
import { aiRatelimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { success } = await aiRatelimit.limit(user.id);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { tripId: string; editCommand: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tripId, editCommand: rawEditCommand } = body;
  const editCommand = typeof rawEditCommand === "string" ? rawEditCommand.slice(0, 2000) : "";

  if (!tripId || typeof tripId !== "string") {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  // Explicit ownership check — prevents IDOR against public trips where RLS
  // allows SELECT but not writes. Without this, any authenticated user can
  // trigger an AI call on another user's public trip, consuming Groq quota.
  const { data: ownedTrip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!ownedTrip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("*, activities(*)")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true });

  const typedDays = (days ?? []) as Array<ItineraryDay & { activities: Activity[] }>;
  for (const d of typedDays) {
    d.activities = (d.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  const currentItinerary: GeneratedItinerary = {
    days: typedDays.map((d) => ({
      day_number: d.day_number,
      date: d.date,
      activities: d.activities.map((a) => ({
        title: a.title,
        description: a.description ?? "",
        category: a.category as GeneratedActivity["category"],
        start_time: a.start_time ?? "",
        end_time: a.end_time ?? "",
        duration_minutes: a.duration_minutes ?? 0,
        location_name: a.location_name ?? "",
        address: a.address ?? "",
        lat: a.lat ?? 0,
        lng: a.lng ?? 0,
        estimated_cost: a.estimated_cost ?? 0,
        photo_query: a.photo_query ?? "",
      })) as GeneratedActivity[],
    })) as GeneratedDay[],
  };

  try {
    const updated = await gemini.editItinerary(currentItinerary, editCommand);

    for (const updatedDay of updated.days) {
      const existingDay = typedDays.find(
        (d) => d.day_number === updatedDay.day_number
      );
      if (!existingDay) continue;

      await supabase.from("activities").delete().eq("day_id", existingDay.id);

      const activitiesPayload = updatedDay.activities.map((a, idx) => ({
        trip_id: tripId,
        day_id: existingDay.id,
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Gemini edit-itinerary error:", err);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 503 }
    );
  }
}
