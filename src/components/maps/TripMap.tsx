"use client";
import { useState, useEffect } from "react";
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
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: React.ComponentType<React.ComponentProps<typeof import("react-leaflet")["MapContainer"]>>;
    TileLayer: React.ComponentType<React.ComponentProps<typeof import("react-leaflet")["TileLayer"]>>;
    Polyline: React.ComponentType<React.ComponentProps<typeof import("react-leaflet")["Polyline"]>>;
    Marker: React.ComponentType<React.ComponentProps<typeof import("react-leaflet")["Marker"]>>;
    Popup: React.ComponentType<React.ComponentProps<typeof import("react-leaflet")["Popup"]>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activeDayFilter, setActiveDayFilter] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([import("react-leaflet"), import("leaflet")]).then(
      ([rl, L]) => {
        // Fix default marker icons for Next.js
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.default.Icon.Default.prototype as any)._getIconUrl;
        L.default.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });
        setMapComponents({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Polyline: rl.Polyline,
          Marker: rl.Marker,
          Popup: rl.Popup,
          L: L.default,
        });
      }
    );
  }, []);

  const filteredDays =
    activeDayFilter !== null
      ? days.filter((d) => d.day_number === activeDayFilter)
      : days;

  const geoActivities = filteredDays.flatMap((d) =>
    d.activities.filter((a) => a.lat && a.lng && a.category !== "transport")
  );

  if (!MapComponents) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Polyline, Marker, Popup, L } = MapComponents;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-3 left-3 right-3 z-[1000] flex gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveDayFilter(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-colors ${
            activeDayFilter === null
              ? "bg-primary text-white"
              : "bg-white text-foreground hover:bg-muted"
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
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm bg-white text-foreground hover:bg-muted transition-colors"
            style={
              activeDayFilter === d.day_number
                ? {
                    backgroundColor:
                      DAY_COLORS[(d.day_number - 1) % DAY_COLORS.length],
                    color: "white",
                  }
                : {}
            }
          >
            Day {d.day_number}
          </button>
        ))}
      </div>

      <MapContainer
        center={[centerLat || 48.8566, centerLng || 2.3522]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {filteredDays.map((day) => {
          const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];
          const geoActs = day.activities.filter(
            (a) => a.lat && a.lng && a.category !== "transport"
          );

          const customIcon = (idx: number) =>
            L.divIcon({
              html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${idx + 1}</div>`,
              className: "",
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });

          return (
            <div key={day.day_number}>
              {geoActs.length > 1 && (
                <Polyline
                  positions={geoActs.map((a) => [a.lat!, a.lng!] as [number, number])}
                  pathOptions={{ color, weight: 2, opacity: 0.6 }}
                />
              )}
              {geoActs.map((activity, idx) => (
                <Marker
                  key={activity.id}
                  position={[activity.lat!, activity.lng!]}
                  icon={customIcon(idx)}
                  eventHandlers={{ click: () => setSelectedActivity(activity) }}
                />
              ))}
            </div>
          );
        })}
      </MapContainer>

      {selectedActivity && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-5 z-[1000] max-h-64 overflow-y-auto">
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
  );
}
