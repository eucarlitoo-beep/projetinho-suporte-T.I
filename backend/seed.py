"""Idempotent seed: a lively demo workspace (bot teammates, channels, threads, reactions, pins).
Run: cd /app/backend && python seed.py   (re-running resets only seeded data)."""

import asyncio
from datetime import datetime, timedelta, timezone

from lib.db import db, ensure_indexes

BOTS = [
    ("seed-ana", "Ana Souza", "ana.souza", "Product Lead", "#F472B6", "🚀", "Lançando a v2", True),
    ("seed-bruno", "Bruno Lima", "bruno.lima", "Engenheiro Backend", "#34D399", "💻", "Em foco", True),
    ("seed-carla", "Carla Mendes", "carla.mendes", "Designer de Produto", "#A78BFA", "🎨", "Desenhando", True),
    ("seed-diego", "Diego Rocha", "diego.rocha", "Engenheiro Frontend", "#FBBF24", "🎧", "", False),
    ("seed-elisa", "Elisa Prado", "elisa.prado", "CEO", "#FB923C", "✈️", "Viajando até sexta", False),
    ("seed-nexus", "Nexus AI", "nexus", "Assistente de IA", "#00E5FF", "🤖", "Sempre online", True),
]

CHANNELS = [
    ("seed-geral", "geral", "Anúncios e conversas de todo o time", False),
    ("seed-dev", "desenvolvimento", "Engenharia, deploys e code review", False),
    ("seed-design", "design", "Interfaces, protótipos e feedback visual", False),
    ("seed-anuncios", "anuncios", "Novidades oficiais da empresa", False),
    ("seed-random", "random", "Memes, café e tudo que não é trabalho", False),
    ("seed-lideranca", "lideranca", "Canal privado da liderança", True),
]

# (id, channel, user, minutes_ago, text, reactions, pinned, parent)
MESSAGES = [
    ("m1", "seed-geral", "seed-elisa", 2900, "Bom dia, time! ☀️ Bem-vindos ao **Nexus** — nosso novo espaço de trabalho em tempo real.", [("👋", ["seed-ana", "seed-bruno", "seed-carla"]), ("🚀", ["seed-diego"])], True, None),
    ("m2", "seed-geral", "seed-ana", 2880, "Que demais! Já migrei os quadros do produto pra cá. Usem `#desenvolvimento` para assuntos técnicos 🙌", [("🔥", ["seed-elisa"])], False, None),
    ("m3", "seed-geral", "seed-carla", 1500, "Pessoal, a nova identidade visual está no #design — feedbacks são muito bem-vindos!", [], False, None),
    ("m4", "seed-geral", "seed-bruno", 240, "Deploy da v2.4 concluído com sucesso ✅ Latência média caiu 38%.", [("🎉", ["seed-ana", "seed-elisa", "seed-carla", "seed-diego"]), ("⚡", ["seed-ana"])], False, None),
    ("m4r1", "seed-geral", "seed-ana", 230, "Incrível @bruno.lima! O que mudou na arquitetura?", [], False, "m4"),
    ("m4r2", "seed-geral", "seed-bruno", 225, "Trocamos o polling por WebSockets e adicionamos cache nas consultas de presença.", [("🧠", ["seed-ana"])], False, "m4"),
    ("m4r3", "seed-geral", "seed-diego", 220, "No front a diferença é absurda, as mensagens aparecem instantaneamente.", [], False, "m4"),
    ("m5", "seed-geral", "seed-nexus", 60, "Dica: abra o painel **Nexus AI** no topo do canal para resumir conversas longas ou tirar dúvidas sobre o que foi decidido. ✨", [("🤖", ["seed-ana", "seed-carla"])], False, None),

    ("d1", "seed-dev", "seed-bruno", 1800, "Abri o PR #482: refatoração do serviço de notificações. Quem consegue revisar?", [("👀", ["seed-diego"])], False, None),
    ("d1r1", "seed-dev", "seed-diego", 1790, "Pego agora! Só preciso terminar o componente de reações.", [], False, "d1"),
    ("d1r2", "seed-dev", "seed-bruno", 1700, "Valeu! Atenção especial no retry exponencial.", [], False, "d1"),
    ("d2", "seed-dev", "seed-diego", 600, "Alguém sabe por que o build está demorando 4 min no CI?", [], False, None),
    ("d3", "seed-dev", "seed-bruno", 590, "Provável cache do node_modules invalidado. Vou ajustar a chave do cache para usar o hash do `yarn.lock`.", [("🙏", ["seed-diego"])], True, None),
    ("d4", "seed-dev", "seed-ana", 120, "Lembrete: code freeze na quinta às 18h. Priorizem os bugs P1 🐞", [("✅", ["seed-bruno", "seed-diego"])], False, None),

    ("g1", "seed-design", "seed-carla", 1400, "Subi a nova paleta: azul elétrico `#00E5FF` + fundo void `#070B14`. Inspirada em circuitos ⚡", [("😍", ["seed-ana", "seed-diego", "seed-elisa"])], True, None),
    ("g1r1", "seed-design", "seed-ana", 1390, "Ficou muito futurista. Funciona no tema claro também?", [], False, "g1"),
    ("g1r2", "seed-design", "seed-carla", 1380, "Sim! No claro usamos `#0284C7` para manter contraste AA.", [("👌", ["seed-ana"])], False, "g1"),
    ("g2", "seed-design", "seed-diego", 300, "Implementei as micro-interações nas reações — dá um pop suave ao clicar 🎯", [("✨", ["seed-carla"])], False, None),

    ("a1", "seed-anuncios", "seed-elisa", 4000, "📣 Fechamos a rodada Série A! Obrigada a cada um de vocês. Novos desafios vêm aí.", [("🎉", ["seed-ana", "seed-bruno", "seed-carla", "seed-diego"]), ("❤️", ["seed-ana", "seed-carla"])], True, None),
    ("a2", "seed-anuncios", "seed-ana", 900, "Offsite confirmado: 12 e 13 do próximo mês em Florianópolis 🏝️", [("🏖️", ["seed-bruno", "seed-diego"])], False, None),

    ("r1", "seed-random", "seed-diego", 700, "Quem topa um café às 16h? ☕", [("☕", ["seed-bruno", "seed-carla"])], False, None),
    ("r2", "seed-random", "seed-carla", 690, "Eu! Levo os pães de queijo 🧀", [("😂", ["seed-diego"])], False, None),

    ("l1", "seed-lideranca", "seed-elisa", 1000, "Pauta da reunião de planejamento do Q3: metas, contratações e roadmap.", [], True, None),
    ("l2", "seed-lideranca", "seed-ana", 980, "Sugiro priorizar o assistente de IA no roadmap — o uso cresceu 3x este mês.", [("💯", ["seed-elisa"])], False, None),
]


