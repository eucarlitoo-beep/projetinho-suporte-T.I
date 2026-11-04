"""Chamados de T.I. (tickets) + dashboard stats."""

import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.extras import (
    CountItem, PeriodPoint, TicketCategory, TicketCategoryCreate, TicketCreate, TicketOut,
    TicketStats, TicketUpdate,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])

PRIORITIES = [
    ("urgente", "Urgente", "#F43F5E"),
    ("alta", "Alta", "#F59E0B"),
    ("media", "Média", "#00E5FF"),
    ("baixa", "Baixa", "#34D399"),
]
PALETTE = ["#00E5FF", "#3B82F6", "#A78BFA", "#34D399", "#F59E0B", "#F472B6", "#22D3EE", "#F43F5E", "#84CC16", "#94A3B8"]
DEFAULT_CATEGORIES = [
    "Computador / Hardware", "Software / Programas", "Rede e Internet", "Impressora",
    "Acesso e Senhas", "Projetor / Audiovisual", "Sistema acadêmico", "Outros",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _zone(tz: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=422, detail="Fuso horário inválido")


async def _categories() -> list[dict]:
    cats = await db.ticket_categories.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    if cats:
        return cats
    # first run: register the default school-IT categories (configuration, not ticket data)
    docs = [
        {"id": str(uuid.uuid4()), "name": n, "color": PALETTE[i % len(PALETTE)], "order": i}
        for i, n in enumerate(DEFAULT_CATEGORIES)
    ]
    await db.ticket_categories.insert_many([dict(d) for d in docs])
    return docs


@router.get("/categories", response_model=List[TicketCategory])
async def list_categories(_me: dict = Depends(current_user)):
    return [TicketCategory(**c) for c in await _categories()]


@router.post("/categories", response_model=TicketCategory)
async def create_category(body: TicketCategoryCreate, _me: dict = Depends(current_user)):
    cats = await _categories()
    name = body.name.strip()
    if any(c["name"].lower() == name.lower() for c in cats):
        raise HTTPException(status_code=409, detail="Categoria já existe")
    doc = {"id": str(uuid.uuid4()), "name": name, "color": PALETTE[len(cats) % len(PALETTE)], "order": len(cats)}
    await db.ticket_categories.insert_one(dict(doc))
    return TicketCategory(**doc)


@router.get("", response_model=List[TicketOut])
async def list_tickets(
    status: Optional[str] = Query(None, pattern="^(aberto|em_atendimento|resolvido)$"),
    q: Optional[str] = Query(None, max_length=80),
    _me: dict = Depends(current_user),
):
    filt: dict = {}
    if status:
        filt["status"] = status
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        filt["$or"] = [{"title": rx}, {"description": rx}, {"location": rx}]
    docs = await db.tickets.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [TicketOut(**d) for d in docs]


@router.post("", response_model=TicketOut)
async def create_ticket(body: TicketCreate, me: dict = Depends(current_user)):
    if not await db.ticket_categories.find_one({"id": body.category_id}):
        raise HTTPException(status_code=422, detail="Categoria inválida")
    counter = await db.counters.find_one_and_update(
        {"_id": "tickets"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER,
    )
    ts = now_iso()
    doc = {
        "id": str(uuid.uuid4()), "number": counter["seq"], "title": body.title.strip(),
        "description": body.description.strip(), "category_id": body.category_id,
        "priority": body.priority, "status": "aberto", "location": body.location.strip(),
        "requester_id": me["user_id"], "assignee_id": None,
        "created_at": ts, "updated_at": ts, "resolved_at": None,
    }
    await db.tickets.insert_one(dict(doc))
    return TicketOut(**doc)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(ticket_id: str, body: TicketUpdate, _me: dict = Depends(current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado")
    changes = body.model_dump(exclude_unset=True)
    if "category_id" in changes and not await db.ticket_categories.find_one({"id": changes["category_id"]}):
        raise HTTPException(status_code=422, detail="Categoria inválida")
    if "assignee_id" in changes and changes["assignee_id"] and not await db.users.find_one({"user_id": changes["assignee_id"]}):
        raise HTTPException(status_code=422, detail="Responsável inválido")
    if "status" in changes:
        changes["resolved_at"] = now_iso() if changes["status"] == "resolvido" else None
    changes["updated_at"] = now_iso()
    doc = await db.tickets.find_one_and_update(
        {"id": ticket_id}, {"$set": changes}, projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    return TicketOut(**doc)


@router.get("/stats", response_model=TicketStats)
async def ticket_stats(
    tz: Optional[str] = Query(None, max_length=64),
    start: Optional[date] = None,
    end: Optional[date] = None,
    _me: dict = Depends(current_user),
):
    zone = _zone(tz)
    end_d = end or date.fromisoformat(today_iso(zone.key))
    start_d = start or end_d - timedelta(days=29)
    if start_d > end_d:
        raise HTTPException(status_code=422, detail="Data inicial maior que a final")
    if (end_d - start_d).days > 366:
        raise HTTPException(status_code=422, detail="Período máximo de 1 ano")

    lo = datetime.combine(start_d, time.min, zone).astimezone(timezone.utc).isoformat()
    hi = datetime.combine(end_d + timedelta(days=1), time.min, zone).astimezone(timezone.utc).isoformat()
    created = await db.tickets.find({"created_at": {"$gte": lo, "$lt": hi}}, {"_id": 0}).to_list(20000)
    resolved = await db.tickets.find({"resolved_at": {"$gte": lo, "$lt": hi}}, {"_id": 0, "resolved_at": 1}).to_list(20000)

    def local_day(iso: str) -> str:
        return datetime.fromisoformat(iso).astimezone(zone).strftime("%Y-%m-%d")

    days = [(start_d + timedelta(days=i)).isoformat() for i in range((end_d - start_d).days + 1)]
    opened_by_day = {d: 0 for d in days}
    resolved_by_day = {d: 0 for d in days}
    for t in created:
        opened_by_day[local_day(t["created_at"])] = opened_by_day.get(local_day(t["created_at"]), 0) + 1
    for t in resolved:
        k = local_day(t["resolved_at"])
        resolved_by_day[k] = resolved_by_day.get(k, 0) + 1

    pr_counts = {k: 0 for k, _, _ in PRIORITIES}
    cat_counts: dict[str, int] = {}
    for t in created:
        pr_counts[t["priority"]] = pr_counts.get(t["priority"], 0) + 1
        cat_counts[t["category_id"]] = cat_counts.get(t["category_id"], 0) + 1
    cats = await _categories()

    return TicketStats(
        start=start_d.isoformat(), end=end_d.isoformat(), total=len(created),
        open_now=await db.tickets.count_documents({"status": "aberto"}),
        in_progress_now=await db.tickets.count_documents({"status": "em_atendimento"}),
        resolved_in_period=len(resolved),
        period=[PeriodPoint(date=d, abertos=opened_by_day[d], resolvidos=resolved_by_day[d]) for d in days],
        priority=[CountItem(key=k, label=label, count=pr_counts[k], color=color) for k, label, color in PRIORITIES],
        category=sorted(
            [CountItem(key=c["id"], label=c["name"], count=cat_counts.get(c["id"], 0), color=c["color"]) for c in cats],
            key=lambda x: -x.count,
        ),
    )
