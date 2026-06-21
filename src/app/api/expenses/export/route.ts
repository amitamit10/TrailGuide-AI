import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyTripOwnership(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from("trips").select("id").eq("id", tripId).eq("user_id", userId).single();
  return !!data;
}

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!await verifyTripOwnership(supabase, tripId, user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: expenses } = await supabase
    .from("expenses")
    .select("date,title,category,amount,note")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  const rows = [
    ["Date", "Title", "Category", "Amount", "Note"],
    ...(expenses ?? []).map((e) => [e.date, e.title, e.category, e.amount, e.note ?? ""]),
  ];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="expenses-${tripId}.csv"`,
    },
  });
}
