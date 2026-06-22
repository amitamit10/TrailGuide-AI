export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { activityTitle, destination } = await req.json();
  if (!activityTitle || !destination) return NextResponse.json({ caption: null });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{
      role: "user",
      content: `Write a single-sentence travel photo caption (max 15 words) for a photo of "${activityTitle}" in ${destination}. Be evocative but concise. Return only the caption text.`,
    }],
    max_tokens: 50,
    temperature: 0.8,
  });
  const caption = completion.choices[0]?.message?.content?.trim() ?? null;
  return NextResponse.json({ caption });
}
