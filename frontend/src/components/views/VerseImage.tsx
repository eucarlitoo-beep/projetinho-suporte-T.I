import { useEffect, useState } from "react";
import { Download, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VerseOut } from "@/lib/types";
import { cn } from "@/lib/utils";

type Format = "square" | "story";
const FORMATS: Record<Format, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "Quadrado", hint: "Conversas do WhatsApp" },
  story: { w: 1080, h: 1920, label: "Vertical", hint: "Status e stories" },
};
const SERIF = '"Newsreader Variable", Georgia, serif';
const SANS = '"Inter Variable", system-ui, sans-serif';
const CYAN = "#00E5FF";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function spacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

async function render(v: VerseOut, dateLabel: string, format: Format): Promise<HTMLCanvasElement> {
  const { w, h } = FORMATS[format];
  await Promise.all([
    document.fonts.load(`italic 500 80px ${SERIF}`, v.text),
    document.fonts.load(`600 28px ${SANS}`),
    document.fonts.load(`760 40px ${SANS}`),
  ]);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const story = format === "story";
  const pad = story ? 110 : 96;

  // ground: deep navy, cyan bloom top-right, blue bloom bottom-left, faint grid
  ctx.fillStyle = "#070B14";
  ctx.fillRect(0, 0, w, h);
  const g1 = ctx.createRadialGradient(w * 0.95, h * 0.02, 0, w * 0.95, h * 0.02, w * 0.9);
  g1.addColorStop(0, "rgba(0,229,255,0.28)");
  g1.addColorStop(1, "rgba(0,229,255,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(0, h, 0, 0, h, w * 0.8);
  g2.addColorStop(0, "rgba(59,130,246,0.16)");
  g2.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 60; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 60; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(0,229,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad / 2, pad / 2, w - pad, h - pad);

  // header: eyebrow + date
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CYAN;
  ctx.font = `620 26px ${SANS}`;
  spacing(ctx, 6);
  ctx.fillText("VERSÍCULO DO DIA", pad + 10, pad + 58);
  spacing(ctx, 0);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText(dateLabel, pad + 10, pad + 100);

  // verse: auto-fit Newsreader italic in the middle band
  const maxW = w - (pad + 10) * 2;
  const top = pad + 200;
  const bottom = h - pad - (story ? 320 : 230);
  let size = story ? 104 : 74;
  let lines: string[] = [];
  const text = `${v.text}”`;
  for (; size >= 36; size -= 2) {
    ctx.font = `italic 500 ${size}px ${SERIF}`;
    lines = wrap(ctx, text, maxW);
    if (lines.length * size * 1.28 <= bottom - top) break;
  }
  const lh = size * 1.28;
  const blockH = lines.length * lh;
  let y = top + (bottom - top - blockH) / 2 + size;
  ctx.fillStyle = CYAN;
  ctx.font = `italic 500 ${size * 2.2}px ${SERIF}`;
  ctx.fillText("“", pad - 4, y - size * 0.55);
  ctx.fillStyle = "#F1F5F9";
  ctx.font = `italic 500 ${size}px ${SERIF}`;
  spacing(ctx, -size * 0.012);
  for (const l of lines) { ctx.fillText(l, pad + 10, y); y += lh; }
  spacing(ctx, 0);

  // reference
  y += size * 0.35;
  ctx.fillStyle = CYAN;
  ctx.fillRect(pad + 10, y - 12, 56, 3);
  ctx.font = `660 32px ${SANS}`;
  spacing(ctx, 4);
  ctx.fillText(v.reference.toUpperCase(), pad + 86, y);
  spacing(ctx, 0);

  // footer: wordmark + translation credit
  const fy = h - pad - 34;
  ctx.font = `760 44px ${SANS}`;
  spacing(ctx, -1.8);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("nexus", pad + 10, fy);
  const wm = ctx.measureText("nexus").width;
  ctx.fillStyle = CYAN;
  ctx.fillText(".", pad + 10 + wm + 1, fy);
  spacing(ctx, 0);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `400 22px ${SANS}`;
  ctx.fillText(v.translation, w - pad - 10, fy);
  ctx.textAlign = "left";
  return c;
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("png"))), "image/png"));

export function VerseImageDialog({ verse, dateLabel, open, onOpenChange }: { verse: VerseOut | undefined; dateLabel: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [format, setFormat] = useState<Format>("square");
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const shareText = verse ? `“${verse.text}” — ${verse.reference} (Almeida)` : "";

  useEffect(() => {
    if (!open || !verse) return;
    let url = "";
    let alive = true;
    render(verse, dateLabel, format)
      .then(toBlob)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, blob });
      })
      .catch(() => toast.error("Não foi possível gerar a imagem"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [open, verse, dateLabel, format]);

  const fileName = `versiculo-${verse?.date ?? "dia"}-${format === "square" ? "quadrado" : "vertical"}.png`;
  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = fileName;
    a.click();
  };
  const share = async () => {
    if (!preview) return;
    const file = new File([preview.blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: shareText });
      } catch {
        /* user cancelled */
      }
      return;
    }
    download();
    toast.success("Imagem baixada", { description: "Anexe a imagem na conversa do WhatsApp." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[30rem]" data-testid="verse-image-dialog">
        <DialogHeader>
          <DialogTitle>Compartilhar versículo</DialogTitle>
          <DialogDescription>Uma imagem pronta para o WhatsApp, com a tipografia do Nexus.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Formato da imagem">
          {(Object.keys(FORMATS) as Format[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => setFormat(f)}
              data-testid={`verse-format-${f}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color] duration-200",
                format === f ? "border-primary/60 bg-primary/10" : "border-border hover:border-primary/30",
              )}
            >
              <span className={cn("shrink-0 rounded-[3px] border-2", format === f ? "border-primary" : "border-muted-foreground/50", f === "square" ? "size-5" : "h-6 w-3.5")} aria-hidden />
              <span>
                <span className="block text-sm font-[620] tracking-[-0.01em]">{FORMATS[f].label}</span>
                <span className="block type-meta text-[11px] text-muted-foreground">{FORMATS[f].hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid place-items-center rounded-xl border border-border bg-muted/40 p-3">
          {preview ? (
            <img src={preview.url} alt="Prévia da imagem do versículo" data-testid="verse-image-preview" className={cn("rounded-lg shadow-[0_20px_50px_-20px_rgba(0,229,255,0.35)]", format === "square" ? "w-full max-w-[22rem]" : "h-[22rem]")} />
          ) : (
            <div className={cn("animate-pulse rounded-lg bg-muted", format === "square" ? "aspect-square w-full max-w-[22rem]" : "h-[22rem] w-[12.4rem]")} data-testid="verse-image-loading" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} disabled={!preview} data-testid="verse-image-share-btn" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-[600] text-primary-foreground shadow-[0_0_20px_-6px_var(--glow)] transition-[transform] active:scale-95 disabled:opacity-50">
            <Share2 className="size-4" /> Compartilhar imagem
          </button>
          <button type="button" onClick={download} disabled={!preview} data-testid="verse-image-download-btn" className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-[560] transition-[border-color,color] hover:border-primary/50 hover:text-primary disabled:opacity-50">
            <Download className="size-4" /> Baixar
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" data-testid="verse-text-whatsapp-link" className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-[560] transition-[border-color,color] hover:border-primary/50 hover:text-primary">
            <MessageCircle className="size-4" /> Só o texto
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
