import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Clock,
  MapPin,
  DollarSign,
  ArrowLeft,
  UtensilsCrossed,
  Landmark,
  Bus,
  Hotel,
  Plane,
  Leaf,
} from "lucide-react";
import type { Activity } from "@/types";

const CATEGORY_META = {
  food: { icon: UtensilsCrossed, color: "bg-orange-100 text-orange-600", label: "Food & Dining" },
  attraction: { icon: Landmark, color: "bg-blue-100 text-blue-600", label: "Attraction" },
  transport: { icon: Bus, color: "bg-gray-100 text-gray-600", label: "Transport" },
  hotel: { icon: Hotel, color: "bg-purple-100 text-purple-600", label: "Accommodation" },
  flight: { icon: Plane, color: "bg-sky-100 text-sky-600", label: "Flight" },
  free: { icon: Leaf, color: "bg-green-100 text-green-600", label: "Free Time" },
};

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activity } = await supabase
    .from("activities")
    .select("*, itinerary_days(trip_id, day_number, date)")
    .eq("id", activityId)
    .single();

  if (
    !activity ||
    (activity.itinerary_days as { trip_id: string })?.trip_id !== id
  ) {
    notFound();
  }

  const a = activity as Activity & {
    itinerary_days: { trip_id: string; day_number: number; date: string };
  };

  const meta =
    CATEGORY_META[a.category as keyof typeof CATEGORY_META] ??
    CATEGORY_META.attraction;
  const Icon = meta.icon;

  const mapsUrl = a.lat && a.lng
    ? `https://maps.google.com/?q=${a.lat},${a.lng}`
    : a.address
      ? `https://maps.google.com/?q=${encodeURIComponent(a.address)}`
      : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-primary/10 px-4 pt-6 pb-8">
        <Link
          href={`/trips/${id}/timeline`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to timeline
        </Link>
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${meta.color}`}
          >
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}
            >
              {meta.label}
            </span>
            <h1 className="text-xl font-bold mt-1 leading-tight">{a.title}</h1>
            {a.itinerary_days && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Day {a.itinerary_days.day_number} ·{" "}
                {new Date(
                  a.itinerary_days.date + "T00:00:00"
                ).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          {a.start_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>
                {a.start_time}
                {a.end_time ? ` – ${a.end_time}` : ""}
              </span>
            </div>
          )}
          {a.duration_minutes && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground opacity-0" />
              <span className="text-muted-foreground">
                {a.duration_minutes >= 60
                  ? `${Math.floor(a.duration_minutes / 60)}h${a.duration_minutes % 60 ? ` ${a.duration_minutes % 60}m` : ""}`
                  : `${a.duration_minutes}m`}
              </span>
            </div>
          )}
          {a.estimated_cost != null && a.estimated_cost > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>~{a.estimated_cost} per person</span>
            </div>
          )}
        </div>

        {a.description && (
          <div className="bg-card rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">About</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {a.description}
            </p>
          </div>
        )}

        {(a.location_name || a.address) && (
          <div className="bg-card rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">Location</h3>
            {a.location_name && (
              <p className="text-sm font-medium">{a.location_name}</p>
            )}
            {a.address && (
              <p className="text-sm text-muted-foreground mt-0.5">{a.address}</p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary font-medium hover:underline"
              >
                <MapPin className="w-3.5 h-3.5" />
                Open in Google Maps
              </a>
            )}
          </div>
        )}

        {a.notes && (
          <div className="bg-card rounded-2xl p-4">
            <h3 className="font-semibold text-sm mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {a.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
