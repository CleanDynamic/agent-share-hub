// Posts, spaces and where they travel (UX-04): the shapes, the query keys and the one error type.
//
// THE TABLES ARE REACHED THROUGH A CAST. spaces, space_members, posts, post_spaces, post_attachments, post_mentions, post_likes and
// post_reactions are newer than src/integrations/supabase/types.ts, which is generated from the live database. This module uses the
// client typed without a schema, as src/lib/social/types.ts does, and describes every row here, column for column as the migrations
// declare it (supabase/migrations/20261107120000 to 20261107170000). If the two disagree, the migration is right.
//
// ERRORS. The database refuses with plain words of its own: "A reply can attach only your own work." (a raised exception, code
// P0001). Those reach the caller UNCHANGED, as the PostError's message, because they are fixed text that names the rule and holds
// nothing a reader wrote. Every other failure is built from the operation, the code and the status only: a refused insert's details
// can quote a post's words, so the server's message is never copied for them (neoscale-error-monitoring, Privacy).

import { db } from "@/lib/social/types";

export { db };

/** Posts in one page, unless the caller asks for fewer. */
export const POSTS_PAGE_SIZE = 20;
/** The most one list returns. */
export const POSTS_MAX = 50;

/** The one shape of a query key in this module: ['posts', '<fn>', ...args]. */
export const postKey = (fn: string, ...args: readonly unknown[]) => ["posts", fn, ...args] as const;

export type SpaceWhoCanPost = "anyone" | "members" | "invite";
export type SpaceOrder = "newest" | "most_replied" | "pinned_first";
export type SpaceView = "thread" | "wall";
export type SpaceReaction = "dislike" | "rating";
export type SpaceRole = "member" | "moderator";

export interface Space {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: string;
  creatorId: string;
  whoCanPost: SpaceWhoCanPost;
  postOrder: SpaceOrder;
  defaultView: SpaceView;
  rewardsAllowed: boolean;
  reactions: SpaceReaction[];
  createdAt: string;
}

export interface SpaceRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: string;
  creator_id: string;
  who_can_post: SpaceWhoCanPost;
  post_order: SpaceOrder;
  default_view: SpaceView;
  rewards_allowed: boolean;
  reactions: SpaceReaction[] | null;
  created_at: string;
}

export const SPACE_COLUMNS =
  "id, slug, name, description, rules, creator_id, who_can_post, post_order, default_view, rewards_allowed, reactions, created_at";

export const toSpace = (row: SpaceRow): Space => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  rules: row.rules,
  creatorId: row.creator_id,
  whoCanPost: row.who_can_post,
  postOrder: row.post_order,
  defaultView: row.default_view,
  rewardsAllowed: row.rewards_allowed,
  reactions: row.reactions ?? [],
  createdAt: row.created_at,
});

