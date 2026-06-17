import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SummaryClient } from "@/components/summary/SummaryClient";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status, travelers_count, budget_currency")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("id, day_number, date")
    .eq("trip_id", id)
    .order("day_number", { ascending: true });

  const dayIds = (days ?? []).map((d) => d.id);

  const { data: activities } = dayIds.length
    ? await supabase
        .from("activities")
        .select("id, title, description, category, location_name, estimated_cost, duration_minutes, photo_query, is_completed, day_id, sort_order")
        .in("day_id", dayIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const dayMap = Object.fromEntries((days ?? []).map((d) => [d.id, d]));

  const enriched = (activities ?? []).map((a) => ({
    ...a,
    day_number: dayMap[a.day_id]?.day_number ?? 0,
    date: dayMap[a.day_id]?.date ?? "",
  }));

  const totalCost = enriched.reduce((sum, a) => sum + (a.estimated_cost ?? 0), 0);
  const completedCount = enriched.filter((a) => a.is_completed).length;
  const daysCount = days?.length ?? 0;

  return (
    <SummaryClient
      trip={trip}
      activities={enriched}
      stats={{ totalCost, completedCount, daysCount, totalCount: enriched.length }}
    />
  );
}
