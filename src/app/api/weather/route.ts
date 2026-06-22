import { NextRequest, NextResponse } from "next/server";
import { publicRatelimit, clientIp } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  const { success } = await publicRatelimit.limit(clientIp(req));
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: "valid lat and lng required" }, { status: 400 });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    const data = await res.json();

    return NextResponse.json(
      {
        temperature: data.current?.temperature_2m ?? 0,
        weather_code: data.current?.weather_code ?? 0,
        wind_speed: data.current?.wind_speed_10m ?? 0,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 503 });
  }
}
