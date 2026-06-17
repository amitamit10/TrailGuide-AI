"use client";
import { useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Navigation, Loader2 } from "lucide-react";

export default function NavigatePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dest = searchParams.get("dest") ?? "";
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  useEffect(() => {
    // Build Google Maps directions URL
    let url: string;
    if (lat && lng) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    } else if (dest) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`;
    } else {
      router.back();
      return;
    }

    window.location.href = url;
  }, [dest, lat, lng, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Navigation className="w-7 h-7 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Opening Google Maps…</p>
        {dest && <p className="text-sm text-muted-foreground mt-1">{dest}</p>}
      </div>
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  );
}
