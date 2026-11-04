"""Workspace REST API: users, channels, DMs, messages, threads, reactions, pins, files, search."""

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import quote

from bson import Binary
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile

from lib.auth import current_user, unique_handle
from lib.db import db
from lib.realtime import broadcast_channel, hub
from routers.gifs import is_giphy_url
from models.chat import (
    ChannelCreate, ChannelOut, ChannelUpdate, DMCreate, FileMeta, MessageCreate, MessageEdit,
    MessageOut, ReactionIn, SearchOut, StatusIn, SyncIn, ThreadOut, UserOut,
)

router = APIRouter()

MAX_FILE_BYTES = 8 * 1024 * 1024


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def user_out(doc: dict) -> UserOut:
    return UserOut(**{**doc, "online": hub.is_online(doc["user_id"]) or bool(doc.get("always_online"))})


def can_access(channel: dict, uid: str) -> bool:
    if channel.get("is_private") or channel.get("is_dm"):
        return uid in channel.get("members", [])
    return True


async def get_channel_for(channel_id: str, uid: str) -> dict:
    ch = await db.channels.find_one({"id": channel_id}, {"_id": 0})
    if not ch or not can_access(ch, uid):
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    return ch


async def get_message_for(message_id: str, uid: str) -> tuple[dict, dict]:
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    ch = await get_channel_for(msg["channel_id"], uid)
    return msg, ch


async def extract_mentions(text: str) -> list[str]:
    handles = set(re.findall(r"@([a-z0-9][a-z0-9._-]*)", text.lower()))
    if not handles:
        return []
    handles = {h.rstrip(".") for h in handles}
    docs = await db.users.find({"handle": {"$in": list(handles)}}, {"_id": 0, "user_id": 1}).to_list(100)
    return [d["user_id"] for d in docs]


async def emit_message(ch: dict, event: str, msg: dict) -> None:
    await broadcast_channel(ch, {"type": event, "channel_id": ch["id"], "message": MessageOut(**msg).model_dump()})


# ---------------------------------------------------------------- me / users
@router.get("/me", response_model=UserOut)
async def get_me(me: dict = Depends(current_user)):
    return user_out(me)


@router.post("/me/sync", response_model=UserOut)
async def sync_me(body: SyncIn, me: dict = Depends(current_user)):
    update = {"name": body.name.strip(), "email": body.email, "avatar_url": body.avatar_url}
    if me["handle"].startswith("membro.") or me["name"] != update["name"]:
        update["handle"] = await unique_handle(update["name"], me["user_id"])
    await db.users.update_one({"user_id": me["user_id"]}, {"$set": update})
    doc = {**me, **update}
    await hub.send({"type": "user.updated", "user": user_out(doc).model_dump()})
    return user_out(doc)


@router.patch("/me/status", response_model=UserOut)
async def set_status(body: StatusIn, me: dict = Depends(current_user)):
    update = body.model_dump()
    await db.users.update_one({"user_id": me["user_id"]}, {"$set": update})
    doc = {**me, **update}
    await hub.send({"type": "user.updated", "user": user_out(doc).model_dump()})
    return user_out(doc)


@router.get("/users", response_model=List[UserOut])
async def list_users(me: dict = Depends(current_user)):
    docs = await db.users.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [user_out(d) for d in docs]


# ---------------------------------------------------------------- channels
async def channel_out(ch: dict, uid: str, reads: dict[str, str]) -> ChannelOut:
    is_member = uid in ch.get("members", []) or not (ch.get("is_private") or ch.get("is_dm"))
    last = reads.get(ch["id"])
    unread = mentions = 0
    if last is not None or ch.get("is_dm") or uid in ch.get("members", []):
        q = {"channel_id": ch["id"], "parent_id": None, "user_id": {"$ne": uid}}
        if last:
            q["created_at"] = {"$gt": last}
        unread = await db.messages.count_documents(q)
        mentions = await db.messages.count_documents({**q, "mentions": uid})
    return ChannelOut(**ch, unread=unread, mentions=mentions, is_member=is_member)


@router.get("/channels", response_model=List[ChannelOut])
async def list_channels(me: dict = Depends(current_user)):
    uid = me["user_id"]
    docs = await db.channels.find(
        {"$or": [{"is_private": False, "is_dm": False}, {"members": uid}]}, {"_id": 0}
    ).sort("name", 1).to_list(500)
    reads = {r["channel_id"]: r["last_read_at"] for r in await db.reads.find({"user_id": uid}, {"_id": 0}).to_list(1000)}
    return [await channel_out(d, uid, reads) for d in docs]


