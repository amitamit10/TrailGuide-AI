# TrailGuide AI — Phase 21: Photo Journal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload photos during or after their trip and attach them to specific activities. Photos appear as thumbnails on timeline activity cards and as a mosaic on the Summary page. AI auto-generates a caption for each uploaded photo using Groq.

**Architecture:** Photos upload directly from the browser to Supabase Storage (signed upload URLs — no proxy needed). Metadata (storage path, caption, activity link) goes into a new `activity_photos` table via the Go backend. The Python AI service gets a new `POST /ai/caption` route that takes the photo URL and returns a one-line caption using Groq (text description, not vision — prompt contains the activity title and destination as context). The `html2canvas` summary export already works; photos will appear naturally when they're in the DOM.

**Tech Stack:** Supabase Storage (direct browser upload). Go (Gin, pgx) — photo metadata CRUD. Python FastAPI — AI caption. Next.js — upload UI, timeline thumbnails, summary mosaic.

**Prerequisite:** Phase 19 complete (Go backend, Python AI service running).

## Global Constraints

- Supabase Storage bucket: `activity-photos` (public read, authenticated write).
- Max upload size: 10 MB per photo. Accepted types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
- Upload flow: browser gets signed upload URL from Go backend → uploads directly to Supabase Storage → sends metadata (path, activity_id) to Go backend → Go calls Python `/ai/caption` with the public URL → stores caption in DB.
- New table: `activity_photos` (see Task 1 schema).
- New Go routes: `GET /api/v1/activities/:id/photos`, `POST /api/v1/activities/:id/photos`, `DELETE /api/v1/photos/:id`.
- New Python route: `POST /ai/caption`.
- New env var (Go backend): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for generating signed URLs).

---

## File Map

```
supabase/migrations/
└── 004_activity_photos.sql          CREATE — activity_photos table + bucket policy

backend/internal/handlers/
└── photos.go                        CREATE — signed URL + photo metadata CRUD

ai-service/routers/
└── caption.py                       CREATE — POST /ai/caption (Groq text caption)

src/
├── components/
│   ├── photos/
│   │   ├── PhotoUpload.tsx          CREATE — drag-drop / camera upload button
│   │   ├── PhotoThumbnails.tsx      CREATE — row of thumbnails on activity card
│   │   └── PhotoMosaic.tsx          CREATE — grid on Summary page
│   └── itinerary/
│       └── ActivityCard.tsx         MODIFY — add PhotoThumbnails + upload button
└── app/(app)/trips/[id]/
    └── summary/
        └── SummaryClient.tsx        MODIFY — add PhotoMosaic section
```

---

## Task 1: Database schema and Storage bucket

**Files:**
- Create: `supabase/migrations/004_activity_photos.sql`

- [ ] **Step 1: Create `supabase/migrations/004_activity_photos.sql`**

```sql
create table if not exists activity_photos (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid references activities(id) on delete cascade not null,
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  storage_path text not null,
  public_url text not null,
  caption text,
  file_size_bytes int,
  created_at timestamptz default now()
);

alter table activity_photos enable row level security;

drop policy if exists "Users can view photos for their trips" on activity_photos;
create policy "Users can view photos for their trips" on activity_photos
  for select using (
    trip_id in (select trip_id from trip_members where user_id = auth.uid())
  );

drop policy if exists "Users can upload photos to their trips" on activity_photos;
create policy "Users can upload photos to their trips" on activity_photos
  for insert with check (
    trip_id in (
      select trip_id from trip_members where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

drop policy if exists "Users can delete their own photos" on activity_photos;
create policy "Users can delete their own photos" on activity_photos
  for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Create the Supabase Storage bucket**

In Supabase Dashboard → Storage → New bucket:
- Name: `activity-photos`
- Public: YES (so photo URLs work in `<img>` tags without auth)
- Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`
- Max file size: 10 MB

