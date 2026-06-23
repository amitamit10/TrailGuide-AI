# TrailGuide AI — API Reference

All Next.js routes are under `/api/`. Authenticated routes require a valid Supabase session cookie. All request/response bodies are JSON unless noted.

Go backend routes are under `/api/v1/` and require a `Authorization: Bearer <supabase-jwt>` header.

---

## AI Routes

### `POST /api/ai/generate-itinerary`

Generates a full day-by-day itinerary and saves it to the database.

**Auth:** Required  
**Timeout:** `maxDuration = 60`

**Request:**
```json
{
  "tripId": "uuid",
  "destination": "Tokyo, Japan",
  "startDate": "2026-08-01",
  "endDate": "2026-08-07",
  "travelers": 2,
  "tripStyle": "explorer",
  "interests": ["food", "history", "art"],
  "transportMode": "public",
  "budget": "medium",
  "flightInfo": "Arrive HND 14:00 Aug 1",
  "hotelInfo": "Shinjuku district"
}
```

**Response:**
```json
{
  "success": true,
  "days": [
    {
      "id": "uuid",
      "date": "2026-08-01",
      "dayNumber": 1,
      "activities": [
        {
          "id": "uuid",
          "title": "Tsukiji Outer Market",
          "time": "08:00",
          "duration": "1.5 hours",
          "cost": 20,
          "category": "food",
          "address": "Tsukiji, Chuo, Tokyo"
        }
      ]
    }
  ]
}
```

---

### `POST /api/ai/edit-itinerary`

AI-edits one or more activities based on a natural language instruction.

**Auth:** Required  
**Timeout:** `maxDuration = 60`

**Request:**
```json
{
  "tripId": "uuid",
  "editCommand": "Move the museum visit to day 3 and add sake tasting on day 2"
}
```

**Response:** Same shape as `generate-itinerary`.

---

### `POST /api/ai/chat`

Streaming AI companion. Returns `text/event-stream`.

**Auth:** Required  
**Timeout:** `maxDuration = 60`

**Request:**
```json
{
  "tripId": "uuid",
  "message": "What should I do tonight?",
  "history": [
    { "role": "user", "parts": [{ "text": "I'm in Shibuya" }] },
    { "role": "model", "parts": [{ "text": "Shibuya Crossing at night is magical!" }] }
  ]
}
```

**Response:** SSE stream of text chunks. Final chunk includes suggested quick-reply chips in a `<!-- chips: [...] -->` comment.

---

### `POST /api/ai/recommendations`

Returns AI-generated nearby recommendations for the Discover tab.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "dayId": "uuid",
  "currentActivities": ["Senso-ji Temple", "Akihabara"],
  "count": 5
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "title": "Yanaka Cemetery",
      "description": "Peaceful historic cemetery with cherry trees.",
      "category": "attraction",
      "estimatedCost": 0,
      "duration": "1 hour",
      "address": "Yanaka, Taito, Tokyo",
      "lat": 35.7261,
      "lng": 139.7716
    }
  ]
}
```

---

### `POST /api/ai/replace-activity`

Suggests 3 alternative activities for a given activity.

**Auth:** Required

**Request:**
```json
{
  "activityId": "uuid",
  "tripId": "uuid",
  "currentTitle": "Tokyo Disneyland",
  "destination": "Tokyo, Japan",
  "date": "2026-08-03",
  "interests": ["food", "history"]
}
```

**Response:**
```json
{
  "alternatives": [
    {
      "title": "Edo-Tokyo Museum",
      "description": "...",
      "time": "10:00",
      "duration": "2 hours",
      "cost": 15,
      "category": "attraction",
      "address": "1-4-1 Yokoami, Sumida"
    }
  ]
}
```

---

### `POST /api/ai/preview-replace`

Previews activity replacement options without saving.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "activity": { "title": "Tokyo Disneyland", "start_time": "10:00", "end_time": "18:00", "duration_minutes": 480 },
  "neighbors": [],
  "destination": "Tokyo, Japan",
  "userRequest": "Something more cultural"
}
```

**Response:** Same shape as `replace-activity`.

---

### `POST /api/ai/trip-story`

Generates a 2–3 paragraph travel narrative for the Summary page.

**Auth:** Required  
**Timeout:** `maxDuration = 60`

**Request:**
```json
{
  "tripId": "uuid",
  "tripTitle": "Tokyo Adventure",
  "destination": "Tokyo, Japan",
  "completedActivities": [
    { "title": "Tsukiji Market", "description": "Morning tuna auction" }
  ]
}
```

**Response:**
```json
{ "story": "The moment we landed at Haneda..." }
```

---

### `POST /api/ai/packing-list`

