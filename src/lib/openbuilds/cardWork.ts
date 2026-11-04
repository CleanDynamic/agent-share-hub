// What a list of posts needs besides the posts (UX-05 Part 1): the work their attachments name, and a digest of their replies.
//
// Two reads for a page of posts, started together by the caller, neither in a loop:
//   * readCardWork: the published builds the posts attach or are about (title, tool, reproduction facts), their top-level steps
//     and any step an attachment names, and, only when a session or a part is attached, the build's `making`.
//   * readReplyDigests: the replies of all the page's roots in one request, folded to a strip per root.
// Work copied from a draft carries its own snapshot and needs no read.

import { signEntryMedia } from "./media";
import { listPosts, type ListPostsOptions, type PostsPage } from "./posts";
import { db, AUTHOR_EMBED, postLayerError, unique, type Post } from "./types";

/** The rows read per kind of read, so a page of twenty posts cannot ask for an unbounded list. */
const NODE_ROWS_PER_BUILD = 200;
const REPLY_ROWS = 300;

export interface CardBuildFacts {
  id: string;
  slug: string | null;
  title: string | null;
  madeWith: string | null;
  status: string;
  reproduction_count: number | null;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
  /** Only for a build with a session or a part attached. */
  making?: unknown;
}

export interface CardNode {
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
  /** A prompt's or a step's own words, for a step attached on its own. */
  text: string | null;
  /** The session a top-level prompt belongs to. */
  session: string | null;
}

export interface CardWork {
  builds: Map<string, CardBuildFacts>;
  nodes: Map<string, CardNode[]>;
}

export const NO_CARD_WORK: CardWork = { builds: new Map(), nodes: new Map() };

const BUILD_FACTS = "id, slug, title, made_with, status, reproduction_count, last_confirmed_at, last_confirmed_model, published_at";
const NODE_COLUMNS =
  "id, build_id, parent_id, type, title, position, is_gap, tested:payload->tested, setup:payload->setup, step:payload->step, text:payload->>text, session:payload->>session";

interface BuildRow {
  id: string;
  slug: string | null;
  title: string | null;
  made_with: string | null;
  status: string;
  reproduction_count: number | null;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
}

/** The build ids a page of posts names by reference (a copy from a draft needs none), and the step ids to read. */
export function workNamedBy(posts: readonly Post[]): { builds: string[]; strips: string[]; steps: string[]; making: string[] } {
  const builds: string[] = [];
  const strips: string[] = [];
  const steps: string[] = [];
  const making: string[] = [];
  for (const post of posts) {
    if (post.aboutBuildId) builds.push(post.aboutBuildId);
    if (post.aboutNodeId) steps.push(post.aboutNodeId);
    for (const attachment of post.attachments) {
      if (attachment.kind === "media" || !attachment.buildId || attachment.snapshot) continue;
      builds.push(attachment.buildId);
      if (attachment.kind === "build" || attachment.kind === "session" || attachment.kind === "step") strips.push(attachment.buildId);
      if (attachment.kind === "step" && attachment.nodeId) steps.push(attachment.nodeId);
      if (attachment.kind === "session" || attachment.kind === "part") making.push(attachment.buildId);
    }
  }
  return { builds: unique(builds), strips: unique([...strips, ...posts.flatMap((post) => (post.aboutBuildId ? [post.aboutBuildId] : []))]), steps: unique(steps), making: unique(making) };
}

/** The work a page of posts names, in at most one round: builds, nodes and (only when needed) `making`, together. */
export const readCardWork = (posts: readonly Post[]): Promise<CardWork> => readNamedWork(workNamedBy(posts));

