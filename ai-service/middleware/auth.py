import os
from fastapi import Header, HTTPException

async def verify_internal_token(x_internal_token: str = Header(...)):
    expected = os.getenv("INTERNAL_API_SECRET", "")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=403, detail="forbidden")
