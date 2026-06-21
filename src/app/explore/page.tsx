import { createServiceClient } from "@/lib/supabase/server";
import { ExploreClient } from "@/components/explore/ExploreClient";

export default async function ExplorePage() {
  const supabase = createServiceClient();

  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, travelers, trip_style, interests")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  return <ExploreClient trips={trips ?? []} />;
}
