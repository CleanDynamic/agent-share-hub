// Where posts travel (UX-04 Part 7): the posts about a build, the posts by a person, and how many started from a build.

import { readCardExtras, type CardExtras } from "./cardWork";
import { AUTHOR_EMBED, ATTACHMENTS_EMBED, POST_COLUMNS, SPACES_EMBED, db, pageLimit, postLayerError, toPost, unique, type Post, type PostRow } from "./types";

export interface PostsAbout {
  /** Posts and replies about the build or one of its steps, newest first. */
  posts: Post[];
  /** How many posts and replies are about each step, by the step's id. */
  countsByStep: Record<string, number>;
}

/** The most posts listed on a build page, and the most links read to count per step. */
export const ABOUT_POSTS_LIMIT = 50;
const ABOUT_COUNT_LIMIT = 1000;

/** Posts and replies about a build or its steps, with counts per step: two requests, started together. */
export async function listPostsAbout(buildId: string): Promise<PostsAbout> {
  const [list, steps] = await Promise.all([
    db
      .from("openbuild_posts")
      .select(`${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, ${SPACES_EMBED}`)
      .eq("about_build_id", buildId)
      .is("hidden_by", null)
      .order("created_at", { ascending: false })
      .limit(ABOUT_POSTS_LIMIT),
    db.from("openbuild_posts").select("about_node_id").eq("about_build_id", buildId).not("about_node_id", "is", null).is("hidden_by", null).limit(ABOUT_COUNT_LIMIT),
  ]);
  if (list.error) throw postLayerError("listPostsAbout", list);
  if (steps.error) throw postLayerError("listPostsAbout", steps);

  const countsByStep: Record<string, number> = {};
  for (const row of (steps.data ?? []) as { about_node_id: string | null }[]) {
    if (row.about_node_id) countsByStep[row.about_node_id] = (countsByStep[row.about_node_id] ?? 0) + 1;
  }
  return { posts: ((list.data ?? []) as unknown as PostRow[]).map(toPost), countsByStep };
}

export interface PostsBy {
  posts: Post[];
  next: number | null;
}

/** A person's root posts and replies, newest first, a page at a time. */
export async function listPostsBy(userId: string, options: { offset?: number; limit?: number } = {}): Promise<PostsBy> {
  const limit = pageLimit(options.limit);
  const from = Math.max(0, options.offset ?? 0);
  const response = await db
    .from("openbuild_posts")
    .select(`${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, ${SPACES_EMBED}`)
    .eq("author_id", userId)
    .is("hidden_by", null)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (response.error) throw postLayerError("listPostsBy", response);
  const rows = (response.data ?? []) as unknown as PostRow[];
  return { posts: rows.map(toPost), next: rows.length < limit ? null : from + rows.length };
}

/**
 * About how many root posts started from a build: root posts with an attachment from it. The number is shown as "about", so the count
 * is the planner's estimate; a post that attaches two things from one build is counted twice.
 */
export async function countPostsStartedFrom(buildId: string): Promise<number> {
  const response = await db
    .from("post_attachments")
    .select("post_id, openbuild_posts!inner(parent_id)", { count: "estimated", head: true })
    .eq("build_id", buildId)
    .is("openbuild_posts.parent_id", null);
  if (response.error) throw postLayerError("countPostsStartedFrom", response);
  return response.count ?? 0;
}

/* ── UX-07 Part 2: the build page's Discussed in OpenBuilds ── */

export interface TopicsAbout {
  /** Topics about the build or one of its steps, and topics started from it, once each, newest first. */
  topics: Post[];
  /** Topics about the build or its steps. */
  aboutCount: number;
  /** Replies about the build or its steps. */
  replyCount: number;
  /** Topics started from the build (a root post attaching it, or a part of it), exact up to ABOUT_POSTS_LIMIT. */
  startedCount: number;
  /** For each step with replies about it: how many, and the topic with the most of them. */
  stepReplies: Map<string, { count: number; rootId: string }>;
  /** Whether the maker lets other people start a topic from the build (builds.allow_as_post_source). */
  allowsTopics: boolean;
}

