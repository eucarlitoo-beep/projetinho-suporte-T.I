import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/api";
import type { MessageOut, ThreadOut, UserOut } from "@/lib/types";

type TypingMap = Record<string, Record<string, number>>; // key -> user_id -> expiresAt

interface RealtimeCtx {
  connected: boolean;
  typing: TypingMap;
  sendTyping: (channelId: string, parentId?: string | null) => void;
}

const Ctx = createContext<RealtimeCtx>({ connected: false, typing: {}, sendTyping: () => {} });

export const typingKey = (channelId: string, parentId?: string | null) => `${channelId}:${parentId ?? ""}`;

function upsert(list: MessageOut[] | undefined, msg: MessageOut): MessageOut[] | undefined {
  if (!list) return list;
  const i = list.findIndex((m) => m.id === msg.id);
  if (i === -1) return [...list, msg];
  const next = list.slice();
  next[i] = msg;
  return next;
}

function applyMessage(qc: QueryClient, msg: MessageOut, isNew: boolean) {
  if (!msg.parent_id) {
    qc.setQueryData<MessageOut[]>(["messages", msg.channel_id], (old) =>
      isNew ? upsert(old, msg) : old?.map((m) => (m.id === msg.id ? msg : m)),
    );
    qc.setQueryData<ThreadOut>(["thread", msg.id], (old) => (old ? { ...old, parent: msg } : old));
  } else {
    qc.setQueryData<ThreadOut>(["thread", msg.parent_id], (old) =>
      old ? { ...old, replies: upsert(old.replies, msg) ?? [] } : old,
    );
  }
}

export function RealtimeProvider({ meId, activeChannelId, children }: { meId: string; activeChannelId: string | null; children: ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<TypingMap>({});
  const wsRef = useRef<WebSocket | null>(null);
  const lastTyping = useRef<Record<string, number>>({});
  const activeRef = useRef(activeChannelId);
  activeRef.current = activeChannelId;

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let ping: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onEvent = (data: Record<string, unknown>) => {
      const type = data.type as string;
      if (type === "message.new" || type === "message.updated") {
        const msg = data.message as MessageOut;
        applyMessage(qc, msg, type === "message.new");
        if (msg.pinned !== undefined) qc.invalidateQueries({ queryKey: ["pins", msg.channel_id] });
        if (type === "message.new") {
          qc.invalidateQueries({ queryKey: ["channels"] });
          // a new message clears that author's typing indicator
          setTyping((t) => {
            const k = typingKey(msg.channel_id, msg.parent_id);
            if (!t[k]?.[msg.user_id]) return t;
            const { [msg.user_id]: _gone, ...rest } = t[k];
            return { ...t, [k]: rest };
          });
          if (msg.user_id !== meId && msg.mentions.includes(meId)) {
            qc.invalidateQueries({ queryKey: ["mentions"] });
            const users = qc.getQueryData<UserOut[]>(["users"]);
            const author = users?.find((u) => u.user_id === msg.user_id)?.name ?? "Alguém";
            toast(`${author} mencionou você`, { description: msg.text.slice(0, 90) });
          }
        }
      } else if (type === "message.deleted") {
        const channelId = data.channel_id as string;
        const id = data.message_id as string;
        const parentId = data.parent_id as string | null;
        qc.setQueryData<MessageOut[]>(["messages", channelId], (old) => old?.filter((m) => m.id !== id));
        if (parentId) {
          qc.setQueryData<ThreadOut>(["thread", parentId], (old) =>
            old ? { ...old, replies: old.replies.filter((r) => r.id !== id) } : old,
          );
        }
        qc.invalidateQueries({ queryKey: ["pins", channelId] });
      } else if (type === "channel.updated") {
        qc.invalidateQueries({ queryKey: ["channels"] });
      } else if (type === "presence") {
        const uid = data.user_id as string;
        const online = data.online as boolean;
        qc.setQueryData<UserOut[]>(["users"], (old) => {
          if (!old) return old;
          if (!old.some((u) => u.user_id === uid)) {
            qc.invalidateQueries({ queryKey: ["users"] });
            return old;
          }
          return old.map((u) => (u.user_id === uid ? { ...u, online: online || u.bot } : u));
        });
      } else if (type === "user.updated") {
        const user = data.user as UserOut;
        qc.setQueryData<UserOut[]>(["users"], (old) =>
          old ? (old.some((u) => u.user_id === user.user_id) ? old.map((u) => (u.user_id === user.user_id ? user : u)) : [...old, user]) : old,
        );
      } else if (type === "typing") {
        const k = typingKey(data.channel_id as string, data.parent_id as string | null);
        const uid = data.user_id as string;
        setTyping((t) => ({ ...t, [k]: { ...(t[k] ?? {}), [uid]: Date.now() + 3500 } }));
      } else if (type === "hello") {
        qc.invalidateQueries({ queryKey: ["users"] });
      }
    };

    const connect = async () => {
      if (stopped) return;
      const token = await getAuthToken();
      if (stopped) return;
      if (!token) {
        timer = setTimeout(connect, 2000);
        return;
      }
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/api/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        // catch up on anything missed while disconnected
        qc.invalidateQueries({ queryKey: ["messages"] });
        qc.invalidateQueries({ queryKey: ["channels"] });
        ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25000);
      };
      ws.onmessage = (ev) => {
        try {
          onEvent(JSON.parse(ev.data as string) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (ping) clearInterval(ping);
        if (stopped) return;
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, 600 * 2 ** retry);
      };
    };
    connect();

    // sweep expired typing entries
    const sweep = setInterval(() => {
      const now = Date.now();
      setTyping((t) => {
        let changed = false;
        const next: TypingMap = {};
        for (const [k, m] of Object.entries(t)) {
          const kept = Object.fromEntries(Object.entries(m).filter(([, exp]) => exp > now));
          if (Object.keys(kept).length !== Object.keys(m).length) changed = true;
          next[k] = kept;
        }
        return changed ? next : t;
      });
    }, 1000);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (ping) clearInterval(ping);
      clearInterval(sweep);
      wsRef.current?.close();
    };
  }, [qc, meId]);

  const sendTyping = useCallback((channelId: string, parentId?: string | null) => {
    const k = typingKey(channelId, parentId);
    const now = Date.now();
    if ((lastTyping.current[k] ?? 0) > now - 2000) return;
    lastTyping.current[k] = now;
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "typing", channel_id: channelId, parent_id: parentId ?? null }));
  }, []);

  const value = useMemo(() => ({ connected, typing, sendTyping }), [connected, typing, sendTyping]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  return useContext(Ctx);
}

export function useTypingUsers(channelId: string, parentId?: string | null): string[] {
  const { typing } = useRealtime();
  return Object.keys(typing[typingKey(channelId, parentId)] ?? {});
}
