from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from middleware.auth import verify_internal_token
from services.groq_client import get_groq

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
        s = await groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=512,
            temperature=0.8,
            stream=True,
        )
        async for chunk in s:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(stream(), media_type="text/plain")
