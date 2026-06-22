import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedActivity } from "@/types";
import { aiRatelimit } from "@/lib/ratelimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `You are a travel activity planner. Generate a single replacement activity as valid JSON.

Return ONLY this JSON structure, no markdown:
{
  "title": "Activity name",
  "description": "2-3 sentence description of why it is worth visiting.",
  "category": "attraction",
  "start_time": "10:00",
  "end_time": "12:00",
  "duration_minutes": 120,
  "location_name": "Place name",
  "address": "Full street address",
  "lat": 48.8566,
  "lng": 2.3522,
  "estimated_cost": 15,
  "photo_query": "descriptive search query for a photo of this place"
}

category must be one of: food, attraction, transport, hotel, flight, free
Use real coordinates for the destination city.`;

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

  const { tripId, activityId, dayId, userRequest: rawUserRequest } = await req.json();
  const userRequest = typeof rawUserRequest === "string" ? rawUserRequest.slice(0, 1000) : "";

  // Load context: trip destination, the activity to replace, and its neighbors
  const { data: trip } = await supabase
    .from("trips")
    .select("destination, travel_style, interests")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  // Get surrounding activities for scheduling context
  const { data: dayActivities } = await supabase
    .from("activities")
    .select("title, start_time, end_time, sort_order")
    .eq("day_id", dayId)
    .neq("id", activityId)
    .order("sort_order", { ascending: true });

  const neighbors = (dayActivities ?? [])
    .map((a) => `${a.start_time ?? "?"} – ${a.end_time ?? "?"}: ${a.title}`)
    .join("\n");

  const prompt = `Trip destination: ${trip.destination}
Travel style: ${trip.travel_style}
Interests: ${Array.isArray(trip.interests) ? trip.interests.join(", ") : "general"}

Current activity being replaced:
Title: ${activity.title}
Time: ${activity.start_time ?? "?"} – ${activity.end_time ?? "?"}
Duration: ${activity.duration_minutes ?? 60} minutes

Other activities on this day (for scheduling context):
${neighbors || "None yet"}

User's request: "${userRequest}"

Generate a replacement activity that fits the requested time slot (${activity.start_time} – ${activity.end_time}) and complements the other activities.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? "{}";
    const newActivity = JSON.parse(text) as GeneratedActivity;

    // Delete old activity and insert the replacement
    await supabase.from("activities").delete().eq("id", activityId);

    await supabase.from("activities").insert({
      trip_id: tripId,
      day_id: dayId,
      title: newActivity.title,
      description: newActivity.description,
      category: newActivity.category,
      start_time: newActivity.start_time,
      end_time: newActivity.end_time,
      duration_minutes: newActivity.duration_minutes,
      location_name: newActivity.location_name,
      address: newActivity.address,
      lat: newActivity.lat,
      lng: newActivity.lng,
      estimated_cost: newActivity.estimated_cost,
      photo_query: newActivity.photo_query,
      sort_order: activity.sort_order,
    });

    return NextResponse.json({ success: true, activity: newActivity });
  } catch (err) {
    console.error("replace-activity error:", err);
    return NextResponse.json({ error: "AI service error" }, { status: 503 });
  }
}
