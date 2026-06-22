export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { aiRatelimit } from "@/lib/ratelimit";
import { proxyToBackend } from "@/lib/backend-proxy";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface Recommendation {
  title: string;
  description: string;
  reason: string;
  category: "food" | "attraction" | "transport" | "hotel" | "free";
  location_name: string;
  address: string;
  lat: number;
  lng: number;
  estimated_cost: number;
  photo_query: string;
  duration_minutes: number;
}

const SYSTEM = `You are a travel discovery AI. Return a JSON object with a "recommendations" array of places.

Each item must match this structure exactly:
{
  "title": "Place name",
  "description": "2-3 sentences about the place.",
  "reason": "1 sentence: why this fits the traveler's interests.",
  "category": "attraction",
  "location_name": "Neighbourhood or landmark name",
  "address": "Full street address",
  "lat": 35.6762,
  "lng": 139.6503,
  "estimated_cost": 15,
  "photo_query": "descriptive search query for a photo",
  "duration_minutes": 90
}

category must be one of: food, attraction, free
Use accurate real-world coordinates. estimated_cost is per person (0 for free).
Return exactly the number of recommendations requested. No markdown, only JSON.`;

// POST /api/ai/recommendations
// Body: { destination, interests, travelStyle, existingTitles, category?, count? }
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

  const raw = await req.json();
  const destination = typeof raw.destination === "string" ? raw.destination.slice(0, 300) : "";
  const travelStyle = typeof raw.travelStyle === "string" ? raw.travelStyle.slice(0, 50) : "balanced";
  const category = typeof raw.category === "string" ? raw.category.slice(0, 50) : undefined;
  const count = Math.min(Math.max(1, Number(raw.count) || 8), 20);
  const interests: string[] = (Array.isArray(raw.interests) ? raw.interests : [])
    .slice(0, 20).map((i: unknown) => (typeof i === "string" ? i.slice(0, 100) : "")).filter(Boolean);
  const existingTitles: string[] = (Array.isArray(raw.existingTitles) ? raw.existingTitles : [])
    .slice(0, 20).map((t: unknown) => (typeof t === "string" ? t.slice(0, 200) : "")).filter(Boolean);

  if (!destination) return NextResponse.json({ error: "destination required" }, { status: 400 });

  // Try Go backend when configured
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const proxied = await proxyToBackend("/ai/recommendations", {
      destination, interests, travelStyle, currentActivities: existingTitles,
    }, session.access_token);
    if (proxied) return proxied;
  }

  const categoryLine = category ? `Focus only on category: ${category}.` : "Mix categories: food, attraction, and free activities.";
  const excludeLine = existingTitles.length > 0
    ? `Do NOT suggest these already-planned places: ${existingTitles.slice(0, 20).join(", ")}.`
    : "";

  const prompt = `Destination: ${destination}
Traveler interests: ${Array.isArray(interests) ? interests.join(", ") : "general"}
Travel style: ${travelStyle}
${categoryLine}
${excludeLine}

Generate ${count} discovery recommendations for this destination. Prioritize hidden gems, local favourites, and highly-rated spots that match the interests. Include a mix of well-known and off-the-beaten-path options.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? '{"recommendations":[]}';
    const parsed = JSON.parse(text);
    return NextResponse.json({ recommendations: parsed.recommendations ?? [] });
  } catch (err) {
    console.error("recommendations error:", err);
    return NextResponse.json({ error: "AI error" }, { status: 503 });
  }
}
