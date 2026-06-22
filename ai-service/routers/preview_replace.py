import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

SYSTEM = """You are a travel activity planner. Generate a single replacement activity as valid JSON.

Return ONLY this JSON structure, no markdown:
{
  "title": "Activity name",
  "description": "2-3 sentence description of why it is worth visiting.",
  "category": "attraction",
  "start_time": "10:00",
  "end_time": "12:00",
  "duration_minutes": 120,
  "location_name": "Place name",
  "address": "Full street address",
  "lat": 48.8566,
  "lng": 2.3522,
  "estimated_cost": 15,
  "photo_query": "descriptive search query for a photo of this place"
}

category must be one of: food, attraction, transport, hotel, flight, free
Use real coordinates for the destination city."""


class PreviewReplaceRequest(BaseModel):
    destination: str = Field(..., max_length=300)
    travelStyle: Optional[str] = Field(default="balanced", max_length=50)
    interests: Optional[List[str]] = Field(default=[], max_length=20)
    activity: dict
    neighbors: Optional[List[dict]] = Field(default=[], max_length=20)
    userRequest: str = Field(..., max_length=1000)


@router.post("/preview-replace")
async def preview_replace(req: PreviewReplaceRequest):
    groq = get_groq()
    neighbor_lines = "\n".join(
        f"{n.get('start_time','?')} – {n.get('end_time','?')}: {n.get('title','')}"
        for n in (req.neighbors or [])
    ) or "None"

    prompt = f"""Trip destination: {req.destination}
Travel style: {req.travelStyle}
Interests: {', '.join(req.interests or [])}

Activity being replaced:
Title: {req.activity.get('title', '')}
Time: {req.activity.get('start_time', '?')} – {req.activity.get('end_time', '?')}
Duration: {req.activity.get('duration_minutes', 60)} minutes

Other activities this day:
{neighbor_lines}

User request: "{req.userRequest}"

Generate a replacement that fits the {req.activity.get('start_time', '?')} – {req.activity.get('end_time', '?')} time slot."""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=512,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")
