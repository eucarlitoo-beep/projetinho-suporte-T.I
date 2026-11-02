import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react";
import { dark } from "@clerk/ui/themes";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { setTokenGetter } from "@/lib/api";

interface ClerkConfig {
  enabled: boolean;
  publishable_key: string;
  proxy_url: string;
}

// Registers Clerk's getToken with the fetch layer during render (before any child query
// fires) and drops the react-query cache whenever the signed-in account changes.
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, userId } = useAuth();
  const qc = useQueryClient();
  setTokenGetter(() => getToken());
  const prev = useRef(userId);
  useEffect(() => {
    if (prev.current !== userId) {
      qc.clear();
      prev.current = userId;
    }
  }, [userId, qc]);
  return <>{children}</>;
}

// Starts Clerk from the backend's runtime config, so deploy's live keys need no rebuild.
export default function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [config, setConfig] = useState<ClerkConfig | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0): Promise<void> => {
      try {
        const cfg = (await (await fetch(`/api/clerk/config`)).json()) as ClerkConfig;
        if (cfg.enabled) {
          if (!cancelled) setConfig(cfg);
          return;
        }
      } catch {
        /* backend restarting — retry */
      }
      if (cancelled) return;
      if (attempt >= 20) {
        setUnavailable(true);
        return;
      }
      setTimeout(() => load(attempt + 1), 1500);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (unavailable)
    return <p style={{ padding: 24 }}>O login está indisponível agora. Atualize a página para tentar novamente.</p>;
  if (!config) return null;

  const isDark = resolvedTheme !== "light";
  const appearance = {
    ...(isDark ? { theme: dark, captcha: { theme: "dark" as const } } : {}),
    variables: {
      colorPrimary: isDark ? "#00E5FF" : "#0284C7",
      colorPrimaryForeground: isDark ? "#070B14" : "#FFFFFF",
      colorBackground: isDark ? "#0C1222" : "#FFFFFF",
      fontFamily: "'DM Sans Variable', sans-serif",
      borderRadius: "0.75rem",
    },
  };

  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      proxyUrl={config.proxy_url || undefined}
      appearance={appearance}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      <TokenBridge>{children}</TokenBridge>
    </ClerkProvider>
  );
}
