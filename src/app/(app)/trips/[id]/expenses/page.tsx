import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpensesClient } from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, budget_total, budget_currency")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) redirect("/dashboard");
  return <ExpensesClient trip={trip} />;
}
