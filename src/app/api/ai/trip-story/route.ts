import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { aiRatelimit } from "@/lib/ratelimit";
import { proxyToBackend } from "@/lib/backend-proxy";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
  const { destination, startDate, endDate, activities } = body;

  // Try Go backend when configured
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const proxied = await proxyToBackend("/ai/trip-story", body, session.access_token);
    if (proxied) return proxied;
  }

  const activityList = (activities as { title: string; description?: string; day: number }[])
    .map((a) => `Day ${a.day}: ${a.title}${a.description ? ` — ${a.description}` : ""}`)
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You write vivid, personal travel stories in 2-3 short paragraphs. First person, past tense. Warm, specific, evocative — like a postcard from a great trip. No bullet points, no headers. End with one memorable sentence.",
      },
      {
        role: "user",
        content: `Write a travel story for a trip to ${destination} from ${startDate} to ${endDate}.\n\nActivities:\n${activityList}`,
      },
    ],
    max_tokens: 400,
    temperature: 0.85,
  });

  const story = completion.choices[0]?.message?.content ?? "";
  return NextResponse.json({ story });
}
