import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const { activityId, completed } = await req.json();
  if (typeof completed !== "boolean") return NextResponse.json({ error: "completed must be boolean" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership via RLS-scoped select before updating
  const { data: activity } = await supabase.from("activities").select("id").eq("id", activityId).single();
  if (!activity) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("activities")
    .update({ is_completed: completed })
    .eq("id", activityId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
