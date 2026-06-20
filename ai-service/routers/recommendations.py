import json, os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
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
    destination: str
    interests: List[str]
    currentActivities: List[str] = []
    date: Optional[str] = None

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
    return json.loads(raw.strip())
