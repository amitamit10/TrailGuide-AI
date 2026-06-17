# TrailGuide AI — Phase 40: Onboarding Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare post-signup redirect with an interactive onboarding flow: a 3-screen welcome wizard that captures travel preferences (style, interests, budget), then drops the user on the dashboard with a sample trip pre-generated for them — showing the app's value in under 2 minutes.

**Architecture:** After first signup, `profiles.onboarding_complete = false`. Next.js middleware detects this and redirects to `/onboarding`. The 3-screen wizard (step 1: welcome + name, step 2: travel style + interests, step 3: pick first destination or "skip to dashboard") is all client-side state. On submit, Go saves preferences to `profiles.preferences jsonb` and generates a sample trip via the AI service. On skip, just marks onboarding done.

**Tech Stack:** Next.js (3-step wizard), Go (save preferences + trigger AI trip generation), Python (re-uses existing generate-itinerary route).

**Prerequisite:** Phase 18 (Next.js frontend). Phase 17 (Python AI service).

## Global Constraints
- Onboarding only shows ONCE — after `profiles.onboarding_complete = true`, never redirect to `/onboarding` again.
- "Skip" option is always visible and never hidden — don't force users through onboarding.
- Sample trip uses a simple destination ("Tokyo, Japan"), 5-day duration, preset preferences — no user input needed for generation.
- The generated sample trip is titled "Your first adventure 🌍" and is deletable like any other trip.
- Wizard progress: 3 dots at top, current dot filled.

---

## Task 1: Database

- [ ] **Step 1: Migrate profiles table**

```sql
-- Add to supabase/migrations/012_onboarding.sql
alter table profiles
  add column if not exists onboarding_complete boolean default false,
  add column if not exists preferences jsonb default '{}';

-- Mark existing users as already onboarded (they've been using the app)
update profiles set onboarding_complete = true where created_at < now() - interval '1 day';
```

```bash
supabase db push
```

- [ ] **Step 2: Add Go endpoint to save preferences**

In `backend/internal/handlers/profile.go`, add:

```go
// CompleteOnboarding saves preferences and marks onboarding done
func (h *ProfileHandler) CompleteOnboarding(c *gin.Context) {
    userID := c.GetString("user_id")
    var body struct {
        FullName    string   `json:"full_name"`
        TravelStyle string   `json:"travel_style"`
        Interests   []string `json:"interests"`
        Budget      string   `json:"budget"`
    }
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    prefs, _ := json.Marshal(map[string]interface{}{
        "travel_style": body.TravelStyle,
        "interests": body.Interests,
        "budget": body.Budget,
    })
    _, err := h.db.Exec(c.Request.Context(),
        `UPDATE profiles SET onboarding_complete=true, full_name=COALESCE(NULLIF($2,''),full_name), preferences=$3 WHERE id=$1`,
        userID, body.FullName, string(prefs))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"done": true}})
}
```

Route: `v1.POST("/profile/onboarding", profileHandler.CompleteOnboarding)`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_onboarding.sql backend/internal/handlers/profile.go backend/main.go
git commit -m "feat: add onboarding_complete and preferences to profiles + CompleteOnboarding endpoint"
```

---

## Task 2: Next.js middleware + redirect

- [ ] **Step 1: Update `src/middleware.ts` to check onboarding**

After verifying the session exists, check if onboarding is complete:

```typescript
// In middleware, after session check:
const { data: profile } = await supabase
  .from("profiles")
  .select("onboarding_complete")
  .eq("id", session.user.id)
  .single();

const isOnboardingRoute = req.nextUrl.pathname.startsWith("/onboarding");

