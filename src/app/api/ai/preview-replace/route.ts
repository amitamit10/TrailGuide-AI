import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { GeneratedActivity } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { aiRatelimit } from "@/lib/ratelimit";
import { proxyToBackend } from "@/lib/backend-proxy";

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
  const { data: { user } } = await supabase.auth.getUser();
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

  const body = await req.json();
  const { destination, travelStyle, interests, activity, neighbors, userRequest } = body;

  // Try Go backend when configured
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const proxied = await proxyToBackend("/ai/preview-replace", body, session.access_token);
    if (proxied) return proxied;
  }

  const prompt = `Trip destination: ${destination}
Travel style: ${travelStyle ?? "balanced"}
Interests: ${Array.isArray(interests) ? interests.join(", ") : "general"}

Activity being replaced:
Title: ${activity.title}
Time: ${activity.start_time ?? "?"} – ${activity.end_time ?? "?"}
Duration: ${activity.duration_minutes ?? 60} minutes

Other activities this day:
${(neighbors as Array<{title: string; start_time: string}>)?.map(a => `${a.start_time}: ${a.title}`).join("\n") || "None"}

User request: "${userRequest}"

Generate a replacement that fits the ${activity.start_time} – ${activity.end_time} time slot.`;

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
    return NextResponse.json(newActivity);
  } catch (err) {
    console.error("preview-replace error:", err);
    return NextResponse.json({ error: "AI error" }, { status: 503 });
  }
}
