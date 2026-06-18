import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildActivityDateRange } from "@/lib/calendar";
import ical from "ical-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("id, date")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  const dayIds = (days ?? []).map((d) => d.id);

  const { data: activities } = dayIds.length
    ? await supabase
        .from("activities")
        .select("title, description, address, start_time, duration_minutes, day_id")
        .in("day_id", dayIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const dayDateMap = Object.fromEntries((days ?? []).map((d) => [d.id, d.date]));

  const calendar = ical({ name: trip.title });

  for (const activity of activities ?? []) {
    if (!activity.start_time) continue;
    const date = dayDateMap[activity.day_id];
    if (!date) continue;
    const durationMins = activity.duration_minutes ?? 60;
    const { start, end } = buildActivityDateRange(date, activity.start_time, durationMins);
    calendar.createEvent({
      start,
      end,
      summary: activity.title,
      description: activity.description ?? "",
      location: activity.address ?? "",
    });
  }

  const icsContent = calendar.toString();
  const filename = `${trip.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
