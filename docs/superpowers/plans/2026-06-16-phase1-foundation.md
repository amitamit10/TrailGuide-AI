# TrailGuide AI — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working end-to-end flow: sign up → AI conversation → itinerary generated → timeline view. Users can create a trip using natural language and see a day-by-day schedule.

**Architecture:** Next.js 16.2.9 App Router as full-stack (UI + API routes). Supabase for auth, PostgreSQL, and storage. Groq (llama-3.3-70b-versatile) powers all AI features through server-side API routes only — the API key never reaches the browser. Tailwind CSS v4 (CSS-first) for styling; shadcn/ui was not used in the final implementation.

**Tech Stack:** Next.js 16.2.9 (Turbopack), TypeScript, Tailwind CSS v4, Supabase (`@supabase/ssr` v0.12.0), Groq SDK, uuid

> **Note (updated 2026-06-17):** This plan was written before the tech stack was finalised. Actual implementation used Next.js 16.2.9 and Groq instead of Next.js 14 and Google Gemini. Phase 1 is complete.

**Spec:** `docs/superpowers/specs/2026-06-16-trailguide-ai-design.md`

---

## File Map

```
/home/amit/travel app/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── middleware.ts                              # Supabase auth route protection
├── .env.local                                 # API keys (gitignored)
├── .env.local.example                         # Template committed to git
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql             # All tables + RLS policies
├── src/
│   ├── types/
│   │   └── index.ts                           # All shared TypeScript interfaces
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                      # Browser Supabase client
│   │   │   └── server.ts                      # Server Supabase client (cookies)
│   │   ├── gemini.ts                          # GeminiService: chat, generate, edit, companion
│   │   └── utils.ts                           # shadcn/ui cn() utility
│   ├── app/
│   │   ├── layout.tsx                         # Root layout (fonts, metadata)
│   │   ├── page.tsx                           # Welcome screen
│   │   ├── globals.css                        # Tailwind + custom CSS variables
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── auth/callback/route.ts         # OAuth + email confirmation callback
│   │   ├── (app)/
│   │   │   ├── layout.tsx                     # Protected layout (auth guard)
│   │   │   ├── dashboard/page.tsx             # Trip list / home screen
│   │   │   └── trips/
│   │   │       ├── new/page.tsx               # AI Chat (trip creation)
│   │   │       └── [id]/
│   │   │           ├── page.tsx               # Redirects to /timeline
│   │   │           └── timeline/page.tsx      # Itinerary timeline view
│   │   └── api/
│   │       └── ai/
│   │           ├── chat/route.ts              # POST: multi-turn Gemini chat
│   │           └── generate-itinerary/route.ts # POST: generate + save itinerary
│   └── components/
│       ├── ui/                                # shadcn/ui (auto-generated, don't edit)
│       ├── chat/
│       │   ├── ChatMessage.tsx                # Single message bubble
│       │   ├── QuickReplyChips.tsx            # Tappable suggestion chips
│       │   └── ChatInput.tsx                  # Textarea + send button
│       └── itinerary/
│           ├── ActivityCard.tsx               # Single activity card
│           └── DaySection.tsx                 # Day header + activity list
```

---

### Task 1: Project Setup

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `src/app/globals.css`
- Create: `.env.local.example`

- [ ] **Step 1: Bootstrap Next.js project**

Run from inside the repo directory:

```bash
cd "/home/amit/travel app"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: Next.js project files created. Existing files like `.git/` and `docs/` are preserved.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @google/generative-ai uuid
npm install lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
npm install @types/uuid --save-dev
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

Then add the components used in Phase 1:

```bash
npx shadcn@latest add button card input textarea badge avatar separator tabs
```

- [ ] **Step 4: Replace `tailwind.config.ts` with design tokens**

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF8",
        card: "#F5F0E8",
        primary: {
          DEFAULT: "#2D6A4F",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F5F0E8",
          foreground: "#6B7280",
        },
        border: "#E5E0D8",
        foreground: "#1A1A1A",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

- [ ] **Step 5: Replace `src/app/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 60 14% 98%;
    --foreground: 0 0% 10%;
    --card: 40 30% 95%;
    --card-foreground: 0 0% 10%;
    --popover: 60 14% 98%;
    --popover-foreground: 0 0% 10%;
    --primary: 153 41% 30%;
    --primary-foreground: 0 0% 100%;
    --secondary: 40 30% 92%;
    --secondary-foreground: 0 0% 20%;
    --muted: 40 30% 95%;
    --muted-foreground: 220 9% 46%;
    --accent: 40 30% 92%;
    --accent-foreground: 0 0% 10%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 40 20% 88%;
    --input: 40 20% 88%;
    --ring: 153 41% 30%;
    --radius: 1rem;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

