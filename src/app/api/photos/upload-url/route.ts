export const maxDuration = 30;
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { activityId, tripId, fileName, contentType } = await req.json();
  if (!activityId || !tripId || !fileName) {
    return NextResponse.json({ error: "activityId, tripId, fileName required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify trip ownership
  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serviceSupabase = createServiceClient();
  // Sanitize filename to avoid URL encoding issues
  const safeFileName = fileName.replace(/[^\w.\-]/g, "_");
  const path = `${user.id}/${tripId}/${activityId}/${Date.now()}-${safeFileName}`;

  const { data, error } = await serviceSupabase.storage
    .from("activity-photos")
    .createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signedUrl: data.signedUrl, path });
}
