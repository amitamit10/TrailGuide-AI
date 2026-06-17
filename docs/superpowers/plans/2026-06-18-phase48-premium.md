# TrailGuide AI — Phase 48: Premium Features & Paywall

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a free tier with limits and a Premium subscription (Stripe). Free: 3 trips, 10 AI chat messages/day. Premium ($4.99/month): unlimited trips, unlimited AI, trip collaboration, and photo journal.

**Architecture:** Stripe Checkout for subscriptions. `profiles.subscription_tier` (`free` | `premium`). A Go middleware `requirePremium` checks the tier before premium-gated endpoints. Usage limits tracked in `usage_counters` table (reset daily). Next.js shows upgrade prompts when limits are hit. Stripe webhooks update `subscription_tier` on payment events.

**Tech Stack:** Stripe (Checkout + webhooks), Go (webhook handler + rate limit middleware), Next.js (upgrade modal).

**Prerequisite:** Phase 19 (Go backend). Phase 18 (Next.js frontend).

## Global Constraints
- New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID`.
- Webhook route at Go: `POST /webhooks/stripe` (no auth — uses Stripe signature verification).
- Free tier limits: 3 trips total, 10 AI chat requests/day.
- Collaboration (Phase 20) and Photo Journal (Phase 21) are premium-only.
- Existing users at phase launch → grandfathered as premium for 90 days.
- NEVER store card details — Stripe handles all PCI compliance.

---

## Task 1: Database

- [ ] **Step 1: Create `supabase/migrations/015_premium.sql`**

```sql
alter table profiles
  add column if not exists subscription_tier text default 'free' check (subscription_tier in ('free','premium')),
  add column if not exists stripe_customer_id text unique,
  add column if not exists subscription_expires_at timestamptz;

-- Daily usage counters
create table if not exists usage_counters (
  user_id uuid primary key references profiles(id) on delete cascade,
  ai_chat_count int default 0,
  reset_date date default current_date
);

-- Grandfather existing users as premium for 90 days
update profiles set
  subscription_tier = 'premium',
  subscription_expires_at = now() + interval '90 days'
where created_at < now() - interval '1 hour';
```

```bash
supabase db push
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/015_premium.sql
git commit -m "feat: add subscription_tier, stripe_customer_id, and usage_counters to profiles"
```

---

## Task 2: Go — usage limits + premium middleware

- [ ] **Step 1: Create `backend/internal/middleware/premium.go`**

```go
package middleware

import (
    "context"
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
)

func RequirePremium(db *pgxpool.Pool) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        var tier string
        db.QueryRow(context.Background(),
            `SELECT COALESCE(subscription_tier,'free') FROM profiles WHERE id=$1`, userID).Scan(&tier)
        if tier != "premium" {
            c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
                "error": "premium_required",
                "message": "This feature requires a TrailGuide Premium subscription",
                "upgrade_url": "/upgrade",
            })
            return
        }
        c.Next()
    }
}

func CheckAILimit(db *pgxpool.Pool) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        // Premium users: skip limit
        var tier string
        db.QueryRow(context.Background(),
            `SELECT COALESCE(subscription_tier,'free') FROM profiles WHERE id=$1`, userID).Scan(&tier)
        if tier == "premium" { c.Next(); return }

        // Upsert counter for today
        var count int
        db.QueryRow(context.Background(),
            `INSERT INTO usage_counters (user_id, ai_chat_count, reset_date)
             VALUES ($1, 1, CURRENT_DATE)
             ON CONFLICT (user_id) DO UPDATE SET
               ai_chat_count = CASE WHEN usage_counters.reset_date < CURRENT_DATE THEN 1
                                    ELSE usage_counters.ai_chat_count + 1 END,
               reset_date = CURRENT_DATE
             RETURNING ai_chat_count`, userID).Scan(&count)

        if count > 10 {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
                "error": "daily_limit_reached",
                "message": "You've used all 10 free AI messages today. Upgrade to Premium for unlimited access.",
                "limit": 10,
                "reset": "midnight UTC",
                "upgrade_url": "/upgrade",
            })
            return
        }
        c.Set("ai_usage_count", count)
        c.Next()
    }
}
```

- [ ] **Step 2: Apply middleware**

```go
// AI chat route — apply usage limit:
aiRoutes.POST("/chat", middleware.CheckAILimit(pool), aiProxy.Chat)

