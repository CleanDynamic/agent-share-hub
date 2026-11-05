// What the post page reads beyond `getPost` (UX-06): one round of parallel reads that need the post's ids.
//
//   * the work the post and its replies name (readCardWork, as the cards read it) and the pictures they carry;
//   * the facts the Wall draws for each build in a reply: its maker's build it was rebuilt from (`parent_build_id`, with the handle
//     frozen at fork time) and the top-level steps with their words, so Line up steps can compare kind and text;
//   * which of the posts the reader liked;
//   * the post's first space, with its maker, moderators, members and the reader's role, read by the id the post already carries,
//     all in the same round (`readSpaceCrowd`; getSpaceCrowd, which starts from a slug, takes up to three in a row).
//
// Named columns, a limit on every list, nothing read in a loop.

import { currentUserId } from "@/lib/social/types";

import { readCardWork, type CardWork } from "./cardWork";
import { signEntryMedia } from "./media";
import type { SpaceCrowd } from "./spacesFeed";
import { SPACE_COLUMNS, db, postLayerError, toSpace, unique, type Post, type PostThread, type SpaceReaction, type SpaceRow } from "./types";

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
  /** UX-07 P7: the extra reactions every one of the topic's spaces switched on (none for a topic in no space). Absent: none. */
  reactionKinds?: SpaceReaction[];
  /** UX-07 P7: each post's reactions, by its id. Read only when a kind is on. */
  reactions?: Map<string, PostReactions>;
}

/** UX-07 P7: one post's dislikes and ratings, and the reader's own. */
export interface PostReactions {
  dislikes: number;
  disliked: boolean;
  ratings: number;
  /** The mean of the ratings, or null with none. */
  average: number | null;
  /** The reader's own rating, 1 to 5. */
  mine: number | null;
}

export const NO_REACTIONS: PostReactions = { dislikes: 0, disliked: false, ratings: 0, average: null, mine: null };

/** The kinds every space switched on: a topic in several spaces shows a reaction only if all of them allow it. */
export function enabledReactions(spaces: readonly { reactions: readonly SpaceReaction[] }[]): SpaceReaction[] {
  if (spaces.length === 0) return [];
  return (["dislike", "rating"] as const).filter((kind) => spaces.every((space) => space.reactions.includes(kind)));
}

/** The reaction rows folded per post. */
export function foldReactions(rows: readonly { post_id: string; user_id: string; kind: string; value: number | null }[], viewerId: string | null): Map<string, PostReactions> {
  const sums = new Map<string, { total: number } & PostReactions>();
  for (const row of rows) {
    const entry = sums.get(row.post_id) ?? { ...NO_REACTIONS, total: 0 };
    if (row.kind === "dislike") {
      entry.dislikes += 1;
      if (row.user_id === viewerId) entry.disliked = true;
    } else if (row.kind === "rating" && typeof row.value === "number") {
      entry.ratings += 1;
      entry.total += row.value;
      if (row.user_id === viewerId) entry.mine = row.value;
    }
    sums.set(row.post_id, entry);
  }
  return new Map([...sums].map(([id, { total, ...entry }]) => [id, { ...entry, average: entry.ratings > 0 ? total / entry.ratings : null }]));
}

