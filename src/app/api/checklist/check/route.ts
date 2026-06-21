import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const { id, checked } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (typeof checked !== "boolean")
    return NextResponse.json({ error: "checked must be boolean" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership via RLS-scoped select before updating
  const { data: item } = await supabase
    .from("checklist_items")
    .select("id")
    .eq("id", id)
    .single();
  if (!item) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("checklist_items")
    .update({ is_checked: checked })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
