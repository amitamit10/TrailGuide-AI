import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DaySection } from "@/components/itinerary/DaySection";
import { EditBar } from "@/components/itinerary/EditBar";
import type { ItineraryDay, Activity } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, destination")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("*, activities(*)")
    .eq("trip_id", id)
    .order("day_number", { ascending: true });

  const typedDays = (days ?? []) as Array<
    ItineraryDay & { activities: Activity[] }
  >;

  for (const day of typedDays) {
    day.activities = (day.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-112px)]">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {typedDays.map((day) => (
          <DaySection key={day.id} day={day} tripId={id} />
        ))}

        {typedDays.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>No itinerary yet.</p>
            <Link
              href="/trips/new"
              className={cn(buttonVariants(), "rounded-xl mt-4 inline-flex")}
            >
              Plan Another Trip
            </Link>
          </div>
        )}
      </div>

      <EditBar tripId={id} />
    </div>
  );
}
