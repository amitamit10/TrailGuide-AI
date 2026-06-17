# TrailGuide AI — Phase 17: Python AI Service (FastAPI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Python FastAPI service that handles all AI operations — itinerary generation, chat, recommendations, activity replacement, trip story, document import, photo proxy, and weather proxy — replacing the equivalent Next.js API routes.

**Architecture:** FastAPI with uvicorn. No database access — this service is pure AI/HTTP. The Go backend (Phase 16) calls this service via HTTP with an `X-Internal-Token` header. The service reads that token and rejects requests that don't match `INTERNAL_API_SECRET`. All Groq calls use the official Python SDK. Tavily, Wikipedia, Unsplash, and Open-Meteo are called with `httpx` (async HTTP client).

**Tech Stack:** Python 3.12, FastAPI 0.115+, uvicorn, groq (Python SDK), tavily-python, httpx, python-dotenv.

## Global Constraints

- All routes are protected by `X-Internal-Token` header — reject with 403 if missing or wrong.
- No database access. Trip context (destination, activities list, etc.) is passed in the request body by the caller (Go backend or Next.js during migration).
- Groq models: `llama-3.3-70b-versatile` for heavy tasks, `llama-3.1-8b-instant` for fast tasks.
- Return plain JSON — no `{ "data": ... }` wrapper (Go backend wraps for clients).
- Default port: 8081.
- New environment variables: `GROQ_API_KEY`, `TAVILY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `INTERNAL_API_SECRET`, `PORT` (default 8081).

---

## File Map

```
ai-service/
├── requirements.txt
├── .env.example
├── main.py                       FastAPI app + router registration
├── middleware/
│   └── auth.py                   X-Internal-Token check (dependency)
├── services/
│   └── groq_client.py            shared Groq client instance
└── routers/
    ├── generate.py               POST /ai/generate-itinerary
    ├── chat.py                   POST /ai/chat
    ├── recommendations.py        POST /ai/recommendations
    ├── replace.py                POST /ai/replace-activity
    ├── story.py                  POST /ai/trip-story
    ├── edit.py                   POST /ai/edit-itinerary
    ├── import_doc.py             POST /documents/import
    ├── photos.py                 GET  /places/photo
    └── weather.py                GET  /weather
```

---

## Task 1: Bootstrap FastAPI app with internal auth middleware

**Files:**
- Create: `ai-service/requirements.txt`
- Create: `ai-service/.env.example`
- Create: `ai-service/middleware/auth.py`
- Create: `ai-service/services/groq_client.py`
- Create: `ai-service/main.py`

- [ ] **Step 1: Create `ai-service/requirements.txt`**

```
fastapi==0.115.6
uvicorn[standard]==0.32.1
groq==0.13.1
tavily-python==0.5.0
httpx==0.27.2
python-dotenv==1.0.1
```

- [ ] **Step 2: Create `ai-service/.env.example`**

```bash
PORT=8081
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
UNSPLASH_ACCESS_KEY=...
INTERNAL_API_SECRET=same-secret-as-go-backend
```

- [ ] **Step 3: Create `ai-service/middleware/auth.py`**

```python
import os
from fastapi import Header, HTTPException

async def verify_internal_token(x_internal_token: str = Header(...)):
    expected = os.getenv("INTERNAL_API_SECRET", "")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=403, detail="forbidden")
```

- [ ] **Step 4: Create `ai-service/services/groq_client.py`**

```python
import os
from groq import AsyncGroq

_client: AsyncGroq | None = None

def get_groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
    return _client
```

- [ ] **Step 5: Create `ai-service/main.py`**

```python
import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI

app = FastAPI(title="TrailGuide AI Service")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Install dependencies and run**

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --port 8081 --reload
```

Expected: `Application startup complete.`

```bash
curl http://localhost:8081/health
# {"status":"ok"}
```

- [ ] **Step 7: Commit**

```bash
git add ai-service/
git commit -m "feat: bootstrap Python FastAPI AI service with internal auth middleware"
```

---

## Task 2: Itinerary generation route

**Files:**
- Create: `ai-service/routers/generate.py`

- [ ] **Step 1: Create `ai-service/routers/generate.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class GenerateRequest(BaseModel):
    destination: str
    startDate: str
    endDate: str
    travelers: int
    tripStyle: str
    interests: List[str]
    transportMode: str
    budget: str
    flightInfo: Optional[str] = ""
    hotelInfo: Optional[str] = ""
    currency: str = "USD"

