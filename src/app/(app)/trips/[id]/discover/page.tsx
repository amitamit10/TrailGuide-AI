import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoverClient } from "@/components/discover/DiscoverClient";

export default async function DiscoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, destination, interests, travel_style")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  // Get existing activity titles to exclude from recommendations
  const { data: activities } = await supabase
    .from("activities")
    .select("title")
    .eq("trip_id", id);

  const existingTitles = (activities ?? []).map((a) => a.title);

  return (
    <DiscoverClient
      tripId={id}
      destination={trip.destination}
      interests={trip.interests ?? []}
      travelStyle={trip.travel_style ?? "balanced"}
      existingTitles={existingTitles}
    />
  );
}
