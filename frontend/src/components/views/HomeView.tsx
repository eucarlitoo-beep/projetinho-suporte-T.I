import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, ChevronLeft, ChevronRight, ArrowRight, Copy, Hash, Home, LifeBuoy, Newspaper, Pause, Play, Share2, HeartPulse, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { apiGet, errorMessage } from "@/lib/api";
import type { NewsItem, TicketStats, VerseOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/chat/hooks";
import { CATEGORY_META, NewsImage, useNews } from "./NewsView";
import { ViewShell, localTz, relTime } from "./ViewShell";
import { NewsReader } from "./NewsReader";
import { VerseImageDialog } from "./VerseImage";

const SLIDE_MS = 7000;

function NewsCarousel({ onSeeAll }: { onSeeAll: () => void }) {
  const news = useNews({ withImage: true, limit: 8 });
  const items = news.data?.items ?? [];
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reading, setReading] = useState<NewsItem | null>(null);
  const autoplay = !reduce && !paused && !hover && !reading && items.length > 1;

  const go = useCallback(
    (delta: number) => {
      if (!items.length) return;
      setDir(delta);
      setI((n) => (n + delta + items.length) % items.length);
    },
    [items.length],
  );

  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [autoplay, i, go]);

  if (news.isError)
    return (
      <div className="grid h-72 place-items-center rounded-3xl border border-border bg-card/60 text-sm text-muted-foreground" data-testid="home-carousel-error">
        Não foi possível carregar as notícias. {errorMessage(news.error, "")}
      </div>
    );
  if (!items.length) return <div className="h-72 animate-pulse rounded-3xl bg-muted sm:h-96" data-testid="home-carousel-loading" />;

  const it = items[i % items.length];
  const meta = CATEGORY_META[it.categories[0]];
  return (
    <>
    <section
      className="group relative h-80 overflow-hidden rounded-3xl border border-border bg-void sm:h-[420px]"
      aria-roledescription="carrossel"
      aria-label="Notícias em destaque"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      data-testid="home-news-carousel"
    >
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <motion.div
          key={it.id}
          role="button"
          tabIndex={0}
          onClick={() => setReading(it)}
          onKeyDown={(e) => { if (e.key === "Enter") setReading(it); }}
          custom={dir}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60, scale: 1.02 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
          transition={{ duration: reduce ? 0.2 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 block cursor-pointer outline-none"
          aria-roledescription="slide"
          aria-label={`${(i % items.length) + 1} de ${items.length}: ${it.title} — abrir no modo leitura`}
          data-testid="home-carousel-slide"
        >
          {it.video ? (
            <video src={it.video} poster={it.image} muted autoPlay={!reduce} loop playsInline className="absolute inset-0 size-full object-cover" />
          ) : (
            <NewsImage item={it} className={cn("absolute inset-0 size-full", !reduce && "animate-kenburns")} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {meta && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 font-semibold backdrop-blur" style={{ color: meta.tint }}>
                  <meta.icon className="size-3.5" /> {meta.label}
                </span>
              )}
              <span className="type-meta text-white/70">{it.source} · {relTime(it.published_at)}</span>
            </div>
            <h2 className="max-w-3xl type-headline text-[1.75rem] leading-[1.1] tracking-[-0.016em] sm:text-[2.75rem] sm:leading-[1.06]" data-testid="home-carousel-title">{it.title}</h2>
            {it.summary && <p className="mt-3 line-clamp-2 max-w-2xl type-dek text-white/75 sm:text-[1.0625rem]">{it.summary}</p>}
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#00E5FF]">Ler no modo leitura <ArrowRight className="size-3.5" /></span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Reproduzir carrossel" : "Pausar carrossel"} data-testid="home-carousel-pause-btn" className="grid size-9 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-[background-color] hover:bg-black/70">
          {paused || reduce ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        <button type="button" onClick={onSeeAll} data-testid="home-carousel-see-all-btn" className="rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-[background-color] hover:bg-black/70">
          Ver todas
        </button>
      </div>
      {(["prev", "next"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => go(k === "next" ? 1 : -1)}
          aria-label={k === "next" ? "Próxima notícia" : "Notícia anterior"}
          data-testid={`home-carousel-${k}-btn`}
          className={cn(
            "absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/50 text-white opacity-80 backdrop-blur transition-[opacity,background-color,transform] hover:scale-105 hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            k === "next" ? "right-3" : "left-3",
          )}
        >
          {k === "next" ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      ))}
      <div className="absolute right-5 bottom-5 z-10 hidden gap-1.5 sm:flex" role="tablist" aria-label="Escolher notícia">
        {items.map((n, k) => (
          <button
            key={n.id}
            type="button"
            role="tab"
            aria-selected={k === i}
            aria-label={`Notícia ${k + 1}`}
            onClick={() => { setDir(k > i ? 1 : -1); setI(k); }}
            data-testid={`home-carousel-dot-${k}`}
            className={cn("relative h-1.5 overflow-hidden rounded-full bg-white/25 transition-[width] duration-300", k === i ? "w-8" : "w-1.5 hover:bg-white/50")}
          >
            {k === i && autoplay && <motion.span key={`${n.id}-${i}`} className="absolute inset-y-0 left-0 bg-[#00E5FF]" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: SLIDE_MS / 1000, ease: "linear" }} />}
            {k === i && !autoplay && <span className="absolute inset-0 bg-[#00E5FF]" />}
          </button>
        ))}
      </div>
    </section>
    <NewsReader item={reading} onClose={() => setReading(null)} />
    </>
  );
}

function VerseCard() {
  const [offset, setOffset] = useState(0);
  const [imageOpen, setImageOpen] = useState(false);
  const verse = useQuery({
    queryKey: ["verse", offset],
    queryFn: () => apiGet<VerseOut>(`/verse?tz=${encodeURIComponent(localTz())}&offset=${offset}`),
    staleTime: 60 * 60_000,
  });
  const v = verse.data;
  const shareText = v ? `“${v.text}” — ${v.reference} (Almeida)` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Versículo copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  const dateLabel = v ? new Date(`${v.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "";

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-primary/20 bg-card/70 p-5 backdrop-blur sm:p-6" data-testid="verse-card">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 type-eyebrow text-primary"><BookOpen className="size-4" /> Versículo do Dia</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setOffset((o) => Math.min(o + 1, 30))} disabled={offset >= 30} aria-label="Versículo anterior" data-testid="verse-prev-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-primary disabled:opacity-40">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => setOffset((o) => Math.max(o - 1, 0))} disabled={offset === 0} aria-label="Próximo versículo" data-testid="verse-next-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-primary disabled:opacity-40">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <p className="mt-1 type-meta first-letter:uppercase text-muted-foreground" data-testid="verse-date">{offset === 0 ? `Hoje, ${dateLabel}` : dateLabel}</p>
      <div className="flex flex-1 flex-col justify-center py-5">
        <AnimatePresence mode="wait">
          {verse.isError ? (
            <p className="text-sm text-muted-foreground" data-testid="verse-error">Não foi possível carregar o versículo.</p>
          ) : !v ? (
            <div className="space-y-2"><div className="h-4 animate-pulse rounded bg-muted" /><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /></div>
          ) : (
            <motion.blockquote key={v.date} initial={{ opacity: 0, y: 8, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}>
              <p className="font-serif text-[1.375rem] leading-[1.38] font-medium italic tracking-[-0.012em] sm:text-[1.625rem]" data-testid="verse-text">“{v.text}”</p>
              <footer className="mt-4 type-eyebrow text-[0.75rem] not-italic text-primary" data-testid="verse-reference">{v.reference}</footer>
            </motion.blockquote>
          )}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} disabled={!v} data-testid="verse-copy-btn" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-[border-color,color] hover:border-primary/50 hover:text-primary disabled:opacity-50">
          <Copy className="size-3.5" /> Copiar
        </button>
        <button type="button" onClick={() => setImageOpen(true)} disabled={!v} data-testid="verse-share-btn" className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_20px_-6px_var(--glow)] transition-[transform] active:scale-95 disabled:opacity-50">
          <Share2 className="size-3.5" /> Criar imagem
        </button>
        {v && <span className="ml-auto text-[10px] text-muted-foreground">{v.translation}</span>}
      </div>
      <VerseImageDialog verse={v} dateLabel={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} open={imageOpen} onOpenChange={setImageOpen} />
    </div>
  );
}

export function HomeView({ onOpenNav, onOpenNews }: { onOpenNav: () => void; onOpenNews: (category?: string) => void }) {
  const { me, channels, goToChannel } = useWorkspace();
  const stats = useQuery({
    queryKey: ["ticket-stats", "home"],
    queryFn: () => apiGet<TicketStats>(`/tickets/stats?tz=${encodeURIComponent(localTz())}`),
    staleTime: 60_000,
  });
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const unread = channels.filter((c) => c.is_member && c.unread > 0 && !c.is_dm).slice(0, 4);

  const shortcuts = [
    { id: "tickets", icon: LifeBuoy, label: "Chamados de T.I.", value: stats.data ? `${stats.data.open_now + stats.data.in_progress_now} em aberto` : "…", act: () => goToChannel("tickets") },
    { id: "news", icon: Newspaper, label: "Notícias", value: "Tecnologia e educação", act: () => onOpenNews() },
    { id: "schools", icon: GraduationCap, label: "Tecnologia nas Escolas", value: "IA, robótica, inclusão", act: () => onOpenNews("escolas") },
    { id: "health", icon: HeartPulse, label: "Saúde Mental", value: "Bem-estar e equilíbrio", act: () => onOpenNews("saude") },
  ];

  return (
    <ViewShell icon={Home} title="Início" subtitle="Seu painel do dia" onOpenNav={onOpenNav} testid="home-view">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
          <h2 className="type-title" data-testid="home-greeting">
            {greet}, <span className="text-primary text-glow">{me.name.split(" ")[0]}</span>.
          </h2>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <NewsCarousel onSeeAll={() => onOpenNews()} />
          <VerseCard />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shortcuts.map((s, k) => (
            <motion.button
              key={s.id}
              type="button"
              onClick={s.act}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + k * 0.05 }}
              whileHover={{ y: -4 }}
              data-testid={`home-shortcut-${s.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 text-left backdrop-blur transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_16px_40px_-24px_var(--glow)]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110"><s.icon className="size-5" /></span>
              <span>
                <span className="block type-h4">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.value}</span>
              </span>
            </motion.button>
          ))}
        </div>

        {unread.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/40 p-4" data-testid="home-unread">
            <p className="mb-2 type-eyebrow text-muted-foreground">Canais com novidades</p>
            <div className="flex flex-wrap gap-2">
              {unread.map((c) => (
                <button key={c.id} type="button" onClick={() => goToChannel(c.id)} data-testid={`home-unread-${c.name}`} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm transition-[border-color,color] hover:border-primary/50 hover:text-primary">
                  <Hash className="size-3.5" /> {c.name}
                  <span className="rounded-full bg-primary/15 px-1.5 font-mono text-[10px] text-primary">{c.unread}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ViewShell>
  );
}
