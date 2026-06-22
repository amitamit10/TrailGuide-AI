export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { aiRatelimit } from "@/lib/ratelimit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const raw = await req.json();
  const { tripId } = raw;
  const destination = typeof raw.destination === "string" ? raw.destination.slice(0, 300) : "";
  const startDate = typeof raw.startDate === "string" ? raw.startDate.slice(0, 20) : "";
  const endDate = typeof raw.endDate === "string" ? raw.endDate.slice(0, 20) : "";
  const travelStyle = typeof raw.travelStyle === "string" ? raw.travelStyle.slice(0, 50) : "balanced";
  const travelers = Math.min(Math.max(1, Number(raw.travelers) || 1), 50);
  const interests: string[] = (Array.isArray(raw.interests) ? raw.interests : [])
    .slice(0, 20).map((i: unknown) => (typeof i === "string" ? i.slice(0, 100) : "")).filter(Boolean);

  if (!destination || !tripId) {
    return NextResponse.json({ error: "tripId and destination required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fix 1: Trip ownership verification (IDOR prevention)
  const { data: trip } = await supabase.from("trips").select("id").eq("id", tripId).eq("user_id", user.id).single();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fix 2: Rate limiting
  const { success } = await aiRatelimit.limit(user.id);
  if (!success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Check if items already generated for this trip (idempotent)
  const { data: existing } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("trip_id", tripId)
    .eq("source", "ai")
    .limit(1);

  if (existing?.length) {
    const { data: items } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("category")
      .order("created_at");
    return NextResponse.json({ items: items ?? [] });
  }

  // Fetch weather forecast for destination dates (optional — wrapped in try/catch)
  let weatherNote = "";
  try {
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
    );
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1`
    );
    const geoData = await geoRes.json();
    const loc = geoData.results?.[0];
    if (loc) {
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,precipitation_sum&forecast_days=${Math.min(days + 1, 16)}&timezone=auto`
      );
      const wx = await wxRes.json();
      const temps = wx.daily?.temperature_2m_max ?? [];
      const rain = wx.daily?.precipitation_sum ?? [];
      const maxTemp = Math.max(...temps);
      const minTemp = Math.min(...temps);
      const rainDays = rain.filter((r: number) => r > 1).length;
      weatherNote = `Weather forecast: ${minTemp}–${maxTemp}°C, ${rainDays} rainy day${rainDays !== 1 ? "s" : ""} expected.`;
    }
  } catch {
    /* weather is optional, don't fail */
  }

  const nightsCount = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  );

  // Fix 3: Wrap Groq call, JSON.parse, and DB insert in try/catch
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You generate practical packing lists for trips. Return ONLY valid JSON.
Format: {"items": [{"label": "item name", "category": "clothing|toiletries|documents|electronics|health|gear|other"}]}
Be specific to the destination and trip type. Do not include items the traveler obviously already has (phone, wallet).
Aim for 30-45 items total across all categories.`,
        },
        {
          role: "user",
          content: `Generate a packing list for:
Destination: ${destination}
Duration: ${nightsCount} nights
Travel style: ${travelStyle}
Interests: ${(interests as string[]).join(", ")}
Travelers: ${travelers}
${weatherNote}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0].message.content?.trim() ?? '{"items":[]}';
    const { items } = JSON.parse(text) as { items: Array<{ label: string; category: string }> };

    // Persist to DB
    if (items.length > 0) {
      await supabase.from("checklist_items").insert(
        items.map((item) => ({
          trip_id: tripId,
          user_id: user.id,
          label: item.label,
          category: item.category,
          source: "ai",
        }))
      );
    }

    const { data: saved } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("category")
      .order("created_at");

    return NextResponse.json({ items: saved ?? [] });
  } catch {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
