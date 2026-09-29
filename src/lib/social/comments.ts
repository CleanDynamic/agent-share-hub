// Comments on a build and on its parts (RC-P15).
//
// A comment is a build_comments row: on the build, or on one of its parts
// (node_id), or a reply to a top-level comment (parent_id, one level deep).
// The database refuses a part or a parent from another build and a reply to a
// reply (validate_build_comment), refuses a comment on a draft, and keeps
// builds.comment_count by trigger (20261001180000_rc_build_social.sql).
//
// ONE REQUEST A PAGE. A page is the next rows of the build's comments, oldest
// first, top-level and replies together, each with its author embedded
// through build_comments_author_profile_fkey. A reply is always written after
// the comment it answers, so reading in time order never meets a reply before
// its comment: nestComments hangs each reply under its comment, and a caller
// holding several pages nests their rows together. The comments section
// (RC-P17) spends one request here and one on the part counts, two in all.
//
// `after`, NOT `before`. The section lists comments oldest first and pages
// forward, so the cursor is the created_at of the last row held and the next
// page is strictly newer.
//
// THE BODY NEVER LEAVES IN AN ERROR ⟦neoscale-error-monitoring › Privacy⟧. An
// empty or overlong body is refused before any request, and a refusal from the
// database is reported by its code and status only (see types.ts).

import {
  COMMENTS_PAGE_SIZE,
  COMMENT_MAX,
  SocialError,
  currentUserId,
  db,
  signedOutError,
  socialError,
  type BuildComment,
  type BuildCommentRow,
  type CommentAuthorRow,
  type CommentPage,
  type CommentThread,
} from "./types";

/** The columns a comment is drawn from. Never `*`. */
export const COMMENT_COLUMNS =
  "id, build_id, node_id, parent_id, author_id, body, is_hidden, created_at, edited_at";

/** The comment and its author, in one request. */
export const COMMENT_SELECT = `${COMMENT_COLUMNS}, author:profiles!build_comments_author_profile_fkey(id, username, display_name, avatar_url)`;

function authorOf(embed: BuildCommentRow["author"]): BuildComment["author"] {
  const row: CommentAuthorRow | null = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null);
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

/** One row, as the rest of the app holds it. */
export function toBuildComment(row: BuildCommentRow): BuildComment {
  return {
    id: row.id,
    buildId: row.build_id,
    nodeId: row.node_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    author: authorOf(row.author),
    body: row.body,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  };
}

function byTime(a: BuildComment, b: BuildComment): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Top-level comments, oldest first, each with its replies, oldest first.
 *
 * A reply whose comment is not among the rows is left out: its comment is
 * hidden from this reader, or on a page not yet read. Pass every page's rows
 * together and a reply finds its comment wherever it was read.
 */
export function nestComments(rows: readonly BuildComment[]): CommentThread[] {
  const ordered = [...rows].sort(byTime);
  const threads: CommentThread[] = [];
  const byId = new Map<string, CommentThread>();
  for (const row of ordered) {
    if (row.parentId !== null) continue;
    if (byId.has(row.id)) continue;
    const thread: CommentThread = { ...row, replies: [] };
    byId.set(row.id, thread);
    threads.push(thread);
  }
  const seen = new Set<string>();
  for (const row of ordered) {
    if (row.parentId === null || seen.has(row.id)) continue;
    const thread = byId.get(row.parentId);
    if (!thread) continue;
    seen.add(row.id);
    thread.replies.push(row);
  }
  return threads;
}

export interface ListCommentsOptions {
  /** At most this many rows, top-level and replies together; defaults to 50. */
  limit?: number;
  /** Rows strictly newer than this created_at: the last row of the page held. */
  after?: string;
}

/**
 * A page of a build's comments, oldest first, top-level comments with their
 * replies nested. One request.
 */
