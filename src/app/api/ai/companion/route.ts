import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/ai";
import { aiRatelimit } from "@/lib/ratelimit";

export interface NudgeCard {
  type: "timing" | "discovery" | "weather" | "navigation";
  message: string;
  action_label?: string;
  action_url?: string;
}

async function getWeather(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m&hourly=temperature_2m,precipitation_probability,weathercode&forecast_days=1&timezone=auto`
    );
    if (!res.ok) return "Weather unavailable";
    const d = await res.json();
    const temp = d.current?.temperature_2m;
    const code = d.current?.weathercode;
    const rainChance = d.hourly?.precipitation_probability
      ? Math.max(...(d.hourly.precipitation_probability as number[]))
      : 0;
    const condition = weatherCodeToText(code);
    return `${condition}, ${temp}°C, ${rainChance}% chance of rain today`;
  } catch {
    return "Weather unavailable";
  }
}

function weatherCodeToText(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Rain showers";
  return "Thunderstorm";
}

// POST /api/ai/companion
// Body: { tripId, lat, lng, currentTime }
export async function POST(req: NextRequest) {
  const { tripId, lat, lng, currentTime } = await req.json();
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  // Validate coordinates when supplied by the client.
  if (lat !== undefined && lat !== null) {
    const latN = Number(lat);
    if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
      return NextResponse.json({ error: "lat must be a number in [-90, 90]" }, { status: 400 });
    }
  }
  if (lng !== undefined && lng !== null) {
    const lngN = Number(lng);
    if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
      return NextResponse.json({ error: "lng must be a number in [-180, 180]" }, { status: 400 });
    }
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

  // Get trip
  const { data: trip } = await supabase
    .from("trips")
    .select("id, destination, destination_lat, destination_lng, travel_style")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const destLat = lat ?? trip.destination_lat ?? 0;
  const destLng = lng ?? trip.destination_lng ?? 0;

  // Get today's activities ordered by time
  const today = new Date().toISOString().split("T")[0];
  const { data: todayDay } = await supabase
    .from("itinerary_days")
    .select("id, date")
    .eq("trip_id", tripId)
    .eq("date", today)
    .single();

  let nextActivity = null;
  let allTodayActivities: Array<{ title: string; location_name: string; start_time: string; is_completed: boolean }> = [];

  if (todayDay) {
    const { data: activities } = await supabase
      .from("activities")
      .select("title, location_name, start_time, is_completed")
      .eq("day_id", todayDay.id)
      .eq("is_completed", false)
      .order("sort_order", { ascending: true });

    allTodayActivities = activities ?? [];
    nextActivity = allTodayActivities[0] ?? null;
  }

  // Fetch weather
  const weather = await getWeather(destLat, destLng);

  // Generate nudges
  const nudges = await gemini.getCompanionNudges({
    currentTime: currentTime ?? new Date().toTimeString().slice(0, 5),
    currentLat: destLat,
    currentLng: destLng,
    nextActivity: nextActivity
      ? { title: nextActivity.title, location: nextActivity.location_name ?? "", start_time: nextActivity.start_time }
      : { title: "Free time", location: trip.destination, start_time: "anytime" },
    weatherSummary: weather,
    destination: trip.destination,
  });

  // Persist nudges
  if (nudges.length > 0) {
    await supabase.from("companion_nudges").insert(
      nudges.map((n) => ({
        trip_id: tripId,
        type: n.type,
        message: n.message,
        action_label: n.action_label ?? null,
      }))
    );
  }

  return NextResponse.json({
    weather,
    nextActivity,
    remainingToday: allTodayActivities.length,
    nudges,
  });
}
