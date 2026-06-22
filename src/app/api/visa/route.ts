export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { publicRatelimit, clientIp } from "@/lib/ratelimit";

const DESTINATION_RE = /^[A-Za-z\s,'\-]{1,100}$/;

function safeSourceUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const { success } = await publicRatelimit.limit(clientIp(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const raw = req.nextUrl.searchParams.get("destination");
  if (!raw) return NextResponse.json({ error: "destination required" }, { status: 400 });

  if (!DESTINATION_RE.test(raw))
    return NextResponse.json({ error: "Invalid destination" }, { status: 400 });

  const destination = raw.trim();

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `entry requirements visa ${destination} 2025 tourism`,
        search_depth: "basic",
        max_results: 3,
        include_answer: true,
      }),
    });
    const data = await res.json();
    return NextResponse.json(
      {
        summary: data.answer ?? "Check official government travel advisory for entry requirements.",
        source: safeSourceUrl(data.results?.[0]?.url),
      },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({
      summary: "Unable to fetch requirements. Check your government's travel advisory.",
      source: "",
    });
  }
}
