import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { dayLabel } from "@/lib/format";
import { useTypingUsers } from "@/lib/realtime";
import type { MessageOut } from "@/lib/types";
import { TypingDots } from "./Avatar";
import { MessageItem } from "./MessageItem";
import { useWorkspace } from "./hooks";

const GROUP_MS = 5 * 60 * 1000;

export function shouldGroup(prev: MessageOut | undefined, m: MessageOut) {
  if (!prev || prev.user_id !== m.user_id) return false;
  if (dayLabel(prev.created_at) !== dayLabel(m.created_at)) return false;
  return new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS && !prev.reply_count;
}

export function TypingLine({ channelId, parentId }: { channelId: string; parentId?: string | null }) {
  const { users } = useWorkspace();
  const ids = useTypingUsers(channelId, parentId);
  const names = ids.map((id) => users[id]?.name.split(" ")[0] ?? "Alguém");
  const label = names.length === 1 ? `${names[0]} está digitando` : names.length === 2 ? `${names[0]} e ${names[1]} estão digitando` : "Várias pessoas estão digitando";
  return (
    <div className="h-6 px-5">
      <AnimatePresence>
        {ids.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="typing-indicator">
            <TypingDots /> <span>{label}…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MessageList({ messages, channelId, highlightId, header }: { messages: MessageOut[]; channelId: string; highlightId?: string | null; header?: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const { me } = useWorkspace();
  const lastId = messages[messages.length - 1]?.id;
  const lastMine = messages[messages.length - 1]?.user_id === me.user_id;

  // jump to the bottom when switching channels
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
  }, [channelId]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (highlightId) {
      document.getElementById(`msg-${highlightId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (atBottom.current || lastMine) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setShowJump(false);
    } else setShowJump(true);
  }, [lastId, lastMine, highlightId]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (atBottom.current) setShowJump(false);
        }}
        className="scroll-thin h-full overflow-y-auto px-2 pb-2"
        data-testid="message-list"
      >
        {header}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="sticky top-0 z-[5] my-3 flex items-center gap-3 px-3" data-testid="day-divider">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
                  <span className="rounded-full border border-border bg-background/90 px-3 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground backdrop-blur">
                    {dayLabel(m.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
                </div>
              )}
              <MessageItem message={m} grouped={!newDay && shouldGroup(prev, m)} highlight={m.id === highlightId} />
            </Fragment>
          );
        })}
      </div>
      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}
            data-testid="jump-to-latest-btn"
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-4px_var(--glow)]"
          >
            <ArrowDown className="size-3.5" /> Novas mensagens
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
