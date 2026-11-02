import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, Bold, Code, Italic, Loader2, Paperclip, SendHorizontal, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { apiUpload, errorMessage } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { fileSize } from "@/lib/format";
import type { FileMeta, GifMeta, UserOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";
import { useSendMessage, useWorkspace } from "./hooks";

interface Props {
  channelId: string;
  parentId?: string | null;
  placeholder: string;
  testid: string;
}

export function Composer({ channelId, parentId = null, placeholder, testid }: Props) {
  const { me, users } = useWorkspace();
  const { sendTyping } = useRealtime();
  const send = useSendMessage(channelId, me.user_id, parentId);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [gif, setGif] = useState<GifMeta | null>(null);
  const [uploading, setUploading] = useState(0);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const candidates = useMemo<UserOut[]>(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return Object.values(users)
      .filter((u) => u.handle.includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, users]);

  const autosize = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([\w.-]*)$/);
    if (m) {
      setMention({ query: m[2], start: caret - m[2].length - 1 });
      setMentionIdx(0);
    } else setMention(null);
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    detectMention(e.target.value, e.target.selectionStart);
    autosize();
    if (e.target.value.trim()) sendTyping(channelId, parentId);
  };

  const insertAt = (snippet: string, replaceFrom?: number) => {
    const el = ta.current;
    const caret = el?.selectionStart ?? text.length;
    const from = replaceFrom ?? caret;
    const next = text.slice(0, from) + snippet + text.slice(caret);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = from + snippet.length;
      el?.setSelectionRange(pos, pos);
      autosize();
    });
  };

  const pickMention = (u: UserOut) => {
    if (!mention) return;
    insertAt(`@${u.handle} `, mention.start);
    setMention(null);
  };

  const wrap = (mark: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e) || "texto";
    const next = text.slice(0, s) + mark + sel + mark + text.slice(e);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + mark.length, s + mark.length + sel.length);
    });
  };

  const submit = () => {
    const body = text.trim();
    if ((!body && !files.length && !gif) || uploading) return;
    send.mutate({ text: body, parent_id: parentId, file_ids: files.map((f) => f.id), gif });
    setText("");
    setFiles([]);
    setGif(null);
    setMention(null);
    requestAnimationFrame(autosize);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && candidates.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(candidates[mentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list).slice(0, 6)) {
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} é maior que 8 MB`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const meta = await apiUpload<FileMeta>("/files", f);
        setFiles((prev) => [...prev, meta]);
      } catch (err) {
        toast.error(errorMessage(err, "Falha no upload"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const canSend = (!!text.trim() || files.length > 0 || !!gif) && !uploading;

  return (
    <div className="relative px-4 pb-4" data-testid={`${testid}-wrapper`}>
      {/* mention autocomplete */}
      <AnimatePresence>
        {mention && candidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="absolute inset-x-4 bottom-full z-30 mb-2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl"
            data-testid={`${testid}-mention-list`}
          >
            <p className="px-2 py-1 type-eyebrow text-[10px] text-muted-foreground">Mencionar</p>
            {candidates.map((u, i) => (
              <button
                key={u.user_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(u);
                }}
                data-testid={`mention-option-${u.handle}`}
                className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors", i === mentionIdx ? "bg-primary/15 text-foreground" : "hover:bg-muted")}
              >
                <UserAvatar user={u} size="sm" presence />
                <span className="font-medium">{u.name}</span>
                <span className="font-mono text-xs text-muted-foreground">@{u.handle}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "rounded-2xl border bg-card/80 backdrop-blur transition-[border-color,box-shadow] duration-200",
          focused ? "border-primary/50 shadow-[0_0_0_3px_color-mix(in_oklab,var(--glow)_12%,transparent),0_10px_40px_-12px_color-mix(in_oklab,var(--glow)_30%,transparent)]" : "border-border",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <AnimatePresence>
          {gif && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-3 pt-3" data-testid={`${testid}-gif-preview`}>
              <div className="relative inline-block overflow-hidden rounded-xl border border-primary/40 bg-muted shadow-[0_0_24px_-10px_var(--glow)]">
                <img src={gif.preview_url || gif.url} alt={gif.title || "GIF"} className="block max-h-40 max-w-[240px] object-cover" style={gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined} />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[9px] font-bold tracking-[0.18em] text-white">GIPHY</span>
                <button type="button" aria-label="Remover GIF" onClick={() => setGif(null)} data-testid={`${testid}-gif-remove-btn`} className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-white transition-[background-color] hover:bg-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Pré-visualização — escreva uma legenda (opcional) e pressione Enter para enviar.</p>
            </motion.div>
          )}
        </AnimatePresence>
        {(files.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {files.map((f) => (
              <motion.span key={f.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 text-xs" data-testid={`${testid}-pending-file`}>
                {f.content_type.startsWith("image/") ? <img src={`/api/files/${f.id}`} alt="" className="size-6 rounded object-cover" /> : <Paperclip className="size-3.5 text-primary" />}
                <span className="max-w-[140px] truncate">{f.name}</span>
                <span className="text-muted-foreground">{fileSize(f.size)}</span>
                <button type="button" aria-label="Remover anexo" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-destructive">
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
            {uploading > 0 && (
              <span className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 px-2 py-1 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" /> Enviando…
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTimeout(() => setMention(null), 120);
          }}
          onClick={(e) => detectMention(text, e.currentTarget.selectionStart)}
          placeholder={placeholder}
          data-testid={`${testid}-input`}
          className="block max-h-[220px] w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            {[
              { icon: Bold, label: "Negrito", act: () => wrap("**"), id: "bold" },
              { icon: Italic, label: "Itálico", act: () => wrap("_"), id: "italic" },
              { icon: Code, label: "Código", act: () => wrap("`"), id: "code" },
              { icon: AtSign, label: "Mencionar", act: () => { insertAt("@"); setMention({ query: "", start: (ta.current?.selectionStart ?? text.length) }); }, id: "mention" },
            ].map((b) => (
              <button key={b.id} type="button" aria-label={b.label} title={b.label} onClick={b.act} data-testid={`${testid}-${b.id}-btn`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-primary/10 hover:text-primary">
                <b.icon className="size-4" />
              </button>
            ))}
            <EmojiPicker
              onPick={(e) => insertAt(e)}
              testid={`${testid}-emoji-btn`}
              trigger={<button type="button" aria-label="Emoji" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-primary/10 hover:text-primary"><Smile className="size-4" /></button>}
            />
            <GifPicker
              onPick={(g) => {
                setGif(g);
                requestAnimationFrame(() => ta.current?.focus());
              }}
              testid={`${testid}-gif-btn`}
              trigger={<button type="button" aria-label="GIF" title="GIF" className="grid h-8 place-items-center rounded-lg px-1.5 font-heading text-[11px] font-bold tracking-wide text-muted-foreground transition-[color,background-color] hover:bg-primary/10 hover:text-primary"><span className="rounded border border-current px-1 leading-4">GIF</span></button>}
            />
            <button type="button" aria-label="Anexar arquivo" title="Anexar arquivo" onClick={() => fileInput.current?.click()} data-testid={`${testid}-attach-btn`} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-primary/10 hover:text-primary">
              <Paperclip className="size-4" />
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} data-testid={`${testid}-file-input`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              <kbd className="font-mono">Enter</kbd> envia · <kbd className="font-mono">Shift+Enter</kbd> quebra linha
            </span>
            <motion.button
              type="button"
              onClick={submit}
              disabled={!canSend}
              whileTap={{ scale: 0.88 }}
              data-testid={`${testid}-send-btn`}
              aria-label="Enviar"
              className={cn(
                "grid size-9 place-items-center rounded-xl transition-[background-color,color,box-shadow] duration-200",
                canSend ? "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_var(--glow)]" : "bg-muted text-muted-foreground",
              )}
            >
              <SendHorizontal className="size-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
