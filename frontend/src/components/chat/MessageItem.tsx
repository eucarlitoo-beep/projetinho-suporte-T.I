import { memo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, FileText, MessageSquareText, MoreHorizontal, Pencil, Pin, SmilePlus, Trash2, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RichText, fileSize, fullDate, timeLabel } from "@/lib/format";
import type { FileMeta, MessageOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { EmojiPicker, QUICK_REACTIONS } from "./EmojiPicker";
import { GifView } from "./GifPicker";
import { useMessageActions, useWorkspace } from "./hooks";

function Attachments({ files }: { files: FileMeta[] }) {
  const [preview, setPreview] = useState<FileMeta | null>(null);
  if (!files.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f) =>
        f.content_type.startsWith("image/") ? (
          <button key={f.id} type="button" onClick={() => setPreview(f)} data-testid={`attachment-image-${f.id}`} className="group/img relative overflow-hidden rounded-xl border border-border">
            <img src={`/api/files/${f.id}`} alt={f.name} className="max-h-60 max-w-[min(360px,70vw)] object-cover transition-transform duration-300 group-hover/img:scale-[1.03]" loading="lazy" />
          </button>
        ) : (
          <a key={f.id} href={`/api/files/${f.id}?download=1`} data-testid={`attachment-file-${f.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
            <span className="min-w-0">
              <span className="block max-w-[220px] truncate text-sm font-medium">{f.name}</span>
              <span className="block text-xs text-muted-foreground">{fileSize(f.size)}</span>
            </span>
            <Download className="size-4 text-muted-foreground" />
          </a>
        ),
      )}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl border-primary/20 bg-card/95 p-2 backdrop-blur-xl sm:max-w-4xl" data-testid="image-preview-modal">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          {preview && <img src={`/api/files/${preview.id}`} alt={preview.name} className="max-h-[80vh] w-full rounded-lg object-contain" />}
          {preview && (
            <div className="flex items-center justify-between px-2 pb-1 text-sm text-muted-foreground">
              <span className="truncate">{preview.name}</span>
              <a href={`/api/files/${preview.id}?download=1`} className="text-primary hover:underline" data-testid="image-preview-download">Baixar</a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface Props {
  message: MessageOut;
  grouped?: boolean;
  inThread?: boolean;
  highlight?: boolean;
}

function MessageItemBase({ message: m, grouped = false, inThread = false, highlight = false }: Props) {
  const { me, users, handles, openPanel } = useWorkspace();
  const { react, pin, edit, remove } = useMessageActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const author = users[m.user_id];
  const mine = m.user_id === me.user_id;
  const mentionsMe = m.mentions.includes(me.user_id);

  const toggle = (emoji: string) => react.mutate({ id: m.id, emoji });
  const saveEdit = () => {
    const text = draft.trim();
    if (text && text !== m.text) edit.mutate({ id: m.id, text });
    setEditing(false);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: m.pending ? 0.6 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      data-testid={`message-${m.id}`}
      id={`msg-${m.id}`}
      className={cn(
        "group relative flex gap-3 rounded-xl px-3 transition-[background-color] duration-150 hover:bg-foreground/[0.03]",
        grouped ? "py-0.5" : "mt-2 pt-2 pb-1",
        mentionsMe && "border-l-2 border-amber-400/70 bg-amber-400/[0.05]",
        m.pinned && !mentionsMe && "bg-primary/[0.04]",
        highlight && "ring-1 ring-primary/50",
      )}
    >
      <div className="w-9 shrink-0">
        {grouped ? (
          <span className="block pt-1 text-right type-caption text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{timeLabel(m.created_at)}</span>
        ) : (
          <UserAvatar user={author} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] type-author" data-testid="message-author">{author?.name ?? "Desconhecido"}</span>
            {author?.bot && <span className="rounded bg-primary/15 px-1.5 py-px font-mono text-[10px] text-primary">IA</span>}
            <span className="type-caption text-muted-foreground/80" title={fullDate(m.created_at)}>{timeLabel(m.created_at)}</span>
          </div>
        )}
        {m.pinned && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-primary" data-testid="message-pinned-label">
            <Pin className="size-3" /> Fixada{m.pinned_by && users[m.pinned_by] ? ` por ${users[m.pinned_by].name}` : ""}
          </p>
        )}

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              data-testid="message-edit-input"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="min-h-16 bg-card"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} data-testid="message-edit-save">Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="message-edit-cancel"><X className="size-3.5" /> Cancelar</Button>
            </div>
          </div>
        ) : (
          m.text && (
            <div className="text-[15px] leading-[1.53] tracking-(--track-text) break-words text-foreground/90" data-testid="message-text">
              <RichText text={m.text} handles={handles} />
              {m.edited && <span className="ml-1 text-[11px] text-muted-foreground">(editada)</span>}
            </div>
          )
        )}

        {m.gif && <GifView gif={m.gif} />}
        <Attachments files={m.files} />

        {m.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <AnimatePresence initial={false}>
              {m.reactions.map((r) => {
                const mineR = r.user_ids.includes(me.user_id);
                return (
                  <motion.button
                    key={r.emoji}
                    type="button"
                    layout
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                    onClick={() => toggle(r.emoji)}
                    title={r.user_ids.map((u) => users[u]?.name ?? "?").join(", ")}
                    data-testid={`reaction-${m.id}-${r.emoji}`}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-[background-color,border-color]",
                      mineR ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span className="text-sm leading-none">{r.emoji}</span>
                    <motion.span key={r.user_ids.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono">
                      {r.user_ids.length}
                    </motion.span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            <EmojiPicker
              onPick={toggle}
              testid={`reaction-add-inline-${m.id}`}
              trigger={<button type="button" className="grid h-6 w-8 place-items-center rounded-full border border-dashed border-border text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"><SmilePlus className="size-3.5" /></button>}
            />
          </div>
        )}

        {!inThread && m.reply_count > 0 && (
          <button
            type="button"
            onClick={() => openPanel({ kind: "thread", id: m.id })}
            data-testid={`thread-summary-${m.id}`}
            className="group/thread mt-1.5 flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-xs transition-[border-color,background-color] hover:border-border hover:bg-card"
          >
            <span className="flex -space-x-1.5">
              {m.reply_user_ids.slice(0, 3).map((u) => <UserAvatar key={u} user={users[u]} size="xs" />)}
            </span>
            <span className="font-semibold text-primary">{m.reply_count} {m.reply_count === 1 ? "resposta" : "respostas"}</span>
            {m.last_reply_at && <span className="text-muted-foreground group-hover/thread:hidden">Última às {timeLabel(m.last_reply_at)}</span>}
            <span className="hidden text-muted-foreground group-hover/thread:inline">Ver thread →</span>
          </button>
        )}
      </div>

      {/* hover toolbar */}
      {!m.pending && !editing && (
        <div className="pointer-events-none absolute -top-3.5 right-3 z-10 flex translate-y-1 items-center gap-0.5 rounded-xl border border-border bg-popover p-0.5 opacity-0 shadow-lg shadow-black/20 transition-[opacity,transform] duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 has-[[data-popup-open]]:pointer-events-auto has-[[data-popup-open]]:opacity-100" data-testid={`message-toolbar-${m.id}`}>
          {QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} type="button" onClick={() => toggle(e)} data-testid={`quick-react-${m.id}-${e}`} className="grid size-7 place-items-center rounded-lg text-base transition-transform hover:scale-125 hover:bg-primary/10">
              {e}
            </button>
          ))}
          <EmojiPicker
            onPick={toggle}
            testid={`reaction-picker-${m.id}`}
            trigger={<button type="button" aria-label="Adicionar reação" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"><SmilePlus className="size-4" /></button>}
          />
          {!inThread && (
            <button type="button" aria-label="Responder em thread" onClick={() => openPanel({ kind: "thread", id: m.id })} data-testid={`reply-thread-btn-${m.id}`} className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
              <MessageSquareText className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" aria-label="Mais ações" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" />} data-testid={`message-more-btn-${m.id}`}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => pin.mutate(m.id)} data-testid={`pin-message-btn-${m.id}`}>
                <Pin className="size-4" /> {m.pinned ? "Desafixar" : "Fixar no canal"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(m.text)} data-testid={`copy-message-btn-${m.id}`}>
                <FileText className="size-4" /> Copiar texto
              </DropdownMenuItem>
              {mine && (
                <>
                  <DropdownMenuSeparator />
                  {m.text && (
                    <DropdownMenuItem onClick={() => { setDraft(m.text); setEditing(true); }} data-testid={`edit-message-btn-${m.id}`}>
                      <Pencil className="size-4" /> Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(m)} data-testid={`delete-message-btn-${m.id}`}>
                    <Trash2 className="size-4" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </motion.div>
  );
}

export const MessageItem = memo(MessageItemBase);
