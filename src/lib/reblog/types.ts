export type ReblogMediaKind = "none" | "image" | "video";

export interface RebloggerProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface EmbeddedOriginal {
  id: string;
  title: string;
  slug: string | null;
  post_type: string;
  cover_image_url: string | null;
  creator_id: string;
  visibility: string;
  unavailable: boolean;
  unavailable_reason?: "deleted" | "private" | null;
  reblogger?: RebloggerProfile | null;
}

export interface ReblogRow {
  id: string;
  slug: string;
  reblogger_id: string;
  original_post_id: string;
  parent_reblog_id: string | null;
  root_original_post_id: string;
  text: string | null;
  media_kind: ReblogMediaKind;
  media_url: string | null;
  media_thumbnail_url: string | null;
  is_self_reblog: boolean;
  reblog_count: number;
  like_count: number;
  comment_count: number;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  excerpt_text?: string | null;
  excerpt_source_block_id?: string | null;
  excerpt_source_block_type_label?: string | null;
  excerpt_text_hash?: string | null;
}

export interface Reblog extends ReblogRow {
  reblogger: RebloggerProfile | null;
}

export interface ReblogFull extends Reblog {
  embeddedOriginal: EmbeddedOriginal | null;
  parentReblog: Reblog | null;
  viewer: {
    hasLiked: boolean;
    hasBookmarked: boolean;
    hasReblogged: boolean;
  };
  isExcerptStillValid?: boolean;
}
