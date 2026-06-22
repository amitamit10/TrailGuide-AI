import json
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

try:
    from tavily import TavilyClient
    _tavily = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY", ""))
except Exception:
    _tavily = None

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class RecommendationsRequest(BaseModel):
    destination: str = Field(..., max_length=300)
    interests: List[str] = Field(default=[], max_length=20)
    currentActivities: List[str] = Field(default=[], max_length=50)
    date: Optional[str] = Field(default=None, max_length=20)

    @field_validator("interests", mode="before")
    @classmethod
    def cap_interests(cls, v: List[str]) -> List[str]:
        return [i[:100] if isinstance(i, str) else "" for i in (v or [])]

    @field_validator("currentActivities", mode="before")
    @classmethod
    def cap_activities(cls, v: List[str]) -> List[str]:
        return [a[:200] if isinstance(a, str) else "" for a in (v or [])]

@router.post("/recommendations")
async def recommendations(req: RecommendationsRequest):
    groq = get_groq()
    web_context = ""
    if _tavily:
        try:
            results = _tavily.search(
                query=f"best {' '.join(req.interests)} places {req.destination} hidden gems 2026",
                max_results=3, search_depth="basic",
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
      "description": "string (1-2 sentences)",
      "reason": "string (1 sentence)",
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
        max_tokens=2048, temperature=0.8,
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
