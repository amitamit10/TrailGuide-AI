import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { SummaryClient } from "@/components/summary/SummaryClient";
import { MapPin } from "lucide-react";

export default async function SharePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = createServiceClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status, travelers_count, budget_currency, is_public")
    .eq("id", tripId)
    .single();

  if (!trip) notFound();

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("id, day_number, date")
    .eq("trip_id", tripId)
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
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="font-bold text-sm text-primary">TrailGuide AI</span>
        <span className="text-muted-foreground text-sm ml-1">— shared trip</span>
      </header>
      <SummaryClient
        trip={trip}
        activities={enriched}
        stats={{ totalCost, completedCount, daysCount, totalCount: enriched.length }}
      />
    </div>
  );
}
