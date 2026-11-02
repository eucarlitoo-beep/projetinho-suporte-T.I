import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowDownWideNarrow, ExternalLink, Globe2, HeartPulse, Newspaper, RefreshCw, Search, ShieldCheck, Sparkles, GraduationCap, BookOpenText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, errorMessage } from "@/lib/api";
import type { NewsCategoryId, NewsItem, NewsOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ViewShell, relTime } from "./ViewShell";

export const CATEGORY_META: Record<NewsCategoryId, { icon: LucideIcon; label: string; tint: string }> = {
  ia: { icon: Sparkles, label: "Tecnologia & IA", tint: "#00E5FF" },
  escolas: { icon: GraduationCap, label: "Tecnologia nas Escolas", tint: "#A78BFA" },
  educacao: { icon: BookOpenText, label: "Educação Digital", tint: "#3B82F6" },
  saude: { icon: HeartPulse, label: "Saúde Mental", tint: "#34D399" },
  seguranca: { icon: ShieldCheck, label: "Segurança Digital", tint: "#F59E0B" },
};

const SORT_LABEL: Record<string, string> = { recentes: "Mais recentes", antigas: "Mais antigas" };
const REGION_LABEL: Record<string, string> = { todas: "Brasil e internacional", br: "Brasil", mundo: "Internacional" };

export function useNews(params: { category?: string; region?: string; q?: string; sort?: string; withImage?: boolean; limit?: number }) {
  const sp = new URLSearchParams();
  if (params.category) sp.set("category", params.category);
  if (params.region) sp.set("region", params.region);
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.sort) sp.set("sort", params.sort);
  if (params.withImage) sp.set("with_image", "true");
  sp.set("limit", String(params.limit ?? 60));
  const qs = sp.toString();
  return useQuery({
    queryKey: ["news", qs],
    queryFn: () => apiGet<NewsOut>(`/news?${qs}`),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Image with graceful fallback to a category-tinted circuit pattern. */
export function NewsImage({ item, className }: { item: NewsItem; className?: string }) {
  const [broken, setBroken] = useState(false);
  const meta = CATEGORY_META[item.categories[0]] ?? CATEGORY_META.ia;
  if (!item.image || broken)
    return (
      <div className={cn("relative grid place-items-center overflow-hidden bg-grid", className)} style={{ background: `radial-gradient(circle at 30% 20%, ${meta.tint}33, transparent 60%)` }}>
        <meta.icon className="size-10 opacity-70" style={{ color: meta.tint }} />
        <span className="absolute bottom-2.5 left-3 type-eyebrow text-[10px] text-muted-foreground">{item.source}</span>
      </div>
    );
  return <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn("object-cover", className)} />;
}

function NewsCard({ item, index, featured }: { item: NewsItem; index: number; featured?: boolean }) {
  return (
    <motion.a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_50px_-25px_var(--glow)]",
        featured && "sm:col-span-2 sm:flex-row",
      )}
      data-testid={`news-card-${item.id}`}
    >
      <div className={cn("relative overflow-hidden", featured ? "aspect-video sm:aspect-auto sm:w-1/2" : "aspect-video")}>
        <NewsImage item={item} className="size-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {item.categories.slice(0, 2).map((c) => (
            <span key={c} className="rounded-md bg-black/65 px-2 py-1 type-eyebrow text-[10px] tracking-[0.1em] text-white backdrop-blur">{CATEGORY_META[c]?.label ?? c}</span>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2.5 flex items-center gap-2 type-meta text-muted-foreground">
          <span className="type-eyebrow text-[10px] text-primary" data-testid="news-card-source">{item.source}</span>
          <span className="size-0.5 rounded-full bg-muted-foreground/60" aria-hidden />
          <time dateTime={item.published_at} title={new Date(item.published_at).toLocaleString("pt-BR")} data-testid="news-card-date">{relTime(item.published_at)}</time>
          {item.region === "mundo" && (
            <span className="ml-auto flex items-center gap-1"><Globe2 className="size-3" /> Internacional</span>
          )}
        </div>
        <h3
          className={cn("type-headline text-foreground transition-colors duration-200 group-hover:text-primary", featured ? "text-[1.75rem] leading-[1.12] sm:text-[2rem]" : "text-[1.25rem] leading-[1.2]")}
          data-testid="news-card-title"
        >
          {item.title}
        </h3>
        {item.summary && <p className={cn("mt-2.5 type-dek text-[0.875rem] text-muted-foreground", featured ? "line-clamp-4 sm:text-[0.9375rem]" : "line-clamp-3")}>{item.summary}</p>}
        <span className="mt-auto flex items-center gap-1.5 pt-4 text-[0.8125rem] font-semibold tracking-[-0.005em] text-primary opacity-80 transition-[opacity,gap] duration-200 group-hover:gap-2.5 group-hover:opacity-100">
          Ler matéria completa <ExternalLink className="size-3" />
        </span>
      </div>
    </motion.a>
  );
}

