import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navigation, Plus, MapPin, Calendar, ChevronRight, Settings, Compass } from "lucide-react";
import type { Trip } from "@/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}, ${e.getFullYear()}`;
}

function TripCard({ trip }: { trip: Trip }) {
  const statusColors: Record<string, string> = {
    planning: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
  };

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block bg-card rounded-2xl p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[trip.status]}`}
            >
              {trip.status}
            </span>
          </div>
          <h3 className="font-semibold text-base truncate">{trip.title}</h3>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {trip.destination}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateRange(trip.start_date, trip.end_date)}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false });

  const activeTrip = trips?.find((t: Trip) => t.status === "active");
  const upcomingTrips = trips?.filter(
    (t: Trip) => t.status === "planning"
  ) ?? [];
  const pastTrips = trips?.filter(
    (t: Trip) => t.status === "completed"
  ) ?? [];

  const firstName = profile?.full_name?.split(" ")[0] ?? "Traveler";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base">TrailGuide AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/explore" className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Compass className="w-4 h-4" />
          </Link>
          <Link href="/settings" className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Settings className="w-4 h-4" />
          </Link>
          <Link
            href="/trips/new"
            className={cn(buttonVariants({ size: "sm" }), "rounded-xl gap-1")}
          >
            <Plus className="w-4 h-4" />
            New Trip
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Hi, {firstName}! 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Where are you headed next?
          </p>
        </div>

        {activeTrip && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Active Trip
            </h2>
            <TripCard trip={activeTrip} />
          </section>
        )}

        {upcomingTrips.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Upcoming
            </h2>
            <div className="space-y-3">
              {upcomingTrips.map((trip: Trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>
        )}

        {pastTrips.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Past Trips
            </h2>
            <div className="space-y-3">
              {pastTrips.map((trip: Trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          </section>
        )}

        {!trips?.length && (
          <div className="flex flex-col items-center text-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Navigation className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">No trips yet</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Chat with TrailGuide AI to plan your first adventure
              </p>
            </div>
            <Link
              href="/trips/new"
              className={cn(buttonVariants(), "rounded-xl")}
            >
              Plan My First Trip
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
