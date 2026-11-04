"""Pydantic models for the chat workspace. Mirror: frontend/src/lib/types.ts."""

from typing import List, Optional

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    user_id: str
    name: str
    handle: str
    email: str = ""
    avatar_url: str = ""
    color: str = "#00E5FF"
    title: str = ""
    status_text: str = ""
    status_emoji: str = ""
    bot: bool = False
    online: bool = False


class SyncIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = ""
    avatar_url: str = ""


class StatusIn(BaseModel):
    status_text: str = Field(default="", max_length=100)
    status_emoji: str = Field(default="", max_length=8)
    title: str = Field(default="", max_length=60)


class ChannelOut(BaseModel):
    id: str
    name: str
    topic: str = ""
    is_private: bool = False
    is_dm: bool = False
    members: List[str] = []
    created_by: str = ""
    created_at: str
    unread: int = 0
    mentions: int = 0
    is_member: bool = True


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    topic: str = Field(default="", max_length=200)
    is_private: bool = False
    member_ids: List[str] = []


class ChannelUpdate(BaseModel):
    topic: str = Field(default="", max_length=200)


class DMCreate(BaseModel):
    user_id: str


class FileMeta(BaseModel):
    id: str
    name: str
    content_type: str
    size: int


class GifMeta(BaseModel):
    """A GIPHY GIF attached to a message. url = message rendition, preview_url = picker thumbnail."""
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(default="", max_length=200)
    url: str = Field(min_length=1, max_length=600)
    preview_url: str = Field(default="", max_length=600)
    width: int = 0
    height: int = 0


class GifSearchOut(BaseModel):
    gifs: List[GifMeta]


class Reaction(BaseModel):
    emoji: str
    user_ids: List[str] = []


class MessageOut(BaseModel):
    id: str
    channel_id: str
    user_id: str
    text: str
    parent_id: Optional[str] = None
    reply_count: int = 0
    reply_user_ids: List[str] = []
    last_reply_at: Optional[str] = None
    reactions: List[Reaction] = []
    files: List[FileMeta] = []
    gif: Optional[GifMeta] = None
    mentions: List[str] = []
    pinned: bool = False
    pinned_by: Optional[str] = None
    edited: bool = False
    created_at: str


class MessageCreate(BaseModel):
    text: str = Field(default="", max_length=8000)
    parent_id: Optional[str] = None
    file_ids: List[str] = []
    gif: Optional[GifMeta] = None


class MessageEdit(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class ThreadOut(BaseModel):
    parent: MessageOut
    replies: List[MessageOut]


class SearchOut(BaseModel):
    messages: List[MessageOut]
    channels: List[ChannelOut]
    files: List[MessageOut]


class AIStreamIn(BaseModel):
    channel_id: str
    parent_id: Optional[str] = None
    prompt: str = Field(min_length=1, max_length=4000)


class AIMessage(BaseModel):
    id: str
    channel_id: str
    role: str  # "user" | "assistant"
    text: str
    created_at: str
