import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class GenerateRequest(BaseModel):
    destination: str = Field(..., max_length=300)
    startDate: str = Field(..., max_length=20)
    endDate: str = Field(..., max_length=20)
    travelers: int = Field(..., ge=1, le=50)
    tripStyle: str = Field(..., max_length=50)
    interests: List[str] = Field(default=[], max_length=20)
    transportMode: str = Field(..., max_length=50)
    budget: str = Field(..., max_length=50)
    flightInfo: Optional[str] = Field(default="", max_length=2000)
    hotelInfo: Optional[str] = Field(default="", max_length=2000)
    currency: str = Field(default="USD", max_length=10)

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
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")
