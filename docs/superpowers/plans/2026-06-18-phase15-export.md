# TrailGuide AI — Phase 15: Trip Export & Calendar Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users export their trip itinerary as an `.ics` calendar file (works with Google Calendar, Apple Calendar, Outlook), add individual activities to Google Calendar via deep-link, and download the full itinerary as a formatted PDF.

**Architecture:** Three independent export mechanisms — (1) a server-side iCal API route using `ical-generator` that returns a downloadable `.ics` file, (2) client-side Google Calendar URL construction (no OAuth, just a deep-link that opens Google Calendar pre-filled), and (3) client-side PDF generation using `jsPDF` that renders the full itinerary as structured text. A shared `ExportMenu` dropdown component sits in the Summary tab; per-activity calendar buttons live in the Timeline activity card.

**Tech Stack:** `ical-generator` v8 (server-side), `jspdf` v3 (client-side), existing `html2canvas` (already installed). No new auth flows.

## Global Constraints

- iCal export is a server route — it reads from Supabase with `createClient()` (auth required).
- Google Calendar deep-links need no API key, no OAuth. They open in a new tab.
- PDF generation is entirely client-side (no server-side rendering). Use dynamic `import()` so jsPDF is not bundled into the initial page load.
- Activity `time` field is a string like `"09:00"`. Duration is a string like `"2 hours"`. Parse both for calendar date math.
- Do NOT add individual activity "Add to Calendar" buttons in Phase 15 — that clutters the card. Instead, add one "Export all to Google Calendar" option in the ExportMenu. If the user wants individual events, the .ics export covers that.

---

## File Map

```
src/
├── lib/
│   └── calendar.ts                        CREATE — Google Calendar URL builder + duration parser
├── app/
│   └── api/
│       └── trips/
│           └── [id]/
│               └── export/
│                   └── ical/
│                       └── route.ts        CREATE — returns .ics file
└── components/
    └── trip/
        └── ExportMenu.tsx                  CREATE — dropdown with 3 export options

src/components/summary/SummaryClient.tsx    MODIFY — add ExportMenu
```

---

## Task 1: Install `ical-generator` and `jspdf`

**Files:** none created — just package installs.

- [ ] **Step 1: Install packages**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm install ical-generator jspdf
```

Expected: packages added, no peer dep errors.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install ical-generator and jspdf for trip export"
```

---

## Task 2: Create the calendar utility library

**Files:**
- Create: `src/lib/calendar.ts`

**Interfaces:**
- Produces:
  - `parseDurationMinutes(duration: string): number` — e.g. `"2 hours"` → `120`, `"90 minutes"` → `90`
  - `buildActivityDateRange(date: string, time: string, durationMinutes: number): { start: Date; end: Date }` — parses `"2026-08-01"` + `"09:00"` + 120 → two Date objects
  - `googleCalendarUrl(title: string, description: string, location: string, start: Date, end: Date): string` — returns a pre-filled Google Calendar add-event URL

- [ ] **Step 1: Create `src/lib/calendar.ts`**

```typescript
export function parseDurationMinutes(duration: string): number {
  const hoursMatch = duration.match(/(\d+(?:\.\d+)?)\s*hour/i);
  const minutesMatch = duration.match(/(\d+)\s*min/i);
  let total = 0;
  if (hoursMatch) total += parseFloat(hoursMatch[1]) * 60;
  if (minutesMatch) total += parseInt(minutesMatch[1], 10);
  return total > 0 ? total : 60; // default 1 hour if unparseable
}

export function buildActivityDateRange(
  date: string,
  time: string,
  durationMinutes: number
): { start: Date; end: Date } {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return { start, end };
}

function formatGCalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function googleCalendarUrl(
  title: string,
  description: string,
  location: string,
  start: Date,
  end: Date
): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
    details: description ?? "",
    location: location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
```

- [ ] **Step 2: Manual test in browser console**

