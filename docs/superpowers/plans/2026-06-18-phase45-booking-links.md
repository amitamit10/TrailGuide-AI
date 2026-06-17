# TrailGuide AI — Phase 45: Restaurant & Activity Booking Links

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deep-link booking buttons to activity cards — for restaurants: OpenTable/Resy search links; for attractions and tours: Viator/GetYourGuide/Airbnb Experiences links. These are constructed from the activity title and destination, not live API calls — no new API keys required.

**Architecture:** Pure frontend feature — no backend changes needed. A `BookingLinks` component reads `activity.category`, `activity.title`, `activity.address`, and `trip.destination` and generates pre-filled search URLs for 2-3 relevant booking platforms. Displayed as small chip buttons below the activity description.

**Tech Stack:** Next.js only. URL construction from template strings.

**Prerequisite:** Phase 18 (Next.js frontend with activity cards).

## Global Constraints
- Booking links open in a new tab (`target="_blank" rel="noopener noreferrer"`).
- No API calls, no tracking — pure URL construction.
- Show a maximum of 3 booking chips per activity.
- Only show chips for relevant categories (food → restaurant links; attraction/activities → tour links).
- If the activity has an `address`, use it for more specific search; otherwise use destination.

---

## Task 1: Booking URL builder

- [ ] **Step 1: Create `src/lib/bookingLinks.ts`**

```typescript
export interface BookingLink {
  label: string;
  url: string;
  color: string;
}

function encode(s: string) {
  return encodeURIComponent(s.trim());
}

function restaurantLinks(title: string, destination: string): BookingLink[] {
  const query = `${title} ${destination}`;
  return [
    {
      label: "OpenTable",
      url: `https://www.opentable.com/s?term=${encode(query)}&covers=2`,
      color: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    {
      label: "Yelp",
      url: `https://www.yelp.com/search?find_desc=${encode(title)}&find_loc=${encode(destination)}`,
      color: "bg-red-100 text-red-700 hover:bg-red-200",
    },
    {
      label: "Google",
      url: `https://www.google.com/search?q=${encode(query + " restaurant reservation")}`,
      color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
  ];
}

function tourLinks(title: string, destination: string): BookingLink[] {
  return [
    {
      label: "Viator",
      url: `https://www.viator.com/search?text=${encode(destination + " " + title)}`,
      color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    },
    {
      label: "GetYourGuide",
      url: `https://www.getyourguide.com/s/?q=${encode(destination + " " + title)}&et=3`,
      color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    },
    {
      label: "Airbnb Exp.",
      url: `https://www.airbnb.com/s/experiences?query=${encode(destination)}&refinement_paths%5B%5D=%2Fexperiences`,
      color: "bg-red-100 text-red-700 hover:bg-red-200",
    },
  ];
}

function hotelLinks(destination: string): BookingLink[] {
  return [
    {
      label: "Booking.com",
      url: `https://www.booking.com/search.html?ss=${encode(destination)}`,
      color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
    {
      label: "Hotels.com",
      url: `https://hotels.com/search.do?destination-id=&q-destination=${encode(destination)}`,
      color: "bg-orange-100 text-orange-700 hover:bg-orange-200",
    },
  ];
}

function transportLinks(destination: string): BookingLink[] {
  return [
    {
      label: "Rome2Rio",
      url: `https://www.rome2rio.com/s/${encode(destination)}`,
      color: "bg-green-100 text-green-700 hover:bg-green-200",
    },
    {
      label: "Omio",
      url: `https://www.omio.com/search?destination=${encode(destination)}`,
      color: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    },
  ];
}

export function getBookingLinks(
  category: string,
  title: string,
  destination: string
): BookingLink[] {
  switch (category) {
    case "food":
      return restaurantLinks(title, destination).slice(0, 3);
    case "attraction":
    case "free":
      return tourLinks(title, destination).slice(0, 3);
    case "hotel":
    case "accommodation":
      return hotelLinks(destination).slice(0, 2);
    case "transport":
      return transportLinks(destination).slice(0, 2);
    default:
      return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bookingLinks.ts
git commit -m "feat: add booking URL builder for restaurants, tours, hotels, transport"
```

---

## Task 2: BookingLinks component

- [ ] **Step 1: Create `src/components/activities/BookingLinks.tsx`**

```typescript
import { getBookingLinks } from "@/lib/bookingLinks";

interface Props {
  category: string;
  title: string;
  destination: string;
}

export function BookingLinks({ category, title, destination }: Props) {
  const links = getBookingLinks(category, title, destination);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map(link => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${link.color}`}
          onClick={e => e.stopPropagation()}
        >
          {link.label} ↗
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add `BookingLinks` to activity cards**

In `src/components/timeline/ActivityCard.tsx` (or wherever activity cards are rendered):

```typescript
import { BookingLinks } from "@/components/activities/BookingLinks";

// Inside the card, below the description:
<BookingLinks
  category={activity.category}
  title={activity.title}
  destination={tripDestination}
/>
```

`tripDestination` must be passed down from the parent or stored in React context.

- [ ] **Step 3: Add booking links to activity detail drawer/modal**

In the activity detail view (if there's a drawer or expanded view), also add the full set of 3 links:

```typescript
// In expanded activity view, below the address:
<div className="border-t border-border pt-3 mt-3">
  <p className="text-xs text-on-surface-2 mb-2">Book this</p>
  <BookingLinks category={activity.category} title={activity.title} destination={destination}/>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/activities/ src/components/timeline/
git commit -m "feat: add booking link chips to activity cards (OpenTable, Viator, GetYourGuide, etc.)"
```

---

## Task 3: Smart link detection

- [ ] **Step 1: Improve link relevance based on keywords**

Update `getBookingLinks` to also check the title for category hints:

```typescript
// If category is "free" but title contains "tour" or "museum":
function inferCategory(category: string, title: string): string {
  const lower = title.toLowerCase();
  if (category === "free" && (lower.includes("restaurant") || lower.includes("cafe") || lower.includes("bar"))) {
    return "food";
  }
  if (lower.includes("tour") || lower.includes("cruise") || lower.includes("safari")) {
    return "attraction";
  }
  return category;
}
```

Apply `inferCategory(activity.category, activity.title)` in `BookingLinks`.

- [ ] **Step 2: Verify link construction**

Manual test — log constructed URLs to console for a few activities:
```typescript
// In browser console:
import { getBookingLinks } from "/src/lib/bookingLinks";
console.log(getBookingLinks("food", "Ramen at Ichiran", "Tokyo, Japan"));
// Expected: [ { label: "OpenTable", url: "https://www.opentable.com/s?term=Ramen+at+Ichiran+Tokyo%2C+Japan&covers=2" }, ... ]
```

Manually click each link and verify it opens a relevant search page on the booking site.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bookingLinks.ts
git commit -m "feat: add keyword-based category inference to booking link builder"
```

---

## Verification Checklist

- [ ] Food activities show OpenTable, Yelp, Google links
- [ ] Attraction activities show Viator, GetYourGuide, Airbnb Experiences links
- [ ] Hotel activities show Booking.com, Hotels.com links
- [ ] Transport activities show Rome2Rio, Omio links
- [ ] Links open in new tab without closing the activity card
- [ ] Clicking a link does NOT trigger the card's own click handler
- [ ] Activities with category "free" show tour booking links (not blank)
- [ ] No API keys or server calls — all URL construction is client-side
