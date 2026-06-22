export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get trip destination (also verifies ownership)
  const { data: trip } = await supabase
    .from("trips")
    .select("destination")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const destination = trip.destination;

  // Check 7-day cache
  const serviceSupabase = createServiceClient();
  const { data: cached } = await serviceSupabase
    .from("culture_cache")
    .select("data, cached_at")
    .eq("destination", destination)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ data: cached.data, cached: true });
    }
  }

  // Generate with Groq
  const prompt = `You are a cultural travel expert. Generate a comprehensive local guide for travelers visiting ${destination}.

Return ONLY valid JSON in this exact format:
{
  "language": {
    "name": "Local language name",
    "phrases": [
      {"phrase": "Hello", "local": "...", "pronunciation": "..."},
      {"phrase": "Thank you", "local": "...", "pronunciation": "..."},
      {"phrase": "Where is...?", "local": "...", "pronunciation": "..."},
      {"phrase": "How much?", "local": "...", "pronunciation": "..."},
      {"phrase": "Help!", "local": "...", "pronunciation": "..."},
      {"phrase": "I don't understand", "local": "...", "pronunciation": "..."},
      {"phrase": "Do you speak English?", "local": "...", "pronunciation": "..."},
      {"phrase": "Excuse me", "local": "...", "pronunciation": "..."}
    ]
  },
  "customs": {
    "tipping": "string",
    "dress_code": "string",
    "etiquette": ["do 1", "dont 1", "do 2", "dont 2"],
    "greetings": "string"
  },
  "practical": {
    "electricity": {"voltage": "220V", "plug_type": "Type A", "adapter_needed": true},
    "currency_name": "string",
    "currency_code": "USD",
    "cash_culture": "string",
    "water_safety": "string",
    "internet": "string"
  },
  "emergency": {
    "police": "911",
    "ambulance": "911",
    "fire": "911",
    "tourist_helpline": null,
    "notes": "string"
  },
  "visa": {
    "summary": "string",
    "on_arrival": true,
    "duration_days": 90,
    "notes": "string"
  }
}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  let pack: unknown;
  try {
    pack = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Failed to parse culture pack" }, { status: 500 });
  }

  // Upsert cache
  await serviceSupabase.from("culture_cache").upsert({
    destination,
    data: pack,
    cached_at: new Date().toISOString(),
  });

  return NextResponse.json({ data: pack, cached: false });
}
