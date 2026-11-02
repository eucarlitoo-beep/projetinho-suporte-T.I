import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useSpring } from "motion/react";
import { ArrowLeft, ExternalLink, Globe2, Languages, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiGet, errorMessage } from "@/lib/api";
import type { ArticleBlock, ArticleOut, NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CATEGORY_META, NewsImage } from "./NewsView";

const SIZES = [16, 18, 20, 22] as const;
const SIZE_KEY = "nexus-reader-size";

function readSize(): number {
  const v = Number(localStorage.getItem(SIZE_KEY));
  return SIZES.includes(v as (typeof SIZES)[number]) ? v : 18;
}

function Block({ b }: { b: ArticleBlock }) {
  if (b.kind === "h") return <h3 className="mt-[1.8em] mb-[0.6em] type-h3 text-[1.2em]">{b.text}</h3>;
  if (b.kind === "li")
    return (
      <li className="relative mb-[0.5em] pl-[1.2em] before:absolute before:top-[0.72em] before:left-0 before:size-[0.3em] before:rounded-full before:bg-primary">
        {b.text}
      </li>
    );
  if (b.kind === "quote")
    return <blockquote className="my-[1.4em] border-l-2 border-primary pl-[1em] font-serif text-[1.18em] leading-[1.5] italic text-foreground">{b.text}</blockquote>;
  return <p className="mb-[1.1em]">{b.text}</p>;
}

function ReaderBody({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  const [size, setSize] = useState(readSize);
  const article = useQuery({
    queryKey: ["news-article", item.id],
    queryFn: () => apiGet<ArticleOut>(`/news/${item.id}/article`),
    staleTime: 60 * 60_000,
  });
  const meta = CATEGORY_META[item.categories[0]];
  const step = (d: number) => {
    const i = Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(size as (typeof SIZES)[number]) + d));
    setSize(SIZES[i]);
    localStorage.setItem(SIZE_KEY, String(SIZES[i]));
  };
  const minutes = article.data?.reading_minutes;
  const full = article.data?.status === "full";

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl sm:px-5">
        <button type="button" onClick={onClose} data-testid="reader-close-btn" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-[560] text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </button>
        <span className="hidden type-eyebrow text-[10px] text-muted-foreground sm:inline">Modo leitura</span>
        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border p-0.5" role="group" aria-label="Tamanho do texto" data-testid="reader-size-controls">
          <button type="button" onClick={() => step(-1)} disabled={size === SIZES[0]} aria-label="Diminuir texto" data-testid="reader-size-down-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-foreground disabled:opacity-35">
            <Minus className="size-3.5" />
          </button>
          <span className="w-12 text-center font-heading text-[0.8125rem] font-[620] tabular" data-testid="reader-size-value">
            <span className="text-[0.75em]">A</span>A {size}
          </span>
          <button type="button" onClick={() => step(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label="Aumentar texto" data-testid="reader-size-up-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-foreground disabled:opacity-35">
            <Plus className="size-3.5" />
          </button>
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" data-testid="reader-original-link" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-[560] text-primary transition-[background-color] hover:bg-primary/10 sm:flex">
          Site original <ExternalLink className="size-3.5" />
        </a>
        <motion.span className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary shadow-[0_0_10px_var(--glow)]" style={{ scaleX: progress }} aria-hidden />
      </div>

      {/* editorial column */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-testid="reader-scroll">
        <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-[44rem] px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 type-eyebrow text-[10.5px]" data-testid="reader-kicker">
            <span style={{ color: meta?.tint }}>{meta?.label}</span>
            {item.region === "mundo" && <span className="flex items-center gap-1 text-muted-foreground"><Globe2 className="size-3" /> Internacional</span>}
          </p>
          <DialogTitle className="mt-3 type-headline font-serif text-[2rem] leading-[1.1] font-[560] tracking-[-0.018em] text-foreground sm:text-[2.75rem] sm:leading-[1.06]" data-testid="reader-title">
            {item.title}
          </DialogTitle>
          {item.summary && (
            <DialogDescription className="mt-4 type-lead text-[1.1875rem] text-muted-foreground" data-testid="reader-dek">
              {item.summary}
            </DialogDescription>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-border py-3 type-meta text-muted-foreground" data-testid="reader-meta">
            <span className="font-[620] text-foreground">{item.source}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.published_at}>
              {new Date(item.published_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}, {new Date(item.published_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </time>
            {minutes && full && (<><span aria-hidden>·</span><span data-testid="reader-minutes">{minutes} min de leitura</span></>)}
            {item.translated && (
              <span className="ml-auto flex items-center gap-1 text-primary" data-testid="reader-translated"><Languages className="size-3.5" /> Traduzido para o português</span>
            )}
          </div>
          {item.image && <NewsImage item={item} className="mt-8 aspect-video w-full rounded-2xl" />}

          <div className="mt-9 text-foreground/90" style={{ fontSize: size, lineHeight: 1.75, letterSpacing: "var(--track-text)" }} data-testid="reader-body">
            {article.isPending ? (
              <div className="space-y-3" data-testid="reader-loading">
                <p className="type-meta text-muted-foreground">Preparando a matéria{item.translated ? " e traduzindo" : ""}…</p>
                {Array.from({ length: 7 }).map((_, i) => <div key={i} className={cn("h-4 animate-pulse rounded bg-muted", i % 3 === 2 && "w-2/3")} />)}
              </div>
            ) : article.isError ? (
              <p className="type-reading text-muted-foreground" data-testid="reader-error">Não foi possível abrir a matéria. {errorMessage(article.error, "")}</p>
            ) : full ? (
              <div className="[&>li]:list-none [text-wrap:pretty]">{article.data.blocks.map((b, i) => <Block key={i} b={b} />)}</div>
            ) : (
              <div className="rounded-2xl border border-border bg-card/60 p-5" data-testid="reader-fallback">
                <p className="type-h4">Este veículo não permite a leitura completa aqui.</p>
                <p className="mt-1 type-reading text-muted-foreground">Você leu o resumo acima. A matéria completa está disponível no site de {item.source}.</p>
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <p className="type-meta text-muted-foreground">Fonte: {item.source}{item.translated ? " · tradução automática" : ""}</p>
            <a href={item.url} target="_blank" rel="noopener noreferrer" data-testid="reader-original-btn" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-[600] tracking-[-0.008em] text-primary-foreground shadow-[0_0_20px_-6px_var(--glow)] transition-[transform] active:scale-95">
              Ler no site original <ExternalLink className="size-3.5" />
            </a>
          </div>
        </motion.article>
      </div>
    </div>
  );
}

/** Full-screen editorial reader. Pass `item` to open, `null` to close. */
export function NewsReader({ item, onClose }: { item: NewsItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 block h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none bg-background p-0 text-base ring-0 sm:max-w-none"
        data-testid="news-reader"
      >
        {item && <ReaderBody key={item.id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
