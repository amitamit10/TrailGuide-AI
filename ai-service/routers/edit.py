import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class EditRequest(BaseModel):
    instruction: str
    currentItinerary: dict

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
        max_tokens=8192, temperature=0.5,
    )
    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
