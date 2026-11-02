# Nexus — Slack-like real-time workspace (pt-BR)

## What it does
Landing page with the user's chip video as an intro splash + hero background, then a Slack-style workspace:
public/private channels, DMs (incl. self-DM), live chat via WebSocket, threads, emoji reactions, @mentions
(+ Activity view), typing indicator, online presence, edit/delete own messages, pins, global search (Ctrl/⌘+K:
messages, channels, files, people), file/image upload (≤8 MB, stored in Mongo), user status, channel topic,
join/leave, unread dots + mention badges, dark/light theme, Nexus AI panel (Claude Sonnet 4.6 via Emergent key,
streaming SSE) to summarize channel/thread or answer questions.

## Auth
Emergent-managed Clerk (email/password + Google). Frontend registers Clerk getToken() into src/lib/api.ts;
backend `require_user` (clerk_auth.py) → `lib/auth.current_user` upserts a `users` doc and auto-joins
channels with `auto_join: true`. WebSocket: `/api/ws?token=<clerk jwt>`.
Profile name/email/avatar synced via POST /api/me/sync on workspace load.

## Data model (Mongo)
- users {user_id, name, handle, email, avatar_url, color, title, status_text, status_emoji, bot, always_online?}
- channels {id, name, topic, is_private, is_dm, members[], created_by, created_at, dm_key?, auto_join?}
- messages {id, channel_id, user_id, text, parent_id|null, reply_count, reply_user_ids, last_reply_at,
  reactions[{emoji,user_ids}], files[FileMeta], mentions[user_id], pinned, pinned_by, edited, created_at(ISO str)}
- reads {user_id, channel_id, last_read_at}; files {id,name,content_type,size,data,user_id}; ai_messages

## Key endpoints (all /api)
me, me/sync, me/status, users, channels (GET/POST), channels/{id} PATCH, /join, /leave, /read, /messages,
/pins, dms, messages/{id} PATCH/DELETE, /thread, /reactions, /pin, mentions, search?q=, files (POST/GET),
ai/history, ai/stream, ws, clerk/config.

## Seed (python seed.py)
Bot users: Ana Souza (@ana.souza), Bruno Lima (@bruno.lima), Carla Mendes, Diego Rocha, Elisa Prado, Nexus AI.
Channels: #geral, #desenvolvimento, #design, #anuncios, #random (public) and #lideranca (private) — all auto_join.
Seeded messages include threads (m4 in #geral has 3 replies), reactions and pins.

## GIFs (GIPHY)
- Backend proxy `GET /api/gifs/trending`, `GET /api/gifs/search?q=` (routers/gifs.py, auth required, 5-min in-memory cache, key `GIPHY_API_KEY` in backend/.env; 503 "GIFs ainda não configurados" if missing).
- Messages carry optional `gif: GifMeta {id,title,url,preview_url,width,height}`; POST message accepts `gif` (only https *.giphy.com URLs, else 422). A GIF-only message is valid.
- Composer (channel + thread) has a "GIF" button → popover with search, suggestions, trending, "Powered by GIPHY". Picking sends immediately.

## Landing
- Hero positioned for "Suporte T.I. · Gestão escolar"; school section (#suporte-ti, #secretaria, #coordenacao, #comunicados tiles).

## Workspace views (route /app/:channelId with special ids)
- `/app` → **Início** (HomeView): saudação, carrossel automático de notícias (7s, pausa no hover/foco/botão, setas, pontos, teclado ←/→, respeita prefers-reduced-motion, vídeo só mudo), **Versículo do Dia** (copiar, compartilhar via Web Share/WhatsApp, voltar até 30 dias), atalhos (Chamados, Notícias, Escolas, Saúde Mental), canais com novidades.
- `/app/tickets` → **Chamados de T.I.**: aba Painel (filtro 7/30/90 dias ou datas; KPIs; gráfico de linhas por período abertos×resolvidos; rosca por prioridade com % e legenda; barras horizontais por categoria cadastrada) e aba Chamados (lista, filtro por status, busca, mudar status/responsável, novo chamado, cadastrar categoria).
- `/app/news` → **Notícias**: categorias ia | escolas | educacao | saude | seguranca, região (Brasil/Mundo), busca, ordenação; saúde mental mostra aviso "não substitui orientação profissional / CVV 188".
- `/app/activity` (menções) and channel ids unchanged. Rail: Início, Chat, Chamados, Notícias, Atividade, Buscar (mobile: same items in sidebar sheet).

## New APIs (all auth required)
- Tickets (routers/tickets.py, models/extras.py): `GET/POST /api/tickets`, `PATCH /api/tickets/{id}`, `GET/POST /api/tickets/categories` (defaults auto-registered on first read), `GET /api/tickets/stats?tz=&start=&end=` (default last 30 days ending server "today" in tz). Collections: tickets, ticket_categories, counters. No fake tickets are seeded.
- News (routers/news.py): `GET /api/news?category=&region=&q=&sort=recentes|antigas&with_image=&limit=` — aggregates public RSS (g1, Tecnoblog, Olhar Digital, Canaltech, BBC, The Hacker News, Porvir, EdSurge, Agência Brasil, The Guardian), keyword-classified, 20-min in-memory cache, stale copy kept on failure, `failed_sources` reported.
- Verse (routers/verse.py): `GET /api/verse?tz=&offset=0..30` — local verified collection `backend/data/verses.json` (118 verses, Almeida domínio público, checked against bible-api.com).
- GIF: picker now shows a **preview** in the composer (remove/caption) before sending.

## Landing
- "Ver intro" button removed; "Entrar" → /sign-in (existing Clerk auth).

## Typography system v2 ("Nexus Type", Inter-only + Newsreader editorial)
- UI: Inter Variable only (opsz axis → display cut at large sizes). Text features cv02/03/04/05/08/11 + ss03; headings drop cv05/cv08.
- Editorial: Newsreader ONLY for news headlines + verse (`type-headline`). Code: JetBrains Mono.
- Semantic utilities in src/index.css: type-display, type-section, type-title, type-h3-lg, type-h3, type-h4, type-bar, type-wordmark, type-author, type-lead, type-reading, type-dek, type-eyebrow, type-caption, type-meta, type-kpi, type-headline.
- Weights come from --w-display/--w-heading/--w-title/--w-strong and --track-text tokens; .dark trims weight & opens tracking.
- News: all sources are PT-BR; backend `_translate` (news.py) auto-translates any foreign-language item via Claude (EMERGENT_LLM_KEY), cached by id; fails open.
