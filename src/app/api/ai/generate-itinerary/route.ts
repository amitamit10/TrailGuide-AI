export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import type { TripConfig } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  try {
    const itinerary = await gemini.generateItinerary(config);
    return NextResponse.json(itinerary);
  } catch (err) {
    console.error("Gemini generate-itinerary error:", err);
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 503 }
    );
  }
}