Or via SQL:
```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-photos', 'activity-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "Authenticated users can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'activity-photos');

create policy "Anyone can view" on storage.objects
  for select using (bucket_id = 'activity-photos');

create policy "Users can delete own uploads" on storage.objects
  for delete to authenticated
  using (bucket_id = 'activity-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 3: Apply migration**

```bash
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_activity_photos.sql
git commit -m "feat: add activity_photos table and Supabase Storage bucket for photo uploads"
```

---

## Task 2: Go — photo upload handler

**Files:**
- Create: `backend/internal/handlers/photos.go`

The Go backend generates a signed Supabase Storage upload URL so the browser uploads directly — Go never proxies the image bytes.

- [ ] **Step 1: Add Supabase URL + service key to config**

In `backend/internal/config/config.go`, add:
```go
SupabaseURL:            mustEnv("SUPABASE_URL"),
SupabaseServiceRoleKey: mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
```

- [ ] **Step 2: Create `backend/internal/handlers/photos.go`**

```go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PhotoHandler struct {
	db                    *pgxpool.Pool
	supabaseURL           string
	supabaseServiceRoleKey string
	aiServiceURL          string
	internalAPISecret     string
}

func NewPhotoHandler(db *pgxpool.Pool, supabaseURL, serviceKey, aiURL, internalSecret string) *PhotoHandler {
	return &PhotoHandler{db: db, supabaseURL: supabaseURL,
		supabaseServiceRoleKey: serviceKey, aiServiceURL: aiURL, internalAPISecret: internalSecret}
}

