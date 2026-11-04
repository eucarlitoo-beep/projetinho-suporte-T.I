import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { FileText, Hash, Lock, MessageSquareText, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import { RichText, fullDate } from "@/lib/format";
import type { ChannelCreate, ChannelOut, SearchOut, StatusIn, UserOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "./Avatar";
import { channelLabel, useWorkspace } from "./hooks";

/* ---------------- create channel ---------------- */
export function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { me, users, goToChannel } = useWorkspace();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const others = Object.values(users).filter((u) => u.user_id !== me.user_id);
  const create = useMutation({
    mutationFn: (body: ChannelCreate) => apiPost<ChannelOut>("/channels", body),
    onSuccess: (ch) => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success(`#${ch.name} criado`);
      onOpenChange(false);
      setName("");
      setTopic("");
      setMembers([]);
      setIsPrivate(false);
      goToChannel(ch.id);
    },
    onError: (e) => toast.error(errorMessage(e, "Não foi possível criar o canal")),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="create-channel-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Criar canal</DialogTitle>
          <DialogDescription>Canais organizam conversas por tema, projeto ou time.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ name, topic, is_private: isPrivate, member_ids: isPrivate ? members : [] });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Nome</Label>
            <div className="flex items-center rounded-lg border border-input px-3 focus-within:border-primary">
              {isPrivate ? <Lock className="size-4 text-muted-foreground" /> : <Hash className="size-4 text-muted-foreground" />}
              <input id="ch-name" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="ex: lancamento-q3" maxLength={40} data-testid="create-channel-name-input" className="h-9 flex-1 bg-transparent px-2 text-sm outline-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-topic">Tópico (opcional)</Label>
            <Input id="ch-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Sobre o que é este canal?" data-testid="create-channel-topic-input" />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
            <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(!!v)} data-testid="create-channel-private-checkbox" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Tornar privado</span>
              <span className="block text-xs text-muted-foreground">Apenas membros convidados podem ver e participar.</span>
            </span>
          </label>
          <AnimatePresence>
            {isPrivate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <Label>Convidar membros</Label>
                <div className="scroll-thin mt-1.5 max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1">
                  {others.map((u) => {
                    const on = members.includes(u.user_id);
                    return (
                      <button key={u.user_id} type="button" onClick={() => setMembers((m) => (on ? m.filter((x) => x !== u.user_id) : [...m, u.user_id]))} data-testid={`invite-member-${u.handle}`} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors", on ? "bg-primary/10" : "hover:bg-muted")}>
                        <UserAvatar user={u} size="xs" />
                        <span className="flex-1">{u.name}</span>
                        {on && <Check className="size-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="create-channel-submit-btn">Criar canal</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- new DM ---------------- */
export function NewDMDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me, users, openDM } = useWorkspace();
  const [q, setQ] = useState("");
  const list = Object.values(users).filter((u) => u.user_id !== me.user_id && (u.name.toLowerCase().includes(q.toLowerCase()) || u.handle.includes(q.toLowerCase())));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="new-dm-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Nova mensagem direta</DialogTitle>
          <DialogDescription>Converse em particular com alguém do workspace.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoas…" autoFocus data-testid="new-dm-search-input" />
        <div className="scroll-thin max-h-72 space-y-0.5 overflow-y-auto">
          {list.map((u, i) => (
            <motion.button
              key={u.user_id}
              type="button"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => {
                openDM(u.user_id);
                onOpenChange(false);
              }}
              data-testid={`new-dm-user-${u.handle}`}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
            >
              <UserAvatar user={u} presence />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.title || `@${u.handle}`}</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{u.online ? "online" : "offline"}</span>
            </motion.button>
          ))}
          {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém encontrado.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- search (⌘K) ---------------- */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me, users, handles, channels, goToChannel, openDM } = useWorkspace();
  const [q, setQ] = useState("");
  const term = q.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["search", term],
    queryFn: () => apiGet<SearchOut>(`/search?q=${encodeURIComponent(term)}`),
    enabled: open && term.length >= 2,
    staleTime: 10_000,
  });
  const byId = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels]);
  const go = (channelId: string, msgId?: string) => {
    goToChannel(channelId, msgId);
    onOpenChange(false);
  };
  const people = term.length >= 1 ? Object.values(users).filter((u) => u.name.toLowerCase().includes(term.toLowerCase())).slice(0, 4) : [];
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(""); }}>
      <DialogContent className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false} data-testid="search-dialog">
        <DialogTitle className="sr-only">Buscar</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className={cn("size-5 text-primary", isFetching && "animate-pulse")} />
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Buscar mensagens, canais, arquivos e pessoas…" data-testid="search-input" className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="scroll-thin max-h-[60vh] overflow-y-auto p-2" data-testid="search-results">
          {term.length < 2 && people.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Digite pelo menos 2 caracteres. Dica: use <kbd className="font-mono">Ctrl/⌘ + K</kbd> em qualquer lugar.</div>
          )}
          {people.length > 0 && (
            <Section title="Pessoas">
              {people.map((u) => (
                <ResultRow key={u.user_id} onClick={() => { openDM(u.user_id); onOpenChange(false); }} testid={`search-person-${u.handle}`}>
                  <UserAvatar user={u} size="sm" presence />
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">@{u.handle}</span>
                </ResultRow>
              ))}
            </Section>
          )}
          {data && data.channels.length > 0 && (
            <Section title="Canais">
              {data.channels.map((c) => (
                <ResultRow key={c.id} onClick={() => go(c.id)} testid={`search-channel-${c.name}`}>
                  {c.is_private ? <Lock className="size-4 text-primary" /> : <Hash className="size-4 text-primary" />}
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.topic}</span>
                </ResultRow>
              ))}
            </Section>
          )}
          {data && data.messages.length > 0 && (
            <Section title="Mensagens">
              {data.messages.map((m) => (
                <ResultRow key={m.id} onClick={() => go(m.channel_id, m.parent_id ?? m.id)} testid={`search-message-${m.id}`}>
                  <UserAvatar user={users[m.user_id]} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{users[m.user_id]?.name}</span>
                      <span>em {byId[m.channel_id]?.is_dm ? "DM" : `#${channelLabel(byId[m.channel_id], me.user_id, users)}`}</span>
                      {m.parent_id && <span className="flex items-center gap-1"><MessageSquareText className="size-3" /> thread</span>}
                      <span className="ml-auto font-mono">{fullDate(m.created_at)}</span>
                    </span>
                    <span className="line-clamp-2 text-sm"><RichText text={m.text} handles={handles} /></span>
                  </span>
                </ResultRow>
              ))}
            </Section>
          )}
          {data && data.files.length > 0 && (
            <Section title="Arquivos">
              {data.files.flatMap((m) =>
                m.files.map((f) => (
                  <ResultRow key={f.id} onClick={() => go(m.channel_id, m.parent_id ?? m.id)} testid={`search-file-${f.id}`}>
                    <FileText className="size-4 text-primary" />
                    <span className="text-sm">{f.name}</span>
                  </ResultRow>
                )),
              )}
            </Section>
          )}
          {data && term.length >= 2 && !data.messages.length && !data.channels.length && !data.files.length && people.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground" data-testid="search-empty">Nada encontrado para “{term}”.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-2 py-1.5 type-eyebrow text-[10px] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ResultRow({ onClick, children, testid }: { onClick: () => void; children: React.ReactNode; testid: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-[background-color,transform] hover:translate-x-0.5 hover:bg-primary/10">
      {children}
    </button>
  );
}

