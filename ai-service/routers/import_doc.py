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
        max_tokens=512, temperature=0.1,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return {"extracted": json.loads(raw.strip())}