// Collaboration routes — premium only:
memberGroup := v1.Group("/trips/:tripId/members")
memberGroup.Use(middleware.RequirePremium(pool))
memberGroup.GET("", memberHandler.List)
memberGroup.POST("", memberHandler.Invite)
```

- [ ] **Step 3: Trip creation limit for free users**

In the trip CREATE handler:
```go
// Check free tier trip limit
var tier string
var tripCount int
h.db.QueryRow(ctx, `SELECT COALESCE(subscription_tier,'free') FROM profiles WHERE id=$1`, userID).Scan(&tier)
if tier == "free" {
    h.db.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE user_id=$1`, userID).Scan(&tripCount)
    if tripCount >= 3 {
        c.JSON(http.StatusPaymentRequired, gin.H{
            "error": "free_tier_limit",
            "message": "Free accounts can have up to 3 trips. Upgrade to Premium for unlimited trips.",
            "upgrade_url": "/upgrade",
        })
        return
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/middleware/premium.go backend/internal/handlers/trips.go backend/main.go
git commit -m "feat: add premium middleware (RequirePremium, CheckAILimit) and trip creation limit"
```

---

## Task 3: Stripe webhook handler

- [ ] **Step 1: Create `backend/internal/handlers/stripe.go`**

```go
package handlers

import (
    "context"
    "encoding/json"
    "io"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/stripe/stripe-go/v78"
    "github.com/stripe/stripe-go/v78/webhook"
)

type StripeHandler struct{ db *pgxpool.Pool }
func NewStripeHandler(db *pgxpool.Pool) *StripeHandler { return &StripeHandler{db: db} }

func (h *StripeHandler) Webhook(c *gin.Context) {
    body, _ := io.ReadAll(c.Request.Body)
    sig := c.GetHeader("Stripe-Signature")
    secret := os.Getenv("STRIPE_WEBHOOK_SECRET")
    event, err := webhook.ConstructEvent(body, sig, secret)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
        return
    }

    switch event.Type {
    case "checkout.session.completed":
        var session stripe.CheckoutSession
        json.Unmarshal(event.Data.Raw, &session)
        customerID := session.Customer.ID
        userID := session.ClientReferenceID
        // Activate premium
        expiresAt := time.Now().UTC().AddDate(0, 1, 0)
        h.db.Exec(context.Background(),
            `UPDATE profiles SET subscription_tier='premium', stripe_customer_id=$2, subscription_expires_at=$3 WHERE id=$1`,
            userID, customerID, expiresAt)
        log.Printf("premium activated for user %s", userID)

    case "customer.subscription.deleted":
        var sub stripe.Subscription
        json.Unmarshal(event.Data.Raw, &sub)
        h.db.Exec(context.Background(),
            `UPDATE profiles SET subscription_tier='free', subscription_expires_at=NULL WHERE stripe_customer_id=$1`,
            sub.Customer.ID)
        log.Printf("subscription cancelled for customer %s", sub.Customer.ID)
    }

    c.JSON(http.StatusOK, gin.H{"received": true})
}
```

- [ ] **Step 2: Add checkout session creation endpoint**

```go
// POST /api/v1/billing/checkout — creates a Stripe Checkout session
func (h *StripeHandler) CreateCheckout(c *gin.Context) {
    userID := c.GetString("user_id")
    var email string
    h.db.QueryRow(c.Request.Context(), `SELECT COALESCE(full_name,'') FROM profiles WHERE id=$1`, userID).Scan(&email)

    stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
    params := &stripe.CheckoutSessionParams{
        Mode: stripe.String("subscription"),
        ClientReferenceID: stripe.String(userID),
        LineItems: []*stripe.CheckoutSessionLineItemParams{{
            Price:    stripe.String(os.Getenv("STRIPE_PREMIUM_PRICE_ID")),
            Quantity: stripe.Int64(1),
        }},
        SuccessURL: stripe.String(os.Getenv("APP_URL") + "/upgrade/success"),
        CancelURL:  stripe.String(os.Getenv("APP_URL") + "/upgrade"),
    }
    session, err := stripeSession.New(params)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create checkout"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": gin.H{"url": session.URL}})
}
```

- [ ] **Step 3: Wire routes**

```go
r.POST("/webhooks/stripe", stripeHandler.Webhook)      // No auth
v1.POST("/billing/checkout", stripeHandler.CreateCheckout)
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/stripe.go backend/main.go
git commit -m "feat: add Stripe webhook handler and checkout session creation"
```

---

## Task 4: Next.js — upgrade page and prompts

- [ ] **Step 1: Create `src/app/(app)/upgrade/page.tsx`**

```typescript
// Upgrade page with:
// - Feature comparison table (Free vs Premium)
// - Price ($4.99/month)
// - "Upgrade to Premium" button → POST /api/v1/billing/checkout → redirect to Stripe URL
```

- [ ] **Step 2: Create `src/components/UpgradePrompt.tsx`**

```typescript
interface Props { reason: "trips" | "ai" | "collaboration" | "photos"; onClose: () => void; }

export function UpgradePrompt({ reason, onClose }: Props) {
  const messages = {
    trips: "You've reached the free tier limit of 3 trips.",
    ai: "You've used all 10 free AI messages today.",
    collaboration: "Trip collaboration is a Premium feature.",
    photos: "Photo journal is a Premium feature.",
  };
  async function upgrade() {
    const r = await api.post<{ data: { url: string } }>("/api/v1/billing/checkout", {});
    window.location.href = r.data.url;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="bg-white rounded-t-3xl w-full p-6">
        <h2 className="text-xl font-bold mb-1">Upgrade to Premium</h2>
        <p className="text-sm text-gray-500 mb-4">{messages[reason]}</p>
        <ul className="space-y-2 mb-6 text-sm">
          <li className="flex gap-2"><span>✅</span> Unlimited trips</li>
          <li className="flex gap-2"><span>✅</span> Unlimited AI messages</li>
          <li className="flex gap-2"><span>✅</span> Trip collaboration</li>
          <li className="flex gap-2"><span>✅</span> Photo journal</li>
        </ul>
        <button onClick={upgrade} className="w-full bg-[#2D6A4F] text-white py-3.5 rounded-2xl font-medium mb-3">
          Get Premium — $4.99/month
        </button>
        <button onClick={onClose} className="w-full text-sm text-gray-400 py-2">Maybe later</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Show UpgradePrompt on 402/429 API responses**

In `src/lib/api.ts`, intercept 402 and 429 responses:
```typescript
if (response.status === 402 || response.status === 429) {
  const body = await response.json();
  throw new PremiumRequiredError(body.error, body.message);
}
```

Catch `PremiumRequiredError` in components and show `<UpgradePrompt>`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/upgrade/ src/components/UpgradePrompt.tsx src/lib/api.ts
git commit -m "feat: add upgrade page, UpgradePrompt modal, and intercept 402/429 in api.ts"
```

---

## Verification Checklist

- [ ] Free user creating 4th trip → 402 response + UpgradePrompt shown
- [ ] Free user sending 11th AI chat today → 429 + UpgradePrompt shown
- [ ] Premium middleware on collaboration routes: free user → 402
- [ ] Stripe Checkout session created, redirects to Stripe hosted page
- [ ] `checkout.session.completed` webhook → sets `subscription_tier='premium'`
- [ ] `customer.subscription.deleted` webhook → sets `subscription_tier='free'`
- [ ] Usage counter resets at midnight UTC (reset_date < CURRENT_DATE → count=1)
- [ ] Existing users grandfathered for 90 days
