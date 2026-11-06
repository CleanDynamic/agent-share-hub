// UX-10 P4: a profile's feed, a page at a time.
//
// ONE ORDERED PAGE FROM THE DATABASE. get_profile_feed (20261109120000) answers the page's rows, (kind, id, created_at,
// pinned_position), newest first with the pins leading the first page. The order is the database's; nothing here sorts or merges
// pages. Then each kind's card data is read with the functions the build feed and OpenBuilds already have, all started together:
//
//   build       getGalleryBuildsByIds (the build with its first post, as Home reads it) and the builds' own display choice
//   topic/reply readPostsByIds, then readCardExtras and the replies' topics together (as listTopicsBy reads them)
//   repro_note  one read of build_reproductions with the build and its maker embedded
//
// A row whose card did not come back (removed between the two reads, or no longer readable) is left out, never drawn half.
// WHAT THE READER MAY SEE is decided in the function: drafts, hidden replies and notes the owner keeps to themselves never arrive.

import { getGalleryBuildsByIds, type GalleryPostBuild } from "@/lib/build/gallery";
import { buildLayerError } from "@/lib/build/types";
import { NO_CARD_WORK, readCardExtras, type CardExtras } from "@/lib/openbuilds/cardWork";
import { readPostsByIds } from "@/lib/openbuilds/feedTopics";
import { db, unique, type Post } from "@/lib/openbuilds/types";
import { supabase } from "@/integrations/supabase/client";

import type { BuildDisplay, FeedFilter, PinKind } from "./settings";

export const PROFILE_FEED_PAGE = 20;

export type ProfileFeedKind = PinKind;

/** One row of get_profile_feed, as the function declares it. */
export interface ProfileFeedRow {
  kind: ProfileFeedKind;
  id: string;
  created_at: string;
  pinned_position: number | null;
}

interface ItemBase {
  key: string;
  id: string;
  at: string;
  /** 1 to 3 on a pinned item (first page only), else null. */
  pinned: number | null;
}

export interface ProfileBuildItem extends ItemBase {
  kind: "build";
  build: GalleryPostBuild;
  /** The build's own choice (build_profile_display), or null for the owner's. */
  display: BuildDisplay | null;
}

export interface ProfileTopicItem extends ItemBase {
  kind: "topic";
  post: Post;
}

export interface ProfileReplyItem extends ItemBase {
  kind: "reply";
  post: Post;
  /** The topic the reply is in, or null when the reader may not read it. */
  root: Post | null;
}

export interface ProfileNote {
  buildId: string;
  slug: string;
  title: string;
  /** The build's maker, without the @. */
  makerHandle: string | null;
  model: string | null;
  worked: boolean;
  note: string;
}

export interface ProfileNoteItem extends ItemBase {
  kind: "repro_note";
  note: ProfileNote;
}

export type ProfileFeedItem = ProfileBuildItem | ProfileTopicItem | ProfileReplyItem | ProfileNoteItem;

export interface ProfileFeedPage {
  items: ProfileFeedItem[];
  /** The extras every topic and reply card on the page needs (their work, signed pictures and reply digests). */
  extras: CardExtras;
  /** The next page's cursor, or null at the end. */
  next: string | null;
}

export interface GetProfileFeedOptions {
  filter?: FeedFilter;
  cursor?: string | null;
  limit?: number;
}

type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
const rpc = (fn: string, params: Record<string, unknown>) => (supabase.rpc as unknown as Rpc)(fn, params);

/** The page's rows, in the database's order. One request. */
export async function readProfileFeedRows(handle: string, options: GetProfileFeedOptions = {}): Promise<ProfileFeedRow[]> {
  const { data, error } = await rpc("get_profile_feed", {
    p_username: handle,
    p_filter: options.filter ?? "all",
    p_cursor: options.cursor ?? null,
    p_limit: options.limit ?? PROFILE_FEED_PAGE,
  });
  if (error) throw buildLayerError("getProfileFeed", error);
  return (data ?? []) as ProfileFeedRow[];
}

/** The builds' own display choices, by id. One request, only when the page has builds. */
export async function readBuildDisplays(ids: readonly string[]): Promise<Map<string, BuildDisplay>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("build_profile_display").select("build_id, display").in("build_id", ids).limit(ids.length);
  if (error) throw buildLayerError("readBuildDisplays", error);
  return new Map(((data ?? []) as { build_id: string; display: BuildDisplay }[]).map((row) => [row.build_id, row.display]));
}

