"""WebSocket endpoint: /api/ws?token=<clerk session jwt>. Presence + typing + server-pushed chat events."""

import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from clerk_auth import verify_session_token
from lib.db import db
from lib.realtime import broadcast_channel, hub

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    token = ws.query_params.get("token", "")
    try:
        claims = await run_in_threadpool(verify_session_token, token)
    except HTTPException:
        await ws.close(code=4401)
        return
    uid = claims["sub"]
    await ws.accept()
    if await hub.connect(uid, ws):
        await hub.send({"type": "presence", "user_id": uid, "online": True}, exclude=uid)
    await ws.send_text(json.dumps({"type": "hello", "online": sorted(hub.online_ids())}))
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except ValueError:
                continue
            kind = data.get("type")
            if kind == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
            elif kind == "typing" and isinstance(data.get("channel_id"), str):
                ch = await db.channels.find_one({"id": data["channel_id"]}, {"_id": 0})
                if ch and (not (ch.get("is_private") or ch.get("is_dm")) or uid in ch.get("members", [])):
                    await broadcast_channel(ch, {
                        "type": "typing", "channel_id": ch["id"], "user_id": uid,
                        "parent_id": data.get("parent_id"),
                    }, exclude=uid)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # never let one socket crash the worker
        logger.info("ws closed for %s: %s", uid, exc)
    finally:
        if hub.disconnect(uid, ws):
            await hub.send({"type": "presence", "user_id": uid, "online": False})
