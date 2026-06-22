"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

interface Photo {
  id: string;
  storage_path: string;
  caption: string | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function photoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/activity-photos/${path}`;
}

export function PhotoThumbnails({
  activityId,
  onCountChange,
}: {
  activityId: string;
  onCountChange?: (n: number) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    fetch(`/api/photos?activityId=${activityId}`)
      .then((r) => r.json())
      .then((d) => {
        setPhotos(d.photos ?? []);
        onCountChange?.(d.photos?.length ?? 0);
      });
  }, [activityId, onCountChange]);

  async function deletePhoto(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
  }

  if (photos.length === 0) return null;

  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {photos.map((p) => (
        <div
          key={p.id}
          className="relative group w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0"
        >
          <img
            src={photoUrl(p.storage_path)}
            alt={p.caption ?? ""}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => deletePhoto(p.id)}
            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {p.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
              {p.caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
