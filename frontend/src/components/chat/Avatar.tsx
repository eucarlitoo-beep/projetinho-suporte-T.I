import { Bot } from "lucide-react";
import type { UserOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = { xs: "size-5 text-[9px] rounded-md", sm: "size-7 text-[11px] rounded-lg", md: "size-9 text-sm rounded-xl", lg: "size-14 text-lg rounded-2xl" };

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function UserAvatar({ user, size = "md", presence = false, className }: { user?: UserOut; size?: keyof typeof SIZES; presence?: boolean; className?: string }) {
  const color = user?.color ?? "#64748B";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt={user.name} className={cn("object-cover", SIZES[size])} />
      ) : (
        <span
          className={cn("grid place-items-center font-heading font-bold text-[#070B14]", SIZES[size])}
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, white))` }}
        >
          {user?.bot ? <Bot className="size-1/2" /> : initials(user?.name ?? "?")}
        </span>
      )}
      {presence && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-sidebar",
            size === "xs" ? "size-2" : "size-2.5",
            user?.online ? "bg-emerald-400 shadow-[0_0_8px_#34D399]" : "bg-slate-500",
          )}
          data-testid={`presence-${user?.user_id ?? "unknown"}`}
          data-online={user?.online ? "true" : "false"}
        />
      )}
    </span>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="animate-typing size-1.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}
