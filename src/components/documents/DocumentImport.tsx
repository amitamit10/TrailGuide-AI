"use client";
import { useState, useRef } from "react";
import { Upload, FileText, Image, Check, Loader2, X } from "lucide-react";

interface ExtractedData {
  type?: string;
  flight_number?: string;
  airline?: string;
  departure_airport?: string;
  arrival_airport?: string;
  departure_time?: string;
  arrival_time?: string;
  hotel_name?: string;
  hotel_address?: string;
  check_in?: string;
  check_out?: string;
  confirmation_number?: string;
  notes?: string;
}

interface DocumentImportProps {
  tripId: string;
  onImported: () => void;
}

export function DocumentImport({ tripId, onImported }: DocumentImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function processFile(f: File) {
    setFile(f);
    setExtracted(null);
    setError(null);
    setSaved(false);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", f);
    fd.append("tripId", tripId);

    try {
      const res = await fetch("/api/documents/import", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setExtracted(data.extracted);
      setSaved(true);
      onImported();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  function reset() {
    setFile(null);
    setExtracted(null);
    setError(null);
    setSaved(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const FIELD_LABELS: Record<string, string> = {
    flight_number: "Flight Number",
    airline: "Airline",
    departure_airport: "From",
    arrival_airport: "To",
    departure_time: "Departure",
    arrival_time: "Arrival",
    hotel_name: "Hotel",
    hotel_address: "Address",
    check_in: "Check-in",
    check_out: "Check-out",
    confirmation_number: "Confirmation #",
    notes: "Notes",
  };

  return (
    <div className="space-y-4">
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-sm">
            Drop your booking documents here
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports PDF, JPG, PNG — flight confirmations, hotel bookings, Airbnb reservations
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3 bg-card rounded-2xl px-4 py-3">
          {file.type.startsWith("image/") ? (
            <Image className="w-5 h-5 text-primary flex-shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
          )}
          <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
          {uploading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          ) : (
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {uploading && (
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Extracting booking details with AI...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {extracted && !uploading && (
        <div className="bg-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Details Extracted</p>
              <p className="text-xs text-muted-foreground capitalize">
                {extracted.type ?? "Document"} · Saved to trip
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(FIELD_LABELS).map(([key, label]) => {
              const val = extracted[key as keyof ExtractedData];
              if (!val) return null;
              return (
                <div key={key} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground w-32 flex-shrink-0">
                    {label}
                  </span>
                  <span className="font-medium">{String(val)}</span>
                </div>
              );
            })}
          </div>

          {saved && (
            <button
              onClick={reset}
              className="mt-4 text-sm text-primary font-medium hover:underline"
            >
              Import another document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
