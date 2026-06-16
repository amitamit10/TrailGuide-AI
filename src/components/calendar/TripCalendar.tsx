"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ItineraryDay, Activity } from "@/types";
import { ActivityCard } from "@/components/itinerary/ActivityCard";

interface TripCalendarProps {
  days: Array<ItineraryDay & { activities: Activity[] }>;
  startDate: string;
  endDate: string;
  tripId: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_DOTS: Record<string, string> = {
  food: "bg-orange-400",
  attraction: "bg-blue-400",
  transport: "bg-gray-400",
  hotel: "bg-purple-400",
  flight: "bg-sky-400",
  free: "bg-green-400",
};

export function TripCalendar({ days, startDate, endDate }: TripCalendarProps) {
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(startDate + "T00:00:00");
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(startDate + "T00:00:00");
    return d.getMonth();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysByDate = new Map(days.map((d) => [d.date, d]));
  const tripStart = new Date(startDate + "T00:00:00");
  const tripEnd = new Date(endDate + "T00:00:00");

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startPadding = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const selectedDay = selectedDate ? daysByDate.get(selectedDate) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-base">
          {MONTHS[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0 mb-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-xs text-muted-foreground font-medium py-1"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const cellDate = new Date(viewYear, viewMonth, day);
          const isInTrip = cellDate >= tripStart && cellDate <= tripEnd;
          const tripDay = daysByDate.get(dateStr);
          const isSelected = selectedDate === dateStr;
          const isToday =
            dateStr === new Date().toISOString().split("T")[0];
          const cats = [
            ...new Set(
              (tripDay?.activities ?? []).map((a) => a.category).slice(0, 3)
            ),
          ];

          return (
            <button
              key={dateStr}
              onClick={() =>
                setSelectedDate(isSelected ? null : dateStr)
              }
              className={`relative flex flex-col items-center py-1.5 rounded-xl text-sm transition-colors ${
                isSelected
                  ? "bg-primary text-white"
                  : isInTrip
                    ? "bg-primary/10 hover:bg-primary/20"
                    : "hover:bg-muted"
              } ${isToday && !isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
            >
              <span
                className={`font-medium leading-none ${
                  isSelected
                    ? "text-white"
                    : isInTrip
                      ? "text-primary"
                      : "text-foreground"
                }`}
              >
                {day}
              </span>
              {cats.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {cats.map((cat) => (
                    <div
                      key={cat}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/80" : CATEGORY_DOTS[cat] ?? "bg-gray-400"}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-6">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Day {selectedDay.day_number} ·{" "}
            {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(
              "en-US",
              { weekday: "long", month: "long", day: "numeric" }
            )}
          </h3>
          <div className="bg-card rounded-2xl p-4">
            {selectedDay.activities.map((a, i) => (
              <ActivityCard
                key={a.id}
                activity={a}
                isLast={i === selectedDay.activities.length - 1}
              />
            ))}
            {selectedDay.activities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No activities planned for this day.
              </p>
            )}
          </div>
        </div>
      )}

      {!selectedDay && selectedDate && daysByDate.size > 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          No activities on this date.
        </div>
      )}
    </div>
  );
}