Start `npm run dev`. Open DevTools console and paste:
```javascript
import('/lib/calendar').then(m => {
  console.log(m.parseDurationMinutes("2 hours"));       // expect 120
  console.log(m.parseDurationMinutes("90 minutes"));    // expect 90
  console.log(m.parseDurationMinutes("1.5 hours"));     // expect 90
  console.log(m.parseDurationMinutes("unknown"));       // expect 60
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendar.ts
git commit -m "feat: add calendar utility (duration parser, Google Calendar URL builder)"
```

---

## Task 3: Create the iCal export API route

**Files:**
- Create: `src/app/api/trips/[id]/export/ical/route.ts`

**Interfaces:**
- Consumes: `parseDurationMinutes`, `buildActivityDateRange` from `@/lib/calendar`
- Route: `GET /api/trips/[id]/export/ical` — requires auth, returns `text/calendar` file

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDurationMinutes, buildActivityDateRange } from "@/lib/calendar";
import ical from "ical-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .single();

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: days } = await supabase
    .from("days")
    .select("*, activities(*)")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  const calendar = ical({ name: trip.title });

  for (const day of days ?? []) {
    for (const activity of (day.activities ?? [])) {
      if (!activity.time) continue;
      const durationMins = parseDurationMinutes(activity.duration ?? "1 hour");
      const { start, end } = buildActivityDateRange(day.date, activity.time, durationMins);
      calendar.createEvent({
        start,
        end,
        summary: activity.title,
        description: activity.description ?? "",
        location: activity.address ?? "",
      });
    }
  }

  const icsContent = calendar.toString();
  const filename = `${trip.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Manual test**

With `npm run dev` running and logged in, open:
```
http://localhost:3000/api/trips/<a-real-trip-id>/export/ical
```

Expected: browser downloads a `.ics` file. Open it with Calendar.app or import to Google Calendar — confirm activities appear on the correct dates.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trips/
git commit -m "feat: add iCal export API route (GET /api/trips/[id]/export/ical)"
```

---

## Task 4: Create the ExportMenu component and wire it into Summary

**Files:**
- Create: `src/components/trip/ExportMenu.tsx`
- Modify: `src/components/summary/SummaryClient.tsx`

**Interfaces:**
- Consumes: `googleCalendarUrl`, `parseDurationMinutes`, `buildActivityDateRange` from `@/lib/calendar`
- Props: `ExportMenu({ tripId, tripTitle, days })`
  - `days: Array<{ date: string; activities: Array<{ title: string; description?: string; address?: string; time?: string; duration?: string }> }>`

- [ ] **Step 1: Create `src/components/trip/ExportMenu.tsx`**

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Calendar, FileText, ChevronDown } from "lucide-react";
import { googleCalendarUrl, parseDurationMinutes, buildActivityDateRange } from "@/lib/calendar";

interface Activity {
  title: string;
  description?: string;
  address?: string;
  time?: string;
  duration?: string;
}

interface Day {
  date: string;
  activities: Activity[];
}

interface Props {
  tripId: string;
  tripTitle: string;
  days: Day[];
}

