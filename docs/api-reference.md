# TrailGuide AI — API Reference

All routes are under `/api/`. Authenticated routes require a valid Supabase session cookie. All request and response bodies are JSON unless noted.

---

## AI Routes

### `POST /api/ai/generate-itinerary`

Generates a full day-by-day itinerary and saves it to the database.

**Auth:** Required

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

**Timeout:** `maxDuration = 60` (Vercel)

---

### `POST /api/ai/edit-itinerary`

AI-edits one or more activities based on a natural language instruction.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "instruction": "Move the museum visit to day 3 and add a sake tasting on day 2"
}
```

**Response:** Same shape as `generate-itinerary`.

---

### `POST /api/ai/chat`

Streaming AI companion. Returns a `text/event-stream` response.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "messages": [
    { "role": "user", "content": "What should I do tonight?" }
  ]
}
```

**Response:** SSE stream of text chunks. Final message includes suggested quick-reply chips in a `<!-- chips: [...] -->` comment.

---

### `POST /api/ai/recommendations`

Returns AI-generated nearby recommendations for the Discover tab.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "dayId": "uuid",
  "currentActivities": ["Senso-ji Temple", "Akihabara"]
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
      "address": "Yanaka, Taito, Tokyo"
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

### `POST /api/ai/trip-story`

Generates a 2-3 paragraph travel narrative for the Summary page.

**Auth:** Required

**Request:**
```json
{
  "tripId": "uuid",
  "tripTitle": "Tokyo Adventure",
  "destination": "Tokyo, Japan",
  "completedActivities": ["Tsukiji Market", "Senso-ji", "Shibuya Crossing"]
}
```

**Response:**
```json
{
  "story": "The moment we landed at Haneda, Tokyo wrapped itself around us like..."
}
```

---

## Document Import

### `POST /api/documents/import`

Parses a travel document (email, PDF text, booking confirmation) and extracts structured data.

**Auth:** Required

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
    "arrival": "2026-08-07T18:45:00+00:00",
    "from": "Tokyo Narita",
    "to": "London Heathrow"
  }
}
```

---

## Photos

### `GET /api/places/photo`

Proxies a place photo from Wikipedia or Unsplash. Returns image bytes (not a redirect) for html2canvas CORS compatibility.

**Auth:** None required

**Query params:**
- `query` — search term (e.g. `Senso-ji Temple Tokyo`)

**Response:** Image bytes with `Content-Type: image/*` and `Access-Control-Allow-Origin: *`

---

## Telegram

### `POST /api/telegram/webhook`

grammy webhook handler. Called by Telegram servers. Not for direct use.

**Auth:** None (verified by Telegram token in URL)

---

### `POST /api/telegram/link`

Saves a Telegram Chat ID to the authenticated user's profile.

**Auth:** Required

**Request:**
```json
{
  "chatId": "123456789"
}
```

**Response:**
```json
{ "success": true }
```

**Errors:**
```json
{ "error": "Invalid chat ID" }        // non-numeric
{ "error": "Not authenticated" }      // no session
```

---

## Weather

### `GET /api/weather`

Proxies Open-Meteo weather data for a location.

**Auth:** None required

**Query params:**
- `lat` — latitude
- `lng` — longitude

**Response:** Open-Meteo current weather object (temperature, weather code, wind speed).

---

## Notes

- All AI routes use Groq (`llama-3.3-70b-versatile` for planning, `llama-3.1-8b-instant` for fast tasks).
- Heavy routes export `maxDuration = 60` for Vercel's 60-second function timeout.
- The service role client (`createServiceClient`) is used only in trusted server contexts (Telegram webhook, public share page). Never expose the service role key to the client.
