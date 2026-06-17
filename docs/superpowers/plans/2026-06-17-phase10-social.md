# Phase 10 — Social & Trip Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users share trips publicly, browse a community library of itineraries, clone any public trip into their own account, and build a post-trip memory with a photo mosaic and shareable story card.

**Architecture:** New `is_public` boolean on `trips` table. The existing `/share/[tripId]` page becomes the full public view — extend it with clone and template browsing. A new `/explore` page lists all public trips ordered by destination popularity. "Clone trip" duplicates the DB rows into the viewer's account via `/api/trips/clone`. Post-trip memories extend the Summary tab with a photo mosaic built from activity `photo_query` images.

**Tech Stack:** Supabase (RLS policy update for public trips, `is_public` column) · Next.js (existing public share route, new `/explore` route) · `createServiceClient()` (existing, for reading public trips without auth) · html2canvas (existing, for memory card download)

## Global Constraints

- `nvm` required: prefix all `npm` commands with `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" &&`
- Public trips are read-only for non-owners — all writes go through authenticated routes
- The `/explore` page is public (no auth required) — use `createServiceClient()` for DB reads
- Clone route at `POST /api/trips/clone` must authenticate and create NEW DB rows — never mutate the original
- Never commit `.env.local`
- Do not add new npm dependencies for this phase — use what's already installed

---

### Task 1: Make trips publicly shareable — DB + API

**Files:**
- Create: `supabase/migrations/005_public_trips.sql`
- Create: `src/app/api/trips/visibility/route.ts`

