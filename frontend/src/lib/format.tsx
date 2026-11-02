import { Fragment } from "react";
import type { ReactNode } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

export function timeLabel(iso: string) {
  return format(new Date(iso), "HH:mm");
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function fullDate(iso: string) {
  return format(new Date(iso), "d MMM yyyy 'às' HH:mm", { locale: ptBR });
}

export function fileSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|(?<![\w])_[^_\n]+_(?![\w])|~[^~\n]+~|@[a-z0-9][a-z0-9._-]*[a-z0-9]|https?:\/\/[^\s<]+)/gi;

function inline(text: string, handles: Set<string>, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) {
      out.push(<code key={k} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] text-primary">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      out.push(<strong key={k} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("_")) {
      out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("~")) {
      out.push(<s key={k} className="opacity-70">{tok.slice(1, -1)}</s>);
    } else if (tok.startsWith("@")) {
      const h = tok.slice(1).toLowerCase();
      out.push(
        handles.has(h) ? (
          <span key={k} data-testid="mention-chip" className="rounded-md bg-primary/15 px-1 font-medium text-primary">{tok}</span>
        ) : (
          tok
        ),
      );
    } else {
      out.push(
        <a key={k} href={tok} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">
          {tok}
        </a>,
      );
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Slack-ish markdown: ```blocks```, `code`, **bold**, _italic_, ~strike~, @mentions, links, - lists, # headings. */
export function RichText({ text, handles = new Set<string>() }: { text: string; handles?: Set<string> }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((block, bi) =>
        bi % 2 === 1 ? (
          <pre key={bi} className="my-1.5 overflow-x-auto rounded-lg border border-border bg-[#050811] p-3 font-mono text-[13px] leading-relaxed text-cyan-100">
            {block.replace(/^\n/, "")}
          </pre>
        ) : (
          <Fragment key={bi}>
            {block.split("\n").map((line, li, arr) => {
              const k = `${bi}-${li}`;
              const h = line.match(/^(#{1,3})\s+(.*)$/);
              if (h) return <div key={k} className="mt-2 mb-1 font-heading text-[15px] font-semibold tracking-tight">{inline(h[2], handles, k)}</div>;
              const li_ = line.match(/^\s*[-*•]\s+(.*)$/);
              if (li_) return <div key={k} className="flex gap-2 pl-1"><span className="mt-[9px] size-1 shrink-0 rounded-full bg-primary" /><span>{inline(li_[1], handles, k)}</span></div>;
              const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
              if (ol) return <div key={k} className="flex gap-2 pl-1"><span className="font-mono text-xs leading-6 text-primary">{ol[1]}.</span><span>{inline(ol[2], handles, k)}</span></div>;
              return (
                <Fragment key={k}>
                  {inline(line, handles, k)}
                  {li < arr.length - 1 && <br />}
                </Fragment>
              );
            })}
          </Fragment>
        ),
      )}
    </>
  );
}