export function NewsView({ onOpenNav, initialCategory }: { onOpenNav: () => void; initialCategory?: NewsCategoryId }) {
  const [category, setCategory] = useState<NewsCategoryId | "todas">(initialCategory ?? "todas");
  const [region, setRegion] = useState("todas");
  const [sort, setSort] = useState("recentes");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const news = useNews({ category: category === "todas" ? undefined : category, region: region === "todas" ? undefined : region, q: term, sort, limit: 90 });
  const cats = news.data?.categories ?? [];
  const activeCat = cats.find((c) => c.id === category);

  return (
    <ViewShell
      icon={Newspaper}
      title="Notícias"
      subtitle="Brasil e internacional"
      onOpenNav={onOpenNav}
      testid="news-view"
      actions={
        <button type="button" onClick={() => news.refetch()} aria-label="Atualizar notícias" title="Atualizar" data-testid="news-refresh-btn" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-[color,background-color] hover:bg-muted hover:text-primary">
          <RefreshCw className={cn("size-4", news.isFetching && "animate-spin")} />
        </button>
      }
    >
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* editorial masthead */}
        <div className="mb-5 flex flex-col gap-1 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between" data-testid="news-masthead">
          <div>
            <p className="type-eyebrow text-[10px] text-muted-foreground first-letter:uppercase">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} · Edição do dia
            </p>
            <h2 className="mt-1.5 type-headline text-[2rem] leading-[1.06] tracking-[-0.018em] sm:text-[2.75rem]">Tecnologia, educação e bem-estar</h2>
          </div>
          <p className="max-w-sm type-caption text-muted-foreground sm:text-right">Curadoria automática de veículos brasileiros e serviços internacionais em português.</p>
        </div>
        {/* category tabs */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none]" role="tablist" data-testid="news-category-tabs">
          {(["todas", ...Object.keys(CATEGORY_META)] as (NewsCategoryId | "todas")[]).map((id) => {
            const meta = id === "todas" ? { icon: Newspaper, label: "Todas" } : CATEGORY_META[id];
            const on = category === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCategory(id)}
                data-testid={`news-category-${id}`}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-[border-color,color,background-color] duration-200",
                  on ? "border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {on && <motion.span layoutId="news-tab" className="absolute inset-0 -z-10 rounded-xl bg-primary/10" transition={{ type: "spring", stiffness: 450, damping: 35 }} />}
                <meta.icon className="size-4" /> {meta.label}
              </button>
            );
          })}
        </div>

        {/* filters */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <form
            className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 focus-within:border-primary/50"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(q);
            }}
          >
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} maxLength={80} placeholder="Pesquisar notícias…" data-testid="news-search-input" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <button type="submit" className="text-xs font-semibold text-primary" data-testid="news-search-btn">Buscar</button>
          </form>
          <div className="flex gap-2">
            <Select value={region} onValueChange={(v: string) => setRegion(v)}>
              <SelectTrigger className="h-10 min-w-[150px]" data-testid="news-region-select"><Globe2 className="size-4" /><SelectValue>{(v) => REGION_LABEL[v as string]}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(REGION_LABEL).map(([k, l]) => <SelectItem key={k} value={k} data-testid={`news-region-${k}`}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v: string) => setSort(v)}>
              <SelectTrigger className="h-10 min-w-[150px]" data-testid="news-sort-select"><ArrowDownWideNarrow className="size-4" /><SelectValue>{(v) => SORT_LABEL[v as string]}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_LABEL).map(([k, l]) => <SelectItem key={k} value={k} data-testid={`news-sort-${k}`}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeCat && (
          <motion.div key={activeCat.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-border bg-card/40 p-4" data-testid="news-category-banner">
            <p className="type-eyebrow text-[10px] text-primary">Editoria</p>
            <p className="mt-1 type-headline text-[1.625rem] leading-[1.15]">{activeCat.label}</p>
            <p className="mt-1 max-w-3xl type-reading text-muted-foreground">{activeCat.description}</p>
            {activeCat.id === "saude" && (
              <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300" data-testid="news-health-disclaimer">
                Conteúdo informativo e educativo. Não substitui avaliação, diagnóstico ou tratamento profissional. Em caso de crise, ligue 188 (CVV) — 24h, gratuito.
              </p>
            )}
          </motion.div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="type-meta" data-testid="news-count">{news.data ? `${news.data.items.length} notícias` : "Carregando…"}</span>
          {news.data?.updated_at && <span className="type-meta">Atualizado {relTime(news.data.updated_at)}</span>}
        </div>
        {!!news.data?.failed_sources.length && (
          <p className="mt-1 text-[11px] text-amber-500" data-testid="news-failed-sources">Fontes temporariamente indisponíveis: {news.data.failed_sources.join(", ")}</p>
        )}

        {news.isError ? (
          <div className="mt-16 text-center" data-testid="news-error">
            <p className="type-h3">Não foi possível carregar as notícias</p>
            <p className="text-sm text-muted-foreground">{errorMessage(news.error)}</p>
            <button type="button" onClick={() => news.refetch()} className="mt-2 text-sm text-primary hover:underline">Tentar novamente</button>
          </div>
        ) : news.isPending ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : news.data.items.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted-foreground" data-testid="news-empty">Nenhuma notícia encontrada para esse filtro.</p>
        ) : (
          <div className={cn("mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3", news.isPlaceholderData && "opacity-60 transition-opacity")} data-testid="news-grid">
            {news.data.items.map((it, i) => <NewsCard key={it.id} item={it} index={i} featured={i === 0 && sort === "recentes" && !term} />)}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