Generates an AI packing list with weather context, saves to `checklist_items` (idempotent).

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "destination": "Tokyo, Japan",
  "startDate": "2026-08-01",
  "endDate": "2026-08-07",
  "travelStyle": "explorer",
  "travelers": 2,
  "interests": ["food", "hiking"]
}
```

**Response:**
```json
{ "success": true, "itemCount": 42 }
```

---

### `POST /api/ai/caption`

Generates an AI photo caption (≤15 words) for a travel photo.

**Auth:** Required

**Request:**
```json
{
  "activityTitle": "Senso-ji Temple",
  "destination": "Tokyo, Japan"
}
```

**Response:**
```json
{ "caption": "Golden lanterns glow at dawn in ancient Asakusa." }
```

---

### `POST /api/ai/companion`

Returns a live AI nudge based on current location and time.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "lat": 35.6762,
  "lng": 139.6503,
  "currentTime": "14:30"
}
```

**Response:**
```json
{ "nudge": "You're near Shinjuku — great time to visit Omoide Yokocho before dinner rush." }
```

---

## Document Import

### `POST /api/documents/import`

Parses a travel document (email, PDF text, booking confirmation) and extracts structured data.

**Auth:** Required  
**Timeout:** `maxDuration = 60`  
**Body limit:** 10 MB

**Request:**
```json
{
  "tripId": "uuid",
  "content": "Your flight confirmation: JAL 771 departs NRT 14:30..."
}
```

**Response:**
```json
{
  "extracted": {
    "type": "flight",
    "airline": "JAL",
    "flightNumber": "JL771",
    "departure": "2026-08-07T14:30:00+09:00",
    "from": "Tokyo Narita",
    "to": "London Heathrow"
  }
}
```

---

## Photos

### `GET /api/places/photo`

Proxies a place photo from Wikipedia or Unsplash. Returns image bytes (SSRF-protected, CORS-safe for html2canvas).

**Auth:** None (rate-limited: 30/min per IP)

**Query params:**
- `query` — search term (e.g. `Senso-ji Temple Tokyo`)

**Response:** Image bytes with `Content-Type: image/*`, `Access-Control-Allow-Origin: *`, `X-Content-Type-Options: nosniff`

---

### `POST /api/photos/upload-url`

Returns a signed Supabase Storage upload URL for a trip activity photo.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "activityId": "uuid",
  "filename": "photo.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{ "uploadUrl": "https://...", "storagePath": "uuid/activity-id/photo.jpg" }
```

---

### `GET /api/photos?activityId=uuid`

Lists photo metadata for an activity.

**Auth:** Required

**Response:**
```json
{
  "photos": [
    { "id": "uuid", "storagePath": "...", "caption": "Golden lanterns at dusk." }
  ]
}
```

---

### `POST /api/photos`

Saves photo metadata after a direct Storage upload. Triggers AI caption generation.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "activityId": "uuid",
  "storagePath": "uuid/activity-id/photo.jpg"
}
```

**Response:**
```json
{ "id": "uuid", "caption": "Golden lanterns at dusk." }
```

---

### `DELETE /api/photos?id=uuid`

Deletes a photo from the database and from Supabase Storage.

**Auth:** Required

**Response:** `204 No Content`

---

## Budget / Expenses

### `GET /api/expenses?tripId=uuid`

Lists all expenses for a trip.

**Auth:** Required (trip ownership checked)

---

### `POST /api/expenses`