const NOTE_COLUMNS =
  "id, build_id, model_used, worked, note, confirmed_at, build:builds!build_reproductions_build_id_fkey(id, slug, title, maker:profiles!builds_creator_id_fkey(username))";

interface NoteRow {
  id: string;
  build_id: string;
  model_used: string | null;
  worked: boolean;
  note: string | null;
  build: { id: string; slug: string; title: string; maker: { username: string | null } | null } | null;
}

/** Reproduction notes by id, with the build each is about. One request. */
export async function readReproNotes(ids: readonly string[]): Promise<Map<string, ProfileNote>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from("build_reproductions").select(NOTE_COLUMNS).in("id", ids).limit(ids.length);
  if (error) throw buildLayerError("readReproNotes", error);
  const out = new Map<string, ProfileNote>();
  for (const row of (data ?? []) as unknown as NoteRow[]) {
    if (!row.build || !row.note?.trim()) continue;
    out.set(row.id, {
      buildId: row.build.id,
      slug: row.build.slug,
      title: row.build.title,
      makerHandle: row.build.maker?.username ?? null,
      model: row.model_used?.trim() || null,
      worked: row.worked,
      note: row.note.trim(),
    });
  }
  return out;
}

const NO_EXTRAS: CardExtras = { work: NO_CARD_WORK, digests: new Map(), signed: new Map() };

/** Topics and replies by id, then their extras and the replies' topics together. */
export async function readProfilePosts(ids: readonly string[]): Promise<{ posts: Map<string, Post>; roots: Map<string, Post>; extras: CardExtras }> {
  if (ids.length === 0) return { posts: new Map(), roots: new Map(), extras: NO_EXTRAS };
  const posts = await readPostsByIds(ids);
  const byId = new Map(posts.map((post) => [post.id, post]));
  const rootIds = unique(posts.flatMap((post) => (post.parentId && !byId.has(post.rootId) ? [post.rootId] : [])));
  const [extras, roots] = await Promise.all([readCardExtras(posts), rootIds.length ? readPostsByIds(rootIds) : Promise.resolve([] as Post[])]);
  const rootMap = new Map(roots.map((post) => [post.id, post]));
  for (const post of posts) if (!post.parentId) rootMap.set(post.id, post);
  return { posts: byId, roots: rootMap, extras };
}

/** The next page's cursor: the last row that is not a pin, when the page was full. */
export function nextCursor(rows: readonly ProfileFeedRow[], limit: number): string | null {
  const flowing = rows.filter((row) => row.pinned_position === null);
  return flowing.length < limit ? null : (flowing[flowing.length - 1]?.created_at ?? null);
}

/** One page of a profile's feed: the rows, then each kind's cards with one read per kind, in the rows' order. */
export async function getProfileFeed(handle: string, options: GetProfileFeedOptions = {}): Promise<ProfileFeedPage> {
  const limit = options.limit ?? PROFILE_FEED_PAGE;
  const rows = await readProfileFeedRows(handle, { ...options, limit });
  const ids = (kind: ProfileFeedKind) => rows.filter((row) => row.kind === kind).map((row) => row.id);
  const buildIds = ids("build");
  const postIds = [...ids("topic"), ...ids("reply")];

  const [builds, displays, posts, notes] = await Promise.all([
    buildIds.length ? getGalleryBuildsByIds(buildIds) : Promise.resolve([] as GalleryPostBuild[]),
    readBuildDisplays(buildIds),
    readProfilePosts(postIds),
    readReproNotes(ids("repro_note")),
  ]);
  const buildById = new Map(builds.map((build) => [build.id, build]));

  const items: ProfileFeedItem[] = [];
  for (const row of rows) {
    const base = { key: `${row.kind}:${row.id}`, id: row.id, at: row.created_at, pinned: row.pinned_position };
    if (row.kind === "build") {
      const build = buildById.get(row.id);
      if (build) items.push({ ...base, kind: "build", build, display: displays.get(row.id) ?? null });
    } else if (row.kind === "topic" || row.kind === "reply") {
      const post = posts.posts.get(row.id);
      if (!post) continue;
      if (row.kind === "topic") items.push({ ...base, kind: "topic", post });
      else items.push({ ...base, kind: "reply", post, root: posts.roots.get(post.rootId) ?? null });
    } else if (row.kind === "repro_note") {
      const note = notes.get(row.id);
      if (note) items.push({ ...base, kind: "repro_note", note });
    }
  }
  return { items, extras: posts.extras, next: nextCursor(rows, limit) };
}