- [ ] **Step 6: Create `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Google Maps (Phase 2)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Telegram Bot (Phase 4)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=generate_a_random_string_here
```

Copy to `.env.local` and fill in real values before running the app.

- [ ] **Step 7: Update `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000 with no compilation errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js 14 with Tailwind, shadcn/ui, and all Phase 1 dependencies

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// src/types/index.ts

export type TravelStyle = "relaxed" | "packed" | "balanced";
export type TripStatus = "planning" | "active" | "completed";
export type ActivityCategory =
  | "food"
  | "attraction"
  | "transport"
  | "hotel"
  | "flight"
  | "free";
export type NudgeType = "timing" | "discovery" | "weather" | "navigation";
export type DocumentType = "flight" | "hotel" | "airbnb" | "other";

export interface Profile {
  id: string;
  telegram_chat_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: string;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  departure_city: string | null;
  start_date: string;
  end_date: string;
  travelers_count: number;
  budget_total: number | null;
  budget_currency: string;
  travel_style: TravelStyle;
  interests: string[];
  status: TripStatus;
  created_at: string;
}

export interface ItineraryDay {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  notes: string | null;
}

export interface Activity {
  id: string;
  day_id: string;
  trip_id: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  location_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  estimated_cost: number | null;
  photo_url: string | null;
  rating: number | null;
  notes: string | null;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  trip_id: string | null;
  session_id: string | null;
  role: "user" | "model";
  content: string;
  created_at: string;
}

export interface CompanionNudge {
  id: string;
  trip_id: string;
  type: NudgeType;
  message: string;
  action_label: string | null;
  action_data: Record<string, unknown> | null;
  sent_at: string;
  dismissed_at: string | null;
}

// Built up progressively during the AI chat conversation
export interface TripConfig {
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  departure_city?: string;
  start_date: string;
  end_date: string;
  travelers_count: number;
  traveler_ages?: number[];
  budget_total?: number;
  budget_currency: string;
  travel_style: TravelStyle;
  interests: string[];
  flights_booked: boolean;
  hotels_booked: boolean;
}

// What Gemini returns for each activity in itinerary generation
export interface GeneratedActivity {
  title: string;
  description: string;
  category: ActivityCategory;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  location_name: string;
  address: string;
  lat: number;
  lng: number;
  estimated_cost: number;
  photo_query: string;
  rating?: number;
}

export interface GeneratedDay {
  day_number: number;
  date: string;
  activities: GeneratedActivity[];
}

export interface GeneratedItinerary {
  days: GeneratedDay[];
}

export interface CompanionNudgeOutput {
  type: NudgeType;
  message: string;
  action_label?: string;
  action_data?: Record<string, unknown>;
}

export interface ExtractedDocumentData {
  type: DocumentType;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  departure_time?: string;
  arrival_time?: string;
  airline?: string;
  hotel_name?: string;
  hotel_address?: string;
  check_in?: string;
  check_out?: string;
  confirmation_number?: string;
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add shared TypeScript types for all domain entities

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Supabase Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install supabase --save-dev
npx supabase init
```

Expected: `supabase/` directory created with `config.toml`.

- [ ] **Step 2: Create the database migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  telegram_chat_id text unique,
  full_name text,
  avatar_url text,
  default_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Trips
create table trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  destination text not null,
  destination_lat float,
  destination_lng float,
  departure_city text,
  start_date date not null,
  end_date date not null,
  travelers_count int not null default 1,
  budget_total numeric,
  budget_currency text not null default 'USD',
  travel_style text not null default 'balanced',
  interests text[] not null default '{}',
  status text not null default 'planning',
  created_at timestamptz not null default now()
);

-- Itinerary days
create table itinerary_days (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  day_number int not null,
  date date not null,
  notes text,
  unique(trip_id, day_number)
);

-- Activities
create table activities (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid references itinerary_days(id) on delete cascade not null,
  trip_id uuid references trips(id) on delete cascade not null,
  title text not null,
  description text,
  category text not null default 'attraction',
  start_time time,
  end_time time,
  duration_minutes int,
  location_name text,
  address text,
  lat float,
  lng float,
  estimated_cost numeric,
  photo_url text,
  rating float,
  notes text,
  is_completed boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Uploaded booking documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null,
  file_url text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

-- AI chat history
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  session_id text,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Live companion nudges
create table companion_nudges (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  type text not null,
  message text not null,
  action_label text,
  action_data jsonb,
  sent_at timestamptz not null default now(),
  dismissed_at timestamptz
);

-- Row Level Security (users only see their own data)
alter table profiles enable row level security;
alter table trips enable row level security;
alter table itinerary_days enable row level security;
alter table activities enable row level security;
alter table documents enable row level security;
alter table chat_messages enable row level security;
alter table companion_nudges enable row level security;

create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create policy "Users can manage own trips" on trips for all using (auth.uid() = user_id);

create policy "Users can manage own trip days" on itinerary_days for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

create policy "Users can manage own activities" on activities for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

create policy "Users can manage own documents" on documents for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));

