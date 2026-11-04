import { useState } from "react";
import { useClerk } from "@clerk/react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, ChevronDown, Hash, Home, LifeBuoy, Lock, LogOut, MessagesSquare, Newspaper, Plus, Search, Smile, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogoMark } from "@/components/brand/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRealtime } from "@/lib/realtime";
import type { ChannelOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { useWorkspace } from "./hooks";

function UserMenu({ onStatus, compact }: { onStatus: () => void; compact?: boolean }) {
  const { me } = useWorkspace();
  const { signOut } = useClerk();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={cn("flex items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-sidebar-accent", compact ? "p-1" : "w-full p-2")} />}
        data-testid="user-menu-btn"
      >
        <UserAvatar user={me} size={compact ? "md" : "sm"} presence />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold" data-testid="current-user-name">{me.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{me.status_text ? `${me.status_emoji} ${me.status_text}` : `@${me.handle}`}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold text-foreground">{me.name}</span>
          <span className="block font-normal text-muted-foreground">{me.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onStatus} data-testid="set-status-btn"><Smile className="size-4" /> Definir status</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")} data-testid="menu-theme-toggle"><Sparkles className="size-4" /> Tema {resolvedTheme === "light" ? "escuro" : "claro"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut({ redirectUrl: "/" })} data-testid="sign-out-btn"><LogOut className="size-4" /> Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Narrow icon rail (desktop). */
export function Rail({ onStatus }: { onStatus: () => void }) {
  const { activeChannelId, chatChannelId, goToChannel, openSearch, channels } = useWorkspace();
  const mentions = channels.reduce((n, c) => n + c.mentions, 0);
  const special = ["home", "activity", "news", "tickets"];
  const items = [
    { id: "home", icon: Home, label: "Início", active: activeChannelId === "home", act: () => goToChannel("") },
    { id: "chat", icon: MessagesSquare, label: "Chat", active: !!activeChannelId && !special.includes(activeChannelId), act: () => goToChannel(chatChannelId ?? "") },
    { id: "tickets", icon: LifeBuoy, label: "Chamados", active: activeChannelId === "tickets", act: () => goToChannel("tickets") },
    { id: "news", icon: Newspaper, label: "Notícias", active: activeChannelId === "news", act: () => goToChannel("news") },
    { id: "activity", icon: AtSign, label: "Atividade", active: activeChannelId === "activity", act: () => goToChannel("activity"), badge: mentions },
    { id: "search", icon: Search, label: "Buscar", active: false, act: openSearch },
  ];
  return (
    <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-2 border-r border-sidebar-border bg-void py-4 md:flex" data-testid="workspace-rail">
      <div className="mb-3 grid size-11 place-items-center rounded-2xl border border-primary/30 bg-card text-primary animate-breathe">
        <LogoMark className="size-7" />
      </div>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={it.act} aria-label={it.label} title={it.label} data-testid={`rail-${it.id}-btn`} className="group relative flex flex-col items-center gap-1">
          <span className={cn("relative grid size-10 place-items-center rounded-xl transition-[background-color,color,transform] duration-200 group-hover:scale-105", it.active ? "bg-primary/15 text-primary" : "text-muted-foreground group-hover:bg-sidebar-accent group-hover:text-foreground")}>
            <it.icon className="size-5" />
            {!!it.badge && <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-amber-400 px-1 font-mono text-[10px] font-bold text-[#070B14]">{it.badge}</span>}
          </span>
          <span className={cn("text-[10px] font-[560] tracking-[0.01em]", it.active ? "text-primary" : "text-muted-foreground")}>{it.label}</span>
        </button>
      ))}
      <div className="mt-auto flex flex-col items-center gap-3">
        <ThemeToggle />
        <UserMenu onStatus={onStatus} compact />
      </div>
    </nav>
  );
}

