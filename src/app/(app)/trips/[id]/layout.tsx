import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { TripTabNav } from "@/components/trip/TripTabNav";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const statusColors: Record<string, string> = {
    planning: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="font-bold text-base truncate">{trip.title}</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[trip.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {trip.status}
            </span>
          </div>
        </div>
        <TripTabNav tripId={id} />
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
