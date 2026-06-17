# TrailGuide AI — Phase 20: Real-time Trip Collaboration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users invite travel partners to a shared trip with role-based access (owner / editor / viewer). All participants see live changes in real time via Supabase Realtime websocket subscriptions.

**Architecture:** New `trip_members` table stores invites and roles. The Go backend handles invite CRUD (`POST /api/v1/trips/:id/members`, `DELETE`, `GET`) and enforces role checks on all existing trip/day/activity mutations. Invite emails sent via Resend (Phase 7). Next.js subscribes to Supabase Realtime channels per trip — when a collaborator edits an activity, all viewers' timelines update without a page reload. Conflict resolution: last-write-wins (simple, no OT needed at this scale).

**Tech Stack:** Go (Gin, pgx) — member handlers. Supabase Realtime (already in client) — change subscriptions. Resend API — invite emails. TypeScript/Next.js — realtime hook + collaborator UI.

**Prerequisite:** Phase 19 complete (Go backend running, Next.js migrated to pure frontend).

## Global Constraints

- New table: `trip_members` (see Task 1 schema).
- Role hierarchy: `owner` > `editor` > `viewer`. Owners can invite/remove members. Editors can mutate trips/days/activities. Viewers are read-only.
- All existing Go handlers (`trips.go`, `days.go`, `activities.go`) must check membership, not just `user_id` ownership, for read access.
- Invite flow: owner sends email invite → recipient clicks link → logs in → automatically added as member.
- Realtime channel name: `trip:<tripId>` — broadcast on every write mutation.
- New env var (Go backend): none (uses existing `DATABASE_URL`). New env var (Next.js): none (uses existing Supabase client).

---

## File Map

```
supabase/migrations/
└── 003_trip_members.sql          CREATE — trip_members table + RLS

backend/internal/
├── handlers/
│   └── members.go                CREATE — invite, list, remove members
└── middleware/
    └── trip_access.go            CREATE — role-check middleware for trip routes

src/
├── hooks/
│   └── useTripRealtime.ts        CREATE — Supabase Realtime subscription
├── components/
│   └── collaboration/
│       ├── CollaboratorAvatars.tsx  CREATE — avatar row on timeline header
│       ├── InviteModal.tsx          CREATE — invite by email form
│       └── MembersPanel.tsx         CREATE — list members + remove button
└── app/(app)/trips/[id]/
    └── settings/page.tsx         MODIFY — add Members section
```

---

## Task 1: Database schema — `trip_members` table

**Files:**
- Create: `supabase/migrations/003_trip_members.sql`

- [ ] **Step 1: Create `supabase/migrations/003_trip_members.sql`**

```sql
create table if not exists trip_members (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  invited_by uuid references profiles(id),
  invited_email text,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  unique(trip_id, user_id)
);

alter table trip_members enable row level security;

drop policy if exists "Members can view their trip's member list" on trip_members;
create policy "Members can view their trip's member list" on trip_members
  for select using (
    user_id = auth.uid()
    or trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );

drop policy if exists "Owners can manage members" on trip_members;
create policy "Owners can manage members" on trip_members
  for all using (
    trip_id in (
      select trip_id from trip_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Seed: make every existing trip owner a member
insert into trip_members (trip_id, user_id, role)
  select id, user_id, 'owner' from trips
  on conflict (trip_id, user_id) do nothing;
```

- [ ] **Step 2: Apply migration**

```bash
# Via Supabase CLI:
supabase db push

# Or paste into Supabase Dashboard → SQL Editor
```

- [ ] **Step 3: Verify**

```sql
-- Should return 0 rows (all owners are now members)
select t.id from trips t
left join trip_members m on m.trip_id = t.id and m.user_id = t.user_id
where m.id is null;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_trip_members.sql
git commit -m "feat: add trip_members table with role-based access"
```

---

## Task 2: Go — member handlers

**Files:**
- Create: `backend/internal/handlers/members.go`

- [ ] **Step 1: Create `backend/internal/handlers/members.go`**

