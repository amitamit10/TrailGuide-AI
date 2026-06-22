import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const activityId = req.nextUrl.searchParams.get("activityId");
  if (!activityId) return NextResponse.json({ error: "activityId required" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("activity_photos")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at");
  return NextResponse.json({ photos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { activityId, tripId, storagePath, caption } = await req.json();
  if (!activityId || !tripId || !storagePath) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();
  if (!trip) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase
    .from("activity_photos")
    .insert({ activity_id: activityId, trip_id: tripId, storage_path: storagePath, caption })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // RLS on activity_photos handles ownership; also get storage_path to delete from bucket
  const { data: photo } = await supabase
    .from("activity_photos")
    .select("id, storage_path")
    .eq("id", id)
    .single();
  if (!photo) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await supabase.from("activity_photos").delete().eq("id", id);
  // Also delete from storage
  const serviceSupabase = createServiceClient();
  await serviceSupabase.storage.from("activity-photos").remove([photo.storage_path]);
  return NextResponse.json({ ok: true });
}