/** The most reaction rows one thread reads. */
const REACTION_ROWS = 2000;

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

  const spaceIds = thread.spaces.map((entry) => entry.id);
  const [work, signed, facts, steps, liked, crowd, spaceReactions, reactionRows] = await Promise.all([
    readCardWork(posts),
    media.length ? signEntryMedia(media) : Promise.resolve(new Map<string, string>()),
    builds.length ? db.from("builds").select(FACT_COLUMNS).in("id", builds).limit(builds.length) : Promise.resolve({ data: [], error: null }),
    builds.length
      ? db.from("build_nodes").select(LINE_COLUMNS).in("build_id", builds).is("parent_id", null).order("position", { ascending: true }).limit(LINE_ROWS_PER_BUILD * builds.length)
      : Promise.resolve({ data: [], error: null }),
    viewerId ? listMyLikes(posts.map((post) => post.id)) : Promise.resolve(new Set<string>()),
    space ? readSpaceCrowd(space.id, viewerId) : Promise.resolve(null),
    // UX-07 P7: every space's switched-on reactions, and the thread's reactions, beside the rest: no round of their own.
    spaceIds.length ? db.from("spaces").select("id, reactions").in("id", spaceIds).limit(spaceIds.length) : Promise.resolve({ data: [], error: null }),
    spaceIds.length ? db.from("post_reactions").select("post_id, user_id, kind, value").in("post_id", posts.map((post) => post.id)).limit(REACTION_ROWS) : Promise.resolve({ data: [], error: null }),
  ]);
  if (facts.error) throw postLayerError("readPostExtras", facts);
  if (spaceReactions.error) throw postLayerError("readPostExtras", spaceReactions);
  if (reactionRows.error) throw postLayerError("readPostExtras", reactionRows);
  const spaces = ((spaceReactions.data ?? []) as { id: string; reactions: SpaceReaction[] | null }[]).map((row) => ({ reactions: row.reactions ?? [] }));
  // A space the reader cannot read counts as one that switched nothing on.
  const reactionKinds = spaces.length === spaceIds.length ? enabledReactions(spaces) : [];
  if (steps.error) throw postLayerError("readPostExtras", steps);

  const factMap = new Map<string, WallBuildFacts>();
  for (const row of (facts.data ?? []) as { id: string; slug: string | null; title: string | null; status: string; creator_id: string; parent_build_id: string | null; source_handle_at_fork: string | null }[]) {
    factMap.set(row.id, { id: row.id, slug: row.slug, title: row.title, status: row.status, creatorId: row.creator_id, parentBuildId: row.parent_build_id, sourceHandle: row.source_handle_at_fork });
  }
  const stepMap = new Map<string, LineStepRow[]>();
  for (const row of (steps.data ?? []) as LineStepRow[]) stepMap.set(row.build_id, [...(stepMap.get(row.build_id) ?? []), row]);
  const reactions = reactionKinds.length ? foldReactions((reactionRows.data ?? []) as { post_id: string; user_id: string; kind: string; value: number | null }[], viewerId) : new Map<string, PostReactions>();
  return { work, signed, facts: factMap, steps: stepMap, liked, crowd, reactionKinds, reactions };
}


/** A space by its id with its maker's handle, moderators, members and the reader's role: the same answer as getSpaceCrowd, in one round. */
export async function readSpaceCrowd(spaceId: string, viewerId: string | null): Promise<SpaceCrowd | null> {
  const [found, moderators, count, mine] = await Promise.all([
    db.from("spaces").select(`${SPACE_COLUMNS}, creator:profiles!spaces_creator_id_fkey(username)`).eq("id", spaceId).limit(1).maybeSingle(),
    db.from("space_members").select("user_id, role, profile:profiles(username, display_name, avatar_url)").eq("space_id", spaceId).eq("role", "moderator").limit(20),
    db.from("space_members").select("user_id", { count: "estimated", head: true }).eq("space_id", spaceId),
    viewerId ? db.from("space_members").select("user_id").eq("space_id", spaceId).eq("user_id", viewerId).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const response of [found, moderators, count, mine]) if (response.error) throw postLayerError("readSpaceCrowd", response);
  const row = found.data as unknown as (SpaceRow & { creator?: { username: string | null } | null }) | null;
  if (!row) return null;
  const space = toSpace(row);
  type MemberRow = { user_id: string; profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null };
  const people = ((moderators.data ?? []) as unknown as MemberRow[]).map((member) => ({ id: member.user_id, handle: member.profile?.username ?? null, name: member.profile?.display_name ?? null, avatarUrl: member.profile?.avatar_url ?? null }));
  const role: SpaceCrowd["role"] = !viewerId ? "none" : people.some((person) => person.id === viewerId) || space.creatorId === viewerId ? "moderator" : mine.data ? "member" : "none";
  return { space, creator: { id: space.creatorId, handle: row.creator?.username ?? null }, moderators: people, members: (count as { count?: number | null }).count ?? 0, role };
}
