export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { aiRatelimit } from "@/lib/ratelimit";

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
  if (message.length > 4000) {
    return NextResponse.json({ error: "message too long (max 4000 characters)" }, { status: 400 });
  }

  // Validate and sanitize history to prevent quota abuse via large/malformed entries.
  // Each part is capped at 4000 chars and the total history is capped at 20 turns.
  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(0, 20)
    .filter((h: unknown) => h !== null && typeof h === "object")
    .map((h: unknown) => {
      const entry = h as Record<string, unknown>;
      return {
        role: entry.role === "model" ? ("model" as const) : ("user" as const),
        parts: (Array.isArray(entry.parts) ? entry.parts : [])
          .slice(0, 10)
          .map((p: unknown) => {
            const part = p as Record<string, unknown>;
            return {
              text: typeof part?.text === "string" ? (part.text as string).slice(0, 4000) : "",
            };
          })
          .filter((p) => p.text.length > 0),
      };
    })
    .filter((h) => h.parts.length > 0);

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