@router.post("/channels", response_model=ChannelOut)
async def create_channel(body: ChannelCreate, me: dict = Depends(current_user)):
    name = re.sub(r"[^a-z0-9\-_à-ú]+", "-", body.name.strip().lower()).strip("-")
    if not name:
        raise HTTPException(status_code=422, detail="Nome inválido")
    if await db.channels.find_one({"name": name, "is_dm": False}):
        raise HTTPException(status_code=409, detail="Já existe um canal com esse nome")
    members = list({me["user_id"], *body.member_ids})
    ch = {
        "id": str(uuid.uuid4()), "name": name, "topic": body.topic, "is_private": body.is_private,
        "is_dm": False, "members": members, "created_by": me["user_id"], "created_at": now_iso(),
    }
    await db.channels.insert_one(dict(ch))
    await broadcast_channel(ch, {"type": "channel.updated", "channel_id": ch["id"]})
    return ChannelOut(**ch)


@router.patch("/channels/{channel_id}", response_model=ChannelOut)
async def update_channel(channel_id: str, body: ChannelUpdate, me: dict = Depends(current_user)):
    ch = await get_channel_for(channel_id, me["user_id"])
    await db.channels.update_one({"id": channel_id}, {"$set": {"topic": body.topic}})
    ch["topic"] = body.topic
    await broadcast_channel(ch, {"type": "channel.updated", "channel_id": channel_id})
    return ChannelOut(**ch)


@router.post("/channels/{channel_id}/join", response_model=ChannelOut)
async def join_channel(channel_id: str, me: dict = Depends(current_user)):
    ch = await get_channel_for(channel_id, me["user_id"])
    await db.channels.update_one({"id": channel_id}, {"$addToSet": {"members": me["user_id"]}})
    ch["members"] = list({*ch.get("members", []), me["user_id"]})
    await broadcast_channel(ch, {"type": "channel.updated", "channel_id": channel_id})
    return ChannelOut(**ch)


@router.post("/channels/{channel_id}/leave", response_model=ChannelOut)
async def leave_channel(channel_id: str, me: dict = Depends(current_user)):
    ch = await get_channel_for(channel_id, me["user_id"])
    if ch.get("is_dm"):
        raise HTTPException(status_code=400, detail="Não é possível sair de uma DM")
    await db.channels.update_one({"id": channel_id}, {"$pull": {"members": me["user_id"]}})
    ch["members"] = [m for m in ch.get("members", []) if m != me["user_id"]]
    await broadcast_channel(ch, {"type": "channel.updated", "channel_id": channel_id})
    await hub.send({"type": "channel.updated", "channel_id": channel_id}, [me["user_id"]])
    return ChannelOut(**ch, is_member=False)


@router.post("/channels/{channel_id}/read")
async def mark_read(channel_id: str, me: dict = Depends(current_user)):
    await get_channel_for(channel_id, me["user_id"])
    await db.reads.update_one(
        {"user_id": me["user_id"], "channel_id": channel_id},
        {"$set": {"last_read_at": now_iso()}}, upsert=True,
    )
    return {"ok": True}


@router.post("/dms", response_model=ChannelOut)
async def open_dm(body: DMCreate, me: dict = Depends(current_user)):
    other = await db.users.find_one({"user_id": body.user_id}, {"_id": 0})
    if not other:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    members = sorted({me["user_id"], body.user_id})
    key = ":".join(members)
    ch = await db.channels.find_one({"dm_key": key}, {"_id": 0})
    if not ch:
        ch = {
            "id": str(uuid.uuid4()), "name": key, "topic": "", "is_private": True, "is_dm": True,
            "members": members, "created_by": me["user_id"], "created_at": now_iso(), "dm_key": key,
        }
        await db.channels.insert_one(dict(ch))
        await broadcast_channel(ch, {"type": "channel.updated", "channel_id": ch["id"]})
    return ChannelOut(**ch)


# ---------------------------------------------------------------- messages
@router.get("/channels/{channel_id}/messages", response_model=List[MessageOut])
async def list_messages(channel_id: str, me: dict = Depends(current_user)):
    await get_channel_for(channel_id, me["user_id"])
    docs = await db.messages.find({"channel_id": channel_id, "parent_id": None}, {"_id": 0}) \
        .sort("created_at", -1).to_list(300)
    return [MessageOut(**d) for d in reversed(docs)]