func (h *PhotoHandler) GetUploadURL(c *gin.Context) {
	userID := c.GetString("user_id")
	activityID := c.Param("activityId")

	// Verify access
	var tripID string
	err := h.db.QueryRow(context.Background(),
		`SELECT a.trip_id FROM activities a
		 JOIN trip_members m ON m.trip_id = a.trip_id
		 WHERE a.id=$1 AND m.user_id=$2 AND m.role IN ('owner','editor')`,
		activityID, userID).Scan(&tripID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	var body struct {
		FileName    string `json:"file_name"`
		ContentType string `json:"content_type"`
		FileSize    int    `json:"file_size_bytes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build storage path: userID/tripID/uuid.ext
	ext := filepath.Ext(body.FileName)
	storagePath := fmt.Sprintf("%s/%s/%s%s", userID, tripID, uuid.New().String(), ext)

	// Request signed upload URL from Supabase Storage API
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", h.supabaseURL, "activity-photos", storagePath)
	req, _ := http.NewRequest(http.MethodPost,
		fmt.Sprintf("%s/storage/v1/object/upload/sign/activity-photos/%s", h.supabaseURL, storagePath),
		nil)
	req.Header.Set("Authorization", "Bearer "+h.supabaseServiceRoleKey)
	req.Header.Set("x-upsert", "false")
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate upload URL"})
		return
	}
	defer resp.Body.Close()
	var signResp struct {
		SignedURL string `json:"signedURL"`
		Token     string `json:"token"`
	}
	json.NewDecoder(resp.Body).Decode(&signResp)

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/activity-photos/%s", h.supabaseURL, storagePath)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"upload_url":  signResp.SignedURL,
		"storage_path": storagePath,
		"public_url":  publicURL,
		"upload_method": "PUT",
	}})
	_ = uploadURL
}

func (h *PhotoHandler) SaveMetadata(c *gin.Context) {
	userID := c.GetString("user_id")
	activityID := c.Param("activityId")

	var body struct {
		StoragePath   string `json:"storage_path"`
		PublicURL     string `json:"public_url"`
		FileSizeBytes int    `json:"file_size_bytes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get activity context for caption generation
	var activityTitle, destination string
	err := h.db.QueryRow(context.Background(),
		`SELECT a.title, t.destination FROM activities a
		 JOIN trips t ON t.id=a.trip_id
		 WHERE a.id=$1`, activityID).Scan(&activityTitle, &destination)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "activity not found"})
		return
	}

	// Get tripID for insert
	var tripID string
	h.db.QueryRow(context.Background(),
		`SELECT trip_id FROM activities WHERE id=$1`, activityID).Scan(&tripID)

	// Call Python AI for caption (non-blocking: skip on error)
	caption := h.generateCaption(activityTitle, destination, body.PublicURL)

	var photoID string
	err = h.db.QueryRow(context.Background(),
		`INSERT INTO activity_photos (activity_id, trip_id, user_id, storage_path, public_url, caption, file_size_bytes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		activityID, tripID, userID, body.StoragePath, body.PublicURL, caption, body.FileSizeBytes).Scan(&photoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{
		"id": photoID, "caption": caption, "public_url": body.PublicURL,
	}})
}

func (h *PhotoHandler) List(c *gin.Context) {
	activityID := c.Param("activityId")
	rows, _ := h.db.Query(context.Background(),
		`SELECT id, public_url, caption, created_at FROM activity_photos
		 WHERE activity_id=$1 ORDER BY created_at`, activityID)
	defer rows.Close()
	type row struct {
		ID        string `json:"id"`
		PublicURL string `json:"public_url"`
		Caption   string `json:"caption"`
		CreatedAt string `json:"created_at"`
	}
	var photos []row
	for rows.Next() {
		var r row
		rows.Scan(&r.ID, &r.PublicURL, &r.Caption, &r.CreatedAt)
		photos = append(photos, r)
	}
	if photos == nil { photos = []row{} }
	c.JSON(http.StatusOK, gin.H{"data": photos})
}

func (h *PhotoHandler) Delete(c *gin.Context) {
	userID := c.GetString("user_id")
	photoID := c.Param("photoId")
	h.db.Exec(context.Background(),
		`DELETE FROM activity_photos WHERE id=$1 AND user_id=$2`, photoID, userID)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}

func (h *PhotoHandler) generateCaption(activityTitle, destination, photoURL string) string {
	payload, _ := json.Marshal(map[string]string{
		"activity_title": activityTitle,
		"destination":    destination,
		"photo_url":      photoURL,
	})
	req, _ := http.NewRequest(http.MethodPost,
		h.aiServiceURL+"/ai/caption", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", h.internalAPISecret)
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK { return "" }
	defer resp.Body.Close()
	var result struct{ Caption string `json:"caption"` }
	json.NewDecoder(resp.Body).Decode(&result)
	return strings.TrimSpace(result.Caption)
}
```

- [ ] **Step 3: Wire routes into `main.go`**

```go
photos := handlers.NewPhotoHandler(pool, cfg.SupabaseURL, cfg.SupabaseServiceRoleKey,
    cfg.AIServiceURL, cfg.InternalAPISecret)
v1.POST("/activities/:activityId/photos/upload-url", photos.GetUploadURL)
v1.POST("/activities/:activityId/photos", photos.SaveMetadata)
v1.GET("/activities/:activityId/photos", photos.List)
v1.DELETE("/photos/:photoId", photos.Delete)
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/photos.go backend/internal/config/config.go backend/main.go
git commit -m "feat: add photo upload handler with Supabase Storage signed URLs and AI captions"
```

---

## Task 3: Python — AI caption route

**Files:**
- Create: `ai-service/routers/caption.py`

- [ ] **Step 1: Create `ai-service/routers/caption.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class CaptionRequest(BaseModel):
    activity_title: str
    destination: str
    photo_url: str

@router.post("/caption")
async def caption_photo(req: CaptionRequest):
    groq = get_groq()
    prompt = f"""Write a short, vivid one-line photo caption (max 12 words) for a travel photo.
Activity: {req.activity_title}
Destination: {req.destination}

The caption should feel personal and evocative, like a social media caption. No hashtags. No quotes."""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=50,
        temperature=0.9,
    )
    return {"caption": completion.choices[0].message.content.strip().strip('"')}
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import caption
app.include_router(caption.router)
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST http://localhost:8081/ai/caption \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret" \
  -d '{"activity_title":"Eiffel Tower Visit","destination":"Paris, France","photo_url":"https://..."}' \
  | python3 -m json.tool
# {"caption":"Golden hour magic at the iron lady of Paris"}
```

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/caption.py ai-service/main.py
git commit -m "feat: add AI photo caption route (Groq llama-3.1-8b-instant)"
```

---

## Task 4: Next.js — upload UI and photo display

**Files:**
- Create: `src/components/photos/PhotoUpload.tsx`
- Create: `src/components/photos/PhotoThumbnails.tsx`
- Create: `src/components/photos/PhotoMosaic.tsx`

- [ ] **Step 1: Create `src/components/photos/PhotoUpload.tsx`**

```typescript
"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface Props {
  activityId: string;
  onUploaded: (photo: { id: string; public_url: string; caption: string }) => void;
}

