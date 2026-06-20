import os
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from middleware.auth import verify_internal_token

router = APIRouter(prefix="/places", dependencies=[Depends(verify_internal_token)])

_SAFE_HOSTS = {"upload.wikimedia.org", "images.unsplash.com"}
_SAFE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _is_safe_url(url: str) -> bool:
    p = urlsplit(url)
    if p.scheme != "https":
        return False
    host = p.netloc.lower()
    return any(host == h or host.endswith("." + h) for h in _SAFE_HOSTS)


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
            if src and _is_safe_url(src):
                img = await client.get(src)
                ct = img.headers.get("content-type", "").split(";")[0].strip()
                if ct not in _SAFE_TYPES:
                    ct = "image/jpeg"
                return Response(content=img.content, media_type=ct,
                    headers={"Access-Control-Allow-Origin": "*",
                             "X-Content-Type-Options": "nosniff",
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
                    img_url = r.json()["urls"]["regular"]
                    if _is_safe_url(img_url):
                        img = await client.get(img_url)
                        return Response(content=img.content, media_type="image/jpeg",
                            headers={"Access-Control-Allow-Origin": "*",
                                     "X-Content-Type-Options": "nosniff",
                                     "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"})
            except Exception:
                pass

    return Response(status_code=404)
