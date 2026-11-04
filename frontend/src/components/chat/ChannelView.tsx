import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Hash, Lock, Pin, Search, Sparkles, Users, Menu, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, apiPost, errorMessage } from "@/lib/api";
import type { ChannelOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "./Avatar";
import { Composer } from "./Composer";
import { MessageList, TypingLine } from "./MessageList";
import { channelLabel, useMessages, useWorkspace } from "./hooks";

function HeaderButton({ active, onClick, label, testid, children }: { active?: boolean; onClick: () => void; label: string; testid: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testid}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-[color,background-color,box-shadow] duration-150",
        active ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--glow)_40%,transparent)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TopicEditor({ channel }: { channel: ChannelOut }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(channel.topic);
  const save = useMutation({
    mutationFn: () => apiPatch<ChannelOut>(`/channels/${channel.id}`, { topic }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      setOpen(false);
      toast.success("Tópico atualizado");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setTopic(channel.topic); }}>
      <PopoverTrigger render={<button type="button" className="group/topic flex min-w-0 items-center gap-1 text-left text-xs text-muted-foreground transition-colors hover:text-foreground" />} data-testid="channel-topic-btn">
        <span className="truncate">{channel.topic || "Adicionar um tópico"}</span>
        <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover/topic:opacity-100" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <p className="text-sm font-semibold">Tópico do canal</p>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sobre o que é este canal?" data-testid="channel-topic-input" onKeyDown={(e) => e.key === "Enter" && save.mutate()} />
        <Button size="sm" className="w-full" onClick={() => save.mutate()} disabled={save.isPending} data-testid="channel-topic-save">Salvar</Button>
      </PopoverContent>
    </Popover>
  );
}

export function ChannelView({ channel, highlightId, onOpenNav }: { channel: ChannelOut; highlightId: string | null; onOpenNav: () => void }) {
  const { me, users, panel, openPanel, openSearch } = useWorkspace();
  const qc = useQueryClient();
  const { data: messages = [], isLoading, isError } = useMessages(channel.id);
  const name = channelLabel(channel, me.user_id, users);
  const other = channel.is_dm ? users[channel.members.find((m) => m !== me.user_id) ?? me.user_id] : undefined;
  const lastId = messages[messages.length - 1]?.id;
  const lastRead = useRef<string | undefined>(undefined);

  // mark as read whenever the latest message in view changes
  useEffect(() => {
    if (!lastId || lastRead.current === `${channel.id}:${lastId}` || lastId.startsWith("tmp-")) return;
    lastRead.current = `${channel.id}:${lastId}`;
    apiPost(`/channels/${channel.id}/read`).then(() => qc.invalidateQueries({ queryKey: ["channels"] })).catch(() => {});
  }, [channel.id, lastId, qc]);

  const join = useMutation({
    mutationFn: () => apiPost<ChannelOut>(`/channels/${channel.id}/join`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });

  const intro = (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-10 pb-6" data-testid="channel-intro">
      {channel.is_dm ? (
        <div className="flex items-end gap-4">
          <UserAvatar user={other} size="lg" presence />
          <div>
            <h2 className="type-h3-lg">{name}</h2>
            <p className="text-sm text-muted-foreground">{other?.title || "Membro do workspace"} · início da conversa direta.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary animate-breathe">
            {channel.is_private ? <Lock className="size-6" /> : <Hash className="size-6" />}
          </div>
          <h2 className="type-title">
            {channel.is_private ? "" : "#"}
            {name}
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Este é o início de <span className="font-medium text-foreground">#{name}</span>. {channel.topic}
          </p>
        </>
      )}
    </motion.div>
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background" data-testid="channel-view">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" onClick={onOpenNav} aria-label="Abrir navegação" data-testid="mobile-nav-btn">
            <Menu className="size-4" />
          </button>
          {channel.is_dm ? <UserAvatar user={other} size="sm" presence /> : channel.is_private ? <Lock className="size-4 text-primary" /> : <Hash className="size-4 text-primary" />}
          <div className="min-w-0">
            <h1 className="truncate type-bar" data-testid="channel-title">{name}</h1>
            {!channel.is_dm && <TopicEditor channel={channel} />}
            {channel.is_dm && <p className="text-xs text-muted-foreground">{other?.online ? "Online agora" : "Offline"}{other?.status_text ? ` · ${other.status_emoji} ${other.status_text}` : ""}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!channel.is_dm && (
            <HeaderButton onClick={() => openPanel(panel?.kind === "members" ? null : { kind: "members" })} active={panel?.kind === "members"} label="Membros" testid="members-panel-btn">
              <span className="flex -space-x-1.5">
                {channel.members.slice(0, 3).map((u) => <UserAvatar key={u} user={users[u]} size="xs" />)}
              </span>
              <span className="font-mono text-xs">{channel.members.length}</span>
              <Users className="size-4 sm:hidden" />
            </HeaderButton>
          )}
          <HeaderButton onClick={() => openPanel(panel?.kind === "pins" ? null : { kind: "pins" })} active={panel?.kind === "pins"} label="Mensagens fixadas" testid="pins-panel-btn">
            <Pin className="size-4" />
          </HeaderButton>
          <HeaderButton onClick={openSearch} label="Buscar (Ctrl+K)" testid="header-search-btn">
            <Search className="size-4" />
          </HeaderButton>
          <HeaderButton onClick={() => openPanel(panel?.kind === "ai" ? null : { kind: "ai" })} active={panel?.kind === "ai"} label="Nexus AI" testid="ai-panel-btn">
            <Sparkles className="size-4" />
            <span className="hidden text-xs font-semibold lg:inline">Nexus AI</span>
          </HeaderButton>
        </div>
      </header>

      {isError ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground" data-testid="messages-error">Não foi possível carregar as mensagens. Tentando reconectar…</div>
      ) : isLoading ? (
        <div className="flex-1 space-y-4 p-6" data-testid="messages-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="animate-shimmer size-9 rounded-xl bg-[linear-gradient(90deg,var(--muted),color-mix(in_oklab,var(--glow)_12%,var(--muted)),var(--muted))]" />
              <div className="flex-1 space-y-2">
                <div className="animate-shimmer h-3 w-32 rounded bg-[linear-gradient(90deg,var(--muted),color-mix(in_oklab,var(--glow)_12%,var(--muted)),var(--muted))]" />
                <div className="animate-shimmer h-3 w-2/3 rounded bg-[linear-gradient(90deg,var(--muted),color-mix(in_oklab,var(--glow)_12%,var(--muted)),var(--muted))]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MessageList messages={messages} channelId={channel.id} highlightId={highlightId} header={intro} />
      )}

      <TypingLine channelId={channel.id} />
      {channel.is_member ? (
        <Composer channelId={channel.id} placeholder={channel.is_dm ? `Mensagem para ${name}` : `Mensagem em #${name}`} testid="message-composer" />
      ) : (
        <div className="m-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Você está visualizando <span className="font-semibold text-foreground">#{name}</span>.</p>
          <Button onClick={() => join.mutate()} disabled={join.isPending} data-testid="join-channel-btn">Entrar no canal</Button>
        </div>
      )}
    </section>
  );
}
