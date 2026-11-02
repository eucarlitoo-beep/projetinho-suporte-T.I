"""Notícias: aggregates authorised public RSS feeds from trusted outlets, with an in-memory cache."""

import asyncio
import hashlib
import html
import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

import json
import os

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Depends, Query

from lib.auth import current_user
from models.extras import NewsCategory, NewsItem, NewsOut

router = APIRouter(prefix="/news", tags=["news"])
log = logging.getLogger("news")

CATEGORIES = [
    NewsCategory(id="ia", label="Tecnologia & IA", description="Inteligência artificial, inovação e o mundo da tecnologia."),
    NewsCategory(id="escolas", label="Tecnologia nas Escolas", description="IA na educação, robótica, inclusão digital, ferramentas para professores e projetos educacionais."),
    NewsCategory(id="educacao", label="Educação Digital", description="Políticas, práticas e tendências da educação no Brasil e no mundo."),
    NewsCategory(id="saude", label="Saúde Mental & Bem-estar", description="Bem-estar, saúde emocional, uso equilibrado da tecnologia e saúde mental nas escolas. Conteúdo informativo — não substitui orientação profissional."),
    NewsCategory(id="seguranca", label="Segurança Digital & Inovação", description="Golpes, privacidade, cibersegurança e inovação responsável."),
]

SEG = r"golpe|seguran[cç]a digital|ciberseg|ciberat|hacker|vazamento|senha|privacidade|malware|ransomware|phishing|fraude|lgpd|dados pessoais|inova[cç]|startup|security|breach|cyber|vulnerab|scam"
MENTAL = r"sa[uú]de mental|ansiedade|depress|emocional|emo[cç][oõ]|estresse|burnout|psic[oó]|sono|autoestima|tempo de tela|telas|mindfulness|solid[aã]o|mental health|wellbeing|well-being|anxiety|loneliness|therapy|terapia|bullying"
SCHOOL_TECH = r"tecnolog|digital|rob[oó]t|intelig[eê]ncia artificial|\bIA\b|\bAI\b|computa|internet|celular|smartphone|tablet|aplicativo|plataforma|conectividade|chatgpt|programa[cç][aã]o|edtech|online|screen"

TECH = r"tecnolog|intelig[eê]ncia artificial|\bIA\b|digital|internet|rob[oô]|algoritmo|chip|smartphone|celular|aplicativo|big tech|google|apple|microsoft|openai|chatgpt|redes sociais|computa"
EDU = r"escola|educa|professor|aluno|estudante|universidade|ensino|enem|alfabetiza"

# Only Portuguese-language outlets, so the whole section stays in PT-BR (international coverage via BBC News Brasil, DW and RFI).
# (name, url, region, lang, {category: keyword-regex or None for "all items"})
FEEDS = [
    ("g1 Tecnologia", "https://g1.globo.com/rss/g1/tecnologia/", "br", "pt", {"ia": None, "seguranca": SEG}),
    ("Tecnoblog", "https://tecnoblog.net/feed/", "br", "pt", {"ia": None, "seguranca": SEG}),
    ("Olhar Digital", "https://olhardigital.com.br/feed/", "br", "pt", {"ia": None, "seguranca": SEG}),
    ("Canaltech", "https://canaltech.com.br/rss/", "br", "pt", {"ia": None, "seguranca": SEG}),
    ("Folha Tec", "https://feeds.folha.uol.com.br/tec/rss091.xml", "br", "pt", {"ia": None, "seguranca": SEG}),
    ("Revista Galileu", "https://revistagalileu.globo.com/rss/galileu", "br", "pt", {"ia": TECH, "saude": MENTAL}),
    ("BBC News Brasil", "https://feeds.bbci.co.uk/portuguese/rss.xml", "mundo", "pt", {"ia": TECH, "seguranca": SEG, "saude": MENTAL, "educacao": EDU}),
    ("DW Brasil", "https://rss.dw.com/xml/rss-br-all", "mundo", "pt", {"ia": TECH, "seguranca": SEG, "saude": MENTAL, "educacao": EDU}),
    ("RFI Brasil", "https://www.rfi.fr/br/rss", "mundo", "pt", {"ia": TECH, "saude": MENTAL, "educacao": EDU}),
    ("Porvir", "https://porvir.org/feed/", "br", "pt", {"escolas": None, "educacao": None, "saude": MENTAL}),
    ("g1 Educação", "https://g1.globo.com/rss/g1/educacao/", "br", "pt", {"educacao": None, "escolas": SCHOOL_TECH, "saude": MENTAL}),
    ("Folha Educação", "https://feeds.folha.uol.com.br/educacao/rss091.xml", "br", "pt", {"educacao": None, "escolas": SCHOOL_TECH, "saude": MENTAL}),
    ("Agência Brasil", "https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml", "br", "pt", {"educacao": None, "escolas": SCHOOL_TECH}),
    ("Jornal da USP", "https://jornal.usp.br/feed/", "br", "pt", {"escolas": SCHOOL_TECH, "educacao": EDU, "saude": MENTAL}),
    ("g1 Bem Estar", "https://g1.globo.com/rss/g1/bemestar/", "br", "pt", {"saude": MENTAL}),
    ("Folha Equilíbrio e Saúde", "https://feeds.folha.uol.com.br/equilibrioesaude/rss091.xml", "br", "pt", {"saude": MENTAL}),
    ("Agência Brasil Saúde", "https://agenciabrasil.ebc.com.br/rss/saude/feed.xml", "br", "pt", {"saude": MENTAL}),
]