create policy "Users can manage own chat messages" on chat_messages for all
  using (
    trip_id is null
    or exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid())
  );

create policy "Users can manage own nudges" on companion_nudges for all
  using (exists (select 1 from trips where trips.id = trip_id and trips.user_id = auth.uid()));
```

- [ ] **Step 3: Apply migration to Supabase**

Go to https://app.supabase.com → your project → SQL Editor → paste and run the contents of `001_initial_schema.sql`.

Verify in the Table Editor that these tables exist: `profiles`, `trips`, `itinerary_days`, `activities`, `documents`, `chat_messages`, `companion_nudges`.

- [ ] **Step 4: Create browser Supabase client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Create server Supabase client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore: called from Server Component, cookies are read-only
          }
        },
      },
    }
  );
}
```

- [ ] **Step 6: Create auth middleware**

```typescript
// middleware.ts  (at project root, next to package.json)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/trips");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/ src/lib/supabase/ middleware.ts
git commit -m "feat: add Supabase schema with RLS, browser/server clients, and auth middleware

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Welcome Screen & Auth Flow

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Create root layout**

```typescript
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrailGuide AI — Your Personal AI Travel Planner",
  description:
    "Plan your entire vacation with AI and get guided throughout your trip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create Welcome Screen**

```typescript
// src/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#1a2e1a]">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d1f0d] via-[#2D6A4F] to-[#1a2e1a]" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm mx-auto">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg border border-white/10">
          <Navigation className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
          TrailGuide AI
        </h1>
        <p className="text-white/70 text-lg mb-2 font-medium">
          Your Personal AI Travel Planner
        </p>
        <p className="text-white/50 text-sm mb-10 leading-relaxed max-w-xs">
          Plan your entire trip with AI and get guided every step of the way
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {["AI Itinerary", "Live Guide", "Navigation", "Discoveries"].map(
            (f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium"
              >
                {f}
              </span>
            )
          )}
        </div>

        <div className="w-full flex flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="w-full bg-white text-[#2D6A4F] hover:bg-white/90 font-semibold rounded-xl h-12 text-base"
          >
            <Link href="/signup">Start Planning for Free</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="w-full text-white/80 hover:text-white hover:bg-white/10 rounded-xl h-12"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>

        <p className="text-white/30 text-xs mt-8">No credit card required</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create Sign Up page**

```typescript
// src/app/(auth)/signup/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">TrailGuide AI</span>
        </div>

        <h2 className="text-2xl font-bold mb-1">Create your account</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Start planning your next adventure
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 rounded-xl"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create Login page**

```typescript
// src/app/(auth)/login/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg">TrailGuide AI</span>
        </div>

        <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
        <p className="text-muted-foreground text-sm mb-6">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 rounded-xl"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create OAuth callback route**

```typescript
// src/app/(auth)/auth/callback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
```

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

1. Open http://localhost:3000 — dark green welcome screen should render
2. Click "Start Planning for Free" — signup form appears
3. Create an account — should redirect to `/dashboard` (404 is fine — dashboard is next task)
4. Open incognito → http://localhost:3000/dashboard — should redirect to `/login`

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/\(auth\)/
git commit -m "feat: add welcome screen and email auth (signup/login)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: GeminiService

**Files:**
- Create: `src/lib/gemini.ts`

- [ ] **Step 1: Create GeminiService**

```typescript
// src/lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  TripConfig,
  GeneratedItinerary,
  CompanionNudgeOutput,
} from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TRAVEL_AGENT_SYSTEM_PROMPT = `You are an expert AI travel planner called TrailGuide. Your job is to help users plan amazing trips through friendly conversation.

Ask ONE question at a time. Collect this information in order:
1. Destination city/country
2. Departure city
3. Travel dates (start and end)
4. Number of travelers
5. Ages of travelers (for family-appropriate recommendations)
6. Total budget and currency
7. Travel style: "relaxed" (slow pace), "packed" (see everything), or "balanced"
8. Interests (food & dining, history & culture, art & museums, nature & outdoors, nightlife, shopping, adventure sports, local experiences, hidden gems)
9. Whether flights are already booked
10. Whether hotels are already booked

Required fields: destination, start_date, end_date, travelers_count, travel_style, interests.
Optional: departure_city, traveler_ages, budget_total, flights_booked, hotels_booked.

Once you have all required fields, respond ONLY with this exact JSON structure:
{
  "complete": true,
  "config": {
    "destination": "Paris, France",
    "destination_lat": 48.8566,
    "destination_lng": 2.3522,
    "departure_city": "New York",
    "start_date": "2026-08-01",
    "end_date": "2026-08-08",
    "travelers_count": 2,
    "traveler_ages": [32, 30],
    "budget_total": 5000,
    "budget_currency": "USD",
    "travel_style": "balanced",
    "interests": ["food & dining", "history & culture"],
    "flights_booked": true,
    "hotels_booked": false
  }
}

For all other messages, respond with:
{ "complete": false, "message": "your conversational message here" }

Keep messages warm, brief, and exciting. Use 1-2 emojis occasionally. Never ask multiple questions in one message.`;