export function PhotoUpload({ activityId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file || uploading) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Photo must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      // Step 1: get signed upload URL
      const { data: urlData } = await api.post<{
        data: { upload_url: string; storage_path: string; public_url: string };
      }>(`/api/v1/activities/${activityId}/photos/upload-url`, {
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      });

      // Step 2: upload directly to Supabase Storage
      await fetch(urlData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // Step 3: save metadata + get AI caption
      const { data: photo } = await api.post<{
        data: { id: string; public_url: string; caption: string };
      }>(`/api/v1/activities/${activityId}/photos`, {
        storage_path: urlData.storage_path,
        public_url: urlData.public_url,
        file_size_bytes: file.size,
      });

      onUploaded(photo);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        className="text-xs text-[#2D6A4F] font-medium disabled:opacity-50">
        {uploading ? "Uploading…" : "+ Add photo"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/photos/PhotoThumbnails.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PhotoUpload } from "./PhotoUpload";

interface Photo {
  id: string;
  public_url: string;
  caption: string;
}

export function PhotoThumbnails({ activityId }: { activityId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  useEffect(() => {
    api.get<{ data: Photo[] }>(`/api/v1/activities/${activityId}/photos`)
      .then(r => setPhotos(r.data))
      .catch(() => {});
  }, [activityId]);

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2">
      {photos.map(p => (
        <button key={p.id} onClick={() => setLightbox(p)}
          className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
          <img src={p.public_url} alt={p.caption} className="w-full h-full object-cover" />
        </button>
      ))}
      <PhotoUpload activityId={activityId}
        onUploaded={p => setPhotos(prev => [...prev, p])} />
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50"
          onClick={() => setLightbox(null)}>
          <img src={lightbox.public_url} alt={lightbox.caption}
            className="max-h-[80vh] max-w-[90vw] rounded-lg" />
          {lightbox.caption && (
            <p className="text-white text-sm mt-3 text-center px-4">{lightbox.caption}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/photos/PhotoMosaic.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Photo {
  id: string;
  public_url: string;
  caption: string;
}

export function PhotoMosaic({ tripId }: { tripId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    // Fetch all photos for the trip via days → activities
    api.get<{ data: any[] }>(`/api/v1/trips/${tripId}/days`).then(async ({ data: days }) => {
      const allPhotos: Photo[] = [];
      for (const day of days) {
        for (const act of day.activities ?? []) {
          const r = await api.get<{ data: Photo[] }>(`/api/v1/activities/${act.id}/photos`);
          allPhotos.push(...r.data);
        }
      }
      setPhotos(allPhotos);
    }).catch(() => {});
  }, [tripId]);

  if (photos.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-gray-800 mb-3">Trip Photos</h3>
      <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">
        {photos.slice(0, 9).map(p => (
          <div key={p.id} className="aspect-square overflow-hidden">
            <img src={p.public_url} alt={p.caption}
              className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 9 && (
        <p className="text-xs text-gray-500 mt-2 text-center">+{photos.length - 9} more photos</p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire `PhotoThumbnails` into activity cards and `PhotoMosaic` into summary**

In the activity card component — add below the activity description:
```tsx
import { PhotoThumbnails } from "@/components/photos/PhotoThumbnails";
<PhotoThumbnails activityId={activity.id} />
```

In `SummaryClient.tsx` — add below the trip story:
```tsx
import { PhotoMosaic } from "@/components/photos/PhotoMosaic";
<PhotoMosaic tripId={tripId} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/photos/ src/components/itinerary/ src/app/(app)/trips/
git commit -m "feat: add photo journal — upload, AI captions, timeline thumbnails, summary mosaic"
```

---

## Verification Checklist

- [ ] `activity_photos` table created with RLS
- [ ] `activity-photos` Supabase Storage bucket is public
- [ ] `POST /api/v1/activities/:id/photos/upload-url` returns a signed URL
- [ ] Browser upload goes directly to Supabase Storage (check Network tab — PUT to Supabase URL)
- [ ] Uploaded photo appears as thumbnail on the activity card
- [ ] Caption is generated and stored (check DB: `SELECT caption FROM activity_photos LIMIT 5`)
- [ ] Clicking thumbnail opens lightbox with caption
- [ ] Summary page shows photo mosaic for trips with photos
- [ ] Deleting a photo removes it from the UI
- [ ] File over 10 MB shows alert
