# TrailGuide AI — Phase 46: Weather Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a 7-day weather forecast on the trip timeline. Flag outdoor activities on rainy/stormy days with a warning badge. AI suggests indoor alternatives for weather-affected activities. Weather data is cached in PostgreSQL per location per day (12-hour TTL).

**Architecture:** Go fetches weather from Open-Meteo (free, no API key) geocoding + forecast API. Results cached in `weather_cache` table (location_key + date). On timeline load, Go fetches weather for the trip's location for the upcoming 7 days and returns it alongside day data. Python `POST /ai/weather-alternatives` suggests indoor alternatives for rainy-day outdoor activities.

**Tech Stack:** Open-Meteo API (free, no key), Go (geocoding + forecast + cache), Python (AI alternatives), Next.js (weather icons + warning badges).

**Prerequisite:** Phase 19 (Go backend). Phase 17 (Python AI service).

## Global Constraints
- Open-Meteo URLs: geocoding at `https://geocoding-api.open-meteo.com/v1/search?name={city}`, forecast at `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=weathercode,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`.
- Weather cache TTL: 12 hours (only matters for trips currently happening or starting soon).
- Only fetch weather for trips with `start_date <= today + 7 days`.
- Outdoor categories that show weather warnings: `"attraction"` and `"free"` (not food/hotel/transport).
- WMO weather codes: 0 = clear, 1-3 = clouds, 51-67 = rain, 71-77 = snow, 80-82 = showers, 95+ = thunderstorm.

---

## Task 1: Database + Open-Meteo integration

- [ ] **Step 1: Create `supabase/migrations/014_weather.sql`**

```sql
create table if not exists weather_cache (
  location_key text not null,  -- "lat,lon" rounded to 2 decimals
  forecast_date date not null,
  weather_code int not null,
  precip_mm numeric(5,1) default 0,
  temp_max_c numeric(5,1),
  temp_min_c numeric(5,1),
  fetched_at timestamptz default now(),
  primary key (location_key, forecast_date)
);

-- Auto-clean cache older than 2 days
create index if not exists weather_cache_fetched_idx on weather_cache(fetched_at);
```

```bash
supabase db push
```

- [ ] **Step 2: Create `backend/internal/services/weather.go`**

```go
package services

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

type WeatherDay struct {
    Date        string  `json:"date"`
    WeatherCode int     `json:"weather_code"`
    PrecipMM    float64 `json:"precip_mm"`
    TempMaxC    float64 `json:"temp_max_c"`
    TempMinC    float64 `json:"temp_min_c"`
}

type WeatherClient struct {
    db     *pgxpool.Pool
    client *http.Client
}

func NewWeatherClient(db *pgxpool.Pool) *WeatherClient {
    return &WeatherClient{db: db, client: &http.Client{Timeout: 10 * time.Second}}
}

func (w *WeatherClient) GetForecast(ctx context.Context, destination string, startDate string) ([]WeatherDay, error) {
    // Geocode the destination
    lat, lon, err := w.geocode(ctx, destination)
    if err != nil { return nil, err }

    locationKey := fmt.Sprintf("%.2f,%.2f", lat, lon)

    // Check cache
    cached, err := w.fromCache(ctx, locationKey, startDate)
    if err == nil && len(cached) > 0 { return cached, nil }

    // Fetch from Open-Meteo
    url := fmt.Sprintf(
        "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f"+
            "&daily=weathercode,precipitation_sum,temperature_2m_max,temperature_2m_min"+
            "&timezone=auto&forecast_days=7&start_date=%s",
        lat, lon, startDate)

    resp, err := w.client.Get(url)
    if err != nil || resp.StatusCode != 200 { return nil, fmt.Errorf("weather API unavailable") }
    defer resp.Body.Close()

    var result struct {
        Daily struct {
            Time        []string  `json:"time"`
            WeatherCode []int     `json:"weathercode"`
            PrecipSum   []float64 `json:"precipitation_sum"`
            TempMax     []float64 `json:"temperature_2m_max"`
            TempMin     []float64 `json:"temperature_2m_min"`
        } `json:"daily"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil { return nil, err }

    var days []WeatherDay
    for i, date := range result.Daily.Time {
        day := WeatherDay{
            Date:        date,
            WeatherCode: result.Daily.WeatherCode[i],
            PrecipMM:    result.Daily.PrecipSum[i],
            TempMaxC:    result.Daily.TempMax[i],
            TempMinC:    result.Daily.TempMin[i],
        }
        days = append(days, day)
        // Cache it
        w.db.Exec(ctx,
            `INSERT INTO weather_cache (location_key, forecast_date, weather_code, precip_mm, temp_max_c, temp_min_c)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (location_key, forecast_date) DO UPDATE SET
             weather_code=$3, precip_mm=$4, temp_max_c=$5, temp_min_c=$6, fetched_at=NOW()`,
            locationKey, date, day.WeatherCode, day.PrecipMM, day.TempMaxC, day.TempMinC)
    }
    return days, nil
}

