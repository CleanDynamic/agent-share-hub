// Posts and replies (UX-04 Parts 2, 4 and 7): reading, writing, moderating and reacting.
//
// One shape of read: named columns, a limit on every list, and the author, the attachments and the spaces embedded so that a page is
// one request. The database is the judge of every write; this module sends the writer's own id and says the refusal in words.

import { currentUserId } from "@/lib/social/types";
import { attachmentPayload, type AttachmentInput } from "./attach";
import {
  ATTACHMENTS_EMBED,
  AUTHOR_EMBED,
  POSTS_PAGE_SIZE,
  POST_COLUMNS,
  PostError,
  SPACES_EMBED,
  db,
  pageLimit,
  postLayerError,
  signedOut,
  toPost,
  unique,
  type Post,
  type PostRow,
  type PostThread,
  type SpaceOrder,
} from "./types";

export type PostScope = "everyone" | "following";

export interface ListPostsOptions {
  /** One space's root posts. Without it, every root post that is in a space. */
  spaceId?: string;
  /** everyone: whoever posted. following: the signed-in reader's own posts and those of the people they follow. */
  scope: PostScope;
  /** Only posts still waiting for an answer. */
  stillOpen?: boolean;
  /** The space's order setting, read by the caller with getSpace. 'most_replied' needs a stored reply count the database does not keep yet, and reads as newest. */
  order?: SpaceOrder;
  offset?: number;
  limit?: number;
}

export interface PostsPage {
  posts: Post[];
  /** The offset of the next page, or null at the end. */
  next: number | null;
}

/** A space's posts, or Everyone's, are the root posts that are in a space (an inner join); a person's own and followed posts include those in none. */
const listSelect = (inSpace: boolean) =>
  `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, post_spaces${inSpace ? "!inner" : ""}(space:spaces(id, slug, name)), thread:posts!posts_root_id_fkey(count)`;

/** Root posts, a page at a time. Following reads the people first (one more request); everything else is one. */
export async function listPosts(options: ListPostsOptions): Promise<PostsPage> {
  const limit = pageLimit(options.limit);
  const from = Math.max(0, options.offset ?? 0);

  let authors: string[] | null = null;
  if (options.scope === "following") {
    const me = await currentUserId();
    if (!me) throw signedOut("listPosts");
    const follows = await db.from("follows").select("following_id").eq("follower_id", me).limit(1000);
    if (follows.error) throw postLayerError("listPosts", follows);
    authors = unique([me, ...((follows.data ?? []) as { following_id: string }[]).map((row) => row.following_id)]);
  }

  let query = db.from("posts").select(listSelect(Boolean(options.spaceId) || options.scope === "everyone")).is("parent_id", null).is("hidden_by", null);
  if (options.spaceId) query = query.eq("post_spaces.space_id", options.spaceId);
  if (authors) query = query.in("author_id", authors);
  if (options.stillOpen) query = query.eq("still_open", true);
  if (options.order === "pinned_first") query = query.order("pinned_at", { ascending: false, nullsFirst: false });
  query = query.order("created_at", { ascending: false });

  const response = await query.range(from, from + limit - 1);
  if (response.error) throw postLayerError("listPosts", response);
  const rows = (response.data ?? []) as unknown as PostRow[];
  return { posts: rows.map(toPost), next: rows.length < limit ? null : from + rows.length };
}

const REPLY_SELECT = `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}`;
const THREAD_SELECT = `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, ${SPACES_EMBED}, replies:posts!posts_parent_id_fkey(${REPLY_SELECT}, replies:posts!posts_parent_id_fkey(${REPLY_SELECT}))`;

/** The most replies read at the first level, and under each of those. */
export const FIRST_LEVEL_REPLIES = 50;
export const SECOND_LEVEL_REPLIES = 20;
/** The most links read to count the deeper replies. */
const THREAD_EDGES_MAX = 1000;

/**
 * One post with its replies two levels deep, their attachments and authors, and the number of replies under each at every depth. At
 * most two requests: the post with its replies embedded, then the thread's (id, parent) pairs to count what lies deeper. Null when
 * there is no such post, or the reader cannot read it.
 */
export async function getPost(id: string): Promise<PostThread | null> {
  const first = await db
    .from("posts")
    .select(THREAD_SELECT)
    .eq("id", id)
    .order("created_at", { referencedTable: "replies", ascending: true })
    .limit(FIRST_LEVEL_REPLIES, { referencedTable: "replies" })
    .order("created_at", { referencedTable: "replies.replies", ascending: true })
    .limit(SECOND_LEVEL_REPLIES, { referencedTable: "replies.replies" })
    .limit(1)
    .maybeSingle();
  if (first.error) throw postLayerError("getPost", first);
  const row = first.data as unknown as PostRow | null;
  if (!row) return null;

  const edges = await db.from("posts").select("id, parent_id").eq("root_id", row.root_id).limit(THREAD_EDGES_MAX);
  if (edges.error) throw postLayerError("getPost", edges);
  const children = new Map<string, string[]>();
  for (const edge of (edges.data ?? []) as { id: string; parent_id: string | null }[]) {
    if (edge.parent_id) children.set(edge.parent_id, [...(children.get(edge.parent_id) ?? []), edge.id]);
  }
  const below = (postId: string): number => (children.get(postId) ?? []).reduce((sum, child) => sum + 1 + below(child), 0);

  const build = (node: PostRow): PostThread => ({
    ...toPost(node),
    replyCount: below(node.id),
    replies: (node.replies ?? []).map(build),
  });
  return build(row);
}

/* ── writing ── */

