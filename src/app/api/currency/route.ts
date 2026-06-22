export const maxDuration = 15;
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from and to required" }, { status: 400 });

  const serviceSupabase = createServiceClient();

  // Check 1-hour cache
  const { data: cached } = await serviceSupabase
    .from("currency_cache")
    .select("rates, cached_at")
    .eq("base_currency", from)
    .single();

  let rates: Record<string, number> | null = null;

  if (cached) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age < 60 * 60 * 1000) {
      rates = cached.rates as Record<string, number>;
    }
  }

  if (!rates) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!res.ok)
      return NextResponse.json(
        { error: "Currency service unavailable" },
        { status: 502 }
      );
    const json = await res.json();
    rates = json.rates as Record<string, number>;
    await serviceSupabase.from("currency_cache").upsert({
      base_currency: from,
      rates,
      cached_at: new Date().toISOString(),
    });
  }

  const rate = rates[to];
  if (rate == null)
    return NextResponse.json(
      { error: `Currency ${to} not found` },
      { status: 404 }
    );

  return NextResponse.json(
    { data: { from, to, rate } },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