@router.post("/generate-itinerary")
async def generate_itinerary(req: GenerateRequest):
    groq = get_groq()

    prompt = f"""You are an expert travel planner. Create a detailed day-by-day itinerary.

Trip details:
- Destination: {req.destination}
- Dates: {req.startDate} to {req.endDate}
- Travelers: {req.travelers}
- Style: {req.tripStyle}
- Interests: {', '.join(req.interests)}
- Transport: {req.transportMode}
- Budget: {req.budget}
- Currency: {req.currency}
{f'- Flights: {req.flightInfo}' if req.flightInfo else ''}
{f'- Hotel: {req.hotelInfo}' if req.hotelInfo else ''}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "day_number": 1,
      "activities": [
        {{
          "title": "string",
          "description": "string (2-3 sentences)",
          "time": "HH:MM",
          "duration": "X hours",
          "cost": 0.0,
          "category": "food|attraction|transport|hotel|free",
          "address": "full address",
          "photo_query": "descriptive search term for a photo"
        }}
      ]
    }}
  ]
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
        temperature=0.7,
    )

    raw = completion.choices[0].message.content.strip()
    # Strip markdown fences if model adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)
```

- [ ] **Step 2: Register router in `main.py`**

```python
from routers import generate
app.include_router(generate.router)
```

- [ ] **Step 3: Test the route**

```bash
curl -s -X POST http://localhost:8081/ai/generate-itinerary \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret" \
  -d '{"destination":"Tokyo, Japan","startDate":"2026-08-01","endDate":"2026-08-05","travelers":2,"tripStyle":"explorer","interests":["food","history"],"transportMode":"public","budget":"medium"}' | python3 -m json.tool | head -30
```

Expected: JSON with `days` array containing activities.

- [ ] **Step 4: Commit**

```bash
git add ai-service/routers/generate.py ai-service/main.py
git commit -m "feat: add AI itinerary generation route (Groq llama-3.3-70b)"
```

---

## Task 3: Chat, recommendations, and replace-activity routes

**Files:**
- Create: `ai-service/routers/chat.py`
- Create: `ai-service/routers/recommendations.py`
- Create: `ai-service/routers/replace.py`

- [ ] **Step 1: Create `ai-service/routers/chat.py`**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq
import json

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    tripContext: str = ""

@router.post("/chat")
async def chat(req: ChatRequest):
    groq = get_groq()
    system = f"""You are TrailGuide AI, a friendly and knowledgeable travel companion.
{f'Trip context: {req.tripContext}' if req.tripContext else ''}
Be concise, helpful, and enthusiastic. Suggest 2-3 quick reply options at the end in JSON:
<!-- chips: ["Option 1", "Option 2", "Option 3"] -->"""

    messages = [{"role": "system", "content": system}] + \
               [{"role": m.role, "content": m.content} for m in req.messages]

    async def stream():
        stream = await groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=512,
            temperature=0.8,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(stream(), media_type="text/plain")
```

- [ ] **Step 2: Create `ai-service/routers/recommendations.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

try:
    from tavily import TavilyClient
    import os
    _tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
except Exception:
    _tavily = None

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class RecommendationsRequest(BaseModel):
    destination: str
    interests: List[str]
    currentActivities: List[str] = []
    date: Optional[str] = None

@router.post("/recommendations")
async def recommendations(req: RecommendationsRequest):
    groq = get_groq()

    # Optional: enrich with Tavily web search
    web_context = ""
    if _tavily:
        try:
            results = _tavily.search(
                query=f"best {' '.join(req.interests)} places {req.destination} hidden gems 2026",
                max_results=3,
                search_depth="basic",
            )
            web_context = "\n".join(r.get("content", "") for r in results.get("results", []))[:800]
        except Exception:
            pass

    already = ", ".join(req.currentActivities) if req.currentActivities else "none"
    prompt = f"""Suggest 6 diverse activities in {req.destination} for travelers interested in {', '.join(req.interests)}.
Already planned: {already}.
{f'Web context: {web_context}' if web_context else ''}