/** The same reads for work named directly (the New post window's attachments). */
export async function readNamedWork(named: ReturnType<typeof workNamedBy>): Promise<CardWork> {
  if (named.builds.length === 0 && named.steps.length === 0) return NO_CARD_WORK;

  const buildsRead = named.builds.length
    ? db.from("builds").select(BUILD_FACTS).in("id", named.builds).limit(named.builds.length)
    : Promise.resolve({ data: [], error: null });
  const makingRead = named.making.length
    ? db.from("builds").select("id, making").in("id", named.making).limit(named.making.length)
    : Promise.resolve({ data: [], error: null });
  const stripsRead = named.strips.length
    ? db
        .from("build_nodes")
        .select(NODE_COLUMNS)
        .in("build_id", named.strips)
        .is("parent_id", null)
        .order("build_id", { ascending: true })
        .order("position", { ascending: true })
        .limit(NODE_ROWS_PER_BUILD * named.strips.length)
    : Promise.resolve({ data: [], error: null });
  const stepsRead = named.steps.length
    ? db.from("build_nodes").select(NODE_COLUMNS).in("id", named.steps).limit(named.steps.length)
    : Promise.resolve({ data: [], error: null });

  const [builds, making, strips, steps] = await Promise.all([buildsRead, makingRead, stripsRead, stepsRead]);
  for (const response of [builds, making, strips, steps]) if (response.error) throw postLayerError("readCardWork", response);

  const facts = new Map<string, CardBuildFacts>();
  for (const row of (builds.data ?? []) as BuildRow[]) {
    facts.set(row.id, { ...row, madeWith: row.made_with });
  }
  for (const row of (making.data ?? []) as { id: string; making: unknown }[]) {
    const known = facts.get(row.id);
    if (known) known.making = row.making;
  }
  const nodes = new Map<string, CardNode[]>();
  const seen = new Set<string>();
  for (const row of [...((strips.data ?? []) as CardNode[]), ...((steps.data ?? []) as CardNode[])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    nodes.set(row.build_id, [...(nodes.get(row.build_id) ?? []), row]);
  }
  return { builds: facts, nodes };
}

/* ── replies ── */

export interface ReplyDigest {
  /** Up to three distinct people who replied, the latest first. */
  people: { id: string; name: string; avatarUrl: string | null }[];
  /** Replies that carry a build. */
  builds: number;
  latest: { handle: string | null; at: string } | null;
}

interface ReplyRow {
  root_id: string;
  created_at: string;
  author: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  attachments: { kind: string }[] | null;
}

/** A strip for each root post: who replied, how many replies carry a build, and the latest. One request for the whole page. */
export async function readReplyDigests(rootIds: readonly string[]): Promise<Map<string, ReplyDigest>> {
  const ids = unique(rootIds);
  const out = new Map<string, ReplyDigest>();
  if (ids.length === 0) return out;
  const response = await db
    .from("openbuild_posts")
    .select(`root_id, created_at, ${AUTHOR_EMBED}, attachments:post_attachments(kind)`)
    .in("root_id", ids)
    .not("parent_id", "is", null)
    .is("hidden_by", null)
    .order("created_at", { ascending: false })
    .limit(REPLY_ROWS);
  if (response.error) throw postLayerError("readReplyDigests", response);
  for (const row of (response.data ?? []) as unknown as ReplyRow[]) {
    const digest = out.get(row.root_id) ?? { people: [], builds: 0, latest: null };
    if (!digest.latest) digest.latest = { handle: row.author?.username ?? null, at: row.created_at };
    if (row.author && digest.people.length < 3 && !digest.people.some((person) => person.id === row.author!.id)) {
      digest.people.push({ id: row.author.id, name: row.author.display_name?.trim() || row.author.username || "Someone", avatarUrl: row.author.avatar_url });
    }
    if ((row.attachments ?? []).some((attachment) => attachment.kind === "build")) digest.builds += 1;
    out.set(row.root_id, digest);
  }
  return out;
}

/* ── a page of posts with everything its cards need ── */

export interface CardExtras {
  work: CardWork;
  digests: Map<string, ReplyDigest>;
  signed: Map<string, string>;
}

export interface CardsPage extends PostsPage {
  extras: CardExtras;
}

/** The three reads a page of cards needs beyond its posts, started together: one round. */
export async function readCardExtras(posts: readonly Post[]): Promise<CardExtras> {
  const media = posts.flatMap((post) => post.attachments.flatMap((attachment) => (attachment.kind === "media" && attachment.mediaPath ? [{ path: attachment.mediaPath, mediaKind: attachment.mediaKind ?? ("file" as const) }] : [])));
  const [work, digests, signed] = await Promise.all([
    readCardWork(posts),
    readReplyDigests(posts.filter((post) => post.replyCount > 0).map((post) => post.id)),
    media.length ? signEntryMedia(media) : Promise.resolve(new Map<string, string>()),
  ]);
  return { work, digests, signed };
}

/** A page of topics with its cards' extras: two rounds in all (the posts, then the extras), so a list changes in one step. */
export async function listPostCards(options: ListPostsOptions): Promise<CardsPage> {
  const page = await listPosts(options);
  return { ...page, extras: await readCardExtras(page.posts) };
}
