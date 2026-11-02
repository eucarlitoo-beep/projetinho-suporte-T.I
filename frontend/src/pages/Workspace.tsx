import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { apiPost, errorMessage } from "@/lib/api";
import { RealtimeProvider } from "@/lib/realtime";
import type { ChannelOut, RightPanel, UserOut } from "@/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LogoMark } from "@/components/brand/Brand";
import { ChannelView } from "@/components/chat/ChannelView";
import { CreateChannelDialog, NewDMDialog, SearchDialog, StatusDialog } from "@/components/chat/Dialogs";
import { MentionsView } from "@/components/chat/MentionsView";
import { RightPanelHost } from "@/components/chat/Panels";
import { Rail, Sidebar } from "@/components/chat/Sidebar";
import { WorkspaceContext, useChannelsQuery, useUsersQuery } from "@/components/chat/hooks";
import type { WorkspaceCtx } from "@/components/chat/hooks";
import { HomeView } from "@/components/views/HomeView";
import { NewsView } from "@/components/views/NewsView";
import { TicketsView } from "@/components/views/TicketsView";
import type { NewsCategoryId } from "@/lib/types";

const SPECIAL_VIEWS = ["home", "activity", "news", "tickets"];

function Splash({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" data-testid="workspace-loading">
      <div className="flex flex-col items-center gap-4">
        <motion.div animate={{ rotate: [0, 90, 90, 180, 180, 270, 270, 360] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
          <LogoMark className="size-14 text-primary" />
        </motion.div>
        <p className="type-eyebrow text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function Workspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Splash label="Conectando" />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <SignedInWorkspace />;
}

function SignedInWorkspace() {
  const { user } = useUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { channelId } = useParams();
  const [params] = useSearchParams();
  const highlightId = params.get("m");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiPost<UserOut>("/me/sync", {
        name: user?.fullName || user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Membro",
        email: user?.primaryEmailAddress?.emailAddress ?? "",
        avatar_url: user?.imageUrl && user.hasImage ? user.imageUrl : "",
      }),
    enabled: !!user,
    staleTime: Infinity,
  });
  const me = meQuery.data;
  const usersQ = useUsersQuery(!!me);
  const channelsQ = useChannelsQuery(!!me);

  const [panel, setPanel] = useState<RightPanel>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [lastChat, setLastChat] = useState<string | null>(null);

  const channels = useMemo(() => channelsQ.data ?? [], [channelsQ.data]);
  const fallback = channels.find((c) => c.name === "geral" && !c.is_dm) ?? channels.find((c) => !c.is_dm);
  // special (non-channel) views live on the same /app/:channelId route; /app opens Início
  const view = !channelId ? "home" : SPECIAL_VIEWS.includes(channelId) ? channelId : null;
  const activeId = view ? null : channelId ?? null;
  const active = channels.find((c) => c.id === activeId);
  const [newsCategory, setNewsCategory] = useState<NewsCategoryId | undefined>(undefined);

  const usersMap = useMemo(() => {
    const map: Record<string, UserOut> = {};
    for (const u of usersQ.data ?? []) map[u.user_id] = u;
    if (me && !map[me.user_id]) map[me.user_id] = me;
    return map;
  }, [usersQ.data, me]);
  const meLive = me ? usersMap[me.user_id] ?? me : undefined;
  const handles = useMemo(() => new Set(Object.values(usersMap).map((u) => u.handle)), [usersMap]);

  const goToChannel = useCallback(
    (id: string, msgId?: string) => {
      setNavOpen(false);
      if (!id) return navigate("/app");
      setPanel((p) => (p && (p.kind === "pins" || p.kind === "members" || p.kind === "ai") ? p : null));
      navigate(msgId ? `/app/${id}?m=${msgId}` : `/app/${id}`);
    },
    [navigate],
  );

  const dm = useMutation({
    mutationFn: (userId: string) => apiPost<ChannelOut>("/dms", { user_id: userId }),
    onSuccess: async (ch) => {
      await qc.invalidateQueries({ queryKey: ["channels"] });
      goToChannel(ch.id);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // close thread panel when switching channels; remember the last chat for the "Chat" shortcut
  useEffect(() => {
    if (view !== "news") setNewsCategory(undefined);
  }, [view]);
  useEffect(() => {
    setPanel((p) => (p?.kind === "thread" ? null : p));
    if (activeId) setLastChat(activeId);
  }, [activeId]);

  // ⌘K / Ctrl+K search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // unread count in the tab title
  useEffect(() => {
    const total = channels.reduce((n, c) => n + (c.is_member ? c.unread : 0), 0);
    document.title = total ? `(${total}) Nexus` : "Nexus — Workspace em tempo real";
  }, [channels]);

  const ctx = useMemo<WorkspaceCtx | null>(
    () =>
      meLive
        ? {
            me: meLive,
            users: usersMap,
            handles,
            channels,
            activeChannelId: view ?? activeId,
            chatChannelId: lastChat ?? fallback?.id ?? null,
            panel,
            openPanel: setPanel,
            goToChannel,
            openDM: (uid: string) => dm.mutate(uid),
            openSearch: () => setSearchOpen(true),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meLive, usersMap, handles, channels, view, activeId, lastChat, fallback, panel, goToChannel],
  );

  if (meQuery.isError)
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center" data-testid="workspace-error">
        <div>
          <LogoMark className="mx-auto size-12 text-primary" />
          <p className="mt-4 type-h3">Não foi possível conectar ao workspace</p>
          <button type="button" onClick={() => meQuery.refetch()} className="mt-3 text-sm text-primary hover:underline" data-testid="workspace-retry-btn">Tentar novamente</button>
        </div>
      </div>
    );
  if (!ctx) return <Splash label="Sincronizando" />;

  const isActivity = view === "activity";
  const unknownChannel = !view && channelId && channelsQ.isSuccess && !active;
  const openNav = () => setNavOpen(true);

  return (
    <WorkspaceContext.Provider value={ctx}>
      <RealtimeProvider meId={ctx.me.user_id} activeChannelId={activeId}>
        <div className="flex h-dvh overflow-hidden bg-background" data-testid="workspace">
          <Rail onStatus={() => setStatusOpen(true)} />
          <div className="hidden md:flex">
            <Sidebar onCreateChannel={() => setCreateOpen(true)} onNewDM={() => setDmOpen(true)} onStatus={() => setStatusOpen(true)} />
          </div>
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetContent side="left" className="w-[290px] p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <Sidebar onCreateChannel={() => setCreateOpen(true)} onNewDM={() => setDmOpen(true)} onStatus={() => setStatusOpen(true)} onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>

          {view === "home" ? (
            <HomeView onOpenNav={openNav} onOpenNews={(c) => { setNewsCategory(c as NewsCategoryId | undefined); goToChannel("news"); }} />
          ) : view === "news" ? (
            <NewsView key={newsCategory ?? "all"} onOpenNav={openNav} initialCategory={newsCategory} />
          ) : view === "tickets" ? (
            <TicketsView onOpenNav={openNav} />
          ) : isActivity ? (
            <MentionsView onOpenNav={openNav} />
          ) : active ? (
            <ChannelView key={active.id} channel={active} highlightId={highlightId} onOpenNav={() => setNavOpen(true)} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground" data-testid="channel-empty-state">
              {unknownChannel ? (
                <div>
                  <p className="type-h3 text-foreground">Canal não encontrado</p>
                  <button type="button" onClick={() => goToChannel(fallback?.id ?? "")} className="mt-2 text-primary hover:underline" data-testid="back-to-general-btn">Voltar ao #geral</button>
                </div>
              ) : channelsQ.isError ? (
                "Não foi possível carregar os canais."
              ) : (
                <Splash label="Carregando canais" />
              )}
            </div>
          )}

          {!view && <RightPanelHost channel={active} />}
        </div>

        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
        <NewDMDialog open={dmOpen} onOpenChange={setDmOpen} />
        <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} me={ctx.me} />
      </RealtimeProvider>
    </WorkspaceContext.Provider>
  );
}
