import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class EditRequest(BaseModel):
    instruction: str = Field(..., max_length=2000)
    currentItinerary: dict

@router.post("/edit-itinerary")
async def edit_itinerary(req: EditRequest):
    groq = get_groq()
    # Limit the serialized itinerary size to prevent prompt inflation attacks.
    itinerary_json = json.dumps(req.currentItinerary, indent=2)
    if len(itinerary_json) > 100_000:
        raise HTTPException(status_code=400, detail="itinerary too large")
    prompt = f"""You are editing a travel itinerary. Apply the following change:
"{req.instruction}"

Current itinerary:
{itinerary_json}

Return the complete updated itinerary as ONLY valid JSON in the same format. No explanation, no markdown."""

    completion = await groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192, temperature=0.5,
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