export async function listComments(buildId: string, options: ListCommentsOptions = {}): Promise<CommentPage> {
  const limit = Math.max(1, Math.min(options.limit ?? COMMENTS_PAGE_SIZE, 200));

  let query = db
    .from("build_comments")
    .select(COMMENT_SELECT)
    .eq("build_id", buildId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (options.after) query = query.gt("created_at", options.after);

  const response = await query;
  if (response.error) throw socialError("listComments", response, { buildId });

  const rows = ((response.data ?? []) as BuildCommentRow[]).map(toBuildComment);
  return {
    comments: nestComments(rows),
    rows,
    nextAfter: rows.length < limit ? null : (rows[rows.length - 1]?.createdAt ?? null),
  };
}

/** The most node-attached comments one count read looks at. */
export const PART_COUNT_LIMIT = 1000;

/**
 * How many comments each part of a build carries, in ONE request: the node id
 * of every comment on the build that names a part, counted here. A part with
 * none is absent. Hidden comments are counted only for the readers who can
 * see them, because row-level security decides which rows come back.
 */
export async function listPartCommentCounts(buildId: string): Promise<Record<string, number>> {
  const response = await db
    .from("build_comments")
    .select("node_id")
    .eq("build_id", buildId)
    .not("node_id", "is", null)
    .limit(PART_COUNT_LIMIT);
  if (response.error) throw socialError("listPartCommentCounts", response, { buildId });

  const counts: Record<string, number> = {};
  for (const row of (response.data ?? []) as { node_id: string | null }[]) {
    if (row.node_id) counts[row.node_id] = (counts[row.node_id] ?? 0) + 1;
  }
  return counts;
}

/** Characters as Postgres counts them (char_length), not UTF-16 units. */
function characters(text: string): number {
  return [...text].length;
}

/**
 * The body as it will be stored: trimmed, and refused when that leaves
 * nothing or more than COMMENT_MAX characters. Throws before any request.
 */
function tidyBody(operation: string, body: string, ids: { buildId?: string; commentId?: string }): string {
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length === 0 || characters(text) > COMMENT_MAX) {
    throw new SocialError(operation, "invalid", ids);
  }
  return text;
}

export interface AddCommentInput {
  buildId: string;
  /** The part the comment is about. */
  nodeId?: string | null;
  /** The top-level comment this one answers. */
  parentId?: string | null;
  body: string;
}

/**
 * Post a comment as the signed-in reader, and return it as stored.
 *
 * The body is trimmed; an empty one is refused before any request is made.
 */
export async function addComment(input: AddCommentInput): Promise<BuildComment> {
  const ids = { buildId: input.buildId, nodeId: input.nodeId ?? null, parentId: input.parentId ?? null };
  const body = tidyBody("addComment", input.body, { buildId: input.buildId });

  const userId = await currentUserId();
  if (!userId) throw signedOutError("addComment", ids);

  const response = await db
    .from("build_comments")
    .insert({
      build_id: input.buildId,
      author_id: userId,
      body,
      node_id: input.nodeId ?? null,
      parent_id: input.parentId ?? null,
    })
    .select(COMMENT_SELECT)
    .single();
  if (response.error) throw socialError("addComment", response, ids);

  return toBuildComment(response.data as BuildCommentRow);
}

/**
 * Replace a comment's body as its author, and return it as stored. Only the
 * body and edited_at are written; the database refuses anything else.
 */
export async function editComment(commentId: string, body: string): Promise<BuildComment> {
  const text = tidyBody("editComment", body, { commentId });

  const userId = await currentUserId();
  if (!userId) throw signedOutError("editComment", { commentId });

  const response = await db
    .from("build_comments")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .select(COMMENT_SELECT)
    .maybeSingle();
  if (response.error) throw socialError("editComment", response, { commentId });
  // No row back: not this reader's comment, or gone. Either way, not theirs to edit.
  if (!response.data) throw new SocialError("editComment", "no_access", { commentId });

  return toBuildComment(response.data as BuildCommentRow);
}

/**
 * Delete a comment as its author or as an admin. Its replies go with it, and
 * the build's count falls by trigger.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("deleteComment", { commentId });

  const response = await db.from("build_comments").delete().eq("id", commentId).select("id");
  if (response.error) throw socialError("deleteComment", response, { commentId });
  if (((response.data ?? []) as { id: string }[]).length === 0) {
    throw new SocialError("deleteComment", "no_access", { commentId });
  }
}