NS = {
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "dc": "http://purl.org/dc/elements/1.1/",
}
TTL = 20 * 60
MAX_AGE = timedelta(days=60)
_cache: dict = {"items": [], "fetched_at": 0.0, "updated_at": None, "failed": []}
_lock = asyncio.Lock()
IMG_RE = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: str) -> str:
    return " ".join(html.unescape(TAG_RE.sub(" ", text or "")).split())


def _date(item: ET.Element) -> Optional[datetime]:
    raw = item.findtext("pubDate") or item.findtext("dc:date", namespaces=NS)
    if not raw:
        return None
    try:
        d = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _media(item: ET.Element, desc: str, content: str) -> tuple[str, str]:
    image, video = "", ""
    candidates = item.findall("media:content", NS) + item.findall("media:thumbnail", NS) + item.findall("enclosure")
    for group in item.findall("media:group", NS):
        candidates += group.findall("media:content", NS)
    best_w = -1
    for el in candidates:
        url = el.get("url") or ""
        if not url.startswith("http"):
            continue
        kind = (el.get("type") or el.get("medium") or "").lower()
        if "video" in kind and not video and url.lower().split("?")[0].endswith((".mp4", ".webm")):
            video = url
        elif "video" not in kind and "audio" not in kind:
            w = int(el.get("width") or 0)
            if w > best_w:
                image, best_w = url, w
    if not image:
        m = IMG_RE.search(desc) or IMG_RE.search(content)
        if m and m.group(1).startswith("http"):
            image = html.unescape(m.group(1))
    if image.startswith("http://"):
        image = "https://" + image[7:]
    return image, video


def _parse(xml: bytes, feed: tuple) -> list[dict]:
    name, _url, region, lang, rules = feed
    root = ET.fromstring(xml)
    out = []
    cutoff = datetime.now(timezone.utc) - MAX_AGE
    for item in root.iter("item"):
        title = _clean(item.findtext("title") or "")
        link = (item.findtext("link") or "").strip()
        if not title or not link.startswith("http"):
            continue
        published = _date(item)
        if not published or published < cutoff:
            continue
        desc = item.findtext("description") or ""
        content = item.findtext("content:encoded", namespaces=NS) or ""
        summary = _clean(desc) or _clean(content)
        if len(summary) > 260:
            summary = summary[:257].rsplit(" ", 1)[0] + "…"
        haystack = f"{title} {summary}"
        cats = [c for c, rx in rules.items() if rx is None or re.search(rx, haystack, re.I)]
        if not cats:
            continue
        image, video = _media(item, desc, content)
        out.append({
            "id": hashlib.sha1(link.encode()).hexdigest()[:16], "title": title, "summary": summary, "url": link,
            "image": image, "video": video, "source": name, "region": region, "lang": lang,
            "categories": cats, "published_at": published.astimezone(timezone.utc).isoformat(),
        })
    return out


async def _fetch(client: httpx.AsyncClient, feed: tuple) -> list[dict]:
    r = await client.get(feed[1])
    r.raise_for_status()
    return _parse(r.content, feed)


