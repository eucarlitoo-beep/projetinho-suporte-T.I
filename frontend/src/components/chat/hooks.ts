import { createContext, useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from "@/lib/api";
import type { ChannelOut, MessageCreate, MessageOut, RightPanel, ThreadOut, UserOut } from "@/lib/types";

export interface WorkspaceCtx {
  me: UserOut;
  users: Record<string, UserOut>;
  handles: Set<string>;
  channels: ChannelOut[];
  activeChannelId: string | null;
  /** last opened channel (or #geral) — target of the "Chat" shortcut */
  chatChannelId: string | null;
  panel: RightPanel;
  openPanel: (p: RightPanel) => void;
  goToChannel: (id: string, threadId?: string) => void;
  openDM: (userId: string) => void;
  openSearch: () => void;
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace(): WorkspaceCtx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside provider");
  return ctx;
}

export const useUsersQuery = (enabled: boolean) =>
  useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserOut[]>("/users"), enabled });

export const useChannelsQuery = (enabled: boolean) =>
  useQuery({ queryKey: ["channels"], queryFn: () => apiGet<ChannelOut[]>("/channels"), enabled });

export const useMessages = (channelId: string | null) =>
  useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => apiGet<MessageOut[]>(`/channels/${channelId}/messages`),
    enabled: !!channelId,
  });

export const useThread = (id: string) =>
  useQuery({ queryKey: ["thread", id], queryFn: () => apiGet<ThreadOut>(`/messages/${id}/thread`) });

export function channelLabel(ch: ChannelOut | undefined, meId: string, users: Record<string, UserOut>): string {
  if (!ch) return "";
  if (ch.is_dm) {
    const other = ch.members.find((m) => m !== meId) ?? meId;
    return users[other]?.name ?? "Mensagem direta";
  }
  return ch.name;
}

/** Send a message with an optimistic bubble that is swapped for the server copy on success. */
export function useSendMessage(channelId: string, meId: string, parentId: string | null = null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MessageCreate) => apiPost<MessageOut>(`/channels/${channelId}/messages`, body),
    onMutate: (body) => {
      const temp: MessageOut = {
        id: `tmp-${Date.now()}`, channel_id: channelId, user_id: meId, text: body.text, parent_id: parentId,
        reply_count: 0, reply_user_ids: [], last_reply_at: null, reactions: [], files: [], gif: body.gif ?? null, mentions: [],
        pinned: false, pinned_by: null, edited: false, created_at: new Date().toISOString(), pending: true,
      };
      if (parentId) {
        qc.setQueryData<ThreadOut>(["thread", parentId], (old) => (old ? { ...old, replies: [...old.replies, temp] } : old));
      } else {
        qc.setQueryData<MessageOut[]>(["messages", channelId], (old) => [...(old ?? []), temp]);
      }
      return { tempId: temp.id };
    },
    onSuccess: (msg, _body, ctx) => {
      const swap = (list: MessageOut[]) => {
        const without = list.filter((m) => m.id !== ctx?.tempId);
        return without.some((m) => m.id === msg.id) ? without : [...without, msg];
      };
      if (parentId) {
        qc.setQueryData<ThreadOut>(["thread", parentId], (old) => (old ? { ...old, replies: swap(old.replies) } : old));
      } else {
        qc.setQueryData<MessageOut[]>(["messages", channelId], (old) => swap(old ?? []));
      }
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (err, _body, ctx) => {
      const drop = (list: MessageOut[]) => list.filter((m) => m.id !== ctx?.tempId);
      if (parentId) qc.setQueryData<ThreadOut>(["thread", parentId], (old) => (old ? { ...old, replies: drop(old.replies) } : old));
      else qc.setQueryData<MessageOut[]>(["messages", channelId], (old) => drop(old ?? []));
      toast.error(errorMessage(err, "Não foi possível enviar"));
    },
  });
}

function patchEverywhere(qc: ReturnType<typeof useQueryClient>, msg: MessageOut) {
  if (msg.parent_id) {
    qc.setQueryData<ThreadOut>(["thread", msg.parent_id], (old) =>
      old ? { ...old, replies: old.replies.map((r) => (r.id === msg.id ? msg : r)) } : old,
    );
  } else {
    qc.setQueryData<MessageOut[]>(["messages", msg.channel_id], (old) => old?.map((m) => (m.id === msg.id ? msg : m)));
    qc.setQueryData<ThreadOut>(["thread", msg.id], (old) => (old ? { ...old, parent: msg } : old));
  }
  qc.invalidateQueries({ queryKey: ["pins", msg.channel_id] });
}

export function useMessageActions() {
  const qc = useQueryClient();
  const onError = (err: unknown) => toast.error(errorMessage(err));
  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => apiPost<MessageOut>(`/messages/${id}/reactions`, { emoji }),
    onSuccess: (m) => patchEverywhere(qc, m),
    onError,
  });
  const pin = useMutation({
    mutationFn: (id: string) => apiPost<MessageOut>(`/messages/${id}/pin`),
    onSuccess: (m) => {
      patchEverywhere(qc, m);
      toast.success(m.pinned ? "Mensagem fixada" : "Mensagem desafixada");
    },
    onError,
  });
  const edit = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => apiPatch<MessageOut>(`/messages/${id}`, { text }),
    onSuccess: (m) => patchEverywhere(qc, m),
    onError,
  });
  const remove = useMutation({
    mutationFn: (m: MessageOut) => apiDelete<{ ok: boolean }>(`/messages/${m.id}`).then(() => m),
    onSuccess: (m) => {
      if (m.parent_id) {
        qc.setQueryData<ThreadOut>(["thread", m.parent_id], (old) => (old ? { ...old, replies: old.replies.filter((r) => r.id !== m.id) } : old));
      } else {
        qc.setQueryData<MessageOut[]>(["messages", m.channel_id], (old) => old?.filter((x) => x.id !== m.id));
      }
      qc.invalidateQueries({ queryKey: ["pins", m.channel_id] });
      toast("Mensagem excluída");
    },
    onError,
  });
  return { react, pin, edit, remove };
}
