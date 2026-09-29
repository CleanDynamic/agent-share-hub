// Likes, saves and comments on builds: the shapes and the one error type
// (RC-P15).
//
// WHY THE TABLES ARE REACHED THROUGH A CAST. build_likes, build_saves,
// build_comments and the three count columns on builds are newer than
// src/integrations/supabase/types.ts, which is generated from the live
// database and lands them the next time it is regenerated. Until then the
// generated client refuses their names, so this module reaches them through the
// client typed without a schema — the same narrow cast src/lib/feed/
// getBuildFeed.ts makes for get_build_feed — and every row is described here,
// column for column as the migration declares it
// (supabase/migrations/20261001180000_rc_build_social.sql). If the two ever
// disagree, the migration is right.
//
// ERRORS CARRY IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧
// (CONTRACT §9). A comment body is text a reader wrote, and the database's own
// words can quote it: a refused insert's details read "Failing row contains
// (…)" with the body inside. So a SocialError is built from the operation's
// name, the ids involved, the error code and the HTTP status, never from the
// server's message, details or hint, and it keeps no `cause`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { GalleryBuild } from "@/lib/build";

/**
 * The client, without the generated schema. See the note at the top of the
 * file: rows are typed on the way out, by the row interfaces below.
 */
export const db = supabase as unknown as SupabaseClient;

/** The longest comment the database accepts, in characters. */
export const COMMENT_MAX = 4000;

/** A page of comments, unless the caller asks for fewer. */
export const COMMENTS_PAGE_SIZE = 50;

/** A page of saved builds, unless the caller asks for fewer. */
export const SAVED_PAGE_SIZE = 24;

// =============================================================================
// Rows, as the database returns them
// =============================================================================

/** build_likes and build_saves share this shape. */
export interface ReactionRow {
  build_id: string;
  created_at: string;
}

/** The count columns getEngagementCounts reads from builds. */
export interface EngagementCountRow {
  id: string;
  like_count: number | null;
  comment_count: number | null;
}

/** The author, embedded through build_comments_author_profile_fkey. */
export interface CommentAuthorRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface BuildCommentRow {
  id: string;
  build_id: string;
  node_id: string | null;
  parent_id: string | null;
  author_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
  edited_at: string | null;
  author?: CommentAuthorRow | CommentAuthorRow[] | null;
}

// =============================================================================
// What the rest of the app holds
// =============================================================================

/** A build's two public counts, as a card and a page header show them. */
export interface EngagementCounts {
  likes: number;
  comments: number;
}

/** Counts by build id. A build the reader cannot read is absent. */
export type EngagementCountMap = Record<string, EngagementCounts>;

export interface CommentAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface BuildComment {
  id: string;
  buildId: string;
  /** The part this comment is about, or null for the build as a whole. */
  nodeId: string | null;
  /** The comment this one answers, or null for a top-level comment. */
  parentId: string | null;
  authorId: string;
  /** Null only when the author's profile could not be read. */
  author: CommentAuthor | null;
  body: string;
  /** Hidden comments reach only their author and admins. */
  isHidden: boolean;
  createdAt: string;
  editedAt: string | null;
}

/** A top-level comment and the replies to it, both oldest first. */
export interface CommentThread extends BuildComment {
  replies: BuildComment[];
}

export interface CommentPage {
  /** Top-level comments, oldest first, each with the replies this page holds. */
  comments: CommentThread[];
  /**
   * Every row this page read, flat and oldest first. A reply always comes
   * after the comment it answers, so a reply on this page may answer a comment
   * on an earlier one: keep the rows of every page and pass them all to
   * nestComments to draw the whole list.
   */
  rows: BuildComment[];
  /** created_at of the last row read, or null when this was the last page. */
  nextAfter: string | null;
}

export interface SavedBuild {
  /** When the reader saved it: the list's order and its cursor. */
  savedAt: string;
  build: GalleryBuild;
}

export interface SavedBuildsPage {
  items: SavedBuild[];
  /** The savedAt to pass as `before` for the next page, or null at the end. */
  nextBefore: string | null;
}

// =============================================================================
// The error
// =============================================================================

/**
 *   no_access  the database refused (Postgres 42501, PostgREST PGRST301 or
 *              PGRST302, HTTP 401 or 403), or nobody is signed in. Surfaced as
 *              "You don't have access to this." (STATES.md row 21), never as
 *              an empty list; a 401 sends the reader to sign in.
 *   invalid    refused before any request: an empty or overlong comment.
 *   failed     anything else.
 */
export type SocialErrorKind = "no_access" | "invalid" | "failed";

/** The identifiers an error may carry. Never text a reader wrote. */
export interface SocialErrorIds {
  buildId?: string | null;
  commentId?: string | null;
  nodeId?: string | null;
  parentId?: string | null;
  /** RC-P18: a collection, for the library's build items. */
  collectionId?: string | null;
}

export class SocialError extends Error {
  readonly kind: SocialErrorKind;
  readonly operation: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;
  readonly buildId: string | null;
  readonly commentId: string | null;
  readonly nodeId: string | null;
  readonly parentId: string | null;
  readonly collectionId: string | null;

  constructor(
    operation: string,
    kind: SocialErrorKind,
    ids: SocialErrorIds = {},
    code: string | null = null,
    status: number | null = null,
  ) {
    const parts = [
      code ? `code ${code}` : null,
      status ? `status ${status}` : null,
      ids.buildId ? `build ${ids.buildId}` : null,
      ids.commentId ? `comment ${ids.commentId}` : null,
      ids.nodeId ? `node ${ids.nodeId}` : null,
      ids.parentId ? `parent ${ids.parentId}` : null,
      ids.collectionId ? `collection ${ids.collectionId}` : null,
    ].filter(Boolean);
    super(`${operation} failed: ${kind.replace("_", " ")}${parts.length ? ` (${parts.join(", ")})` : ""}`);
    this.name = "SocialError";
    this.kind = kind;
    this.operation = operation;
    this.code = code;
    this.status = status;
    this.buildId = ids.buildId ?? null;
    this.commentId = ids.commentId ?? null;
    this.nodeId = ids.nodeId ?? null;
    this.parentId = ids.parentId ?? null;
    this.collectionId = ids.collectionId ?? null;
  }
}

const NO_ACCESS_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

/**
 * A SocialError from a PostgREST response. Reads the error's code and the
 * response's status and nothing else: never message, details or hint.
 */
export function socialError(
  operation: string,
  response: { error: unknown; status?: number | null },
  ids: SocialErrorIds = {},
): SocialError {
  const raw =
    response.error && typeof response.error === "object" && "code" in response.error
      ? (response.error as { code: unknown }).code
      : null;
  const code = typeof raw === "string" && raw.length > 0 ? raw : null;
  const status = typeof response.status === "number" && response.status > 0 ? response.status : null;
  const refused = (code !== null && NO_ACCESS_CODES.has(code)) || status === 401 || status === 403;
  return new SocialError(operation, refused ? "no_access" : "failed", ids, code, status);
}

/** Nobody is signed in: the refusal a 401 would be, without the request. */
export function signedOutError(operation: string, ids: SocialErrorIds = {}): SocialError {
  return new SocialError(operation, "no_access", ids, null, 401);
}

/** Postgres unique_violation: the like or save is already there. */
export function isDuplicate(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code: unknown }).code === "23505",
  );
}

/**
 * The signed-in reader's id, or null. Read from the stored session, which
 * makes no request (the pattern of src/lib/build/builds.ts); components take
 * identity from useAuth() and this module takes the same session.
 */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** The ids once each, blanks dropped, in first-seen order. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
}
