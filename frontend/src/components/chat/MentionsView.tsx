import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { AtSign, Hash, Menu } from "lucide-react";
import { apiGet } from "@/lib/api";
import { RichText, fullDate } from "@/lib/format";
import type { MessageOut } from "@/lib/types";
import { UserAvatar } from "./Avatar";
import { channelLabel, useWorkspace } from "./hooks";

export function MentionsView({ onOpenNav }: { onOpenNav: () => void }) {
  const { me, users, handles, channels, goToChannel } = useWorkspace();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["mentions"], queryFn: () => apiGet<MessageOut[]>("/mentions") });
  const byId = Object.fromEntries(channels.map((c) => [c.id, c]));
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background" data-testid="mentions-view">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <button type="button" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" onClick={onOpenNav} aria-label="Abrir navegação" data-testid="mobile-nav-btn">
          <Menu className="size-4" />
        </button>
        <AtSign className="size-4 text-primary" />
        <h1 className="type-bar text-base">Atividade</h1>
        <span className="text-xs text-muted-foreground">Menções a @{me.handle}</span>
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {isError && <p className="text-sm text-muted-foreground">Não foi possível carregar a atividade.</p>}
        {!isLoading && !isError && data.length === 0 && (
          <div className="mx-auto mt-16 max-w-sm text-center" data-testid="mentions-empty">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary animate-breathe">
              <AtSign className="size-7" />
            </div>
            <h2 className="type-h3">Tudo tranquilo por aqui</h2>
            <p className="mt-1 text-sm text-muted-foreground">Quando alguém mencionar <span className="font-mono text-primary">@{me.handle}</span>, aparecerá aqui.</p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-3">
          {data.map((m, i) => {
            const ch = byId[m.channel_id];
            return (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => goToChannel(m.channel_id, m.parent_id ?? m.id)}
                data-testid={`mention-item-${m.id}`}
                className="flex w-full gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40"
              >
                <UserAvatar user={users[m.user_id]} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="text-sm font-semibold text-foreground">{users[m.user_id]?.name}</span>
                    mencionou você em
                    <span className="flex items-center gap-0.5 font-medium text-primary"><Hash className="size-3" />{channelLabel(ch, me.user_id, users)}</span>
                    <span className="ml-auto font-mono">{fullDate(m.created_at)}</span>
                  </p>
                  <div className="mt-1 text-sm"><RichText text={m.text} handles={handles} /></div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
