"use client";
import { useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Polyline,
} from "@vis.gl/react-google-maps";
import { X, Clock, MapPin, DollarSign } from "lucide-react";
import type { ItineraryDay, Activity } from "@/types";

const DAY_COLORS = [
  "#2D6A4F", "#1B4332", "#40916C", "#74C69D",
  "#D62828", "#E85D04", "#F77F00", "#7209B7",
];

interface TripMapProps {
  days: Array<ItineraryDay & { activities: Activity[] }>;
  centerLat: number;
  centerLng: number;
}

export function TripMap({ days, centerLat, centerLng }: TripMapProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activeDayFilter, setActiveDayFilter] = useState<number | null>(null);

  const filteredDays = activeDayFilter !== null
    ? days.filter((d) => d.day_number === activeDayFilter)
    : days;

  const geoActivities = filteredDays.flatMap((d) =>
    d.activities
      .filter((a) => a.lat && a.lng && a.category !== "transport")
      .map((a) => ({ ...a, _dayNumber: d.day_number }))
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-2xl">
        <div className="text-center p-6">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-sm">Map not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative w-full h-full">
        <div className="absolute top-3 left-3 right-3 z-10 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveDayFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border transition-colors ${
              activeDayFilter === null
                ? "bg-primary text-white border-primary"
                : "bg-white border-white/80 text-foreground hover:bg-muted"
            }`}
          >
            All days
          </button>
          {days.map((d) => (
            <button
              key={d.day_number}
              onClick={() =>
                setActiveDayFilter(
                  activeDayFilter === d.day_number ? null : d.day_number
                )
              }
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border transition-colors ${
                activeDayFilter === d.day_number
                  ? "text-white border-transparent"
                  : "bg-white border-white/80 text-foreground hover:bg-muted"
              }`}
              style={
                activeDayFilter === d.day_number
                  ? { backgroundColor: DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length] }
                  : {}
              }
            >
              Day {d.day_number}
            </button>
          ))}
        </div>

        <Map
          defaultCenter={{ lat: centerLat, lng: centerLng }}
          defaultZoom={13}
          mapId="trailguide-map"
          disableDefaultUI={false}
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          {filteredDays.map((day) => {
            const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];
            const geoActs = day.activities.filter(
              (a) => a.lat && a.lng && a.category !== "transport"
            );

            return (
              <div key={day.day_number}>
                {geoActs.length > 1 && (
                  <Polyline
                    path={geoActs.map((a) => ({
                      lat: a.lat!,
                      lng: a.lng!,
                    }))}
                    strokeColor={color}
                    strokeWeight={2}
                    strokeOpacity={0.6}
                  />
                )}
                {geoActs.map((activity, idx) => (
                  <AdvancedMarker
                    key={activity.id}
                    position={{ lat: activity.lat!, lng: activity.lng! }}
                    onClick={() => setSelectedActivity(activity)}
                    title={activity.title}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white"
                      style={{ backgroundColor: color }}
                    >
                      {idx + 1}
                    </div>
                  </AdvancedMarker>
                ))}
              </div>
            );
          })}
        </Map>

        {selectedActivity && (
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-5 z-20 max-h-64 overflow-y-auto">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-base">{selectedActivity.title}</h3>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1 rounded-full hover:bg-muted flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {selectedActivity.description && (
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                {selectedActivity.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {selectedActivity.start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {selectedActivity.start_time}
                </span>
              )}
              {selectedActivity.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedActivity.location_name}
                </span>
              )}
              {selectedActivity.estimated_cost != null &&
                selectedActivity.estimated_cost > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />~
                    {selectedActivity.estimated_cost}
                  </span>
                )}
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