**Interfaces:**
- Produces: `trips.is_public boolean default false`, RLS policy allowing anyone to SELECT public trips
- `PATCH /api/trips/visibility` body: `{ tripId, isPublic }` → `{ ok: true }`

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/005_public_trips.sql`:

  ```sql
  alter table trips add column if not exists is_public boolean not null default false;

  -- Allow anyone (including anon) to read public trips
  drop policy if exists "Anyone can view public trips" on trips;
  create policy "Anyone can view public trips" on trips
    for select using (is_public = true);

  -- Allow anyone to read days and activities for public trips
  drop policy if exists "Anyone can view public trip days" on itinerary_days;
  create policy "Anyone can view public trip days" on itinerary_days
    for select using (
      exists (select 1 from trips where trips.id = trip_id and trips.is_public = true)
    );

  drop policy if exists "Anyone can view public activities" on activities;
  create policy "Anyone can view public activities" on activities
    for select using (
      exists (
        select 1 from itinerary_days
        join trips on trips.id = itinerary_days.trip_id
        where itinerary_days.id = day_id and trips.is_public = true
      )
    );
  ```

- [ ] **Step 2: Run in Supabase SQL editor**

  Go to https://supabase.com/dashboard/project/nlqxnaktnvfomrcjlxmo/sql — paste and run.

  Expected: `ALTER TABLE`, three `CREATE POLICY` statements.

- [ ] **Step 3: Create the visibility toggle route**

  Create `src/app/api/trips/visibility/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";

  export async function PATCH(req: NextRequest) {
    const { tripId, isPublic } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("trips")
      .update({ is_public: isPublic })
      .eq("id", tripId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/005_public_trips.sql src/app/api/trips/visibility/
  git commit -m "feat: public trip sharing — is_public column and RLS policies"
  ```

---

### Task 2: Share toggle in Summary tab

**Files:**
- Modify: `src/components/summary/SummaryClient.tsx`
- Modify: `src/app/(app)/trips/[id]/summary/page.tsx` — pass `isPublic` prop

**Interfaces:**
- Consumes: `trips.is_public` from DB (new column), `PATCH /api/trips/visibility`
- Produces: toggle switch in Summary header; when ON, share URL becomes a real public link

- [ ] **Step 1: Pass isPublic from page to client**

  In `src/app/(app)/trips/[id]/summary/page.tsx`, update the trip select:

  ```typescript
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date, status, travelers_count, budget_currency, is_public")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  ```

  Update the `<SummaryClient>` call:
  ```typescript
  <SummaryClient
    trip={trip}
    activities={enriched}
    stats={{ totalCost, completedCount, daysCount, totalCount: enriched.length }}
  />
  ```

- [ ] **Step 2: Add toggle to SummaryClient**

  In `src/components/summary/SummaryClient.tsx`, update the `Trip` interface:

  ```typescript
  interface Trip {
    id: string; title: string; destination: string; start_date: string; end_date: string;
    status: string; travelers_count: number; budget_currency: string; is_public: boolean;
  }
  ```

  Add state and toggle handler:

  ```typescript
  const [isPublic, setIsPublic] = useState(trip.is_public);

  async function togglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    await fetch("/api/trips/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId: trip.id, isPublic: next }),
    });
  }
  ```

  Replace the Share button with a two-state button:

  ```typescript
  <button
    onClick={isPublic ? handleShare : togglePublic}
    className="flex-1 h-11 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
  >
    <Share2 className="w-4 h-4" />
    {copied ? "Link copied!" : isPublic ? "Copy share link" : "Make public & share"}
  </button>
  ```

  When not public, the first click makes it public. When already public, clicking copies the link as before.

  Add a "Public" badge near the header when `isPublic` is true:
  ```typescript
  {isPublic && (
    <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      Public — anyone with the link can view this trip
      <button onClick={togglePublic} className="ml-auto text-muted-foreground hover:text-foreground">Make private</button>
    </div>
  )}
  ```

- [ ] **Step 3: Test**

  Open Summary tab. Tap "Make public & share" — badge appears and link is copied. Open link in incognito — trip loads without login. Tap "Make private" — badge disappears. Open link in incognito — should show 404.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/summary/SummaryClient.tsx src/app/(app)/trips/[id]/summary/page.tsx
  git commit -m "feat: public/private toggle for trip sharing"
  ```

---

### Task 3: Clone-a-trip API

**Files:**
- Create: `src/app/api/trips/clone/route.ts`

**Interfaces:**
- `POST /api/trips/clone` body: `{ sourceTripId }` → `{ newTripId: string }`
- Copies trip + itinerary_days + activities into the authenticated user's account
- The clone is private by default (`is_public: false`)

- [ ] **Step 1: Create the clone route**

  Create `src/app/api/trips/clone/route.ts`:

  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";
  import { createServiceClient } from "@/lib/supabase/server";

  export async function POST(req: NextRequest) {
    const { sourceTripId } = await req.json();
    const supabase = await createClient();
    const serviceSupabase = createServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Read source trip (service role so public trips are readable regardless of RLS state)
    const { data: source } = await serviceSupabase
      .from("trips")
      .select("*, itinerary_days(*, activities(*))")
      .eq("id", sourceTripId)
      .eq("is_public", true)
      .single();

    if (!source) return NextResponse.json({ error: "Trip not found or not public" }, { status: 404 });

    // Create new trip for this user
    const { data: newTrip, error: tripErr } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        title: `${source.title} (copy)`,
        destination: source.destination,
        destination_lat: source.destination_lat,
        destination_lng: source.destination_lng,
        departure_city: source.departure_city,
        start_date: source.start_date,
        end_date: source.end_date,
        travelers_count: source.travelers_count,
        traveler_ages: source.traveler_ages,
        budget_total: source.budget_total,
        budget_currency: source.budget_currency,
        travel_style: source.travel_style,
        interests: source.interests,
        transport_mode: source.transport_mode,
        max_walk_minutes: source.max_walk_minutes,
        break_minutes: source.break_minutes,
        status: "planning",
        is_public: false,
      })
      .select()
      .single();

    if (tripErr || !newTrip) return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });

    // Clone days + activities
    for (const day of source.itinerary_days ?? []) {
      const { data: newDay } = await supabase
        .from("itinerary_days")
        .insert({ trip_id: newTrip.id, day_number: day.day_number, date: day.date, notes: day.notes })
        .select().single();

      if (!newDay) continue;

      if (day.activities?.length) {
        await supabase.from("activities").insert(
          day.activities.map((a: Record<string, unknown>) => ({
            trip_id: newTrip.id,
            day_id: newDay.id,
            title: a.title,
            description: a.description,
            category: a.category,
            location_name: a.location_name,
            address: a.address,
            lat: a.lat,
            lng: a.lng,
            start_time: a.start_time,
            end_time: a.end_time,
            duration_minutes: a.duration_minutes,
            estimated_cost: a.estimated_cost,
            photo_query: a.photo_query,
            sort_order: a.sort_order,
            is_completed: false,
          }))
        );
      }
    }

    return NextResponse.json({ newTripId: newTrip.id });
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/api/trips/clone/
  git commit -m "feat: clone-a-trip API — copy public trip into user account"
  ```

---

### Task 4: /explore — public trip discovery page

**Files:**
- Create: `src/app/explore/page.tsx`
- Create: `src/components/explore/ExploreClient.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx` — add Explore link in header

**Interfaces:**
- Consumes: `createServiceClient()`, `POST /api/trips/clone`, `/share/[tripId]`
- Produces: `/explore` public page listing community itineraries with Clone button

- [ ] **Step 1: Create the explore page (server component)**

  Create `src/app/explore/page.tsx`:

  ```typescript
  import { createServiceClient } from "@/lib/supabase/server";
  import { ExploreClient } from "@/components/explore/ExploreClient";

  export default async function ExplorePage() {
    const supabase = createServiceClient();

    const { data: trips } = await supabase
      .from("trips")
      .select("id, title, destination, start_date, end_date, travelers_count, travel_style, interests")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50);

    return <ExploreClient trips={trips ?? []} />;
  }
  ```

- [ ] **Step 2: Create ExploreClient**

  Create `src/components/explore/ExploreClient.tsx`:

  ```typescript
  "use client";
  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import { MapPin, Calendar, Users, Compass, Loader2, Copy } from "lucide-react";
  import Link from "next/link";

  interface PublicTrip {
    id: string; title: string; destination: string; start_date: string;
    end_date: string; travelers_count: number; travel_style: string; interests: string[];
  }

  export function ExploreClient({ trips }: { trips: PublicTrip[] }) {
    const router = useRouter();
    const [cloning, setCloning] = useState<string | null>(null);

    async function handleClone(tripId: string) {
      setCloning(tripId);
      try {
        const res = await fetch("/api/trips/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceTripId: tripId }),
        });
        if (res.status === 401) { router.push("/login"); return; }
        const { newTripId } = await res.json();
        router.push(`/trips/${newTripId}/timeline`);
      } finally {
        setCloning(null);
      }
    }

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-white border-b border-border px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <Compass className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-base">Explore Trips</h1>
          <Link href="/dashboard" className="ml-auto text-sm text-muted-foreground hover:text-foreground">My trips</Link>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6">
          <p className="text-sm text-muted-foreground mb-4">{trips.length} community itineraries</p>

          <div className="flex flex-col gap-3">
            {trips.map((trip) => {
              const nights = Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000);
              return (
                <div key={trip.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-tight">{trip.title}</h3>
                      <div className="flex items-center gap-1 text-muted-foreground text-sm mt-0.5">
                        <MapPin className="w-3 h-3" />{trip.destination}
                      </div>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize flex-shrink-0">
                      {trip.travel_style}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{nights} nights</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{trip.travelers_count} traveler{trip.travelers_count !== 1 ? "s" : ""}</span>
                  </div>

                  {trip.interests?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {trip.interests.slice(0, 4).map((i) => (
                        <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full capitalize">{i}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      href={`/share/${trip.id}`}
                      className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      View itinerary
                    </Link>
                    <button
                      onClick={() => handleClone(trip.id)}
                      disabled={cloning === trip.id}
                      className="flex-1 h-9 rounded-xl bg-primary text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {cloning === trip.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><Copy className="w-3.5 h-3.5" /> Clone trip</>}
                    </button>
                  </div>
                </div>
              );
            })}

            {trips.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No public trips yet. Share yours from the Summary tab!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Add Explore link to dashboard header**

  In `src/app/(app)/dashboard/page.tsx`, find the header section and add a Compass link:

  ```typescript
  import { Compass } from "lucide-react";
  // In the header, next to the Settings gear icon:
  <Link href="/explore" className="text-muted-foreground hover:text-foreground">
    <Compass className="w-5 h-5" />
  </Link>
  ```

- [ ] **Step 4: Test**

  Make one of your trips public via Summary tab. Open `/explore` in incognito — card appears. Log in and click Clone — redirects to the cloned trip's timeline.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/explore/ src/components/explore/ src/app/(app)/dashboard/page.tsx
  git commit -m "feat: explore page — browse and clone public community trips"
  ```

---

### Task 5: Post-trip memory card in Summary

**Files:**
- Modify: `src/components/summary/SummaryClient.tsx` — add photo mosaic above the story

**Interfaces:**
- Consumes: `activities[].photo_query` (already available in SummaryClient props)
- Produces: 2×N grid of activity photos shown at the top of the shareable card — visible in the PNG download

- [ ] **Step 1: Add PhotoMosaic component inside SummaryClient**

  In `src/components/summary/SummaryClient.tsx`, add the following component before `SummaryClient`:

  ```typescript
  function PhotoMosaic({ activities }: { activities: Activity[] }) {
    const withPhotos = activities.filter((a) => a.photo_query).slice(0, 6);
    if (withPhotos.length < 2) return null;
    return (
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
        {withPhotos.map((a) => (
          <div key={a.id} className="aspect-square bg-muted overflow-hidden">
            <img
              src={`/api/places/photo?query=${encodeURIComponent(a.photo_query!)}&w=300`}
              alt={a.title}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 2: Insert mosaic into the shareable card**

  In the `<div ref={cardRef}>` section, add the mosaic between the header and the stats grid:

  ```typescript
  {/* Header */}
  <div className="bg-primary rounded-2xl px-6 py-8 text-white"> ... </div>

  {/* Photo mosaic */}
  <PhotoMosaic activities={activities} />

  {/* Stats */}
  <div className="grid grid-cols-2 gap-3"> ... </div>
  ```

- [ ] **Step 3: Test**

  Open Summary on a trip that has activities with photos. Expected: 2–6 photos appear in a grid between the header and stats cards. Click "Save image" — PNG includes the photo mosaic.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/summary/SummaryClient.tsx
  git commit -m "feat: photo mosaic in trip summary memory card"
  ```
