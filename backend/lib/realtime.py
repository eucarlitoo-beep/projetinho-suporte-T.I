"""In-process WebSocket hub: presence + fan-out of chat events (single uvicorn worker)."""

import json
import logging
from typing import Iterable, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self) -> None:
        self.conns: dict[str, set[WebSocket]] = {}

    def online_ids(self) -> set[str]:
        return {uid for uid, socks in self.conns.items() if socks}

    def is_online(self, uid: str) -> bool:
        return bool(self.conns.get(uid))

    async def connect(self, uid: str, ws: WebSocket) -> bool:
        """Register a socket; returns True when the user just came online."""
        first = not self.conns.get(uid)
        self.conns.setdefault(uid, set()).add(ws)
        return first

    def disconnect(self, uid: str, ws: WebSocket) -> bool:
        """Unregister a socket; returns True when the user just went offline."""
        socks = self.conns.get(uid, set())
        socks.discard(ws)
        if not socks:
            self.conns.pop(uid, None)
            return True
        return False

    async def send(self, payload: dict, user_ids: Optional[Iterable[str]] = None, exclude: Optional[str] = None) -> None:
        """Send to the given users (None = everyone online), skipping `exclude`."""
        data = json.dumps(payload)
        targets = list(self.conns.keys()) if user_ids is None else list(set(user_ids))
        for uid in targets:
            if uid == exclude:
                continue
            for ws in list(self.conns.get(uid, ())):
                try:
                    await ws.send_text(data)
                except Exception:  # dead socket — the receive loop cleans it up
                    logger.debug("ws send failed for %s", uid)


hub = Hub()


def audience(channel: dict) -> Optional[list[str]]:
    """Who may receive events for a channel: None for public channels (everyone)."""
    if channel.get("is_private") or channel.get("is_dm"):
        return channel.get("members", [])
    return None


async def broadcast_channel(channel: dict, payload: dict, exclude: Optional[str] = None) -> None:
    await hub.send(payload, audience(channel), exclude)