/* ---------------- status ---------------- */
const STATUS_PRESETS = [
  { emoji: "🎯", text: "Em foco" },
  { emoji: "🍽️", text: "Almoçando" },
  { emoji: "📅", text: "Em reunião" },
  { emoji: "🏠", text: "Trabalhando de casa" },
  { emoji: "🌴", text: "De férias" },
];

export function StatusDialog({ open, onOpenChange, me }: { open: boolean; onOpenChange: (o: boolean) => void; me: UserOut }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StatusIn>({ status_text: me.status_text, status_emoji: me.status_emoji, title: me.title });
  const save = useMutation({
    mutationFn: (body: StatusIn) => apiPatch<UserOut>("/me/status", body),
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Perfil atualizado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) setForm({ status_text: me.status_text, status_emoji: me.status_emoji, title: me.title }); }}>
      <DialogContent className="sm:max-w-md" data-testid="status-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Seu status</DialogTitle>
          <DialogDescription>Conte ao time o que você está fazendo agora.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={form.status_emoji} onChange={(e) => setForm({ ...form, status_emoji: e.target.value.slice(0, 4) })} className="w-14 text-center" placeholder="😀" data-testid="status-emoji-input" />
            <Input value={form.status_text} onChange={(e) => setForm({ ...form, status_text: e.target.value })} placeholder="Qual é o seu status?" data-testid="status-text-input" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_PRESETS.map((p) => (
              <button key={p.text} type="button" onClick={() => setForm({ ...form, status_emoji: p.emoji, status_text: p.text })} data-testid={`status-preset-${p.text}`} className="rounded-full border border-border px-2.5 py-1 text-xs transition-[border-color,background-color] hover:border-primary/50 hover:bg-primary/10">
                {p.emoji} {p.text}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Cargo</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Engenheira de Software" data-testid="status-title-input" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => save.mutate({ ...form, status_text: "", status_emoji: "" })} data-testid="status-clear-btn">Limpar status</Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} data-testid="status-save-btn">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
