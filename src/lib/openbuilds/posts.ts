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

export type PostScope = "everyone" | "following" | "spaces";

export interface ListPostsOptions {
  /** One space's root posts. Without it, every root post that is in a space. */
  spaceId?: string;
  /** everyone: every topic. following: the signed-in reader's own, the people they follow and the spaces they belong to. spaces (UX-05): only topics in the spaces the reader belongs to. */
  scope: PostScope;
  /** Only posts still waiting for an answer. */
  stillOpen?: boolean;
  /** The space's order setting, read by the caller with getSpace. most_replied sorts by the topic's stored reply count. */
  order?: SpaceOrder;
  /** UX-05: a moderator's read of a space: hidden topics come too (the database lets only moderators read them). */
  includeHidden?: boolean;
  offset?: number;
  limit?: number;
}

export interface PostsPage {
  posts: Post[];
  /** The offset of the next page, or null at the end. */
  next: number | null;
}

/** A space's topics are the root entries in that space (an inner join); every other list includes the topics that are in none. */
const listSelect = (inSpace: boolean) =>
  `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, post_spaces${inSpace ? "!inner" : ""}(space:spaces(id, slug, name))`;

/**
 * Topics, a page at a time. Everyone is every topic that is not hidden, in a space or in none; a space is that space's topics; Following
 * is the reader's own, the people they follow and the spaces they belong to, and only those (three small reads first, started together).
 */
export async function listPosts(options: ListPostsOptions): Promise<PostsPage> {
  const limit = pageLimit(options.limit);
  const from = Math.max(0, options.offset ?? 0);

  let authors: string[] | null = null;
  let inMySpaces: string[] = [];
  if (options.scope === "following") {
    const me = await currentUserId();
    if (!me) throw signedOut("listPosts");
    const [follows, member] = await Promise.all([
      db.from("follows").select("following_id").eq("follower_id", me).limit(1000),
      db.from("space_members").select("space_id").eq("user_id", me).limit(100),
    ]);
    if (follows.error) throw postLayerError("listPosts", follows);
    if (member.error) throw postLayerError("listPosts", member);
    authors = unique([me, ...((follows.data ?? []) as { following_id: string }[]).map((row) => row.following_id)]);
    const spaceIds = unique(((member.data ?? []) as { space_id: string }[]).map((row) => row.space_id));
    if (spaceIds.length) {
      const linked = await db.from("post_spaces").select("post_id").in("space_id", spaceIds).order("created_at", { ascending: false }).limit(200);
      if (linked.error) throw postLayerError("listPosts", linked);
      inMySpaces = unique(((linked.data ?? []) as { post_id: string }[]).map((row) => row.post_id));
    }
  }

  // UX-05: the spaces tab. The reader's spaces first; none means nothing to read.
  let mySpaceIds: string[] | null = null;
  if (options.scope === "spaces") {
    const me = await currentUserId();
    if (!me) throw signedOut("listPosts");
    const member = await db.from("space_members").select("space_id").eq("user_id", me).limit(100);
    if (member.error) throw postLayerError("listPosts", member);
    mySpaceIds = unique(((member.data ?? []) as { space_id: string }[]).map((row) => row.space_id));
    if (mySpaceIds.length === 0) return { posts: [], next: null };
  }

  let query = db.from("openbuild_posts").select(listSelect(Boolean(options.spaceId) || mySpaceIds !== null)).is("parent_id", null);
  if (!options.includeHidden) query = query.is("hidden_by", null);
  if (options.spaceId) query = query.eq("post_spaces.space_id", options.spaceId);
  if (mySpaceIds) query = query.in("post_spaces.space_id", mySpaceIds);
  if (authors) query = inMySpaces.length ? query.or(`author_id.in.(${authors.join(",")}),id.in.(${inMySpaces.join(",")})`) : query.in("author_id", authors);
  if (options.stillOpen) query = query.eq("still_open", true);
  if (options.order === "pinned_first") query = query.order("pinned_at", { ascending: false, nullsFirst: false });
  if (options.order === "most_replied") query = query.order("reply_count", { ascending: false });
  query = query.order("created_at", { ascending: false });

  const response = await query.range(from, from + limit - 1);
  if (response.error) throw postLayerError("listPosts", response);
  const rows = (response.data ?? []) as unknown as PostRow[];
  return { posts: rows.map(toPost), next: rows.length < limit ? null : from + rows.length };
}

