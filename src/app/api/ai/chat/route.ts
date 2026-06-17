export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { history: unknown; message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { history, message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const safeHistory = Array.isArray(history) ? history : [];

  try {
    const result = await gemini.sendChatMessage(
      safeHistory as Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }>,
      message
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
      const retryMatch = msg.match(/Please retry in ([\d.]+)s/);
      const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 15;
      return NextResponse.json({ error: "rate_limited", retryAfter }, { status: 429 });
    }
    console.error("Gemini chat error:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
