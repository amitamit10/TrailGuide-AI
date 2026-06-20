import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from middleware.auth import verify_internal_token

router = APIRouter(prefix="/weather", dependencies=[Depends(verify_internal_token)])


@router.get("")
async def get_weather(lat: float = Query(...), lng: float = Query(...)):
    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lng,
                    "current": "temperature_2m,weather_code,wind_speed_10m",
                    "timezone": "auto"},
        )
        return JSONResponse(content=resp.json(),
            headers={"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200"})
