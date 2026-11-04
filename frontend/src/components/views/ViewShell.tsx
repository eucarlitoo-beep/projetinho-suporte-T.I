import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Header + scroll area shared by the non-channel workspace views (Início, Notícias, Chamados). */
export function ViewShell({
  icon: Icon,
  title,
  subtitle,
  actions,
  onOpenNav,
  testid,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onOpenNav: () => void;
  testid: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background" data-testid={testid}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <button type="button" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" onClick={onOpenNav} aria-label="Abrir navegação" data-testid="mobile-nav-btn">
          <Menu className="size-4" />
        </button>
        <Icon className="size-4 text-primary" />
        <h1 className="type-bar" data-testid={`${testid}-title`}>{title}</h1>
        {subtitle && <span className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</span>}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className={cn("scroll-thin min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>
    </section>
  );
}

export function Panel({ title, subtitle, actions, children, className, testid }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string; testid: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-4 backdrop-blur sm:p-5", className)} data-testid={testid}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="type-bar">{title}</h2>
          {subtitle && <p className="mt-0.5 type-caption text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export const relTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

export const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
