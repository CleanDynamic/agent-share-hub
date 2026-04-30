export type ThreadType = "direct" | "group" | "bounty" | "blueprint";
export type MessageKind = "text" | "content-share" | "system";
export type SharedContentType =
  | "blueprint"
  | "stage"
  | "block"
  | "blog"
  | "bounty"
  | "project"
  | "collection"
  | string;

export interface SharedContentMeta {
  title?: string;
  slug?: string;
  author_id?: string;
  author_username?: string;
  author_display_name?: string;
  cover_image_url?: string | null;
  parent_id?: string | null;
  [key: string]: unknown;
}

export interface ThreadSummary {
  id: string;
  type: ThreadType;
  title: string | null;
  avatarUrls: string[];
  memberCount: number;
  lastMessage: {
    kind: MessageKind;
    preview: string;
    contentType?: SharedContentType | null;
    isFromCurrentUser: boolean;
    timestamp: string | null;
  } | null;
  unreadCount: number;
  isPinned: boolean;
  pinnedContentId?: string | null;
  pinnedContentType?: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  text_content: string | null;
  message_type: string;
  image_url: string | null;
  voice_url: string | null;
  voice_duration_seconds: number | null;
  is_liked: boolean | null;
  reply_to_message_id: string | null;
  shared_content_type: SharedContentType | null;
  shared_content_id: string | null;
  shared_content_meta: SharedContentMeta | null;
  /** Resolved current state of the referenced content (if kind='content-share') */
  resolvedContent?: {
    id: string;
    title: string;
    slug: string | null;
    post_type: string | null;
    cover_image_url: string | null;
    creator_id: string;
    isBroken: boolean;
  } | null;
  edited_at: string | null;
  sent_at: string;
  read_at: string | null;
  delivered_at: string | null;
  is_unsent: boolean | null;
}