/** The started-from read: root posts attaching the build, the post embedded with what a row names. */
const STARTED_SELECT = `post_id, post:openbuild_posts!inner(${POST_COLUMNS}, ${AUTHOR_EMBED}, ${SPACES_EMBED})`;

/** Replies about each step, and the topic that holds most of them. */
export function stepRepliesOf(posts: readonly Post[]): Map<string, { count: number; rootId: string }> {
  const byStep = new Map<string, Map<string, number>>();
  for (const post of posts) {
    if (!post.parentId || !post.aboutNodeId) continue;
    const roots = byStep.get(post.aboutNodeId) ?? new Map<string, number>();
    roots.set(post.rootId, (roots.get(post.rootId) ?? 0) + 1);
    byStep.set(post.aboutNodeId, roots);
  }
  const out = new Map<string, { count: number; rootId: string }>();
  for (const [step, roots] of byStep) {
    let best: [string, number] | null = null;
    let count = 0;
    for (const entry of roots) {
      count += entry[1];
      if (!best || entry[1] > best[1]) best = entry;
    }
    if (best) out.set(step, { count, rootId: best[0] });
  }
  return out;
}

/** Everything the build page says about where the build is discussed: three requests, started together, one round. */
export async function listTopicsAbout(buildId: string): Promise<TopicsAbout> {
  const [about, started, allow] = await Promise.all([
    listPostsAbout(buildId),
    db.from("post_attachments").select(STARTED_SELECT).eq("build_id", buildId).is("post.parent_id", null).is("post.hidden_by", null).limit(ABOUT_POSTS_LIMIT),
    db.from("builds").select("allow_as_post_source").eq("id", buildId).limit(1).maybeSingle(),
  ]);
  if (started.error) throw postLayerError("listTopicsAbout", started);
  if (allow.error) throw postLayerError("listTopicsAbout", allow);

  const startedPosts = ((started.data ?? []) as unknown as { post: PostRow | null }[]).flatMap((row) => (row.post ? [toPost(row.post)] : []));
  const roots = about.posts.filter((post) => post.parentId === null);
  const seen = new Set<string>();
  const topics = [...roots, ...startedPosts]
    .filter((post) => (seen.has(post.id) ? false : (seen.add(post.id), true)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    topics,
    aboutCount: roots.length,
    replyCount: about.posts.length - roots.length,
    startedCount: unique(startedPosts.map((post) => post.id)).length,
    stepReplies: stepRepliesOf(about.posts),
    allowsTopics: (allow.data as { allow_as_post_source?: boolean } | null)?.allow_as_post_source !== false,
  };
}

/* ── UX-07 Part 3: a profile's Topics tab ── */

export interface TopicRoot {
  id: string;
  handle: string | null;
  body: string;
}

export interface TopicsBy extends PostsBy {
  /** The topics the person's replies are in, by id: who started each and its words (for `Replied to @maya · <heading>`). */
  roots: Map<string, TopicRoot>;
  extras: CardExtras;
}

/** A person's topics and replies, newest first, with what their cards need: the page, then its extras and the replies' topics together. */
export async function listTopicsBy(userId: string, options: { offset?: number; limit?: number } = {}): Promise<TopicsBy> {
  const page = await listPostsBy(userId, options);
  const rootIds = unique(page.posts.flatMap((post) => (post.parentId ? [post.rootId] : [])));
  const [extras, roots] = await Promise.all([
    readCardExtras(page.posts),
    rootIds.length
      ? db.from("openbuild_posts").select(`id, body, ${AUTHOR_EMBED}`).in("id", rootIds).limit(rootIds.length)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (roots.error) throw postLayerError("listTopicsBy", roots);
  const byId = new Map<string, TopicRoot>();
  for (const row of (roots.data ?? []) as unknown as { id: string; body: string; author: { username: string | null } | null }[]) {
    byId.set(row.id, { id: row.id, handle: row.author?.username ?? null, body: row.body });
  }
  return { ...page, roots: byId, extras };
}
