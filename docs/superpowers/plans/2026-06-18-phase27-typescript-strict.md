# TrailGuide AI — Phase 27: TypeScript Strict Mode + API Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable TypeScript `strict: true`, generate typed API response interfaces from Go model structs, add Zod runtime validation on all API calls in `api.ts`, and eliminate every `any` type in the frontend.

**Architecture:** A new `src/types/api.ts` file mirrors the Go `models.go` structs exactly — same field names, same types. `src/lib/api.ts` is updated to be fully generic with the response type passed at the call site. Zod schemas validate every API response shape at runtime so frontend bugs surface immediately rather than as mysterious undefined errors. `tsconfig.json` gets `strict: true` — fix all resulting type errors.

**Tech Stack:** TypeScript 5, Zod 3.

**Prerequisite:** Phase 18 complete (Next.js is pure frontend, api.ts in place).

## Global Constraints
- Enable `strict: true` in `tsconfig.json` only — do not add `noUncheckedIndexedAccess` yet (too noisy for a single phase).
- All `any` types removed — use `unknown` where truly dynamic, then narrow with Zod.
- `src/types/api.ts` is the single source of truth for domain types — no duplicate interface declarations elsewhere.
- Zod parse errors should log to console in dev and be swallowed silently in prod (not crash the app).

---

## Task 1: Enable strict mode and fix resulting errors

- [ ] **Step 1: Update `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

- [ ] **Step 2: Run type check and count errors**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

- [ ] **Step 3: Fix all type errors**

Common patterns to fix:

**Implicit any parameters:**
```typescript
// Before:
array.forEach((item) => { ... })
// After:
array.forEach((item: Trip) => { ... })
```

**Possibly undefined:**
```typescript
// Before:
const name = user.user_metadata.full_name
// After:
const name = user.user_metadata?.full_name ?? ""
```

**Missing return type on async functions:**
```typescript
// Before:
async function fetchTrips() { ... }
// After:
async function fetchTrips(): Promise<Trip[]> { ... }
```

- [ ] **Step 4: Verify zero errors**

```bash
npx tsc --noEmit
# Exit code 0, no output
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json src/
git commit -m "feat: enable TypeScript strict mode and fix all resulting type errors"
```

---

## Task 2: Create `src/types/api.ts` — domain types mirroring Go models

- [ ] **Step 1: Create `src/types/api.ts`**

```typescript
// Mirrors backend/internal/models/models.go exactly.
// When Go models change, update this file.

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  telegram_chat_id: string | null;
  is_admin: boolean;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  start_date: string;   // "YYYY-MM-DD"
  end_date: string;
  travelers: number;
  trip_style: string;
  interests: string[];
  transport_mode: string;
  flight_info: string;
  hotel_info: string;
  budget: string;
  currency: string;
  is_public: boolean;
  created_at: string;   // ISO8601
}

export interface Day {
  id: string;
  trip_id: string;
  date: string;
  day_number: number;
  activities: Activity[];
}

export interface Activity {
  id: string;
  day_id: string;
  trip_id: string;
  title: string;
  description: string;
  time: string;
  duration: string;
  cost: number;
  category: "food" | "attraction" | "transport" | "hotel" | "free";
  address: string;
  photo_url: string;
  photo_query: string;
  is_completed: boolean;
  sort_order: number;
}

export interface TripMember {
  user_id: string;
  full_name: string;
  avatar_url: string;
  role: "owner" | "editor" | "viewer";
  accepted_at: string | null;
}

export interface ActivityPhoto {
  id: string;
  public_url: string;
  caption: string;
  created_at: string;
}

export interface FlightAlert {
  id: string;
  flight_number: string;
  flight_date: string;
  airline_name: string;
  departure_airport: string;
  arrival_airport: string;
  status: "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted";
  terminal: string | null;
  gate: string | null;
  delay_minutes: number;
  scheduled_departure: string | null;
  estimated_arrival: string | null;
}

// API response wrappers
export type ApiResponse<T> = { data: T };
export type ApiError = { error: string };
```

- [ ] **Step 2: Replace all duplicate type definitions with imports from `@/types/api`**

Search for duplicate definitions:
```bash
grep -rn "interface Trip\|interface Activity\|interface Day\|interface Profile" src/ \
  --include="*.ts" --include="*.tsx" | grep -v "types/api.ts"
```

For each result, delete the local definition and add:
```typescript
import type { Trip, Activity, Day } from "@/types/api";
```

- [ ] **Step 3: Commit**

```bash
git add src/types/api.ts src/
git commit -m "feat: add canonical API types mirroring Go models, remove duplicates"
```

---

## Task 3: Add Zod validation to `api.ts`

- [ ] **Step 1: Install Zod**

```bash
export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && npm install zod
```

- [ ] **Step 2: Create `src/lib/schemas.ts`**

```typescript
import { z } from "zod";

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  day_id: z.string().uuid(),
  trip_id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  time: z.string(),
  duration: z.string(),
  cost: z.number(),
  category: z.enum(["food", "attraction", "transport", "hotel", "free"]),
  address: z.string(),
  photo_url: z.string(),
  photo_query: z.string(),
  is_completed: z.boolean(),
  sort_order: z.number().int(),
});

export const DaySchema = z.object({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
  date: z.string(),
  day_number: z.number().int(),
  activities: z.array(ActivitySchema),
});

export const TripSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  destination: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  travelers: z.number().int(),
  trip_style: z.string(),
  interests: z.array(z.string()),
  transport_mode: z.string(),
  budget: z.string(),
  currency: z.string(),
  is_public: z.boolean(),
  created_at: z.string(),
  // optional fields
  flight_info: z.string().optional().default(""),
  hotel_info: z.string().optional().default(""),
});

export type TripFromSchema = z.infer<typeof TripSchema>;
export type DayFromSchema = z.infer<typeof DaySchema>;
export type ActivityFromSchema = z.infer<typeof ActivitySchema>;
```

- [ ] **Step 3: Update `src/lib/api.ts` to optionally validate with Zod**

```typescript
import { z } from "zod";

// Validated get — parses with schema, logs on mismatch in dev
export async function safeGet<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<T> {
  const raw = await api.get<unknown>(path);
  const result = schema.safeParse(raw);
  if (!result.success) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[api] Schema mismatch for ${path}:`, result.error.format());
    }
    // Return raw cast on failure — don't crash prod
    return raw as T;
  }
  return result.data;
}
```

Usage in components:
```typescript
import { safeGet } from "@/lib/api";
import { TripSchema } from "@/lib/schemas";
import { z } from "zod";

const trips = await safeGet(
  "/api/v1/trips",
  z.object({ data: z.array(TripSchema) })
);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas.ts src/lib/api.ts
git commit -m "feat: add Zod schemas for all Go API response types with dev-mode validation"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` exits 0 with no output
- [ ] `grep -rn ": any" src/` returns 0 results (or only intentional casts with `// eslint-disable` comment)
- [ ] `src/types/api.ts` has interfaces for all 7 domain types (Profile, Trip, Day, Activity, TripMember, ActivityPhoto, FlightAlert)
- [ ] `src/lib/schemas.ts` has Zod schemas matching the types
- [ ] In dev mode, wrong API response shape logs a console warning (test by temporarily returning wrong shape from Go)
- [ ] `npm run build` succeeds