Return ONLY valid JSON:
{{
  "recommendations": [
    {{
      "title": "string",
      "description": "string (1-2 sentences why it's great)",
      "reason": "string (1 sentence matching their interests)",
      "category": "food|attraction|transport|free",
      "address": "string",
      "estimated_cost": 0.0,
      "duration": "X hours",
      "photo_query": "descriptive search term"
    }}
  ]
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
        temperature=0.8,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 3: Create `ai-service/routers/replace.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class ReplaceRequest(BaseModel):
    currentTitle: str
    destination: str
    date: str
    interests: List[str]
    category: Optional[str] = None

@router.post("/replace-activity")
async def replace_activity(req: ReplaceRequest):
    groq = get_groq()
    prompt = f"""Suggest 3 alternative activities to replace "{req.currentTitle}" in {req.destination} on {req.date}.
Traveler interests: {', '.join(req.interests)}.
{f'Same category: {req.category}' if req.category else ''}

Return ONLY valid JSON:
{{
  "alternatives": [
    {{
      "title": "string",
      "description": "string",
      "time": "HH:MM",
      "duration": "X hours",
      "cost": 0.0,
      "category": "food|attraction|transport|free",
      "address": "string",
      "photo_query": "string"
    }}
  ]
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.85,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 4: Register routers in `main.py`**

```python
from routers import chat, recommendations, replace
app.include_router(chat.router)
app.include_router(recommendations.router)
app.include_router(replace.router)
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/routers/
git commit -m "feat: add chat, recommendations, and replace-activity AI routes"
```

---

## Task 4: Trip story, edit-itinerary, and document import routes

**Files:**
- Create: `ai-service/routers/story.py`
- Create: `ai-service/routers/edit.py`
- Create: `ai-service/routers/import_doc.py`

- [ ] **Step 1: Create `ai-service/routers/story.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class StoryRequest(BaseModel):
    destination: str
    startDate: str
    endDate: str
    activities: List[str]

@router.post("/trip-story")
async def trip_story(req: StoryRequest):
    groq = get_groq()
    activity_list = "\n".join(f"- {a}" for a in req.activities)
    prompt = f"""Write a vivid, personal travel story about a trip to {req.destination} ({req.startDate} to {req.endDate}).
Activities experienced:
{activity_list}

Write 2-3 short paragraphs in first person, past tense. Warm, specific, evocative — like a postcard from a great trip.
No bullet points, no headers. End with one memorable sentence."""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.85,
    )
    return {"story": completion.choices[0].message.content.strip()}
```

- [ ] **Step 2: Create `ai-service/routers/edit.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class EditRequest(BaseModel):
    instruction: str
    currentItinerary: dict  # full itinerary JSON

@router.post("/edit-itinerary")
async def edit_itinerary(req: EditRequest):
    groq = get_groq()
    prompt = f"""You are editing a travel itinerary. Apply the following change:
"{req.instruction}"

Current itinerary:
{json.dumps(req.currentItinerary, indent=2)}

Return the complete updated itinerary as ONLY valid JSON in the same format. No explanation, no markdown."""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
        temperature=0.5,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
```

- [ ] **Step 3: Create `ai-service/routers/import_doc.py`**

```python
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/documents", dependencies=[Depends(verify_internal_token)])

class ImportRequest(BaseModel):
    content: str

@router.post("/import")
async def import_document(req: ImportRequest):
    groq = get_groq()
    prompt = f"""Extract all travel booking information from this document.

Document:
{req.content[:4000]}

Return ONLY valid JSON:
{{
  "type": "flight|hotel|airbnb|other",
  "airline": "string or null",
  "flight_number": "string or null",
  "departure_airport": "string or null",
  "arrival_airport": "string or null",
  "departure_time": "ISO8601 or null",
  "arrival_time": "ISO8601 or null",
  "hotel_name": "string or null",
  "hotel_address": "string or null",
  "check_in": "YYYY-MM-DD or null",
  "check_out": "YYYY-MM-DD or null",
  "confirmation_number": "string or null",
  "notes": "any other relevant info"
}}"""

    completion = await groq.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.1,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return {"extracted": json.loads(raw.strip())}
```

- [ ] **Step 4: Register routers in `main.py`**

```python
from routers import story, edit, import_doc
app.include_router(story.router)
app.include_router(edit.router)
app.include_router(import_doc.router)
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/routers/story.py ai-service/routers/edit.py ai-service/routers/import_doc.py ai-service/main.py
git commit -m "feat: add trip-story, edit-itinerary, and document import routes"
```

---

## Task 5: Photo proxy and weather proxy routes

**Files:**
- Create: `ai-service/routers/photos.py`
- Create: `ai-service/routers/weather.py`

- [ ] **Step 1: Create `ai-service/routers/photos.py`**

```python
import os
import httpx
from fastapi import APIRouter, Query
from fastapi.responses import Response

router = APIRouter(prefix="/places")
# No internal auth — this route is called directly by the browser/html2canvas

@router.get("/photo")
async def get_photo(query: str = Query(...)):
    async with httpx.AsyncClient(timeout=10) as client:
        # Try Wikipedia first
        try:
            search_url = "https://en.wikipedia.org/w/api.php"
            search_resp = await client.get(search_url, params={
                "action": "query", "titles": query, "prop": "pageimages",
                "format": "json", "pithumbsize": 800, "pilimit": 1,
            })
            pages = search_resp.json().get("query", {}).get("pages", {})
            page = next(iter(pages.values()), {})
            thumbnail = page.get("thumbnail", {})
            if thumbnail.get("source"):
                img_resp = await client.get(thumbnail["source"])
                content_type = img_resp.headers.get("content-type", "image/jpeg")
                return Response(
                    content=img_resp.content,
                    media_type=content_type,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
                    },
                )
        except Exception:
            pass

        # Fallback: Unsplash
        unsplash_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
        if unsplash_key:
            try:
                unsplash_resp = await client.get(
                    "https://api.unsplash.com/photos/random",
                    params={"query": query, "orientation": "landscape"},
                    headers={"Authorization": f"Client-ID {unsplash_key}"},
                )
                if unsplash_resp.status_code == 200:
                    photo_url = unsplash_resp.json()["urls"]["regular"]
                    img_resp = await client.get(photo_url)
                    return Response(
                        content=img_resp.content,
                        media_type="image/jpeg",
                        headers={
                            "Access-Control-Allow-Origin": "*",
                            "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
                        },
                    )
            except Exception:
                pass

    return Response(status_code=404)
