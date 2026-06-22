from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

router = APIRouter(prefix="/ai", dependencies=[Depends(verify_internal_token)])

class StoryRequest(BaseModel):
    destination: str = Field(..., max_length=300)
    startDate: str = Field(..., max_length=20)
    endDate: str = Field(..., max_length=20)
    activities: List[str] = Field(..., max_length=200)

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
        max_tokens=400, temperature=0.85,
    )
    return {"story": completion.choices[0].message.content.strip()}
