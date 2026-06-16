"use client";
import Link from "next/link";
import { ActivityCard } from "./ActivityCard";
import type { ItineraryDay, Activity } from "@/types";

interface DaySectionProps {
  day: ItineraryDay & { activities: Activity[] };
  tripId?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DaySection({ day, tripId }: DaySectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          {day.day_number}
        </div>
        <div>
          <h3 className="font-semibold text-base">{formatDate(day.date)}</h3>
          <p className="text-xs text-muted-foreground">
            {day.activities.length} activities
          </p>
        </div>
      </div>

      <div className="ml-5">
        {day.activities.map((activity, i) =>
          tripId ? (
            <Link
              key={activity.id}
              href={`/trips/${tripId}/activity/${activity.id}`}
              className="block hover:opacity-80 transition-opacity"
            >
              <ActivityCard
                activity={activity}
                isLast={i === day.activities.length - 1}
              />
            </Link>
          ) : (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isLast={i === day.activities.length - 1}
            />
          )
        )}
      </div>
    </div>
  );
}
