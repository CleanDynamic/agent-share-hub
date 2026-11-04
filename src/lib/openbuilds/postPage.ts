// What the post page reads beyond `getPost` (UX-06): one round of parallel reads that need the post's ids.
//
//   * the work the post and its replies name (readCardWork, as the cards read it) and the pictures they carry;
//   * the facts the Wall draws for each build in a reply: its maker's build it was rebuilt from (`parent_build_id`, with the handle
//     frozen at fork time) and the top-level steps with their words, so Line up steps can compare kind and text;
//   * which of the posts the reader liked;
//   * the post's first space, with its maker, moderators, members and the reader's role (getSpaceCrowd).
//
// Named columns, a limit on every list, nothing read in a loop.

import { currentUserId } from "@/lib/social/types";

import { readCardWork, type CardWork } from "./cardWork";
import { signEntryMedia } from "./media";
import { getSpaceCrowd, type SpaceCrowd } from "./spacesFeed";
import { db, postLayerError, unique, type Post, type PostThread } from "./types";

/** The most top-level steps read per build for Line up steps. */
const LINE_ROWS_PER_BUILD = 200;

/** The post and every reply under it, the post first, then the replies in the order they are held. */
export function flattenThread(thread: PostThread): Post[] {
  const out: Post[] = [];
  const walk = (node: PostThread) => {
    out.push(node);
    for (const reply of node.replies) walk(reply);
  };
  walk(thread);
  return out;
}

export interface WallBuildFacts {
  id: string;
  slug: string | null;
  title: string | null;
  status: string;
  creatorId: string;
  /** The build it was rebuilt from, or null for a new build. */
  parentBuildId: string | null;
  /** The source maker's handle as it was when the rebuild was made. */
  sourceHandle: string | null;
}

/** A top-level step, with the words Line up steps compares. */
export interface LineStepRow {
  id: string;
  build_id: string;
  parent_id: string | null;
  type: string;
  title: string | null;
  position: number | null;
  is_gap: boolean;
  tested: unknown;
  setup: unknown;
  step: unknown;
  /** A prompt's words. */
  text: string | null;
  /** A code step's lines. */
  source: string | null;
}

export interface PostPageExtras {
  work: CardWork;
  signed: Map<string, string>;
  facts: Map<string, WallBuildFacts>;
  steps: Map<string, LineStepRow[]>;
  /** The posts the reader liked. Empty signed out. */
  liked: Set<string>;
  crowd: SpaceCrowd | null;
}

const FACT_COLUMNS = "id, slug, title, status, creator_id, parent_build_id, source_handle_at_fork";
const LINE_COLUMNS =
  "id, build_id, parent_id, type, title, position, is_gap, tested:payload->tested, setup:payload->setup, step:payload->step, text:payload->>text, source:payload->>source";

/** The published builds the post and its replies attach by reference (a copy from a draft carries its own snapshot). */
export function attachedBuildIds(posts: readonly Post[]): string[] {
  return unique(posts.flatMap((post) => post.attachments.flatMap((attachment) => (attachment.kind === "build" && attachment.buildId && !attachment.snapshot ? [attachment.buildId] : []))));
}

/** The posts the signed-in reader liked, of these. */
export async function listMyLikes(postIds: readonly string[]): Promise<Set<string>> {
  const ids = unique(postIds);
  const userId = await currentUserId();
  if (!userId || ids.length === 0) return new Set();
  const response = await db.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", ids).limit(ids.length);
  if (response.error) throw postLayerError("listMyLikes", response);
  return new Set(((response.data ?? []) as { post_id: string }[]).map((row) => row.post_id));
}

/** Everything the page needs once the post is in, started together: one round. */
export async function readPostExtras(thread: PostThread, viewerId: string | null): Promise<PostPageExtras> {
  const posts = flattenThread(thread);
  const builds = attachedBuildIds(posts);
  const media = posts.flatMap((post) => post.attachments.flatMap((attachment) => (attachment.kind === "media" && attachment.mediaPath ? [{ path: attachment.mediaPath, mediaKind: attachment.mediaKind ?? ("file" as const) }] : [])));
  const space = thread.spaces[0] ?? null;

  const [work, signed, facts, steps, liked, crowd] = await Promise.all([
    readCardWork(posts),
    media.length ? signEntryMedia(media) : Promise.resolve(new Map<string, string>()),
    builds.length ? db.from("builds").select(FACT_COLUMNS).in("id", builds).limit(builds.length) : Promise.resolve({ data: [], error: null }),
    builds.length
      ? db.from("build_nodes").select(LINE_COLUMNS).in("build_id", builds).is("parent_id", null).order("position", { ascending: true }).limit(LINE_ROWS_PER_BUILD * builds.length)
      : Promise.resolve({ data: [], error: null }),
    viewerId ? listMyLikes(posts.map((post) => post.id)) : Promise.resolve(new Set<string>()),
    space ? getSpaceCrowd(space.slug, viewerId) : Promise.resolve(null),
  ]);
  if (facts.error) throw postLayerError("readPostExtras", facts);
  if (steps.error) throw postLayerError("readPostExtras", steps);

  const factMap = new Map<string, WallBuildFacts>();
  for (const row of (facts.data ?? []) as { id: string; slug: string | null; title: string | null; status: string; creator_id: string; parent_build_id: string | null; source_handle_at_fork: string | null }[]) {
    factMap.set(row.id, { id: row.id, slug: row.slug, title: row.title, status: row.status, creatorId: row.creator_id, parentBuildId: row.parent_build_id, sourceHandle: row.source_handle_at_fork });
  }
  const stepMap = new Map<string, LineStepRow[]>();
  for (const row of (steps.data ?? []) as LineStepRow[]) stepMap.set(row.build_id, [...(stepMap.get(row.build_id) ?? []), row]);
  return { work, signed, facts: factMap, steps: stepMap, liked, crowd };
}

