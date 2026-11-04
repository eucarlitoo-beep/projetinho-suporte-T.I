"""Models for tickets (chamados), news feed and verse of the day. Mirror: frontend/src/lib/types.ts."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["baixa", "media", "alta", "urgente"]
Status = Literal["aberto", "em_atendimento", "resolvido"]


# ---------------- tickets ----------------
class TicketCategory(BaseModel):
    id: str
    name: str
    color: str


class TicketCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40)


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(default="", max_length=4000)
    category_id: str
    priority: Priority = "media"
    location: str = Field(default="", max_length=80)


class TicketUpdate(BaseModel):
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    category_id: Optional[str] = None
    assignee_id: Optional[str] = None


class TicketOut(BaseModel):
    id: str
    number: int
    title: str
    description: str = ""
    category_id: str
    priority: Priority
    status: Status
    location: str = ""
    requester_id: str
    assignee_id: Optional[str] = None
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None


class PeriodPoint(BaseModel):
    date: str  # YYYY-MM-DD (local to the requested tz)
    abertos: int
    resolvidos: int


class CountItem(BaseModel):
    key: str
    label: str
    count: int
    color: str


class TicketStats(BaseModel):
    start: str
    end: str
    total: int
    open_now: int
    in_progress_now: int
    resolved_in_period: int
    period: List[PeriodPoint]
    priority: List[CountItem]
    category: List[CountItem]


# ---------------- news ----------------
class NewsItem(BaseModel):
    id: str
    title: str
    summary: str
    url: str
    image: str = ""
    video: str = ""
    source: str
    region: Literal["br", "mundo"]
    lang: str
    categories: List[str]
    published_at: str
    translated: bool = False


class ArticleBlock(BaseModel):
    kind: Literal["p", "h", "li", "quote"]
    text: str


class ArticleOut(BaseModel):
    item: NewsItem
    status: Literal["full", "summary"]
    blocks: List[ArticleBlock] = []
    reading_minutes: int = 1


class NewsCategory(BaseModel):
    id: str
    label: str
    description: str


class NewsOut(BaseModel):
    items: List[NewsItem]
    categories: List[NewsCategory]
    updated_at: Optional[str] = None
    failed_sources: List[str] = []


# ---------------- verse ----------------
class VerseOut(BaseModel):
    date: str
    reference: str
    text: str
    translation: str
    source: str
    offset: int
