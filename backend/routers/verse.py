"""Versículo do Dia — local collection of verses verified against bible-api.com (Almeida, public domain)."""

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import current_user
from lib.dates import today_iso
from models.extras import VerseOut

router = APIRouter(prefix="/verse", tags=["verse"])

_DATA = json.loads((Path(__file__).resolve().parent.parent / "data" / "verses.json").read_text(encoding="utf-8"))
VERSES = _DATA["verses"]
EPOCH = date(2024, 1, 1)
MAX_BACK = 30


@router.get("", response_model=VerseOut)
async def verse_of_day(
    tz: Optional[str] = Query(None, max_length=64),
    offset: int = Query(0, ge=0, le=MAX_BACK, description="days before today"),
    _me: dict = Depends(current_user),
):
    try:
        zone = ZoneInfo(tz or "America/Sao_Paulo")
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=422, detail="Fuso horário inválido")
    day = date.fromisoformat(today_iso(zone.key)) - timedelta(days=offset)
    # stride through the list (coprime with its length) so consecutive days feel varied
    n = len(VERSES)
    stride = next(s for s in (37, 41, 43, 47, 1) if n % s != 0 or s == 1)
    v = VERSES[((day - EPOCH).days * stride) % n]
    return VerseOut(
        date=day.isoformat(), reference=v["reference"], text=v["text"],
        translation=_DATA["translation"], source=_DATA["source"], offset=offset,
    )