async def main() -> None:
    await ensure_indexes()
    now = datetime.now(timezone.utc)
    for uid, name, handle, title, color, emoji, status, online in BOTS:
        await db.users.update_one({"user_id": uid}, {"$set": {
            "user_id": uid, "name": name, "handle": handle, "email": f"{handle}@nexus.demo", "avatar_url": "",
            "color": color, "title": title, "status_text": status, "status_emoji": emoji if status else "",
            "bot": uid == "seed-nexus", "always_online": online, "seeded": True,
        }}, upsert=True)
    bot_ids = [b[0] for b in BOTS]
    for cid, name, topic, private in CHANNELS:
        existing = await db.channels.find_one({"id": cid}, {"_id": 0, "members": 1}) or {}
        real_members = [m for m in existing.get("members", []) if not m.startswith("seed-")]
        await db.channels.update_one({"id": cid}, {"$set": {
            "id": cid, "name": name, "topic": topic, "is_private": private, "is_dm": False,
            "members": bot_ids + real_members, "created_by": "seed-elisa",
            "created_at": (now - timedelta(days=5)).isoformat(timespec="microseconds"),
            "auto_join": True, "seeded": True,
        }}, upsert=True)
    for mid, cid, uid, ago, text, reactions, pinned, parent in MESSAGES:
        await db.messages.update_one({"id": mid}, {"$set": {
            "id": mid, "channel_id": cid, "user_id": uid, "text": text, "parent_id": parent,
            "reactions": [{"emoji": e, "user_ids": u} for e, u in reactions], "files": [],
            "mentions": ["seed-bruno"] if "@bruno.lima" in text else [],
            "pinned": pinned, "pinned_by": uid if pinned else None, "edited": False,
            "created_at": (now - timedelta(minutes=ago)).isoformat(timespec="microseconds"), "seeded": True,
        }, "$setOnInsert": {"reply_count": 0, "reply_user_ids": [], "last_reply_at": None}}, upsert=True)
    # Recompute thread counters for seeded parents.
    for mid, *_rest in MESSAGES:
        replies = await db.messages.find({"parent_id": mid}, {"_id": 0}).sort("created_at", 1).to_list(500)
        if replies:
            await db.messages.update_one({"id": mid}, {"$set": {
                "reply_count": len(replies), "reply_user_ids": list(dict.fromkeys(r["user_id"] for r in replies)),
                "last_reply_at": replies[-1]["created_at"],
            }})
    print(f"seeded {len(BOTS)} users, {len(CHANNELS)} channels, {len(MESSAGES)} messages")


if __name__ == "__main__":
    asyncio.run(main())