export function ExportMenu({ tripId, tripTitle, days }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function downloadIcal() {
    window.open(`/api/trips/${tripId}/export/ical`, "_blank");
    setOpen(false);
  }

  function openGoogleCalendar() {
    const allActivities: { activity: Activity; date: string }[] = [];
    for (const day of days) {
      for (const activity of day.activities) {
        if (activity.time) allActivities.push({ activity, date: day.date });
      }
    }
    if (allActivities.length === 0) return;
    // Open the first event — user must repeat for others (Google Calendar limitation: one event per URL)
    const first = allActivities[0];
    const mins = parseDurationMinutes(first.activity.duration ?? "1 hour");
    const { start, end } = buildActivityDateRange(first.date, first.activity.time!, mins);
    const url = googleCalendarUrl(
      first.activity.title,
      first.activity.description ?? "",
      first.activity.address ?? "",
      start,
      end
    );
    window.open(url, "_blank");
    setOpen(false);
  }

  async function downloadPdf() {
    setPdfLoading(true);
    setOpen(false);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      function checkPage(needed = 10) {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
      }

      // Title
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(tripTitle, margin, y);
      y += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated by TrailGuide AI`, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 10;

      for (const day of days) {
        checkPage(16);
        // Day header
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric",
        });
        doc.text(dayLabel, margin, y);
        y += 2;
        doc.setDrawColor(45, 106, 79);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + maxWidth, y);
        y += 6;

        for (const activity of day.activities) {
          checkPage(20);
          // Time + title
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          const timeLabel = activity.time ? `${activity.time}  ` : "";
          doc.text(`${timeLabel}${activity.title}`, margin, y);
          y += 5;

          if (activity.address) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100, 100, 100);
            doc.text(activity.address, margin + 3, y);
            doc.setTextColor(0, 0, 0);
            y += 4;
          }

          if (activity.description) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            const lines = doc.splitTextToSize(activity.description, maxWidth - 3);
            for (const line of lines) {
              checkPage(5);
              doc.text(line, margin + 3, y);
              y += 4;
            }
          }
          y += 3;
        }
        y += 4;
      }

      doc.save(`${tripTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-itinerary.pdf`);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden animate-fade-in">
          <button
            onClick={downloadIcal}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-left"
          >
            <Calendar className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium">Calendar (.ics)</div>
              <div className="text-xs text-muted-foreground">Works with all calendar apps</div>
            </div>
          </button>
          <button
            onClick={openGoogleCalendar}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-left border-t border-border"
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            <div>
              <div className="font-medium">Google Calendar</div>
              <div className="text-xs text-muted-foreground">Opens first activity in browser</div>
            </div>
          </button>
          <button
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-left border-t border-border disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-orange-500" />
            <div>
              <div className="font-medium">{pdfLoading ? "Generating…" : "PDF Itinerary"}</div>
              <div className="text-xs text-muted-foreground">Full printable schedule</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `ExportMenu` to `src/components/summary/SummaryClient.tsx`**

Import at the top of the file:
```typescript
import { ExportMenu } from "@/components/trip/ExportMenu";
```

In the component, pass `days` from the existing `trip.days` data (already fetched). Find the header section of `SummaryClient` (where the trip title and Share / Save Image buttons are) and add the `ExportMenu` alongside the existing buttons:

```typescript
<ExportMenu
  tripId={trip.id}
  tripTitle={trip.title}
  days={days.map(d => ({
    date: d.date,
    activities: d.activities.map(a => ({
      title: a.title,
      description: a.description,
      address: a.address,
      time: a.time,
      duration: a.duration,
    })),
  }))}
/>
```

- [ ] **Step 3: Manual test — iCal export**

Navigate to a trip → Summary tab. Click Export → "Calendar (.ics)". A file download should start. Open the `.ics` file in Calendar.app or import to Google Calendar — confirm events appear on the correct dates and times.

- [ ] **Step 4: Manual test — Google Calendar deep-link**

Click Export → "Google Calendar". A new tab opens Google Calendar pre-filled with the first activity title, date, time, and location. Confirm the data is correct.

- [ ] **Step 5: Manual test — PDF download**

Click Export → "PDF Itinerary". After a moment, a PDF downloads. Open it — confirm it shows the trip title, each day header, and all activities with times, addresses, and descriptions.

- [ ] **Step 6: Commit**

```bash
git add src/components/trip/ExportMenu.tsx src/components/summary/SummaryClient.tsx
git commit -m "feat: add ExportMenu with iCal, Google Calendar, and PDF export options"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `GET /api/trips/<id>/export/ical` returns a valid `.ics` file when logged in
- [ ] `GET /api/trips/<id>/export/ical` returns 401 when not logged in
- [ ] `.ics` file imports correctly into Google Calendar, Apple Calendar, and Outlook
- [ ] Google Calendar deep-link opens a pre-filled event in a new tab with correct title, date, time, and location
- [ ] PDF download generates a multi-page document with all days and activities
- [ ] PDF includes activity times, addresses, and descriptions
- [ ] ExportMenu dropdown closes when clicking outside it
- [ ] `npm run build` succeeds (jsPDF is dynamically imported — no bundle size regression)
- [ ] Normal Summary page (Share, Save Image buttons) still works alongside ExportMenu
