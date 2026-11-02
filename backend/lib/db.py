"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("handle", ASCENDING)], name="handle"),
    ],
    "channels": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("members", ASCENDING)], name="members"),
        IndexModel([("dm_key", ASCENDING)], name="dm_key", sparse=True),
    ],
    "messages": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("channel_id", ASCENDING), ("parent_id", ASCENDING), ("created_at", DESCENDING)], name="channel_parent_created"),
        IndexModel([("parent_id", ASCENDING), ("created_at", ASCENDING)], name="parent_created"),
        IndexModel([("mentions", ASCENDING), ("created_at", DESCENDING)], name="mentions_created"),
    ],
    "reads": [IndexModel([("user_id", ASCENDING), ("channel_id", ASCENDING)], name="user_channel", unique=True)],
    "files": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "ai_messages": [IndexModel([("user_id", ASCENDING), ("channel_id", ASCENDING), ("created_at", ASCENDING)], name="user_channel_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
