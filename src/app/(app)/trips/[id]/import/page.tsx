"use client";
import { useParams, useRouter } from "next/navigation";
import { DocumentImport } from "@/components/documents/DocumentImport";
import { FileText } from "lucide-react";

export default function ImportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">Import Documents</h2>
          <p className="text-xs text-muted-foreground">
            Flight confirmations, hotel bookings, Airbnb reservations
          </p>
        </div>
      </div>

      <DocumentImport
        tripId={params.id}
        onImported={() => router.refresh()}
      />

      <div className="mt-8 p-4 bg-card rounded-2xl">
        <p className="text-xs text-muted-foreground font-medium mb-2">
          Supported formats
        </p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>✓ PDF booking confirmations</li>
          <li>✓ Screenshots (JPG, PNG)</li>
          <li>✓ Flight e-tickets</li>
          <li>✓ Hotel / Airbnb reservations</li>
        </ul>
      </div>
    </div>
  );
}
