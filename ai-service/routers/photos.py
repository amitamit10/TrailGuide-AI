import os
import httpx
from fastapi import APIRouter, Query
from fastapi.responses import Response

router = APIRouter(prefix="/places")

@router.get("/photo")
async def get_photo(query: str = Query(...)):
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            search_resp = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "query", "titles": query, "prop": "pageimages",
                        "format": "json", "pithumbsize": 800, "pilimit": 1},
            )
            pages = search_resp.json().get("query", {}).get("pages", {})
            page = next(iter(pages.values()), {})
            src = page.get("thumbnail", {}).get("source")
            if src:
                img = await client.get(src)
                return Response(content=img.content,
                    media_type=img.headers.get("content-type", "image/jpeg"),
                    headers={"Access-Control-Allow-Origin": "*",
                             "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"})
        except Exception:
            pass

        key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
        if key:
            try:
                r = await client.get("https://api.unsplash.com/photos/random",
                    params={"query": query, "orientation": "landscape"},
                    headers={"Authorization": f"Client-ID {key}"})
                if r.status_code == 200:
                    img = await client.get(r.json()["urls"]["regular"])
                    return Response(content=img.content, media_type="image/jpeg",
                        headers={"Access-Control-Allow-Origin": "*",
                                 "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"})
            except Exception:
                pass

    return Response(status_code=404)