```

- [ ] **Step 2: Create `ai-service/routers/weather.py`**

```python
import httpx
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/weather")

@router.get("")
async def get_weather(lat: float = Query(...), lng: float = Query(...)):
    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lng,
                "current": "temperature_2m,weather_code,wind_speed_10m",
                "timezone": "auto",
            },
        )
        return JSONResponse(
            content=resp.json(),
            headers={"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200"},
        )
```

- [ ] **Step 3: Register routers in `main.py`**

```python
from routers import photos, weather
app.include_router(photos.router)
app.include_router(weather.router)
```

- [ ] **Step 4: Full integration test**

```bash
# Photo proxy
curl -s "http://localhost:8081/places/photo?query=Eiffel+Tower" -o /tmp/test.jpg && file /tmp/test.jpg
# Expected: JPEG image data

# Weather
curl -s "http://localhost:8081/weather?lat=48.86&lng=2.35" | python3 -m json.tool | head -10
# Expected: JSON with current temperature

# Trip story (with internal token)
curl -s -X POST http://localhost:8081/ai/trip-story \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: your-secret" \
  -d '{"destination":"Paris","startDate":"2026-08-01","endDate":"2026-08-05","activities":["Eiffel Tower","Louvre","Seine River Cruise"]}' | python3 -m json.tool
# Expected: {"story": "...paragraphs..."}
```

- [ ] **Step 5: Commit**

```bash
git add ai-service/routers/photos.py ai-service/routers/weather.py ai-service/main.py
git commit -m "feat: add photo proxy (Wikipedia + Unsplash) and weather proxy routes"
```

---

## Verification Checklist

- [ ] `uvicorn main:app --port 8081` starts without errors
- [ ] `GET /health` → `{"status":"ok"}`
- [ ] Any route without `X-Internal-Token` → 403
- [ ] `POST /ai/generate-itinerary` → valid JSON itinerary
- [ ] `POST /ai/chat` → streaming text response
- [ ] `POST /ai/recommendations` → JSON with 6 recommendations
- [ ] `POST /ai/replace-activity` → JSON with 3 alternatives
- [ ] `POST /ai/trip-story` → `{"story":"..."}`
- [ ] `POST /documents/import` → `{"extracted":{...}}`
- [ ] `GET /places/photo?query=Tokyo` → JPEG bytes (no redirect)
- [ ] `GET /weather?lat=35.68&lng=139.69` → Open-Meteo JSON