export interface PostInput {
  body?: string;
  spaceIds?: string[];
  attachments?: AttachmentInput[];
  aboutBuildId?: string | null;
  aboutNodeId?: string | null;
  /** Pounds. Refused unless every space the post is in allows rewards. */
  rewardGbp?: number | null;
  stillOpen?: boolean;
  tags?: string[];
  closesAt?: string | null;
  mentionIds?: string[];
}

export interface ReplyInput {
  parentId: string;
  body?: string;
  attachments?: AttachmentInput[];
  aboutBuildId?: string | null;
  aboutNodeId?: string | null;
  mentionIds?: string[];
}

async function write(operation: string, payload: Record<string, unknown>, attachments: AttachmentInput[] | undefined): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw signedOut(operation);
  const body = { ...payload, attachments: await Promise.all((attachments ?? []).map(attachmentPayload)) };
  const response = await db.rpc("create_post", { p: body });
  if (response.error) throw postLayerError(operation, response, "You can't post there.");
  return response.data as string;
}

/** Start a post as the signed-in user, with its spaces, attachments and mentions in one transaction. Returns its id. */
export function createPost(input: PostInput): Promise<string> {
  return write(
    "createPost",
    {
      body: input.body ?? "",
      space_ids: unique(input.spaceIds ?? []),
      about_build_id: input.aboutBuildId ?? null,
      about_node_id: input.aboutNodeId ?? null,
      reward_gbp: input.rewardGbp ?? null,
      still_open: input.stillOpen ?? false,
      tags: input.tags ?? [],
      closes_at: input.closesAt ?? null,
      mention_ids: unique(input.mentionIds ?? []),
    },
    input.attachments,
  );
}

/** Reply to a post or a reply as the signed-in user. A reply attaches only the replier's own work; the database says so in words. */
export function createReply(input: ReplyInput): Promise<string> {
  return write(
    "createReply",
    {
      parent_id: input.parentId,
      body: input.body ?? "",
      about_build_id: input.aboutBuildId ?? null,
      about_node_id: input.aboutNodeId ?? null,
      mention_ids: unique(input.mentionIds ?? []),
    },
    input.attachments,
  );
}

export interface PostEdit {
  body?: string;
  tags?: string[];
  aboutBuildId?: string | null;
  aboutNodeId?: string | null;
  rewardGbp?: number | null;
  stillOpen?: boolean;
  closesAt?: string | null;
}

/** Change a post's own fields. Only its author can. */
export async function editPost(postId: string, edit: PostEdit): Promise<void> {
  const patch = {
    ...(edit.body !== undefined ? { body: edit.body } : null),
    ...(edit.tags !== undefined ? { tags: edit.tags } : null),
    ...(edit.aboutBuildId !== undefined ? { about_build_id: edit.aboutBuildId } : null),
    ...(edit.aboutNodeId !== undefined ? { about_node_id: edit.aboutNodeId } : null),
    ...(edit.rewardGbp !== undefined ? { reward_gbp: edit.rewardGbp } : null),
    ...(edit.stillOpen !== undefined ? { still_open: edit.stillOpen } : null),
    ...(edit.closesAt !== undefined ? { closes_at: edit.closesAt } : null),
  };
  const response = await db.from("posts").update(patch).eq("id", postId).select("id").limit(1);
  if (response.error) throw postLayerError("editPost", response, "That reward isn't allowed in this space.");
  if (!((response.data as unknown[] | null) ?? []).length) throw new PostError("editPost", "Only the author can edit a post.");
}

async function moderate(operation: string, postId: string, patch: (userId: string) => Record<string, unknown>): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut(operation);
  const response = await db.from("posts").update(patch(userId)).eq("id", postId).select("id").limit(1);
  if (response.error) throw postLayerError(operation, response);
  if (!((response.data as unknown[] | null) ?? []).length) throw new PostError(operation, "Only the post's author or a moderator can do that.");
}

/** Pin a post as its root's author or a moderator of its space. */
export const pinPost = (postId: string) => moderate("pinPost", postId, (userId) => ({ pinned_by: userId }));
export const unpinPost = (postId: string) => moderate("unpinPost", postId, () => ({ pinned_by: null }));
/** Hide a post as its root's author or a moderator of its space. It leaves every feed and page but theirs and its author's. */
export const hidePost = (postId: string, reason?: string) =>
  moderate("hidePost", postId, (userId) => ({ hidden_by: userId, hidden_reason: reason?.trim() || null }));
export const unhidePost = (postId: string) => moderate("unhidePost", postId, () => ({ hidden_by: null }));

/* ── liking and reacting ── */

/** Like as the signed-in user. Liking twice is not an error. */
export async function likePost(postId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("likePost");
  const response = await db.from("post_likes").insert({ post_id: postId, user_id: userId });
  if (response.error && response.error.code !== "23505") throw postLayerError("likePost", response);
}

export async function unlikePost(postId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("unlikePost");
  const response = await db.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  if (response.error) throw postLayerError("unlikePost", response);
}

export type PostReaction = { kind: "dislike" } | { kind: "rating"; value: 1 | 2 | 3 | 4 | 5 };

/** React as the signed-in user, replacing their earlier reaction of that kind. Refused in words where the space has not switched it on. */
export async function reactToPost(postId: string, reaction: PostReaction): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("reactToPost");
  const response = await db
    .from("post_reactions")
    .upsert({ post_id: postId, user_id: userId, kind: reaction.kind, value: reaction.kind === "rating" ? reaction.value : null }, { onConflict: "post_id,user_id,kind" });
  if (response.error) throw postLayerError("reactToPost", response);
}

export { POSTS_PAGE_SIZE };