if (profile && !profile.onboarding_complete && !isOnboardingRoute) {
  return NextResponse.redirect(new URL("/onboarding", req.url));
}
if (profile?.onboarding_complete && isOnboardingRoute) {
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: redirect new users to /onboarding in Next.js middleware"
```

---

## Task 3: Onboarding wizard UI

- [ ] **Step 1: Create `src/app/(app)/onboarding/page.tsx`**

```typescript
import { OnboardingWizard } from "./OnboardingWizard";
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
```

- [ ] **Step 2: Create `src/app/(app)/onboarding/OnboardingWizard.tsx`**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const STYLES = [
  { id: "relaxed", label: "Relaxed", emoji: "🌴", desc: "Slow travel, enjoy the moment" },
  { id: "explorer", label: "Explorer", emoji: "🗺️", desc: "See as much as possible" },
  { id: "cultural", label: "Cultural", emoji: "🏛️", desc: "History, art, local life" },
  { id: "adventure", label: "Adventure", emoji: "🧗", desc: "Outdoors, thrills, challenges" },
  { id: "foodie", label: "Foodie", emoji: "🍜", desc: "Eat your way through the world" },
];
const INTERESTS = ["food","history","architecture","nature","art","shopping","nightlife","sports","photography","wellness"];
const BUDGETS = [
  { id: "low", label: "Budget", desc: "Hostels, street food, free sights" },
  { id: "medium", label: "Mid-range", desc: "3-star hotels, local restaurants" },
  { id: "high", label: "Comfort", desc: "Nice hotels, fine dining" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [style, setStyle] = useState("explorer");
  const [interests, setInterests] = useState<string[]>(["food", "culture"]);
  const [budget, setBudget] = useState("medium");
  const [loading, setLoading] = useState(false);

  function toggleInterest(i: string) {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].slice(0, 5));
  }

  async function finish(withSampleTrip: boolean) {
    setLoading(true);
    await api.post("/api/v1/profile/onboarding", { full_name: name, travel_style: style, interests, budget });
    if (withSampleTrip) {
      try {
        const r = await api.post<{ data: { id: string } }>("/api/v1/trips", {
          title: "Your first adventure 🌍",
          destination: style === "adventure" ? "Queenstown, New Zealand" : "Tokyo, Japan",
          start_date: new Date(Date.now() + 14*86400000).toISOString().slice(0,10),
          end_date: new Date(Date.now() + 19*86400000).toISOString().slice(0,10),
          travelers: 2, trip_style: style, interests, transport_mode: "public", budget, currency: "USD",
        });
        const tripId = r.data.id;
        // Trigger AI generation in background
        void api.post(`/api/v1/trips/${tripId}/generate`, {});
        router.push(`/trips/${tripId}/timeline`);
      } catch {
        router.push("/dashboard");
      }
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-6">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {[1,2,3].map(s => (
          <div key={s} className={`w-2 h-2 rounded-full transition-all ${step >= s ? "bg-[#2D6A4F] w-6" : "bg-gray-200"}`}/>
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-4">✈️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to TrailGuide</h1>
          <p className="text-gray-500 text-sm mb-8">Your AI travel companion. Let's set up your profile.</p>
          <input type="text" placeholder="Your name (optional)" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-2xl px-4 py-3 text-center text-gray-800 mb-6"/>
          <button onClick={() => setStep(2)}
            className="w-full bg-[#2D6A4F] text-white font-medium py-3.5 rounded-2xl">
            Let's go →
          </button>
          <button onClick={() => finish(false)} className="mt-3 text-sm text-gray-400 w-full py-2">
            Skip setup
          </button>
        </div>
      )}

      {/* Step 2: Style + interests */}
      {step === 2 && (
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">How do you travel?</h2>
          <p className="text-sm text-gray-400 mb-5">We'll use this to personalize your trips.</p>
          <div className="grid grid-cols-1 gap-2 mb-6">
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  style === s.id ? "border-[#2D6A4F] bg-[#F0F7F4]" : "border-gray-200 bg-white"
                }`}>
                <span className="text-2xl">{s.emoji}</span>
                <div className="text-left">
                  <p className={`text-sm font-medium ${style === s.id ? "text-[#2D6A4F]" : "text-gray-800"}`}>{s.label}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-gray-500 mb-2">Interests (pick up to 5)</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {INTERESTS.map(i => (
              <button key={i} onClick={() => toggleInterest(i)}
                className={`px-3 py-1 rounded-full text-xs border capitalize transition-all ${
                  interests.includes(i) ? "bg-[#2D6A4F] text-white border-[#2D6A4F]" : "text-gray-600 border-gray-200"
                }`}>{i}</button>
            ))}
          </div>
          <button onClick={() => setStep(3)}
            className="w-full bg-[#2D6A4F] text-white font-medium py-3.5 rounded-2xl">
            Next →
          </button>
        </div>
      )}

      {/* Step 3: Budget + generate sample */}
      {step === 3 && (
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">What's your travel budget?</h2>
          <p className="text-sm text-gray-400 mb-5">Sets cost estimates on your trips.</p>
          <div className="space-y-2 mb-8">
            {BUDGETS.map(b => (
              <button key={b.id} onClick={() => setBudget(b.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                  budget === b.id ? "border-[#2D6A4F] bg-[#F0F7F4]" : "border-gray-200 bg-white"
                }`}>
                <div className="text-left">
                  <p className={`text-sm font-medium ${budget === b.id ? "text-[#2D6A4F]" : "text-gray-800"}`}>{b.label}</p>
                  <p className="text-xs text-gray-400">{b.desc}</p>
                </div>
                {budget === b.id && <div className="w-4 h-4 rounded-full bg-[#2D6A4F]"/>}
              </button>
            ))}
          </div>
          <button onClick={() => finish(true)} disabled={loading}
            className="w-full bg-[#2D6A4F] text-white font-medium py-3.5 rounded-2xl mb-3 disabled:opacity-60">
            {loading ? "Generating your first trip…" : "✨ Create my first trip"}
          </button>
          <button onClick={() => finish(false)} disabled={loading}
            className="w-full text-sm text-gray-400 py-2">
            Skip — go to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/onboarding/
git commit -m "feat: add 3-step onboarding wizard with preference capture and sample trip generation"
```

---

## Verification Checklist

- [ ] New signup → redirected to `/onboarding` (not `/dashboard`)
- [ ] Existing users → `onboarding_complete=true`, skip redirect
- [ ] Step 1 → 2 → 3 progress dots update
- [ ] "Skip" on any step → marks onboarding complete, lands on dashboard
- [ ] "Create my first trip" → generates a 5-day trip, navigates to its timeline
- [ ] After completing onboarding, `/onboarding` redirects to `/dashboard`
- [ ] `profiles.preferences` stores `{ travel_style, interests, budget }`