func (w *WeatherClient) geocode(ctx context.Context, destination string) (float64, float64, error) {
    url := fmt.Sprintf("https://geocoding-api.open-meteo.com/v1/search?name=%s&count=1", destination)
    resp, err := w.client.Get(url)
    if err != nil || resp.StatusCode != 200 { return 0, 0, fmt.Errorf("geocoding failed") }
    defer resp.Body.Close()
    var result struct {
        Results []struct {
            Latitude  float64 `json:"latitude"`
            Longitude float64 `json:"longitude"`
        } `json:"results"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    if len(result.Results) == 0 { return 0, 0, fmt.Errorf("location not found: %s", destination) }
    return result.Results[0].Latitude, result.Results[0].Longitude, nil
}

func (w *WeatherClient) fromCache(ctx context.Context, locationKey, startDate string) ([]WeatherDay, error) {
    rows, err := w.db.Query(ctx,
        `SELECT forecast_date, weather_code, precip_mm, temp_max_c, temp_min_c
         FROM weather_cache
         WHERE location_key=$1
           AND forecast_date >= $2
           AND fetched_at > NOW() - INTERVAL '12 hours'
         ORDER BY forecast_date
         LIMIT 7`, locationKey, startDate)
    if err != nil { return nil, err }
    defer rows.Close()
    var days []WeatherDay
    for rows.Next() {
        var d WeatherDay
        rows.Scan(&d.Date, &d.WeatherCode, &d.PrecipMM, &d.TempMaxC, &d.TempMinC)
        days = append(days, d)
    }
    if len(days) < 7 { return nil, fmt.Errorf("cache incomplete") }
    return days, nil
}

// IsRainy returns true for weather codes indicating rain/storms
func IsRainy(code int) bool {
    return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
}
```

- [ ] **Step 3: Add weather to the trip days endpoint**

In `backend/internal/handlers/days.go`, add weather data to the response:

```go
// Get weather for trip's upcoming days
weather, err := weatherClient.GetForecast(c.Request.Context(), trip.Destination, trip.StartDate)
if err != nil {
    weather = nil // silently degrade — weather is enhancement, not critical
}
// Map weather by date
weatherByDate := map[string]WeatherDay{}
for _, w := range weather { weatherByDate[w.Date] = w }

// In the response for each day, add weather field:
for i, day := range days {
    if w, ok := weatherByDate[day.Date]; ok {
        days[i]["weather"] = w
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/014_weather.sql backend/internal/services/weather.go backend/internal/handlers/days.go
git commit -m "feat: add Open-Meteo weather forecast with 12-hour PostgreSQL cache"
```

---

## Task 2: Python — weather-aware alternatives

- [ ] **Step 1: Create `ai-service/routers/weather_alternatives.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class AlternativeRequest(BaseModel):
    destination: str
    rainy_activities: List[str]  # Titles of outdoor activities on the rainy day
    date: str

@router.post("/weather-alternatives")
async def weather_alternatives(req: AlternativeRequest):
    groq = get_groq()
    acts = "\n".join(f"- {a}" for a in req.rainy_activities[:5])
    prompt = f"""It's going to rain in {req.destination} on {req.date}. The traveler has these outdoor activities planned:
{acts}

Suggest 3 excellent indoor alternatives in {req.destination} — things you can do when it's raining.
Make them specific to the city (not generic like "visit a museum").

Return ONLY valid JSON:
{{"alternatives": [{{"title": "...", "description": "one sentence", "category": "food|attraction|free", "why_rainy_day": "one sentence"}}]}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 2: Register in `main.py`**

```python
from routers import weather_alternatives
app.include_router(weather_alternatives.router)
```

- [ ] **Step 3: Commit**

```bash
git add ai-service/routers/weather_alternatives.py ai-service/main.py
git commit -m "feat: add AI indoor alternatives generator for rainy-day activities"
```

---

## Task 3: Next.js — weather UI

- [ ] **Step 1: Create `src/lib/weather.ts`** — weather code → emoji + label

```typescript
export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

export function isRainyCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}
```

- [ ] **Step 2: Add weather strip to day headers on timeline**

```typescript
// In the day header component:
{day.weather && (
  <div className="flex items-center gap-2 text-xs text-on-surface-2 mt-1">
    <span>{weatherEmoji(day.weather.weather_code)}</span>
    <span>{Math.round(day.weather.temp_max_c)}° / {Math.round(day.weather.temp_min_c)}°</span>
    {day.weather.precip_mm > 2 && <span className="text-blue-500">{day.weather.precip_mm}mm rain</span>}
  </div>
)}
```

- [ ] **Step 3: Add rain warning badge to outdoor activities on rainy days**

```typescript
// In activity card:
const isRainy = day.weather && isRainyCode(day.weather.weather_code);
const isOutdoor = ["attraction","free"].includes(activity.category);

{isRainy && isOutdoor && (
  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 mt-1">
    🌧️ Rain expected · <button className="underline" onClick={showAlternatives}>See alternatives</button>
  </span>
)}
```

- [ ] **Step 4: "See alternatives" calls Python and shows a bottom sheet**

When the user clicks "See alternatives", fetch `POST /api/v1/ai/weather-alternatives` (via Go proxy) and show a sheet with 3 indoor activity suggestions — each with an "Add to this day" button.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather.ts src/components/timeline/
git commit -m "feat: add weather forecast strip and rain warning badges with AI indoor alternatives"
```

---

## Verification Checklist

- [ ] `GET /api/v1/trips/:id/days` includes weather object on each day for near-future trips
- [ ] Weather cache: second call within 12 hours returns cached data (no external request)
- [ ] Trip more than 7 days away returns no weather (skip gracefully)
- [ ] Open-Meteo down → days still load, weather is null, no error shown to user
- [ ] Day headers show emoji + temperature + precipitation
- [ ] Outdoor activities on rainy days show the blue rain badge
- [ ] "See alternatives" fetches and shows 3 indoor suggestions
- [ ] "Add to this day" button adds a suggested alternative to the day's activities