@router.post("/channels/{channel_id}/messages", response_model=MessageOut)
async def post_message(channel_id: str, body: MessageCreate, me: dict = Depends(current_user)):
    ch = await get_channel_for(channel_id, me["user_id"])
    text = body.text.strip()
    files: list[dict] = []
    if body.file_ids:
        files = await db.files.find(
            {"id": {"$in": body.file_ids}, "user_id": me["user_id"]},
            {"_id": 0, "id": 1, "name": 1, "content_type": 1, "size": 1},
        ).to_list(20)
    gif = None
    if body.gif:
        if not is_giphy_url(body.gif.url) or (body.gif.preview_url and not is_giphy_url(body.gif.preview_url)):
            raise HTTPException(status_code=422, detail="GIF inválido")
        gif = body.gif.model_dump()
    if not text and not files and not gif:
        raise HTTPException(status_code=422, detail="Mensagem vazia")
    parent = None
    if body.parent_id:
        parent = await db.messages.find_one({"id": body.parent_id, "channel_id": channel_id}, {"_id": 0})
        if not parent or parent.get("parent_id"):
            raise HTTPException(status_code=404, detail="Thread não encontrada")
    if not ch.get("is_dm") and me["user_id"] not in ch.get("members", []):
        await db.channels.update_one({"id": channel_id}, {"$addToSet": {"members": me["user_id"]}})
    msg = {
        "id": str(uuid.uuid4()), "channel_id": channel_id, "user_id": me["user_id"], "text": text,
        "parent_id": body.parent_id, "reply_count": 0, "reply_user_ids": [], "last_reply_at": None,
        "reactions": [], "files": files, "gif": gif, "mentions": await extract_mentions(text),
        "pinned": False, "pinned_by": None, "edited": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(dict(msg))
    await emit_message(ch, "message.new", msg)
    if parent:
        await db.messages.update_one(
            {"id": parent["id"]},
            {"$inc": {"reply_count": 1}, "$addToSet": {"reply_user_ids": me["user_id"]},
             "$set": {"last_reply_at": msg["created_at"]}},
        )
        updated = await db.messages.find_one({"id": parent["id"]}, {"_id": 0})
        if updated:
            await emit_message(ch, "message.updated", updated)
    return MessageOut(**msg)


@router.get("/messages/{message_id}/thread", response_model=ThreadOut)
async def get_thread(message_id: str, me: dict = Depends(current_user)):
    msg, _ = await get_message_for(message_id, me["user_id"])
    replies = await db.messages.find({"parent_id": message_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return ThreadOut(parent=MessageOut(**msg), replies=[MessageOut(**r) for r in replies])


@router.patch("/messages/{message_id}", response_model=MessageOut)
async def edit_message(message_id: str, body: MessageEdit, me: dict = Depends(current_user)):
    msg, ch = await get_message_for(message_id, me["user_id"])
    if msg["user_id"] != me["user_id"]:
        raise HTTPException(status_code=403, detail="Só o autor pode editar")
    update = {"text": body.text.strip(), "edited": True, "mentions": await extract_mentions(body.text)}
    await db.messages.update_one({"id": message_id}, {"$set": update})
    msg.update(update)
    await emit_message(ch, "message.updated", msg)
    return MessageOut(**msg)


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, me: dict = Depends(current_user)):
    msg, ch = await get_message_for(message_id, me["user_id"])
    if msg["user_id"] != me["user_id"]:
        raise HTTPException(status_code=403, detail="Só o autor pode excluir")
    await db.messages.delete_one({"id": message_id})
    await db.messages.delete_many({"parent_id": message_id})
    await broadcast_channel(ch, {"type": "message.deleted", "channel_id": ch["id"],
                                 "message_id": message_id, "parent_id": msg.get("parent_id")})
    if msg.get("parent_id"):
        await db.messages.update_one({"id": msg["parent_id"]}, {"$inc": {"reply_count": -1}})
        parent = await db.messages.find_one({"id": msg["parent_id"]}, {"_id": 0})
        if parent:
            await emit_message(ch, "message.updated", parent)
    return {"ok": True}


@router.post("/messages/{message_id}/reactions", response_model=MessageOut)
async def toggle_reaction(message_id: str, body: ReactionIn, me: dict = Depends(current_user)):
    msg, ch = await get_message_for(message_id, me["user_id"])
    uid = me["user_id"]
    reactions: list[dict] = msg.get("reactions", [])
    found = next((r for r in reactions if r["emoji"] == body.emoji), None)
    if found:
        if uid in found["user_ids"]:
            found["user_ids"].remove(uid)
        else:
            found["user_ids"].append(uid)
    else:
        reactions.append({"emoji": body.emoji, "user_ids": [uid]})
    reactions = [r for r in reactions if r["user_ids"]]
    await db.messages.update_one({"id": message_id}, {"$set": {"reactions": reactions}})
    msg["reactions"] = reactions
    await emit_message(ch, "message.updated", msg)
    return MessageOut(**msg)


@router.post("/messages/{message_id}/pin", response_model=MessageOut)
async def toggle_pin(message_id: str, me: dict = Depends(current_user)):
    msg, ch = await get_message_for(message_id, me["user_id"])
    pinned = not msg.get("pinned", False)
    update = {"pinned": pinned, "pinned_by": me["user_id"] if pinned else None}
    await db.messages.update_one({"id": message_id}, {"$set": update})
    msg.update(update)
    await emit_message(ch, "message.updated", msg)
    return MessageOut(**msg)


@router.get("/channels/{channel_id}/pins", response_model=List[MessageOut])
async def list_pins(channel_id: str, me: dict = Depends(current_user)):
    await get_channel_for(channel_id, me["user_id"])
    docs = await db.messages.find({"channel_id": channel_id, "pinned": True}, {"_id": 0}) \
        .sort("created_at", -1).to_list(100)
    return [MessageOut(**d) for d in docs]


async def accessible_channel_ids(uid: str) -> list[str]:
    docs = await db.channels.find(
        {"$or": [{"is_private": False, "is_dm": False}, {"members": uid}]}, {"_id": 0, "id": 1}
    ).to_list(1000)
    return [d["id"] for d in docs]


@router.get("/mentions", response_model=List[MessageOut])
async def list_mentions(me: dict = Depends(current_user)):
    ids = await accessible_channel_ids(me["user_id"])
    docs = await db.messages.find({"mentions": me["user_id"], "channel_id": {"$in": ids}}, {"_id": 0}) \
        .sort("created_at", -1).to_list(50)
    return [MessageOut(**d) for d in docs]


@router.get("/search", response_model=SearchOut)
async def search(q: str = Query(min_length=1, max_length=100), me: dict = Depends(current_user)):
    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    ids = await accessible_channel_ids(me["user_id"])
    msgs = await db.messages.find({"channel_id": {"$in": ids}, "text": rx}, {"_id": 0}) \
        .sort("created_at", -1).to_list(30)
    files = await db.messages.find({"channel_id": {"$in": ids}, "files.name": rx}, {"_id": 0}) \
        .sort("created_at", -1).to_list(10)
    chans = await db.channels.find({"id": {"$in": ids}, "is_dm": False, "name": rx}, {"_id": 0}).to_list(10)
    return SearchOut(
        messages=[MessageOut(**m) for m in msgs],
        channels=[ChannelOut(**c) for c in chans],
        files=[MessageOut(**m) for m in files],
    )


# ---------------------------------------------------------------- files
@router.post("/files", response_model=FileMeta)
async def upload_file(file: UploadFile = File(...), me: dict = Depends(current_user)):
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo maior que 8 MB")
    meta = {
        "id": str(uuid.uuid4()), "name": file.filename or "arquivo",
        "content_type": file.content_type or "application/octet-stream", "size": len(data),
    }
    await db.files.insert_one({**meta, "user_id": me["user_id"], "data": Binary(data), "created_at": now_iso()})
    return FileMeta(**meta)


@router.get("/files/{file_id}")
async def get_file(file_id: str, download: Optional[int] = None):
    # File ids are unguessable uuid4s, so <img src> can load them without an auth header.
    doc = await db.files.find_one({"id": file_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    disp = "attachment" if download else "inline"
    return Response(
        content=bytes(doc["data"]), media_type=doc["content_type"],
        headers={"Content-Disposition": f"{disp}; filename*=UTF-8''{quote(doc['name'])}",
                 "Cache-Control": "private, max-age=86400"},
    )
