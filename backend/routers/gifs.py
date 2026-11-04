"""GIPHY proxy: trending + search. The API key stays server-side (GIPHY_API_KEY in backend/.env)."""

import logging
import os
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import current_user
from models.chat import GifMeta, GifSearchOut

# httpx logs full request URLs at INFO — that would leak api_key into the logs
logging.getLogger("httpx").setLevel(logging.WARNING)

router = APIRouter(prefix="/gifs", tags=["gifs"])

GIPHY = "https://api.giphy.com/v1/gifs"
CACHE_TTL = 300  # seconds — beta keys allow ~100 calls/hour, so cache aggressively
_cache: dict[str, tuple[float, list[GifMeta]]] = {}


def is_giphy_url(url: str) -> bool:
    try:
        p = urlparse(url)
    except ValueError:
        return False
    host = (p.hostname or "").lower()
    return p.scheme == "https" and (host == "giphy.com" or host.endswith(".giphy.com"))


def _normalize(item: dict) -> Optional[GifMeta]:
    images = item.get("images") or {}
    full = images.get("downsized_medium") or images.get("downsized_large") or images.get("original") or {}
    thumb = images.get("fixed_width") or images.get("fixed_height") or full
    url = full.get("url")
    if not url:
        return None
    return GifMeta(
        id=str(item.get("id", ""))[:64] or "gif",
        title=(item.get("title") or "")[:200],
        url=url,
        preview_url=thumb.get("webp") or thumb.get("url") or url,
        width=int(full.get("width") or 0),
        height=int(full.get("height") or 0),
    )


async def _giphy(path: str, params: dict) -> list[GifMeta]:
    key = os.environ.get("GIPHY_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="GIFs ainda não configurados")
    cache_key = f"{path}:{sorted(params.items())}"
    hit = _cache.get(cache_key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            r = await client.get(f"{GIPHY}/{path}", params={**params, "api_key": key})
            r.raise_for_status()
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 429:
            raise HTTPException(status_code=503, detail="Limite do GIPHY atingido, tente em instantes")
        if code in (401, 403):
            raise HTTPException(status_code=503, detail="Chave do GIPHY inválida — atualize a GIPHY_API_KEY")
        raise HTTPException(status_code=503, detail="Erro ao consultar o GIPHY")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="GIPHY indisponível")
    gifs = [g for g in (_normalize(i) for i in r.json().get("data", [])) if g]
    _cache[cache_key] = (time.time(), gifs)
    return gifs


@router.get("/trending", response_model=GifSearchOut)
async def trending(limit: int = Query(24, ge=1, le=50), _me: dict = Depends(current_user)):
    return GifSearchOut(gifs=await _giphy("trending", {"limit": limit, "rating": "g"}))


@router.get("/search", response_model=GifSearchOut)
async def search(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(24, ge=1, le=50),
    _me: dict = Depends(current_user),
):
    return GifSearchOut(gifs=await _giphy("search", {"q": q.strip(), "limit": limit, "rating": "g", "lang": "pt"}))