function SectionHeader({ open, onToggle, title, onAdd, testid }: { open: boolean; onToggle: () => void; title: string; onAdd: () => void; testid: string }) {
  return (
    <div className="group mt-4 flex items-center justify-between px-2">
      <button type="button" onClick={onToggle} data-testid={`${testid}-toggle`} className="flex items-center gap-1 type-eyebrow text-muted-foreground transition-colors hover:text-foreground">
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", !open && "-rotate-90")} /> {title}
      </button>
      <button type="button" onClick={onAdd} aria-label={`Adicionar em ${title}`} data-testid={`${testid}-add-btn`} className="grid size-6 place-items-center rounded-md text-muted-foreground transition-[color,background-color,transform] hover:rotate-90 hover:bg-sidebar-accent hover:text-primary">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function NavItem({ active, onClick, children, testid, unread, mentions, dim }: { active: boolean; onClick: () => void; children: React.ReactNode; testid: string; unread?: number; mentions?: number; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      data-active={active ? "true" : "false"}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.875rem] leading-[1.35] font-[460] tracking-[-0.008em] transition-[color,transform] duration-150 active:scale-[0.98]",
        active ? "font-[600] text-primary" : unread ? "font-[640] text-foreground" : dim ? "text-muted-foreground/70 hover:text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg bg-primary/12 shadow-[inset_2px_0_0_var(--glow)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      {!active && <span className="absolute inset-0 rounded-lg bg-sidebar-accent opacity-0 transition-opacity hover:opacity-100" />}
      <span className="relative flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {!!mentions && <span className="relative grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 font-mono text-[10px] font-bold text-[#070B14]">{mentions}</span>}
      {!mentions && !!unread && !active && <span className="relative size-2 rounded-full bg-primary shadow-[0_0_8px_var(--glow)]" />}
    </button>
  );
}

export function Sidebar({ onCreateChannel, onNewDM, onStatus, onNavigate }: { onCreateChannel: () => void; onNewDM: () => void; onStatus: () => void; onNavigate?: () => void }) {
  const { me, users, channels, activeChannelId, goToChannel, openDM, openSearch } = useWorkspace();
  const { connected } = useRealtime();
  const [openCh, setOpenCh] = useState(true);
  const [openDm, setOpenDm] = useState(true);
  const regular = channels.filter((c) => !c.is_dm);
  const dmByUser: Record<string, ChannelOut> = {};
  for (const c of channels.filter((c) => c.is_dm)) {
    const other = c.members.find((m) => m !== me.user_id) ?? me.user_id;
    dmByUser[other] = c;
  }
  const people = Object.values(users)
    .filter((u) => u.user_id !== me.user_id)
    .sort((a, b) => Number(!!dmByUser[b.user_id]?.unread) - Number(!!dmByUser[a.user_id]?.unread) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const nav = (fn: () => void) => () => {
    fn();
    onNavigate?.();
  };

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar md:w-[264px] md:shrink-0 md:border-r md:border-sidebar-border" data-testid="workspace-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <div>
          <p className="type-bar text-[1.0625rem] tracking-[-0.02em]">Nexus HQ</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="connection-status">
            <span className="relative flex size-1.5">
              {connected && <span className="animate-ring-ping absolute inline-flex size-full rounded-full bg-emerald-400" />}
              <span className={cn("relative inline-flex size-1.5 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")} />
            </span>
            {connected ? "Conectado ao vivo" : "Reconectando…"}
          </p>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button type="button" onClick={nav(openSearch)} data-testid="sidebar-search-btn" className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border bg-background/50 px-3 py-2 text-sm text-muted-foreground transition-[border-color,color] hover:border-primary/40 hover:text-foreground">
          <Search className="size-4" /> Buscar…
          <kbd className="ml-auto rounded border border-border px-1.5 font-mono text-[10px]">⌘K</kbd>
        </button>
        <div className="mt-2 space-y-px md:hidden">
          <NavItem active={activeChannelId === "home"} onClick={nav(() => goToChannel(""))} testid="sidebar-home-btn">
            <Home className="size-4" /> Início
          </NavItem>
          <NavItem active={activeChannelId === "tickets"} onClick={nav(() => goToChannel("tickets"))} testid="sidebar-tickets-btn">
            <LifeBuoy className="size-4" /> Chamados de T.I.
          </NavItem>
          <NavItem active={activeChannelId === "news"} onClick={nav(() => goToChannel("news"))} testid="sidebar-news-btn">
            <Newspaper className="size-4" /> Notícias
          </NavItem>
          <NavItem active={activeChannelId === "activity"} onClick={nav(() => goToChannel("activity"))} testid="sidebar-activity-btn">
            <AtSign className="size-4" /> Atividade
          </NavItem>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <SectionHeader open={openCh} onToggle={() => setOpenCh((o) => !o)} title="Canais" onAdd={onCreateChannel} testid="channels-section" />
        <AnimatePresence initial={false}>
          {openCh && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1 space-y-px overflow-hidden">
              {regular.map((c) => (
                <NavItem key={c.id} active={c.id === activeChannelId} onClick={nav(() => goToChannel(c.id))} testid={`channel-item-${c.name}`} unread={c.unread} mentions={c.mentions} dim={!c.is_member}>
                  {c.is_private ? <Lock className="size-3.5 shrink-0" /> : <Hash className="size-3.5 shrink-0" />}
                  <span className="truncate">{c.name}</span>
                </NavItem>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <SectionHeader open={openDm} onToggle={() => setOpenDm((o) => !o)} title="Mensagens diretas" onAdd={onNewDM} testid="dms-section" />
        <AnimatePresence initial={false}>
          {openDm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1 space-y-px overflow-hidden">
              {people.map((u) => {
                const dm = dmByUser[u.user_id];
                return (
                  <NavItem key={u.user_id} active={!!dm && dm.id === activeChannelId} onClick={nav(() => (dm ? goToChannel(dm.id) : openDM(u.user_id)))} testid={`dm-item-${u.handle}`} unread={dm?.unread} mentions={dm?.unread}>
                    <UserAvatar user={u} size="xs" presence />
                    <span className="truncate">{u.name}</span>
                    {u.status_emoji && <span className="text-xs">{u.status_emoji}</span>}
                  </NavItem>
                );
              })}
              <NavItem
                active={!!dmByUser[me.user_id] && dmByUser[me.user_id].id === activeChannelId}
                onClick={nav(() => (dmByUser[me.user_id] ? goToChannel(dmByUser[me.user_id].id) : openDM(me.user_id)))}
                testid="dm-item-self"
              >
                <UserAvatar user={me} size="xs" presence />
                <span className="truncate">{me.name} <span className="text-muted-foreground">(você)</span></span>
              </NavItem>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-sidebar-border p-2 md:hidden">
        <UserMenu onStatus={onStatus} />
      </div>
    </aside>
  );
}