const ITINERARY_SYSTEM_PROMPT = `You are an expert travel itinerary planner. Generate complete, realistic, day-by-day itineraries.

Return ONLY valid JSON, no markdown fences, no explanation text. Match this exact structure:
{
  "days": [
    {
      "day_number": 1,
      "date": "2026-08-01",
      "activities": [
        {
          "title": "Arrival & Hotel Check-in",
          "description": "Settle into your hotel and freshen up after the journey.",
          "category": "hotel",
          "start_time": "14:00",
          "end_time": "15:00",
          "duration_minutes": 60,
          "location_name": "Hotel Name",
          "address": "123 Street, City",
          "lat": 48.8566,
          "lng": 2.3522,
          "estimated_cost": 0,
          "photo_query": "Paris hotel Marais exterior"
        }
      ]
    }
  ]
}

Rules:
- category must be one of: food, attraction, transport, hotel, flight, free
- Include transport activities between locations (walking, metro, taxi)
- Start each day with breakfast, end with dinner
- relaxed style = 3-4 activities/day, balanced = 5-6, packed = 7-8
- Use accurate real-world coordinates (lat/lng)
- estimated_cost is per person in the trip's currency
- photo_query should find a recognizable photo of the specific place
- Mix famous attractions with hidden local gems based on interests`;

export class GeminiService {
  private model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  async sendChatMessage(
    history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
    message: string
  ): Promise<
    | { complete: false; message: string }
    | { complete: true; config: TripConfig }
  > {
    const chat = this.model.startChat({
      history,
      systemInstruction: TRAVEL_AGENT_SYSTEM_PROMPT,
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps JSON
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    try {
      return JSON.parse(jsonText);
    } catch {
      // Gemini returned plain text, not JSON — treat as incomplete
      return { complete: false, message: text };
    }
  }

  async generateItinerary(config: TripConfig): Promise<GeneratedItinerary> {
    const prompt = `Generate a complete day-by-day itinerary for this trip:

Destination: ${config.destination}
Dates: ${config.start_date} to ${config.end_date}
Travelers: ${config.travelers_count} people${config.traveler_ages?.length ? ` (ages: ${config.traveler_ages.join(", ")})` : ""}
${config.budget_total ? `Budget: ${config.budget_total} ${config.budget_currency} total` : "Flexible budget"}
Travel style: ${config.travel_style}
Interests: ${config.interests.join(", ")}
${config.flights_booked ? "Flights already booked." : ""}
${config.hotels_booked ? "Hotels already booked." : ""}

Return only valid JSON.`;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: ITINERARY_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as GeneratedItinerary;
  }

  async editItinerary(
    currentItinerary: GeneratedItinerary,
    editCommand: string
  ): Promise<GeneratedItinerary> {
    const prompt = `Apply this modification to the travel itinerary and return the complete updated itinerary.

Current itinerary:
${JSON.stringify(currentItinerary, null, 2)}

Modification: "${editCommand}"

Return the complete updated itinerary JSON. Keep all unaffected activities unchanged.`;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: ITINERARY_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as GeneratedItinerary;
  }

  async getCompanionNudges(params: {
    currentTime: string;
    currentLat: number;
    currentLng: number;
    nextActivity: { title: string; location: string; start_time: string };
    weatherSummary: string;
    destination: string;
  }): Promise<CompanionNudgeOutput[]> {
    const prompt = `You are a live travel companion. Based on the traveler's current situation, generate 0-3 helpful nudges.

Current time: ${params.currentTime}
Current location: ${params.currentLat}, ${params.currentLng}
Next activity: "${params.nextActivity.title}" at ${params.nextActivity.location}, starting at ${params.nextActivity.start_time}
Weather: ${params.weatherSummary}
Destination: ${params.destination}

Return a JSON array (empty array [] if no nudges needed):
[
  {
    "type": "timing",
    "message": "Short helpful message (max 100 chars)",
    "action_label": "optional button label",
    "action_data": {}
  }
]

type must be one of: timing, discovery, weather, navigation
Only generate nudges that are genuinely useful right now.`;

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });

    const text = result.response.text().trim();
    const jsonText = text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    return JSON.parse(jsonText) as CompanionNudgeOutput[];
  }