```go
package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MemberHandler struct{ db *pgxpool.Pool }

func NewMemberHandler(db *pgxpool.Pool) *MemberHandler { return &MemberHandler{db: db} }

type memberRow struct {
	UserID    string  `json:"user_id"`
	FullName  string  `json:"full_name"`
	AvatarURL string  `json:"avatar_url"`
	Role      string  `json:"role"`
	AcceptedAt *string `json:"accepted_at"`
}

func (h *MemberHandler) List(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")

	if !h.isMember(tripID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	rows, err := h.db.Query(context.Background(),
		`SELECT m.user_id, COALESCE(p.full_name,''), COALESCE(p.avatar_url,''),
		        m.role, m.accepted_at::text
		 FROM trip_members m
		 LEFT JOIN profiles p ON p.id = m.user_id
		 WHERE m.trip_id=$1 ORDER BY m.created_at`, tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var members []memberRow
	for rows.Next() {
		var m memberRow
		rows.Scan(&m.UserID, &m.FullName, &m.AvatarURL, &m.Role, &m.AcceptedAt)
		members = append(members, m)
	}
	if members == nil {
		members = []memberRow{}
	}
	c.JSON(http.StatusOK, gin.H{"data": members})
}

func (h *MemberHandler) Invite(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")

	if !h.isOwner(tripID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only trip owners can invite"})
		return
	}

	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Role == "owner" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot invite as owner"})
		return
	}

	// Look up user by email via profiles (only works if they already signed up)
	var inviteeID *string
	h.db.QueryRow(context.Background(),
		`SELECT id FROM auth.users WHERE email=$1`, body.Email).Scan(&inviteeID)

	var inviteID string
	err := h.db.QueryRow(context.Background(),
		`INSERT INTO trip_members (trip_id, user_id, role, invited_by, invited_email)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (trip_id, user_id) DO UPDATE SET role=EXCLUDED.role
		 RETURNING id`,
		tripID, inviteeID, body.Role, userID, body.Email).Scan(&inviteID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"invite_id": inviteID}})
}

func (h *MemberHandler) Remove(c *gin.Context) {
	userID := c.GetString("user_id")
	tripID := c.Param("tripId")
	targetUserID := c.Param("userId")

	if !h.isOwner(tripID, userID) && userID != targetUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	h.db.Exec(context.Background(),
		`DELETE FROM trip_members WHERE trip_id=$1 AND user_id=$2 AND role != 'owner'`,
		tripID, targetUserID)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"removed": true}})
}

func (h *MemberHandler) isMember(tripID, userID string) bool {
	var count int
	h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM trip_members WHERE trip_id=$1 AND user_id=$2`, tripID, userID).Scan(&count)
	return count > 0
}

func (h *MemberHandler) isOwner(tripID, userID string) bool {
	var count int
	h.db.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM trip_members WHERE trip_id=$1 AND user_id=$2 AND role='owner'`,
		tripID, userID).Scan(&count)
	return count > 0
}
```

- [ ] **Step 2: Update existing trip/day/activity handlers to allow member read access**

In `trips.go` — `List` and `Get` — replace `WHERE user_id=$1` with:
```go
// Allow owners AND members to read:
`WHERE id IN (SELECT trip_id FROM trip_members WHERE user_id=$1)`, userID
```

In `days.go` — `ListForTrip` — replace the ownership check with:
```go
h.db.QueryRow(context.Background(),
    `SELECT COUNT(*) FROM trip_members WHERE trip_id=$1 AND user_id=$2`, tripID, userID).Scan(&count)
```

- [ ] **Step 3: Wire routes into `main.go`**

```go
members := handlers.NewMemberHandler(pool)
v1.GET("/trips/:tripId/members", members.List)
v1.POST("/trips/:tripId/members", members.Invite)
v1.DELETE("/trips/:tripId/members/:userId", members.Remove)
```

- [ ] **Step 4: Test**

```bash
TOKEN=...
TRIP_ID=...

# List members
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/trips/$TRIP_ID/members
# {"data":[{"user_id":"...","full_name":"...","role":"owner",...}]}

# Invite
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"friend@example.com","role":"editor"}' \
  http://localhost:8080/api/v1/trips/$TRIP_ID/members
# {"data":{"invite_id":"..."}}
```

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add trip member invite/list/remove handlers with role checks"
```

---

## Task 3: Next.js — Realtime subscription hook

**Files:**
- Create: `src/hooks/useTripRealtime.ts`

- [ ] **Step 1: Create `src/hooks/useTripRealtime.ts`**

```typescript
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Handler = () => void;

export function useTripRealtime(tripId: string, onUpdate: Handler) {
  useEffect(() => {
    if (!tripId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "activities", filter: `trip_id=eq.${tripId}` },
        onUpdate)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "days", filter: `trip_id=eq.${tripId}` },
        onUpdate)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId, onUpdate]);
}
```

- [ ] **Step 2: Use the hook in `TimelineClient.tsx`**

```typescript
import { useTripRealtime } from "@/hooks/useTripRealtime";
import { useCallback } from "react";

