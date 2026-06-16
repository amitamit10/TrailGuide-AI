"use client";
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
} from "lucide-react";
import type { Activity } from "@/types";

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
}

export function ActivityCard({ activity, isLast }: ActivityCardProps) {
  const meta = CATEGORY_META[activity.category] ?? CATEGORY_META.attraction;
  const Icon = meta.icon;

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

      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm leading-tight">{activity.title}</h4>
          {activity.start_time && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {activity.start_time}
            </span>
          )}
        </div>

        {activity.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {activity.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {activity.location_name && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {activity.location_name}
            </span>
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
      </div>
    </div>
  );
}
