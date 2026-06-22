"use client";
import { useState } from "react";
import {
  UtensilsCrossed,
  Landmark,
  Bus,
  Hotel,
  Plane,
  Leaf,
  Clock,
  DollarSign,
  MapPin,
  RefreshCw,
  ExternalLink,
  Check,
} from "lucide-react";
import type { Activity } from "@/types";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { PhotoUpload } from "@/components/photos/PhotoUpload";
import { PhotoThumbnails } from "@/components/photos/PhotoThumbnails";

function ActivityPhoto({ query, title }: { query?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  if (!query || failed) return null;
  const src = `/api/places/photo?query=${encodeURIComponent(query)}&w=400`;
  return (
    <>
      <div
        className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-muted cursor-zoom-in"
        onClick={(e) => { e.stopPropagation(); setPreview(true); }}
      >
        <img
          src={src}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
      {preview && <PhotoLightbox src={src} alt={title} onClose={() => setPreview(false)} />}
    </>
  );
}

function mapsUrl(a: Activity): string {
  if (a.lat && a.lng) return `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  const q = encodeURIComponent([a.location_name, a.address].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const CATEGORY_META = {
  food: { icon: UtensilsCrossed, color: "bg-orange-100 text-orange-600" },
  attraction: { icon: Landmark, color: "bg-blue-100 text-blue-600" },
  transport: { icon: Bus, color: "bg-gray-100 text-gray-600" },
  hotel: { icon: Hotel, color: "bg-purple-100 text-purple-600" },
  flight: { icon: Plane, color: "bg-sky-100 text-sky-600" },
  free: { icon: Leaf, color: "bg-green-100 text-green-600" },
};

interface ActivityCardProps {
  activity: Activity;
  isLast?: boolean;
  onReplace?: () => void;
  onToggleComplete?: (id: string, completed: boolean) => void;
  tripId?: string;
  destination?: string;
}

export function ActivityCard({ activity, isLast, onReplace, onToggleComplete, tripId, destination }: ActivityCardProps) {
  const meta = CATEGORY_META[activity.category] ?? CATEGORY_META.attraction;
  const Icon = meta.icon;
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-2 mb-0 min-h-[1.5rem]" />
        )}
      </div>

      <div className={`flex-1 pb-6 ${activity.is_completed ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm leading-tight">{activity.title}</h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                {activity.start_time && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {activity.start_time}
                  </span>
                )}
                {onToggleComplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleComplete(activity.id, !activity.is_completed); }}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      activity.is_completed
                        ? "bg-primary border-primary text-white"
                        : "border-border text-transparent hover:border-primary/50"
                    }`}
                    title={activity.is_completed ? "Mark incomplete" : "Mark complete"}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
                {onReplace && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReplace(); }}
                    className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="Replace this activity"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {activity.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-2">
                {activity.description}
              </p>
            )}
          </div>
          <ActivityPhoto query={activity.photo_query} title={activity.title} />
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {activity.location_name && (
            <a
              href={mapsUrl(activity)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {activity.location_name}
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
          {activity.estimated_cost != null && activity.estimated_cost > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />~{activity.estimated_cost}
            </span>
          )}
          {activity.duration_minutes && (
            <span>{activity.duration_minutes} min</span>
          )}
        </div>

        {tripId && destination && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <PhotoThumbnails key={photoRefreshKey} activityId={activity.id} />
            <PhotoUpload
              activityId={activity.id}
              tripId={tripId}
              activityTitle={activity.title}
              destination={destination}
              onUploaded={() => setPhotoRefreshKey((k) => k + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
