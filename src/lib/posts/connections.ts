// Where posts travel (UX-04 Part 7): the posts about a build, the posts by a person, and how many started from a build.

import { AUTHOR_EMBED, ATTACHMENTS_EMBED, POST_COLUMNS, db, pageLimit, postLayerError, toPost, type Post, type PostRow } from "./types";

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
      .from("posts")
      .select(`${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}`)
      .eq("about_build_id", buildId)
      .is("hidden_by", null)
      .order("created_at", { ascending: false })
      .limit(ABOUT_POSTS_LIMIT),
    db.from("posts").select("about_node_id").eq("about_build_id", buildId).not("about_node_id", "is", null).is("hidden_by", null).limit(ABOUT_COUNT_LIMIT),
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
    .from("posts")
    .select(`${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}`)
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
    .select("post_id, posts!inner(parent_id)", { count: "estimated", head: true })
    .eq("build_id", buildId)
    .is("posts.parent_id", null);
  if (response.error) throw postLayerError("countPostsStartedFrom", response);
  return response.count ?? 0;
}