  async generateTripStory(params: {
    destination: string;
    days: number;
    completedActivities: string[];
  }): Promise<string> {
    const prompt = `Write a warm, evocative travel story (3 short paragraphs) about a ${params.days}-day trip to ${params.destination}.

Activities completed: ${params.completedActivities.slice(0, 12).join(", ")}.

Write in second person ("You began your adventure..."). Make it feel like a cherished memory. Plain text only, no markdown, no headers.`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

export const gemini = new GeminiService();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add GeminiService (chat, generate, edit, companion, trip story)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: AI API Routes

**Files:**
- Create: `src/app/api/ai/chat/route.ts`
- Create: `src/app/api/ai/generate-itinerary/route.ts`

- [ ] **Step 1: Create chat API route**

```typescript
// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, session_id, history } = await request.json();

  if (!message || !session_id) {
    return NextResponse.json(
      { error: "message and session_id are required" },
      { status: 400 }
    );
  }

  // Persist user message
  await supabase.from("chat_messages").insert({
    session_id,
    role: "user",
    content: message,
  });

  // Call Gemini with conversation history
  const response = await gemini.sendChatMessage(history ?? [], message);

  // Persist AI response
  const aiContent = response.complete
    ? "[Trip configuration collected]"
    : (response as { complete: false; message: string }).message;

  await supabase.from("chat_messages").insert({
    session_id,
    role: "model",
    content: aiContent,
  });

  return NextResponse.json(response);
}
```

- [ ] **Step 2: Create itinerary generation API route**

```typescript
// src/app/api/ai/generate-itinerary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini } from "@/lib/gemini";
import type { TripConfig, GeneratedItinerary } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { config }: { config: TripConfig } = await request.json();

  // 1. Create trip record
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      title: `${config.destination} Trip`,
      destination: config.destination,
      destination_lat: config.destination_lat ?? null,
      destination_lng: config.destination_lng ?? null,
      departure_city: config.departure_city ?? null,
      start_date: config.start_date,
      end_date: config.end_date,
      travelers_count: config.travelers_count,
      budget_total: config.budget_total ?? null,
      budget_currency: config.budget_currency,
      travel_style: config.travel_style,
      interests: config.interests,
      status: "planning",
    })
    .select()
    .single();

  if (tripError || !trip) {
    console.error("Trip insert error:", tripError);
    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
  }

  // 2. Generate itinerary with Gemini
  let itinerary: GeneratedItinerary;
  try {
    itinerary = await gemini.generateItinerary(config);
  } catch (err) {
    console.error("Gemini generation error:", err);
    // Delete the trip record if generation fails so user can retry
    await supabase.from("trips").delete().eq("id", trip.id);
    return NextResponse.json(
      { error: "Failed to generate itinerary. Please try again." },
      { status: 500 }
    );
  }

  // 3. Save days and activities
  for (const day of itinerary.days) {
    const { data: dayRecord, error: dayError } = await supabase
      .from("itinerary_days")
      .insert({
        trip_id: trip.id,
        day_number: day.day_number,
        date: day.date,
      })
      .select()
      .single();

    if (dayError || !dayRecord) {
      console.error("Day insert error:", dayError);
      continue;
    }

    if (day.activities.length > 0) {
      const activitiesToInsert = day.activities.map((activity, index) => ({
        day_id: dayRecord.id,
        trip_id: trip.id,
        title: activity.title,
        description: activity.description,
        category: activity.category,
        start_time: activity.start_time,
        end_time: activity.end_time,
        duration_minutes: activity.duration_minutes,
        location_name: activity.location_name,
        address: activity.address,
        lat: activity.lat,
        lng: activity.lng,
        estimated_cost: activity.estimated_cost,
        photo_url: null,
        rating: activity.rating ?? null,
        sort_order: index,
      }));

      await supabase.from("activities").insert(activitiesToInsert);
    }
  }

  return NextResponse.json({ trip_id: trip.id });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/
git commit -m "feat: add AI chat and itinerary generation API routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: AI Chat UI (Trip Creation Page)

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/chat/ChatMessage.tsx`
- Create: `src/components/chat/QuickReplyChips.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/app/(app)/trips/new/page.tsx`

- [ ] **Step 1: Create protected app layout**

```typescript
// src/app/(app)/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <>{children}</>;
}
```

- [ ] **Step 2: Create ChatMessage component**

```typescript
// src/components/chat/ChatMessage.tsx
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "model";
  content: string;
  isTyping?: boolean;
}

export function ChatMessage({ role, content, isTyping }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 mb-4", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
          isUser
            ? "bg-primary text-white"
            : "bg-[#F5F0E8] text-[#2D6A4F] border border-border"
        )}
      >
        {isUser ? "You" : "AI"}
      </div>

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-[#F5F0E8] text-foreground rounded-tl-sm"
        )}
      >
        {isTyping ? (
          <span className="flex gap-1 items-center h-5">
            <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create QuickReplyChips component**

```typescript
// src/components/chat/QuickReplyChips.tsx
interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
}

export function QuickReplyChips({ chips, onSelect }: QuickReplyChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create ChatInput component**

```typescript
// src/components/chat/ChatInput.tsx
"use client";
import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex gap-2 items-end px-4 py-3 border-t border-border bg-background">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="resize-none rounded-xl min-h-[44px] max-h-32 py-2.5"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        size="icon"
        className="rounded-xl h-11 w-11 flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Install `uuid` (if not yet installed)**

```bash
npm list uuid || npm install uuid @types/uuid
```

- [ ] **Step 6: Create the AI Chat / Trip Creation page**

```typescript
// src/app/(app)/trips/new/page.tsx
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickReplyChips } from "@/components/chat/QuickReplyChips";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { TripConfig } from "@/types";

type Message = { id: string; role: "user" | "model"; content: string };

const OPENING_MESSAGE: Message = {
  id: "opening",
  role: "model",
  content:
    "Hi! I'm your AI travel planner ✈️ I'll help you plan an amazing trip from start to finish. Let's begin — where are you dreaming of going?",
};

function detectQuickReplies(text: string): string[] {
  const lower = text.toLowerCase();
  if (lower.includes("interest") || lower.includes("enjoy") || lower.includes("like to do"))
    return ["Food & Dining", "History & Culture", "Art & Museums", "Nature & Outdoors", "Nightlife", "Shopping", "Hidden Gems", "Adventure"];
  if (lower.includes("style") || lower.includes("pace"))
    return ["Relaxed", "Balanced", "Packed"];
  if (lower.includes("budget"))
    return ["Under $1,000", "$1,000–3,000", "$3,000–7,000", "Luxury / no limit"];
  if (lower.includes("flight") || lower.includes("hotel") || lower.includes("booked"))
    return ["Yes", "Not yet"];
  return [];
}

export default function NewTripPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sessionId] = useState<string>(() => uuidv4());
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (content: string) => {
      setLoading(true);
      setQuickReplies([]);

      const userMsg: Message = { id: uuidv4(), role: "user", content };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Build Gemini history: all messages except the static opening and the current one
      const history = updatedMessages.slice(1, -1).map((m) => ({
        role: m.role as "user" | "model",
        parts: [{ text: m.content }],
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, session_id: sessionId, history }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.complete) {
        setGenerating(true);
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "model",
            content:
              "Perfect! I have everything I need 🎉 Generating your personalised itinerary now — this takes about 30 seconds...",
          },
        ]);

        const genRes = await fetch("/api/ai/generate-itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: data.config as TripConfig }),
        });

        if (!genRes.ok) {
          setGenerating(false);
          setMessages((prev) => [
            ...prev,
            {
              id: uuidv4(),
              role: "model",
              content: "Sorry, I had trouble generating your itinerary. Please try again.",
            },
          ]);
          return;
        }

        const { trip_id } = await genRes.json();
        router.push(`/trips/${trip_id}/timeline`);
      } else {
        const aiMsg: Message = {
          id: uuidv4(),
          role: "model",
          content: data.message,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setQuickReplies(detectQuickReplies(data.message));
      }
    },
    [messages, sessionId, router]
  );

  return (
    <div className="flex flex-col h-screen bg-background max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border flex-shrink-0">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Plan a New Trip</h1>
          <p className="text-xs text-muted-foreground">AI Travel Planner</p>
        </div>
        {generating && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {loading && <ChatMessage role="model" content="" isTyping />}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <QuickReplyChips chips={quickReplies} onSelect={sendMessage} />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={loading || generating}
        placeholder="Tell me about your dream trip..."
      />
    </div>
  );
}
```

- [ ] **Step 7: Verify chat flow in browser**

```bash
npm run dev
```

1. Sign in → dashboard → "New Trip"
2. Chat page opens with AI greeting
3. Type "I want to go to Tokyo"
4. AI responds with next question
5. Complete the conversation
6. "Generating..." message appears
7. Redirect to `/trips/[id]/timeline` (404 for now — next task)

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/ src/components/chat/
git commit -m "feat: add AI trip creation chat (Gemini multi-turn conversation)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Trip Dashboard

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```typescript
// src/app/(app)/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Navigation, MapPin, Calendar } from "lucide-react";
import type { Trip } from "@/types";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function TripCard({ trip, active }: { trip: Trip; active?: boolean }) {
  return (
    <Link href={`/trips/${trip.id}/timeline`}>
      <Card
        className={`rounded-2xl border-border hover:shadow-md transition-shadow cursor-pointer ${
          active ? "border-primary/40 bg-primary/5" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{trip.title}</h3>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {trip.destination}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {formatDateRange(trip.start_date, trip.end_date)}
                </span>
              </div>
            </div>
            {active && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs font-medium flex-shrink-0">
                Active
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const activeTrip = trips?.find((t: Trip) => t.status === "active");
  const upcomingTrips = trips?.filter((t: Trip) => t.status === "planning") ?? [];
  const pastTrips = trips?.filter((t: Trip) => t.status === "completed") ?? [];

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-lg">TrailGuide AI</h1>
        </div>
        <Button asChild size="sm" className="rounded-xl">
          <Link href="/trips/new">
            <Plus className="w-4 h-4 mr-1" />
            New Trip
          </Link>
        </Button>
      </div>

      {/* Active trip */}
      {activeTrip && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Active Trip
          </h2>
          <TripCard trip={activeTrip} active />
        </section>
      )}

      {/* Empty state */}
      {(!trips || trips.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Plan your first trip</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">
            Tell our AI where you want to go and it'll handle everything — itinerary, maps, and live guidance.
          </p>
          <Button asChild className="rounded-xl">
            <Link href="/trips/new">Start Planning</Link>
          </Button>
        </div>
      )}

      {/* Upcoming trips */}
      {upcomingTrips.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Upcoming
          </h2>
          <div className="flex flex-col gap-3">
            {upcomingTrips.map((trip: Trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {/* Past trips */}
      {pastTrips.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Past Trips
          </h2>
          <div className="flex flex-col gap-3">
            {pastTrips.map((trip: Trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard in browser**

```bash
npm run dev
```

Navigate to http://localhost:3000/dashboard after signing in. Empty state should display "Plan your first trip."

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/dashboard/
git commit -m "feat: add trip dashboard with trip list and empty state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Itinerary Timeline View

**Files:**
- Create: `src/components/itinerary/ActivityCard.tsx`
- Create: `src/components/itinerary/DaySection.tsx`
- Create: `src/app/(app)/trips/[id]/page.tsx`
- Create: `src/app/(app)/trips/[id]/timeline/page.tsx`

- [ ] **Step 1: Create ActivityCard component**

```typescript
// src/components/itinerary/ActivityCard.tsx
import { Clock, MapPin, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types";

const CATEGORY_STYLES: Record<string, string> = {
  food:       "bg-orange-50 text-orange-700 border-orange-200",
  attraction: "bg-blue-50 text-blue-700 border-blue-200",
  transport:  "bg-gray-50 text-gray-500 border-gray-200",
  hotel:      "bg-purple-50 text-purple-700 border-purple-200",
  flight:     "bg-sky-50 text-sky-700 border-sky-200",
  free:       "bg-green-50 text-green-700 border-green-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food", attraction: "Attraction", transport: "Transport",
  hotel: "Hotel", flight: "Flight", free: "Free time",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ActivityCardProps {
  activity: Activity;
  currency?: string;
}

export function ActivityCard({ activity, currency = "USD" }: ActivityCardProps) {
  // Render transport as a slim connector, not a full card
  if (activity.category === "transport") {
    return (
      <div className="flex items-center gap-3 my-1 pl-2">
        <div className="w-6 flex justify-center">
          <div className="w-px h-8 bg-border" />
        </div>
        <span className="text-xs text-muted-foreground">
          {activity.title}
          {activity.duration_minutes
            ? ` · ${formatDuration(activity.duration_minutes)}`
            : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-3">
      {/* Time column */}
      <div className="w-12 flex-shrink-0 pt-3 text-right">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {activity.start_time?.slice(0, 5) ?? ""}
        </span>
      </div>

      {/* Card */}
      <div className="flex-1 bg-card rounded-2xl p-4 border border-border hover:shadow-sm transition-shadow">
        <span
          className={cn(
            "inline-block px-2 py-0.5 rounded-full text-xs font-medium border mb-2",
            CATEGORY_STYLES[activity.category] ?? "bg-gray-50 text-gray-600 border-gray-200"
          )}
        >
          {CATEGORY_LABELS[activity.category] ?? activity.category}
        </span>

        <h4 className="font-semibold text-sm mb-1 leading-tight">{activity.title}</h4>

        {activity.description && (
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
            {activity.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {activity.location_name && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{activity.location_name}</span>
            </span>
          )}
          {activity.estimated_cost != null && activity.estimated_cost > 0 && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <DollarSign className="w-3 h-3" />
              {activity.estimated_cost} {currency}
            </span>
          )}
          {activity.duration_minutes != null && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {formatDuration(activity.duration_minutes)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DaySection component**

```typescript
// src/components/itinerary/DaySection.tsx
import type { Activity, ItineraryDay } from "@/types";
import { ActivityCard } from "./ActivityCard";

interface DaySectionProps {
  day: ItineraryDay;
  activities: Activity[];
  currency?: string;
}

function formatDayHeader(dayNumber: number, dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    dayNumber,
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    dateLabel: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
  };
}

export function DaySection({ day, activities, currency }: DaySectionProps) {
  const { dayNumber, weekday, dateLabel } = formatDayHeader(
    day.day_number,
    day.date
  );

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">{dayNumber}</span>
        </div>
        <div>
          <p className="font-semibold text-sm">{weekday}</p>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
        </div>
      </div>

      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} currency={currency} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create trip root redirect**

```typescript
// src/app/(app)/trips/[id]/page.tsx
import { redirect } from "next/navigation";

export default async function TripRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/trips/${id}/timeline`);
}
```

- [ ] **Step 4: Create timeline page**

```typescript
// src/app/(app)/trips/[id]/timeline/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DaySection } from "@/components/itinerary/DaySection";
import { ArrowLeft, Map, Calendar, Compass } from "lucide-react";
import type { Activity, ItineraryDay, Trip } from "@/types";

const NAV_TABS = [
  { label: "Timeline", href: "timeline" },
  { label: "Calendar", href: "calendar" },
  { label: "Map", href: "map" },
  { label: "Discover", href: "discover" },
] as const;

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trip) notFound();

  const [{ data: days }, { data: activities }] = await Promise.all([
    supabase
      .from("itinerary_days")
      .select("*")
      .eq("trip_id", id)
      .order("day_number"),
    supabase
      .from("activities")
      .select("*")
      .eq("trip_id", id)
      .order("sort_order"),
  ]);

  // Group activities by day_id
  const activitiesByDay = new Map<string, Activity[]>();
  activities?.forEach((a: Activity) => {
    if (!activitiesByDay.has(a.day_id)) activitiesByDay.set(a.day_id, []);
    activitiesByDay.get(a.day_id)!.push(a);
  });

  const typedTrip = trip as Trip;

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">{typedTrip.title}</h1>
            <p className="text-xs text-muted-foreground">{typedTrip.destination}</p>
          </div>
        </div>

        {/* View switcher tabs */}
        <div className="flex gap-1">
          {NAV_TABS.map(({ label, href }) => (
            <Link key={href} href={`/trips/${id}/${href}`}>
              <Button
                variant={href === "timeline" ? "default" : "ghost"}
                size="sm"
                className="rounded-xl text-xs h-8 px-3"
              >
                {label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        {!days || days.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            No itinerary yet.
          </p>
        ) : (
          days.map((day: ItineraryDay) => (
            <DaySection
              key={day.id}
              day={day}
              activities={activitiesByDay.get(day.id) ?? []}
              currency={typedTrip.budget_currency}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run full end-to-end flow**

```bash
npm run dev
```

Complete test:
1. http://localhost:3000 → Welcome screen ✓
2. Sign up → Dashboard with empty state ✓
3. "New Trip" → Chat page with AI greeting ✓
4. Conversation with AI (all questions answered) → "Generating itinerary..." ✓
5. Auto-redirect to `/trips/[id]/timeline` ✓
6. Timeline renders day headers and activity cards ✓

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/itinerary/ src/app/\(app\)/trips/
git commit -m "feat: add itinerary timeline view with day sections and activity cards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 1 Complete

At the end of Phase 1, users can:
- Sign up / log in
- Create a trip via AI conversation
- See a generated itinerary in timeline view

**Phase 2 plan** covers: Calendar view, Map view, Trip Dashboard (with countdown/weather/budget), Document Import, Attraction details, Hotel details.

**Phase 3 plan** covers: Discovery screen, Search & Filters, AI Recommendations, Places API integration.

**Phase 4 plan** covers: Live Companion mode, Navigation screen, Telegram bot, companion nudges.

**Phase 5 plan** covers: Trip Summary, animations, mobile polish, performance.
