"""App-level identity on top of Clerk: every signed-in Clerk user has a `users` profile doc."""

import random
import re
import uuid

from fastapi import Depends

from clerk_auth import require_user
from lib.db import db

COLORS = ["#00E5FF", "#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#FB923C", "#22D3EE"]


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", ".", name.lower()).strip(".")
    return base[:24] or "membro"


async def unique_handle(name: str, uid: str) -> str:
    base = slugify(name)
    handle = base
    while await db.users.find_one({"handle": handle, "user_id": {"$ne": uid}}):
        handle = f"{base}{random.randint(2, 999)}"
    return handle


async def current_user(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    doc = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if doc:
        return doc
    doc = {
        "user_id": uid,
        "name": "Novo membro",
        "handle": f"membro.{uuid.uuid4().hex[:5]}",
        "email": "",
        "avatar_url": "",
        "color": random.choice(COLORS),
        "title": "",
        "status_text": "",
        "status_emoji": "",
        "bot": False,
    }
    await db.users.update_one({"user_id": uid}, {"$setOnInsert": doc}, upsert=True)
    # New members land in the workspace's default channels (seeded with auto_join).
    await db.channels.update_many({"auto_join": True}, {"$addToSet": {"members": uid}})
    return await db.users.find_one({"user_id": uid}, {"_id": 0}) or doc
