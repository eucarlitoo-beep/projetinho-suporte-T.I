import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Hash, Lock, MessageCircle, Pin, Sparkles, Trash2, Wand2, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiStream, errorMessage } from "@/lib/api";
import { RichText, fullDate, timeLabel } from "@/lib/format";
import type { AIMessage, ChannelOut, MessageOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TypingDots, UserAvatar } from "./Avatar";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { TypingLine, shouldGroup } from "./MessageList";
import { channelLabel, useThread, useWorkspace } from "./hooks";

function PanelShell({ title, icon, onClose, children, testid, actions }: { title: string; icon: ReactNode; onClose: () => void; children: ReactNode; testid: string; actions?: ReactNode }) {
  return (
    <div className="flex h-full flex-col" data-testid={testid}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 type-bar">
          <span className="text-primary">{icon}</span> {title}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button type="button" onClick={onClose} aria-label="Fechar painel" data-testid={`${testid}-close-btn`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color,transform] hover:rotate-90 hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

/* ---------------- thread ---------------- */
function ThreadPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { openPanel } = useWorkspace();
  const { data, isLoading, isError } = useThread(id);
  return (
    <PanelShell
      title="Thread"
      icon={<MessageCircle className="size-4" />}
      onClose={onClose}
      testid="thread-panel"
      actions={
        <button type="button" onClick={() => openPanel({ kind: "ai", parentId: id, preset: "Resuma esta thread em tópicos curtos e liste decisões e próximos passos." })} data-testid="thread-summarize-ai-btn" className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
          <Sparkles className="size-3.5" /> Resumir
        </button>
      }
    >
      {isError ? (
        <p className="p-6 text-sm text-muted-foreground">Thread indisponível.</p>
      ) : isLoading || !data ? (
        <div className="p-6"><TypingDots /></div>
      ) : (
        <>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-2">
            <MessageItem message={data.parent} inThread />
            <div className="my-2 flex items-center gap-3 px-4 text-xs text-muted-foreground">
              <span className="font-semibold text-primary" data-testid="thread-reply-count">{data.replies.length} {data.replies.length === 1 ? "resposta" : "respostas"}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {data.replies.map((r, i) => (
              <MessageItem key={r.id} message={r} inThread grouped={shouldGroup(data.replies[i - 1], r)} />
            ))}
          </div>
          <TypingLine channelId={data.parent.channel_id} parentId={id} />
          <Composer channelId={data.parent.channel_id} parentId={id} placeholder="Responder na thread…" testid="thread-composer" />
        </>
      )}
    </PanelShell>
  );
}

/* ---------------- AI ---------------- */
const PRESETS = [
  { label: "Resumir canal", prompt: "Resuma as conversas recentes deste canal em tópicos curtos." },
  { label: "O que foi decidido?", prompt: "Quais decisões foram tomadas nesta conversa?" },
  { label: "Pendências", prompt: "Liste pendências, responsáveis e próximos passos mencionados." },
];

function AIPanel({ channel, parentId, preset, onClose }: { channel: ChannelOut; parentId?: string; preset?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { me, users } = useWorkspace();
  const key = ["ai", channel.id];
  const { data: history = [] } = useQuery({ queryKey: key, queryFn: () => apiGet<AIMessage[]>(`/ai/history?channel_id=${channel.id}`) });
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const firedPreset = useRef<string | undefined>(undefined);

  const scrollDown = () => requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }));

  const ask = async (prompt: string, scopeParent?: string) => {
    if (streaming !== null || !prompt.trim()) return;
    setPendingPrompt(prompt);
    setStreaming("");
    scrollDown();
    let acc = "";
    try {
      await apiStream("/ai/stream", { channel_id: channel.id, parent_id: scopeParent ?? null, prompt }, (t) => {
        acc += t;
        setStreaming(acc);
        scrollDown();
      });
    } catch (err) {
      toast.error(errorMessage(err, "A IA não respondeu. Tente novamente."));
    } finally {
      await qc.invalidateQueries({ queryKey: key });
      setStreaming(null);
      setPendingPrompt(null);
      scrollDown();
    }
  };

  // a preset handed over from the thread panel runs once
  useEffect(() => {
    if (preset && firedPreset.current !== `${parentId}:${preset}`) {
      firedPreset.current = `${parentId}:${preset}`;
      ask(preset, parentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, parentId]);

  const clear = useMutation({
    mutationFn: () => apiDelete(`/ai/history?channel_id=${channel.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const label = channel.is_dm ? channelLabel(channel, me.user_id, users) : `#${channel.name}`;

  return (
    <PanelShell
      title="Nexus AI"
      icon={<Sparkles className="size-4" />}
      onClose={onClose}
      testid="ai-panel"
      actions={
        history.length > 0 && (
          <button type="button" onClick={() => clear.mutate()} aria-label="Limpar conversa" data-testid="ai-clear-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        )
      }
    >
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/20 blur-3xl" />
          <p className="flex items-center gap-2 font-heading font-semibold"><Bot className="size-4 text-primary" /> Olá, {me.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-muted-foreground">Pergunte qualquer coisa sobre {label}. Eu leio a conversa e respondo em segundos.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => ask(p.prompt)} disabled={streaming !== null} data-testid={`ai-preset-${p.label.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="flex items-center gap-1 rounded-full border border-primary/30 bg-background/60 px-2.5 py-1 text-xs font-medium transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 disabled:opacity-50">
                <Wand2 className="size-3 text-primary" /> {p.label}
              </button>
            ))}
          </div>
        </div>

        {history.map((m) => (
          <AIBubble key={m.id} role={m.role} text={m.text} time={m.created_at} />
        ))}
        {pendingPrompt && <AIBubble role="user" text={pendingPrompt} />}
        {streaming !== null && (
          <div data-testid="ai-streaming">
            {streaming ? <AIBubble role="assistant" text={streaming} live /> : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TypingDots /> Nexus AI está pensando…</div>
            )}
          </div>
        )}
      </div>
      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const q = input;
          setInput("");
          ask(q);
        }}
      >
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 transition-[border-color] focus-within:border-primary/50">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao Nexus AI…" data-testid="ai-input" className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Button type="submit" size="sm" disabled={!input.trim() || streaming !== null} data-testid="ai-send-btn">Enviar</Button>
        </div>
      </form>
    </PanelShell>
  );
}

