import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const { activityId, completed } = await req.json();
  if (typeof completed !== "boolean") return NextResponse.json({ error: "completed must be boolean" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the activity's trip_id — RLS may allow SELECT on public trips, which
  // is intentional, but we must then explicitly verify ownership of the trip
  // before allowing a write. Two queries is clearer than a filtered join.
  const { data: activity } = await supabase
    .from("activities")
    .select("id, trip_id")
    .eq("id", activityId)
    .single();
  if (!activity) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: ownedTrip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", activity.trip_id)
    .eq("user_id", user.id)
    .single();
  if (!ownedTrip) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("activities")
    .update({ is_completed: completed })
    .eq("id", activityId)
    .eq("trip_id", activity.trip_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
