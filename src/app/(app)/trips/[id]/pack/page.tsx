import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PackingClient } from "@/components/packing/PackingClient";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, destination, start_date, end_date, travel_style, interests, travelers_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) redirect("/dashboard");
  return <PackingClient trip={trip} />;
}