Creates a new expense entry.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "title": "Sushi dinner",
  "amount": 85.00,
  "category": "food",
  "date": "2026-08-03"
}
```

**Response:**
```json
{ "id": "uuid" }
```

---

### `DELETE /api/expenses?id=uuid`

Deletes an expense.

**Auth:** Required

**Response:** `204 No Content`

---

### `GET /api/expenses/export?tripId=uuid`

Downloads expenses as a CSV file. Formula-injection safe (`csvSafe` escapes `=`, `+`, `-`, `@`).

**Auth:** Required

**Response:** `text/csv` attachment

---

## Checklist / Packing

### `PATCH /api/checklist/check`

Toggles `is_checked` on a checklist item.

**Auth:** Required

**Request:**
```json
{ "id": "uuid", "isChecked": true }
```

**Response:** `200 OK`

---

### `POST /api/checklist/item`

Adds a manual checklist item.

**Auth:** Required

**Request:**
```json
{ "tripId": "uuid", "title": "Sunscreen", "category": "health" }
```

**Response:**
```json
{ "id": "uuid" }
```

---

### `DELETE /api/checklist/item?id=uuid`

Removes a checklist item.

**Auth:** Required

**Response:** `204 No Content`

---

## Culture & Currency

### `GET /api/culture-pack?tripId=uuid`

Returns an AI-generated culture pack for the trip destination (7-day DB cache).

**Auth:** Required

**Response:**
```json
{
  "destination": "Tokyo, Japan",
  "phrases": [{ "local": "ありがとう", "pronunciation": "Arigatou", "meaning": "Thank you" }],
  "customs": { "tipping": "Not customary", "dress": "Smart casual", "dos": [...], "donts": [...] },
  "electricity": "100V / Type A",
  "waterSafety": "Tap water is safe to drink",
  "internet": "Excellent 4G/5G coverage; free Wi-Fi in convenience stores",
  "emergency": { "police": "110", "ambulance": "119", "tourist": "03-3501-0110" },
  "visaSummary": "Most nationalities get 90-day visa-free entry"
}
```

---

### `GET /api/currency?from=USD&to=JPY`

Returns a live exchange rate (1-hour DB cache, open.er-api.com).

**Auth:** None (rate-limited: 30/min per IP)

**Response:**
```json
{ "from": "USD", "to": "JPY", "rate": 149.82 }
```

**Headers:** `Cache-Control: public, max-age=3600`

---

## Visa

### `GET /api/visa?destination=Japan`

Returns visa requirements via Tavily search. Destination is validated (`^[A-Za-z ,'-]{1,100}$`). Source URLs are https-only.

**Auth:** None (rate-limited: 30/min per IP)

**Response:**
```json
{
  "required": false,
  "onArrival": true,
  "duration": "90 days",
  "summary": "Citizens of most countries receive a 90-day visa-free stamp on arrival.",
  "sources": ["https://www.mofa.go.jp/..."]
}
```

---

## Social

### `PATCH /api/trips/visibility`

Toggles a trip's `is_public` flag.

**Auth:** Required (ownership checked)

**Request:**
```json
{ "tripId": "uuid", "isPublic": true }
```

**Response:**
```json
{ "isPublic": true, "shareUrl": "https://your-app.vercel.app/share/uuid" }
```

---

### `POST /api/trips/clone`

Copies a public trip (itinerary_days + activities) into the authenticated user's account.

**Auth:** Required

**Request:**
```json
{ "tripId": "uuid" }
```

**Response:**
```json
{ "newTripId": "uuid" }
```

---

## Telegram

### `POST /api/telegram/webhook`

grammy webhook handler. Called by Telegram. Verified by `X-Telegram-Bot-Api-Secret-Token` (constant-time).

**Auth:** None (Telegram-verified)

---

### `POST /api/telegram/link`

Saves a Telegram Chat ID to the authenticated user's profile.

**Auth:** Required

**Request:**
```json
{ "chatId": "123456789" }
```

**Response:**
```json
{ "success": true }
```

---

## Weather

### `GET /api/weather?lat=35.6762&lng=139.6503`

Proxies Open-Meteo weather data. Validates `lat`/`lng` are finite numbers in range.

**Auth:** None (rate-limited: 30/min per IP)

**Response:** Open-Meteo current weather object (temperature, weather code, wind speed).

---

## Cron Jobs

All cron routes require `Authorization: Bearer <CRON_SECRET>` and are guarded by `crypto.timingSafeEqual`. They are also exempt from session middleware.

### `GET /api/cron/advance-trip-status`
Auto-transitions trip status (`planning→active→completed`) based on today's date.

### `GET /api/cron/daily-briefing`
Sends a Telegram message with today's activities for each active trip that has a linked Telegram chat.

### `GET /api/cron/pre-trip-reminder`
Sends a Resend HTML email 3 and 1 days before trip start.

---

## Go Backend (v1 API)

All routes require `Authorization: Bearer <supabase-jwt>`.

### `GET /api/v1/trips`
Returns all trips for the authenticated user.

### `POST /api/v1/trips`
Creates a new trip. Validates: `title` ≤500, `destination` ≤300, `start_date`/`end_date` ≤20 chars, `travelers` 1–50.

### `PUT /api/v1/trips/:id`
Updates a trip. Same field validation as POST. `status` must be `planning|active|completed`.

### `DELETE /api/v1/trips/:id`
Deletes a trip (ownership enforced by JWT `user_id`).

### `POST /api/v1/ai/*`, `/api/v1/documents/*`, `/api/v1/places/*`, `/api/v1/weather`
Proxied to the Python AI service with `X-Internal-Token`. 55 s HTTP client timeout.

---

## Notes

- All AI routes use Groq (`llama-3.3-70b-versatile` for planning, `llama-3.1-8b-instant` for fast tasks).
- Heavy routes export `maxDuration = 60` for Vercel's 60 s function timeout.
- `createServiceClient` (service role, bypasses RLS) is used only in: Telegram webhook, cron jobs, public share page.
- Input bounds are enforced at every layer: Next.js route, Go handler, and Python Pydantic model.
