"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ActivityCard } from "./ActivityCard";
import { ReplaceActivitySheet } from "./ReplaceActivitySheet";
import type { ItineraryDay, Activity } from "@/types";

interface SelectedActivity {
  activity: Activity;
  dayId: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TimelineClient({
  tripId,
  days,
}: {
  tripId: string;
  days: Array<ItineraryDay & { activities: Activity[] }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedActivity | null>(null);

  const handleReplaced = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 pb-28">
        {days.map((day) => (
          <div key={day.id} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {day.day_number}
              </div>
              <div>
                <h3 className="font-semibold text-base">{formatDate(day.date)}</h3>
                <p className="text-xs text-muted-foreground">{day.activities.length} activities</p>
              </div>
            </div>

            <div className="ml-5">
              {day.activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => router.push(`/trips/${tripId}/activity/${activity.id}`)}
                >
                  <ActivityCard
                    activity={activity}
                    isLast={i === day.activities.length - 1}
                    onReplace={() => setSelected({ activity, dayId: day.id })}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ReplaceActivitySheet
        activity={selected?.activity ?? null}
        tripId={tripId}
        dayId={selected?.dayId ?? ""}
        onClose={() => setSelected(null)}
        onReplaced={handleReplaced}
      />
    </>
  );
}
