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
from fastapi import APIRouter, Depends, HTTPException, Query
import trafilatura

from lib.auth import current_user
from lib.db import db
from models.extras import ArticleBlock, ArticleOut, NewsCategory, NewsItem, NewsOut

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

# PT outlets are shown as-is; foreign-language outlets (lang != "pt") are shown ONLY once translated to PT-BR.
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
    ("BBC", "https://feeds.bbci.co.uk/news/technology/rss.xml", "mundo", "en", {"ia": None, "seguranca": SEG}),
    ("The Guardian", "https://www.theguardian.com/technology/rss", "mundo", "en", {"ia": None, "seguranca": SEG, "saude": MENTAL}),
    ("The Guardian", "https://www.theguardian.com/education/rss", "mundo", "en", {"educacao": None, "escolas": SCHOOL_TECH, "saude": MENTAL}),
    ("EdSurge", "https://www.edsurge.com/articles_rss", "mundo", "en", {"escolas": None, "educacao": None}),
]
MAX_PER_FOREIGN_FEED = 15  # keeps the translation bill bounded

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
    items = _parse(r.content, feed)
    if feed[3] != "pt":
        items = sorted(items, key=lambda x: x["published_at"], reverse=True)[:MAX_PER_FOREIGN_FEED]
    return items


# ---- PT-BR guarantee: foreign-language items are translated by the LLM and persisted (news_translations)
TR_SYSTEM = (
    "Você é editor de um portal de notícias brasileiro. Traduza para português do Brasil com linguagem jornalística "
    "natural e concisa (manchetes sem ponto final). Mantenha nomes próprios e marcas. Responda SOMENTE com JSON válido."
)


def _llm(session: str) -> LlmChat:
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message=TR_SYSTEM).with_model(
        "anthropic", "claude-sonnet-4-6")


def _json_list(raw: str) -> list:
    return json.loads(raw[raw.find("["): raw.rfind("]") + 1])


async def _translate_batch(batch: list[dict]) -> None:
    payload = [{"id": it["id"], "title": it["title"], "summary": it["summary"]} for it in batch]
    try:
        raw = await _llm(f"news-tr-{batch[0]['id']}").send_message(UserMessage(
            text="Traduza cada objeto (campos title e summary) e devolva a lista [{id,title,summary}]:\n"
            + json.dumps(payload, ensure_ascii=False)))
        rows = [r for r in _json_list(raw) if r.get("id") and r.get("title")]
        for r in rows:
            await db.news_translations.update_one(
                {"id": r["id"]}, {"$set": {"id": r["id"], "title": r["title"], "summary": r.get("summary", "")}}, upsert=True)
    except Exception as exc:  # no balance / bad JSON: items simply stay hidden until the next refresh
        log.warning("news translation failed: %s", type(exc).__name__)


async def _translate(items: list[dict]) -> list[dict]:
    """Returns the items to publish: PT items + foreign items that have a PT-BR translation."""
    foreign = [it for it in items if it["lang"] != "pt"]
    if not foreign:
        return items
    ids = [it["id"] for it in foreign]
    done = {d["id"] async for d in db.news_translations.find({"id": {"$in": ids}}, {"id": 1})}
    todo = [it for it in foreign if it["id"] not in done]
    if todo and os.environ.get("EMERGENT_LLM_KEY"):
        sem = asyncio.Semaphore(2)  # gentle on the LLM rate limit

        async def run(batch: list[dict]) -> None:
            async with sem:
                await _translate_batch(batch)
        await asyncio.gather(*(run(todo[i:i + 12]) for i in range(0, len(todo), 12)))
    tr = {d["id"]: d async for d in db.news_translations.find({"id": {"$in": ids}})}
    out = []
    for it in items:
        if it["lang"] == "pt":
            out.append(it)
        elif it["id"] in tr:
            it.update(title=tr[it["id"]]["title"], summary=tr[it["id"]]["summary"], translated=True)
            out.append(it)
    return out


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
    published = await _translate(list(merged.values()))
    _cache.update(
        items=sorted(published, key=lambda x: x["published_at"], reverse=True),
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


# ---------------- reading mode ----------------
MD_EMPH = re.compile(r"(\*\*|__|\*|`)")
MD_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")
MAX_ARTICLE_CHARS = 14000


def _blocks(md: str, title: str) -> list[dict]:
    out, total = [], 0
    for line in md.splitlines():
        line = MD_EMPH.sub("", MD_LINK.sub(r"\1", line)).strip()
        if not line or line.lower() == title.lower():
            continue
        kind = "p"
        if line.startswith("#"):
            kind, line = "h", line.lstrip("#").strip()
        elif line.startswith(("- ", "* ", "• ")):
            kind, line = "li", line[2:].strip()
        elif line.startswith(">"):
            kind, line = "quote", line.lstrip("> ").strip()
        if len(line) < 2 or (kind == "li" and len(line) < 20) or (
                kind == "p" and len(line) < 45 and not line.endswith((".", "!", "?", ":"))):
            continue  # captions, bylines, share buttons
        if kind == "h" and not out:
            continue  # the page's own headline duplicates the title we already show
        out.append({"kind": kind, "text": line})
        total += len(line)
        if total > MAX_ARTICLE_CHARS:
            break
    return out


async def _extract(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
               "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=5.0), follow_redirects=True, headers=headers) as client:
        r = await client.get(url)
        r.raise_for_status()
    return await asyncio.to_thread(
        trafilatura.extract, r.text, output_format="markdown", include_comments=False, include_tables=False,
        include_images=False, include_links=False, favor_precision=True) or ""


async def _translate_blocks(news_id: str, blocks: list[dict]) -> list[dict]:
    texts = [b["text"] for b in blocks]
    raw = await _llm(f"news-art-{news_id}").send_message(UserMessage(
        text="Traduza cada parágrafo desta lista JSON preservando toda a pontuação original (inclusive o ponto final). "
        "Devolva uma lista JSON com o MESMO número de itens, na mesma ordem:\n"
        + json.dumps(texts, ensure_ascii=False)))
    tr = _json_list(raw)
    if len(tr) != len(texts):
        raise ValueError("translation length mismatch")
    return [{"kind": b["kind"], "text": str(t)} for b, t in zip(blocks, tr)]


@router.get("/{news_id}/article", response_model=ArticleOut)
async def read_article(news_id: str, _me: dict = Depends(current_user)):
    item = next((i for i in await _items() if i["id"] == news_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Notícia não encontrada ou expirada.")
    cached = await db.news_articles.find_one({"id": news_id}, {"_id": 0})
    if cached:
        blocks = cached["blocks"]
    else:
        blocks = []
        try:
            blocks = _blocks(await _extract(item["url"]), item["title"])
            if sum(len(b["text"]) for b in blocks) < 400:
                blocks = []  # paywall / script-rendered page: not worth a reader
            if blocks and item["lang"] != "pt":
                blocks = await _translate_blocks(news_id, blocks)
        except Exception as exc:
            log.info("reader fallback for %s: %s", item["source"], type(exc).__name__)
            blocks = []
        if blocks:
            await db.news_articles.update_one({"id": news_id}, {"$set": {"id": news_id, "blocks": blocks}}, upsert=True)
    words = sum(len(b["text"].split()) for b in blocks) or len(item["summary"].split())
    return ArticleOut(
        item=NewsItem(**item), status="full" if blocks else "summary",
        blocks=[ArticleBlock(**b) for b in blocks], reading_minutes=max(1, round(words / 220)),
    )