function AIBubble({ role, text, time, live }: { role: "user" | "assistant"; text: string; time?: string; live?: boolean }) {
  const { handles } = useWorkspace();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", role === "user" ? "justify-end" : "justify-start")} data-testid={`ai-message-${role}`}>
      <div className={cn("max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card")}>
        {role === "assistant" ? <RichText text={text} handles={handles} /> : text}
        {live && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-primary" />}
        {time && <p className={cn("mt-1 font-mono text-[10px]", role === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>{timeLabel(time)}</p>}
      </div>
    </motion.div>
  );
}

/* ---------------- pins ---------------- */
function PinsPanel({ channel, onClose }: { channel: ChannelOut; onClose: () => void }) {
  const { users, handles, goToChannel } = useWorkspace();
  const { data = [], isLoading } = useQuery({ queryKey: ["pins", channel.id], queryFn: () => apiGet<MessageOut[]>(`/channels/${channel.id}/pins`) });
  return (
    <PanelShell title="Fixadas" icon={<Pin className="size-4" />} onClose={onClose} testid="pins-panel">
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!isLoading && data.length === 0 && (
          <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground" data-testid="pins-empty">
            <Pin className="size-8 text-primary/50" />
            Nenhuma mensagem fixada ainda.<br />Use o menu “⋯” de uma mensagem para fixar.
          </div>
        )}
        <AnimatePresence initial={false}>
          {data.map((m) => (
            <motion.button
              key={m.id}
              type="button"
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => goToChannel(m.channel_id, m.parent_id ?? m.id)}
              data-testid={`pinned-item-${m.id}`}
              className="block w-full rounded-xl border border-border bg-card p-3 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="mb-1 flex items-center gap-2">
                <UserAvatar user={users[m.user_id]} size="xs" />
                <span className="text-sm font-semibold">{users[m.user_id]?.name}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fullDate(m.created_at)}</span>
              </div>
              <div className="line-clamp-4 text-sm text-foreground/85"><RichText text={m.text} handles={handles} /></div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </PanelShell>
  );
}

/* ---------------- members ---------------- */
function MembersPanel({ channel, onClose }: { channel: ChannelOut; onClose: () => void }) {
  const qc = useQueryClient();
  const { me, users, openDM, goToChannel } = useWorkspace();
  const members = channel.members.map((id) => users[id]).filter(Boolean).sort((a, b) => Number(b.online) - Number(a.online));
  const leave = useMutation({
    mutationFn: () => apiPost<ChannelOut>(`/channels/${channel.id}/leave`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast(`Você saiu de #${channel.name}`);
      onClose();
      if (channel.is_private) goToChannel("");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <PanelShell title="Detalhes" icon={channel.is_private ? <Lock className="size-4" /> : <Hash className="size-4" />} onClose={onClose} testid="members-panel">
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-4 rounded-xl border border-border bg-card p-3">
          <p className="type-h3">#{channel.name}</p>
          <p className="text-sm text-muted-foreground">{channel.topic || "Sem tópico"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Criado em {fullDate(channel.created_at)}</p>
        </div>
        <p className="mb-2 px-1 type-eyebrow text-[10px] text-muted-foreground">{members.length} membros</p>
        <div className="space-y-0.5">
          {members.map((u) => (
            <button key={u.user_id} type="button" onClick={() => u.user_id !== me.user_id && openDM(u.user_id)} data-testid={`member-row-${u.user_id}`} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted">
              <UserAvatar user={u} size="sm" presence />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.name}{u.user_id === me.user_id && <span className="text-muted-foreground"> (você)</span>}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.status_text ? `${u.status_emoji} ${u.status_text}` : u.title || `@${u.handle}`}</span>
              </span>
            </button>
          ))}
        </div>
        {channel.is_member && (
          <Button variant="outline" className="mt-4 w-full text-destructive" onClick={() => leave.mutate()} data-testid="leave-channel-btn">
            <LogOut className="size-4" /> Sair do canal
          </Button>
        )}
      </div>
    </PanelShell>
  );
}

export function RightPanelHost({ channel }: { channel: ChannelOut | undefined }) {
  const { panel, openPanel } = useWorkspace();
  const close = () => openPanel(null);
  const key = panel ? (panel.kind === "thread" ? `thread-${panel.id}` : panel.kind) : "none";
  return (
    <AnimatePresence mode="wait">
      {panel && channel && (
        <motion.aside
          key={key}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-0 z-40 flex flex-col border-l border-border bg-card/95 backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:w-[400px] lg:shrink-0"
        >
          {panel.kind === "thread" && <ThreadPanel id={panel.id} onClose={close} />}
          {panel.kind === "ai" && <AIPanel channel={channel} parentId={panel.parentId} preset={panel.preset} onClose={close} />}
          {panel.kind === "pins" && <PinsPanel channel={channel} onClose={close} />}
          {panel.kind === "members" && <MembersPanel channel={channel} onClose={close} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
