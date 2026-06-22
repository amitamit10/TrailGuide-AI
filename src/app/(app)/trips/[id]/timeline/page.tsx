import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TimelineClient } from "@/components/itinerary/TimelineClient";
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

  const typedDays = (days ?? []) as Array<ItineraryDay & { activities: Activity[] }>;

  for (const day of typedDays) {
    day.activities = (day.activities ?? []).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
  }

  if (typedDays.length === 0) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-112px)] items-center justify-center text-center px-4">
        <p className="text-muted-foreground">No itinerary yet.</p>
        <Link href="/trips/new" className={cn(buttonVariants(), "rounded-xl mt-4 inline-flex")}>
          Plan Another Trip
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-112px)]">
      <TimelineClient tripId={id} destination={trip.destination} days={typedDays} />
      <EditBar tripId={id} />
    </div>
  );
}
