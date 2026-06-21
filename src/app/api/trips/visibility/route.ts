import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const { tripId, isPublic } = await req.json();
  if (typeof isPublic !== "boolean") return NextResponse.json({ error: "isPublic must be boolean" }, { status: 400 });
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("trips")
    .update({ is_public: isPublic })
    .eq("id", tripId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
