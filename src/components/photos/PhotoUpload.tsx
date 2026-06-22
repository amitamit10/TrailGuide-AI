"use client";
import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

interface Props {
  activityId: string;
  tripId: string;
  activityTitle: string;
  destination: string;
  onUploaded: () => void;
}

export function PhotoUpload({
  activityId,
  tripId,
  activityTitle,
  destination,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Max 10 MB per photo");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type)) {
      alert("JPEG, PNG, WebP, or HEIC only");
      return;
    }
    setUploading(true);
    try {
      // Get signed upload URL
      const { signedUrl, path } = await fetch("/api/photos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId,
          tripId,
          fileName: file.name,
          contentType: file.type,
        }),
      }).then((r) => r.json());

      // Upload directly to Supabase Storage via signed URL
      await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // Generate AI caption
      const { caption } = await fetch("/api/ai/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityTitle, destination }),
      }).then((r) => r.json());

      // Save metadata
      await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, tripId, storagePath: path, caption }),
      });

      onUploaded();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
        title="Add photo"
      >
        {uploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Camera className="w-3 h-3" />
        )}
      </button>
    </>
  );
}
