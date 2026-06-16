import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, MapPin, Calendar, Users, List } from "lucide-react";
import { DaySection } from "@/components/itinerary/DaySection";
import type { Trip, ItineraryDay, Activity } from "@/types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export default async function TripDetailPage({
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
    .select("*")
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
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-4 max-w-2xl mx-auto">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{trip.title}</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-primary rounded-2xl p-5 text-white mb-6">
          <div className="flex flex-wrap gap-4 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {(trip as Trip).destination}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDateRange(
                (trip as Trip).start_date,
                (trip as Trip).end_date
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {(trip as Trip).travelers_count} traveler
              {(trip as Trip).travelers_count !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <List className="w-4 h-4" />
              {typedDays.length} days
            </span>
          </div>
        </div>

        <div>
          {typedDays.map((day) => (
            <DaySection key={day.id} day={day} />
          ))}
        </div>

        {typedDays.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>No itinerary found for this trip.</p>
            <Link
              href="/trips/new"
              className={cn(buttonVariants(), "rounded-xl mt-4")}
            >
              Plan Another Trip
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
