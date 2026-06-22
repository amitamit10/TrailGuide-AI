export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { TripConfig } from "@/types";
import { aiRatelimit } from "@/lib/ratelimit";
import { proxyToBackend } from "@/lib/backend-proxy";

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

  let config: TripConfig;
  try {
    config = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!config.destination || !config.start_date || !config.end_date) {
    return NextResponse.json(
      { error: "destination, start_date, and end_date are required" },
      { status: 400 }
    );
  }

  // Sanitize prompt-injected fields before forwarding to AI.
  config = {
    ...config,
    destination: String(config.destination).slice(0, 300),
    start_date: String(config.start_date).slice(0, 20),
    end_date: String(config.end_date).slice(0, 20),
    travelers_count: Math.min(Math.max(1, Number(config.travelers_count) || 1), 50),
    interests: (Array.isArray(config.interests) ? config.interests : [])
      .slice(0, 20).map((i: unknown) => (typeof i === "string" ? i.slice(0, 100) : "")).filter(Boolean),
  };

  // Try Go backend when configured
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const proxied = await proxyToBackend("/ai/generate-itinerary", config, session.access_token);
    if (proxied) return proxied;
  }

  try {
    const itinerary = await gemini.generateItinerary(config);
    return NextResponse.json(itinerary);
  } catch (err) {
    console.error("generate-itinerary error:", err);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 503 }
    );
  }
}
