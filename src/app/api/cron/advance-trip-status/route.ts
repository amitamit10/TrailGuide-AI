export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // planning → active: start_date is today or earlier, end_date is today or later
  const { data: toActivate } = await supabase
    .from("trips")
    .update({ status: "active" })
    .eq("status", "planning")
    .lte("start_date", today)
    .gte("end_date", today)
    .select("id, title, user_id");

  // active → completed: end_date was yesterday
  const { data: toComplete } = await supabase
    .from("trips")
    .update({ status: "completed" })
    .eq("status", "active")
    .lt("end_date", today)
    .select("id, title, user_id");

  return NextResponse.json({
    activated: toActivate?.length ?? 0,
    completed: toComplete?.length ?? 0,
  });
}