const REPLY_SELECT = `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}`;
const THREAD_SELECT = `${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, ${SPACES_EMBED}, replies:openbuild_posts!openbuild_posts_parent_id_fkey(${REPLY_SELECT}, replies:openbuild_posts!openbuild_posts_parent_id_fkey(${REPLY_SELECT}))`;

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
    .from("openbuild_posts")
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

  const edges = await db.from("openbuild_posts").select("id, parent_id").eq("root_id", row.root_id).limit(THREAD_EDGES_MAX);
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
  if (response.error) throw postLayerError(operation, response, operation === "createReply" ? "You can't reply there." : "You can't start a topic there.");
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
  const response = await db.from("openbuild_posts").update(patch).eq("id", postId).select("id").limit(1);
  if (response.error) throw postLayerError("editPost", response, "That reward isn't allowed in this space.");
  if (!((response.data as unknown[] | null) ?? []).length) throw new PostError("editPost", "Only the author can edit a topic or reply.");
}

async function moderate(operation: string, postId: string, patch: (userId: string) => Record<string, unknown>): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut(operation);
  const response = await db.from("openbuild_posts").update(patch(userId)).eq("id", postId).select("id").limit(1);
  if (response.error) throw postLayerError(operation, response);
  if (!((response.data as unknown[] | null) ?? []).length) throw new PostError(operation, "Only the topic's author or a moderator can do that.");
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

/** UX-07 P7: take back the signed-in user's own reaction of a kind. Taking back one that is not there is not an error. */
export async function removeReaction(postId: string, kind: PostReaction["kind"]): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("removeReaction");
  const response = await db.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId).eq("kind", kind);
  if (response.error) throw postLayerError("removeReaction", response);
}

export { POSTS_PAGE_SIZE };

/* ── what a reader has seen ── */

/** A reader's mark on a topic is written at most once a minute per topic. */
export const TOPIC_SEEN_EVERY_MS = 60_000;
const lastMarked = new Map<string, number>();

/**
 * Note that the signed-in reader has just opened a topic (topic_reads.seen_at = now), at most once a minute per topic: a call inside the
 * minute does nothing. Private to the reader. Returns whether a write was made.
 */
export async function markTopicSeen(rootId: string, now: number = Date.now()): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const key = `${userId}:${rootId}`;
  const last = lastMarked.get(key);
  if (last !== undefined && now - last < TOPIC_SEEN_EVERY_MS) return false;
  lastMarked.set(key, now);
  const response = await db
    .from("topic_reads")
    .upsert({ user_id: userId, root_id: rootId, seen_at: new Date(now).toISOString() }, { onConflict: "user_id,root_id" });
  if (response.error) {
    lastMarked.delete(key);
    throw postLayerError("markTopicSeen", response);
  }
  return true;
}

/** Most topics asked about at once, and the most new replies counted for one. */
const NEW_COUNT_TOPICS_MAX = 50;
const NEW_COUNT_PER_TOPIC = 100;

/**
 * How many replies are new to the signed-in reader on each of these topics: replies created after the reader's mark and not written by
 * them, up to 100. A topic with no mark has none new. The reader's own, so it is asked for apart from the Everyone feed, whose answer is
 * the same for everybody.
 */
export async function getNewReplyCounts(rootIds: readonly string[]): Promise<Record<string, number>> {
  const userId = await currentUserId();
  const ids = unique(rootIds).slice(0, NEW_COUNT_TOPICS_MAX);
  if (!userId || !ids.length) return {};
  const marks = await db.from("topic_reads").select("root_id, seen_at").eq("user_id", userId).in("root_id", ids).limit(NEW_COUNT_TOPICS_MAX);
  if (marks.error) throw postLayerError("getNewReplyCounts", marks);
  const rows = (marks.data ?? []) as { root_id: string; seen_at: string }[];
  const counts = await Promise.all(
    rows.map(async (mark) => {
      const response = await db
        .from("openbuild_posts")
        .select("id")
        .eq("root_id", mark.root_id)
        .not("parent_id", "is", null)
        .is("hidden_by", null)
        .neq("author_id", userId)
        .gt("created_at", mark.seen_at)
        .limit(NEW_COUNT_PER_TOPIC);
      if (response.error) throw postLayerError("getNewReplyCounts", response);
      return [mark.root_id, ((response.data as unknown[] | null) ?? []).length] as const;
    }),
  );
  return Object.fromEntries(counts);
}
