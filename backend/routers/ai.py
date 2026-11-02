"""Nexus AI — streaming channel/thread summaries and Q&A over the conversation (Claude via Emergent key)."""

import json
import os
import uuid
from typing import List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

from lib.auth import current_user
from lib.db import db
from models.chat import AIMessage, AIStreamIn
from routers.chat import get_channel_for, now_iso

router = APIRouter()

SYSTEM = (
    "Você é o Nexus AI, assistente integrado a um workspace de chat estilo Slack. "
    "Responda sempre em português do Brasil, de forma objetiva e bem estruturada em Markdown leve "
    "(títulos curtos, listas com '-', **negrito** para pontos-chave). "
    "Baseie-se apenas na conversa fornecida; se algo não estiver nela, diga isso claramente."
)


async def build_context(channel: dict, parent_id: str | None) -> str:
    if parent_id:
        parent = await db.messages.find_one({"id": parent_id, "channel_id": channel["id"]}, {"_id": 0})
        replies = await db.messages.find({"parent_id": parent_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
        msgs = ([parent] if parent else []) + replies
        scope = "thread"
    else:
        msgs = list(reversed(await db.messages.find({"channel_id": channel["id"], "parent_id": None}, {"_id": 0})
                             .sort("created_at", -1).to_list(120)))
        scope = "canal"
    ids = list({m["user_id"] for m in msgs})
    names = {u["user_id"]: u["name"] for u in await db.users.find({"user_id": {"$in": ids}}, {"_id": 0}).to_list(500)}
    lines = []
    for m in msgs:
        files = f" [anexos: {', '.join(f['name'] for f in m.get('files', []))}]" if m.get("files") else ""
        thread = f" ({m['reply_count']} respostas na thread)" if m.get("reply_count") else ""
        lines.append(f"[{m['created_at'][:16].replace('T', ' ')}] {names.get(m['user_id'], 'Alguém')}: {m['text']}{files}{thread}")
    title = "mensagem direta" if channel.get("is_dm") else f"#{channel['name']}"
    return f"Conversa ({scope} em {title}):\n" + ("\n".join(lines) or "(sem mensagens)")


@router.get("/ai/history", response_model=List[AIMessage])
async def ai_history(channel_id: str, me: dict = Depends(current_user)):
    docs = await db.ai_messages.find({"user_id": me["user_id"], "channel_id": channel_id}, {"_id": 0}) \
        .sort("created_at", 1).to_list(100)
    return [AIMessage(**d) for d in docs]


@router.delete("/ai/history")
async def clear_ai_history(channel_id: str, me: dict = Depends(current_user)):
    await db.ai_messages.delete_many({"user_id": me["user_id"], "channel_id": channel_id})
    return {"ok": True}


@router.post("/ai/stream")
async def ai_stream(body: AIStreamIn, me: dict = Depends(current_user)):
    channel = await get_channel_for(body.channel_id, me["user_id"])
    context = await build_context(channel, body.parent_id)
    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()), "user_id": me["user_id"], "channel_id": body.channel_id,
        "role": "user", "text": body.prompt, "created_at": now_iso(),
    })
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"nexus-{me['user_id']}-{uuid.uuid4().hex[:8]}",
        system_message=SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-6")
    prompt = f"{context}\n\n---\nPedido do usuário ({me['name']}): {body.prompt}"

    async def gen():
        parts: list[str] = []
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    parts.append(ev.content)
                    yield f"data: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:  # surface failure to the client instead of a silent cut
            msg = f"\n\n_Não foi possível concluir a resposta ({type(exc).__name__})._"
            parts.append(msg)
            yield f"data: {json.dumps({'t': msg})}\n\n"
        await db.ai_messages.insert_one({
            "id": str(uuid.uuid4()), "user_id": me["user_id"], "channel_id": body.channel_id,
            "role": "assistant", "text": "".join(parts), "created_at": now_iso(),
        })
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
