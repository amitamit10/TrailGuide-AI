export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get("destination");
  if (!destination)
    return NextResponse.json(
      { error: "destination required" },
      { status: 400 }
    );

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
        summary:
          data.answer ??
          "Check official government travel advisory for entry requirements.",
        source: data.results?.[0]?.url ?? "",
      },
      { headers: { "Cache-Control": "public, max-age=86400" } }
    );
  } catch {
    return NextResponse.json({
      summary:
        "Unable to fetch requirements. Check your government's travel advisory.",
      source: "",
    });
  }
}