export interface PostAuthor {
  id: string;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export type AttachmentKind = "build" | "part" | "session" | "step" | "media";
/** The four sizes of work. */
export type WorkSize = "build" | "part" | "session" | "step";

export interface PostAttachment {
  position: number;
  kind: AttachmentKind;
  buildId: string | null;
  nodeId: string | null;
  partKey: string | null;
  sessionKey: string | null;
  mediaPath: string | null;
  mediaKind: "image" | "video" | "file" | null;
  /** The copy taken when work from a draft was attached. Null for published work and media. */
  snapshot: Record<string, unknown> | null;
}

export interface PostSpaceRef {
  id: string;
  slug: string;
  name: string;
}

export interface Post {
  id: string;
  authorId: string;
  parentId: string | null;
  rootId: string;
  body: string;
  aboutBuildId: string | null;
  aboutNodeId: string | null;
  rewardGbp: number | null;
  stillOpen: boolean;
  tags: string[];
  closesAt: string | null;
  pinnedBy: string | null;
  pinnedAt: string | null;
  hiddenBy: string | null;
  hiddenReason: string | null;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor | null;
  attachments: PostAttachment[];
  /** A root post's spaces. Empty on a reply and on a post in none. */
  spaces: PostSpaceRef[];
  /** Replies under it, at every depth. Zero where the read did not ask. */
  replyCount: number;
}

/** A post with its replies, two levels deep; replyCount holds every depth. */
export interface PostThread extends Post {
  replies: PostThread[];
}

export const POST_COLUMNS =
  "id, author_id, parent_id, root_id, body, about_build_id, about_node_id, reward_gbp, still_open, tags, closes_at, pinned_by, pinned_at, hidden_by, hidden_reason, like_count, created_at, updated_at";
export const AUTHOR_EMBED = "author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)";
export const ATTACHMENTS_EMBED =
  "attachments:post_attachments(position, kind, build_id, node_id, part_key, session_key, media_path, media_kind, snapshot)";
export const SPACES_EMBED = "post_spaces(space:spaces(id, slug, name))";

interface AttachmentRow {
  position: number;
  kind: AttachmentKind;
  build_id: string | null;
  node_id: string | null;
  part_key: string | null;
  session_key: string | null;
  media_path: string | null;
  media_kind: "image" | "video" | "file" | null;
  snapshot: Record<string, unknown> | null;
}

export interface PostRow {
  id: string;
  author_id: string;
  parent_id: string | null;
  root_id: string;
  body: string;
  about_build_id: string | null;
  about_node_id: string | null;
  reward_gbp: number | string | null;
  still_open: boolean;
  tags: string[] | null;
  closes_at: string | null;
  pinned_by: string | null;
  pinned_at: string | null;
  hidden_by: string | null;
  hidden_reason: string | null;
  like_count: number | null;
  created_at: string;
  updated_at: string;
  author?: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  attachments?: AttachmentRow[] | null;
  post_spaces?: { space: PostSpaceRef | null }[] | null;
  /** posts!posts_root_id_fkey(count): the thread, the root itself included. */
  thread?: { count: number }[] | null;
  replies?: PostRow[] | null;
}

export const toPost = (row: PostRow): Post => ({
  id: row.id,
  authorId: row.author_id,
  parentId: row.parent_id,
  rootId: row.root_id,
  body: row.body,
  aboutBuildId: row.about_build_id,
  aboutNodeId: row.about_node_id,
  rewardGbp: row.reward_gbp === null ? null : Number(row.reward_gbp),
  stillOpen: row.still_open,
  tags: row.tags ?? [],
  closesAt: row.closes_at,
  pinnedBy: row.pinned_by,
  pinnedAt: row.pinned_at,
  hiddenBy: row.hidden_by,
  hiddenReason: row.hidden_reason,
  likeCount: row.like_count ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: row.author
    ? { id: row.author.id, handle: row.author.username, name: row.author.display_name, avatarUrl: row.author.avatar_url }
    : null,
  attachments: (row.attachments ?? [])
    .map((a) => ({
      position: a.position,
      kind: a.kind,
      buildId: a.build_id,
      nodeId: a.node_id,
      partKey: a.part_key,
      sessionKey: a.session_key,
      mediaPath: a.media_path,
      mediaKind: a.media_kind,
      snapshot: a.snapshot,
    }))
    .sort((a, b) => a.position - b.position),
  spaces: (row.post_spaces ?? []).flatMap((link) => (link.space ? [link.space] : [])),
  // The thread count includes the root; a reply's thread is not asked for.
  replyCount: row.thread?.[0] ? Math.max(0, row.thread[0].count - 1) : 0,
});

/** The refusal from the database, or the failure of an operation. See the note at the top of the file. */
export class PostError extends Error {
  readonly operation: string;
  readonly code: string | null;
  readonly status: number | null;

  constructor(operation: string, message: string, code: string | null = null, status: number | null = null) {
    super(message);
    this.name = "PostError";
    this.operation = operation;
    this.code = code;
    this.status = status;
  }
}

/** Plain words for a refused write that the database refused without words of its own (a policy, 42501). */
export function postLayerError(operation: string, response: { error: unknown; status?: number | null }, refusal?: string): PostError {
  const error = response.error && typeof response.error === "object" ? (response.error as { code?: unknown; message?: unknown }) : null;
  const code = typeof error?.code === "string" ? error.code : null;
  const status = typeof response.status === "number" ? response.status : null;
  // A raised exception is the database's own plain words, fixed text with nothing a reader wrote in it.
  if (code === "P0001" && typeof error?.message === "string") return new PostError(operation, error.message, code, status);
  if (code === "42501" && refusal) return new PostError(operation, refusal, code, status);
  return new PostError(operation, `${operation} failed${code ? ` (${code})` : ""}`, code, status);
}

export const signedOut = (operation: string): PostError => new PostError(operation, "Sign in to do that.", null, 401);

/** The ids once each, blanks dropped. */
export const unique = (ids: readonly string[]): string[] => [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];

export const pageLimit = (requested: number | undefined): number => Math.max(1, Math.min(requested ?? POSTS_PAGE_SIZE, POSTS_MAX));