# ---- PT-BR guarantee: any headline that slips in another language is translated (cached by id)
_EN = re.compile(r"\b(the|and|of|to|is|for|with|on|how|why|what|from|are|will|your|this|that)\b", re.I)
_PT = re.compile(r"\b(o|a|os|as|de|do|da|dos|das|que|em|para|com|um|uma|no|na|é|por|não|ao)\b", re.I)
_tr: dict[str, tuple[str, str]] = {}


def _foreign(it: dict) -> bool:
    t = f"{it['title']} {it['summary']}"
    return len(_EN.findall(t)) > max(2, len(_PT.findall(t)))


async def _translate(items: list[dict]) -> None:
    todo = [it for it in items if it["id"] not in _tr and _foreign(it)][:40]
    if todo and os.environ.get("EMERGENT_LLM_KEY"):
        payload = [{"id": it["id"], "title": it["title"], "summary": it["summary"][:400]} for it in todo]
        try:
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"news-tr-{int(time.time())}",
                system_message="Você é editor de um portal de notícias brasileiro. Traduza para português do Brasil, "
                "com linguagem jornalística natural. Responda SOMENTE com JSON: lista de objetos {id,title,summary}.",
            ).with_model("anthropic", "claude-sonnet-4-6")
            raw = await chat.send_message(UserMessage(text=json.dumps(payload, ensure_ascii=False)))
            raw = raw[raw.find("["): raw.rfind("]") + 1]
            for r in json.loads(raw):
                _tr[r["id"]] = (r["title"], r.get("summary", ""))
        except Exception as exc:  # never block the feed on translation
            log.warning("news translation failed: %s", type(exc).__name__)
    for it in items:
        if it["id"] in _tr:
            it["title"], it["summary"] = _tr[it["id"]]


async def _refresh() -> None:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; NexusNewsBot/1.0; +school-workspace)"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=4.0), follow_redirects=True, headers=headers) as client:
        results = await asyncio.gather(*(_fetch(client, f) for f in FEEDS), return_exceptions=True)
    merged: dict[str, dict] = {}
    failed = []
    for feed, res in zip(FEEDS, results):
        if isinstance(res, BaseException):
            log.warning("news feed failed: %s (%s)", feed[0], type(res).__name__)
            failed.append(feed[0])
            continue
        for it in res:
            prev = merged.get(it["id"])
            if prev:
                prev["categories"] = sorted(set(prev["categories"]) | set(it["categories"]))
            else:
                merged[it["id"]] = it
    if not merged and _cache["items"]:
        _cache["failed"] = failed  # keep serving the last good copy
        _cache["fetched_at"] = time.time() - TTL + 120  # retry in 2 min
        return
    await _translate(list(merged.values()))
    _cache.update(
        items=sorted(merged.values(), key=lambda x: x["published_at"], reverse=True),
        fetched_at=time.time(), updated_at=datetime.now(timezone.utc).isoformat(), failed=failed,
    )


async def _items() -> list[dict]:
    if time.time() - _cache["fetched_at"] > TTL:
        async with _lock:
            if time.time() - _cache["fetched_at"] > TTL:
                await _refresh()
    return _cache["items"]


@router.get("", response_model=NewsOut)
async def list_news(
    category: Optional[str] = Query(None, pattern="^(ia|escolas|educacao|saude|seguranca)$"),
    region: Optional[str] = Query(None, pattern="^(br|mundo)$"),
    q: Optional[str] = Query(None, max_length=80),
    sort: str = Query("recentes", pattern="^(recentes|antigas)$"),
    with_image: bool = False,
    limit: int = Query(60, ge=1, le=200),
    _me: dict = Depends(current_user),
):
    items = await _items()
    if category:
        items = [i for i in items if category in i["categories"]]
    if region:
        items = [i for i in items if i["region"] == region]
    if with_image:
        items = [i for i in items if i["image"]]
    if q and q.strip():
        needle = q.strip().lower()
        items = [i for i in items if needle in i["title"].lower() or needle in i["summary"].lower()]
    if sort == "antigas":
        items = list(reversed(items))
    return NewsOut(
        items=[NewsItem(**i) for i in items[:limit]], categories=CATEGORIES,
        updated_at=_cache["updated_at"], failed_sources=_cache["failed"],
    )
