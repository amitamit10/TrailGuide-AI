import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class ReplaceRequest(BaseModel):
    currentTitle: str = Field(..., max_length=300)
    destination: str = Field(..., max_length=300)
    date: str = Field(..., max_length=20)
    interests: List[str] = Field(default=[], max_length=20)
    category: Optional[str] = Field(default=None, max_length=50)

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
        max_tokens=1024, temperature=0.85,
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