// Inside the component:
const refreshDays = useCallback(async () => {
  const { data } = await api.get<{ data: Day[] }>(`/api/v1/trips/${tripId}/days`);
  setDays(data);
}, [tripId]);

useTripRealtime(tripId, refreshDays);
```

- [ ] **Step 3: Create `src/components/collaboration/CollaboratorAvatars.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Member {
  user_id: string;
  full_name: string;
  avatar_url: string;
  role: string;
}

export function CollaboratorAvatars({ tripId }: { tripId: string }) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    api.get<{ data: Member[] }>(`/api/v1/trips/${tripId}/members`)
      .then(r => setMembers(r.data))
      .catch(() => {});
  }, [tripId]);

  if (members.length <= 1) return null;

  return (
    <div className="flex -space-x-2">
      {members.slice(0, 5).map(m => (
        <div key={m.user_id} title={m.full_name}
          className="w-7 h-7 rounded-full border-2 border-white bg-[#2D6A4F] flex items-center justify-center text-white text-xs font-semibold overflow-hidden">
          {m.avatar_url
            ? <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
            : m.full_name[0]?.toUpperCase() ?? "?"}
        </div>
      ))}
      {members.length > 5 && (
        <div className="w-7 h-7 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs text-gray-600 font-semibold">
          +{members.length - 5}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/collaboration/InviteModal.tsx`**

```typescript
"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export function InviteModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleInvite() {
    setStatus("sending");
    try {
      await api.post(`/api/v1/trips/${tripId}/members`, { email, role });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Invite travel partner</h2>
        <input
          type="email" placeholder="friend@example.com" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
        />
        <select value={role} onChange={e => setRole(e.target.value as "editor" | "viewer")}
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm">
          <option value="editor">Editor — can edit the itinerary</option>
          <option value="viewer">Viewer — read-only</option>
        </select>
        <div className="flex gap-2">
          <button onClick={handleInvite} disabled={status === "sending" || !email}
            className="flex-1 bg-[#2D6A4F] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {status === "sending" ? "Sending…" : status === "done" ? "Sent!" : "Send invite"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-gray-500">Cancel</button>
        </div>
        {status === "error" && <p className="text-red-500 text-xs mt-2">Failed to invite. Check the email address.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add `CollaboratorAvatars` and invite button to timeline header**

In `src/app/(app)/trips/[id]/timeline/page.tsx` or the timeline header component, add:
```tsx
import { CollaboratorAvatars } from "@/components/collaboration/CollaboratorAvatars";
// In the header row:
<CollaboratorAvatars tripId={tripId} />
```

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: add realtime collaboration — live timeline sync + invite modal + member avatars"
```

---

## Verification Checklist

- [ ] Migration applied — `trip_members` table exists with RLS policies
- [ ] All existing trips have owner row in `trip_members`
- [ ] `GET /api/v1/trips/:tripId/members` returns member list
- [ ] `POST /api/v1/trips/:tripId/members` creates invite
- [ ] Viewer cannot edit activities (Go returns 403 on mutations)
- [ ] Open the same trip in two browser tabs — editing an activity in one refreshes the other
- [ ] `CollaboratorAvatars` shows up when a trip has 2+ members
- [ ] `InviteModal` sends invite and shows "Sent!" state
