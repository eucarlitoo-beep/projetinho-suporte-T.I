import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Search, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet, errorMessage } from "@/lib/api";
import type { GifMeta, GifSearchOut } from "@/lib/types";

const SUGGESTIONS = ["obrigado", "parabéns", "aula", "escola", "café", "sexta-feira", "uau", "kkk"];

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function GifPicker({ onPick, trigger, testid }: { onPick: (gif: GifMeta) => void; trigger: ReactElement; testid: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 400);

  const gifs = useQuery({
    queryKey: ["gifs", term],
    queryFn: () => apiGet<GifSearchOut>(term ? `/gifs/search?q=${encodeURIComponent(term)}` : "/gifs/trending"),
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const pick = (g: GifMeta) => {
    onPick(g);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} data-testid={testid} />
      <PopoverContent className="w-[340px] p-0 sm:w-[380px]" align="start" side="top" data-testid={`${testid}-panel`}>
        <div className="border-b border-border p-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-primary/50">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              maxLength={50}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar GIFs no GIPHY"
              data-testid="gif-search-input"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {gifs.isFetching && <Loader2 className="size-3.5 animate-spin text-primary" />}
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                data-testid={`gif-suggestion-${s}`}
                className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-[color,border-color,background-color] hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[320px] overflow-y-auto p-2" data-testid="gif-results">
          <p className="mb-1.5 flex items-center gap-1.5 px-0.5 type-eyebrow text-[10px] text-muted-foreground">
            {term ? <>Resultados para “{term}”</> : <><TrendingUp className="size-3" /> Em alta</>}
          </p>
          {gifs.isError ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground" data-testid="gif-error">{errorMessage(gifs.error, "Não foi possível carregar GIFs")}</p>
          ) : gifs.isPending ? (
            <div className="columns-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="mb-2 animate-pulse rounded-lg bg-muted" style={{ height: 70 + ((i * 37) % 60) }} />
              ))}
            </div>
          ) : gifs.data.gifs.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground" data-testid="gif-empty">Nenhum GIF encontrado.</p>
          ) : (
            <div className="columns-2 gap-2">
              {gifs.data.gifs.map((g, i) => (
                <motion.button
                  key={g.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.4) }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => pick(g)}
                  title={g.title}
                  aria-label={`Enviar GIF ${g.title}`}
                  data-testid={`gif-option-${i}`}
                  className="mb-2 block w-full overflow-hidden rounded-lg bg-muted ring-primary/60 hover:ring-2"
                >
                  <img
                    src={g.preview_url}
                    alt={g.title}
                    loading="lazy"
                    className="block w-full"
                    style={g.width && g.height ? { aspectRatio: `${g.width} / ${g.height}` } : undefined}
                  />
                </motion.button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end border-t border-border px-3 py-1.5" data-testid="giphy-attribution">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Powered by GIPHY</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GifView({ gif }: { gif: GifMeta }) {
  return (
    <div className="mt-1.5 inline-block max-w-[min(320px,70vw)] overflow-hidden rounded-xl border border-border bg-muted" data-testid="message-gif">
      <img
        src={gif.url}
        alt={gif.title || "GIF"}
        loading="lazy"
        className="block max-h-64 w-full object-cover"
        style={gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined}
      />
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] text-muted-foreground">
        <span className="truncate">{gif.title}</span>
        <span className="shrink-0 font-bold uppercase tracking-[0.18em]">GIPHY</span>
      </div>
    </div>
  );
}
