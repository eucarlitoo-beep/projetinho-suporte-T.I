// Mirrors backend/models/chat.py — keep the pair in sync by hand.

export interface UserOut {
  user_id: string;
  name: string;
  handle: string;
  email: string;
  avatar_url: string;
  color: string;
  title: string;
  status_text: string;
  status_emoji: string;
  bot: boolean;
  online: boolean;
}

export interface SyncIn {
  name: string;
  email: string;
  avatar_url: string;
}

export interface StatusIn {
  status_text: string;
  status_emoji: string;
  title: string;
}

export interface ChannelOut {
  id: string;
  name: string;
  topic: string;
  is_private: boolean;
  is_dm: boolean;
  members: string[];
  created_by: string;
  created_at: string;
  unread: number;
  mentions: number;
  is_member: boolean;
}

export interface ChannelCreate {
  name: string;
  topic: string;
  is_private: boolean;
  member_ids: string[];
}

export interface FileMeta {
  id: string;
  name: string;
  content_type: string;
  size: number;
}

export interface GifMeta {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
}

export interface GifSearchOut {
  gifs: GifMeta[];
}

export interface Reaction {
  emoji: string;
  user_ids: string[];
}

export interface MessageOut {
  id: string;
  channel_id: string;
  user_id: string;
  text: string;
  parent_id: string | null;
  reply_count: number;
  reply_user_ids: string[];
  last_reply_at: string | null;
  reactions: Reaction[];
  files: FileMeta[];
  gif?: GifMeta | null;
  mentions: string[];
  pinned: boolean;
  pinned_by: string | null;
  edited: boolean;
  created_at: string;
  /** client-only: optimistic message not yet confirmed by the server */
  pending?: boolean;
}

export interface MessageCreate {
  text: string;
  parent_id: string | null;
  file_ids: string[];
  gif?: GifMeta | null;
}

export interface ThreadOut {
  parent: MessageOut;
  replies: MessageOut[];
}

export interface SearchOut {
  messages: MessageOut[];
  channels: ChannelOut[];
  files: MessageOut[];
}

export interface AIMessage {
  id: string;
  channel_id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export type RightPanel =
  | { kind: "thread"; id: string }
  | { kind: "ai"; parentId?: string; preset?: string }
  | { kind: "pins" }
  | { kind: "members" }
  | null;

/* ---------------- tickets (mirror backend/models/extras.py) ---------------- */
export type TicketPriority = "baixa" | "media" | "alta" | "urgente";
export type TicketStatus = "aberto" | "em_atendimento" | "resolvido";

export interface TicketCategory {
  id: string;
  name: string;
  color: string;
}

export interface TicketCategoryCreate {
  name: string;
}

export interface TicketCreate {
  title: string;
  description: string;
  category_id: string;
  priority: TicketPriority;
  location: string;
}

export interface TicketUpdate {
  status?: TicketStatus;
  priority?: TicketPriority;
  category_id?: string;
  assignee_id?: string | null;
}

export interface TicketOut {
  id: string;
  number: number;
  title: string;
  description: string;
  category_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  location: string;
  requester_id: string;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface PeriodPoint {
  date: string;
  abertos: number;
  resolvidos: number;
}

export interface CountItem {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface TicketStats {
  start: string;
  end: string;
  total: number;
  open_now: number;
  in_progress_now: number;
  resolved_in_period: number;
  period: PeriodPoint[];
  priority: CountItem[];
  category: CountItem[];
}

/* ---------------- news ---------------- */
export type NewsCategoryId = "ia" | "escolas" | "educacao" | "saude" | "seguranca";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  image: string;
  video: string;
  source: string;
  region: "br" | "mundo";
  lang: string;
  categories: NewsCategoryId[];
  published_at: string;
}

export interface NewsCategory {
  id: NewsCategoryId;
  label: string;
  description: string;
}

export interface NewsOut {
  items: NewsItem[];
  categories: NewsCategory[];
  updated_at: string | null;
  failed_sources: string[];
}

/* ---------------- verse ---------------- */
export interface VerseOut {
  date: string;
  reference: string;
  text: string;
  translation: string;
  source: string;
  offset: number;
}
