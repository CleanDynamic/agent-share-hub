// The new-path feed, as the browser sees it.
//
// ONE REQUEST PER PAGE, and that is the whole reason this module exists. The
// home feed's five legacy tabs issue roughly fifteen queries between them and
// merge and sort the results in the browser; this one calls get_build_feed and
// renders what comes back, in the order it comes back. The ordering is the
// database's answer, not a client-side sort over three separately paged lists —
// which is the thing that cannot be made correct at any number of requests.
//
// A DOMAIN MODULE, not a hook and not a query inside a component. Data access
// on this codebase lives in src/lib/<domain>/ as named typed functions, and
// this is the feed domain's first one. src/lib/build/ is where BUILD access
// lives; the feed reads across three sources and belongs beside them rather
// than inside one of them.
//
// WHY THE ROW TYPE IS HAND-WRITTEN. Every other row shape in this codebase is
// derived from src/integrations/supabase/types.ts, which is generated from the
// live database. get_build_feed lands in that file the next time it is
// regenerated; until then the generated Functions map does not know the name,
// so the call is made through a narrow cast and the row is described here. The
// shape below is the migration's RETURNS TABLE, column for column — if the two
// ever disagree, the migration is right.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type GalleryBuild,
  type GalleryMedia,
} from "@/lib/build";

/** What the Builds tab asks for, and what the function defaults to. */
export const FEED_PAGE_SIZE = 20;

/** The three kinds of thing the feed carries. */
export type FeedItemKind = "build" | "rebuild" | "repro_note";

/**
 * One row of get_build_feed, exactly as the function declares it.
 *
 * snake_case because it is a database row and has not been mapped yet. Nothing
 * outside this file should hold one of these — the mapper below is what the
 * rest of the app consumes.
 */
export interface BuildFeedRow {
  item_kind: FeedItemKind;
  item_at: string;
  build_id: string;
  slug: string;
  title: string;
  outcome: string | null;
  shape: string;
  cover_media_id: string | null;
  creator_id: string;
  creator_username: string | null;
  creator_display: string | null;
  creator_avatar: string | null;
  reproduction_count: number;
  rebuild_count: number;
  parent_build_id: string | null;
  source_title_at_fork: string | null;
  source_handle_at_fork: string | null;
  rebuild_note: string | null;
  repro_note: string | null;
  repro_model: string | null;
  repro_user_username: string | null;
  status: string;
  made_for: string[] | null;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  cover_bucket: string | null;
  cover_path: string | null;
  cover_kind: string | null;
  cover_poster_path: string | null;
  repro_worked: boolean | null;
}

/**
 * A published build that is nobody's child. Renders as the gallery card,
 * unchanged.
 */
export interface BuildFeedItem {
  kind: "build";
  /** Stable across renders and unique within a page. A React key. */
  key: string;
  /** The keyset cursor this row sits at: published_at. */
  at: string;
  build: GalleryBuild;
}

/**
 * A published build that names a parent. The same card, plus the credit line
 * the gallery already shows and the rebuilder's own account of what changed.
 */
export interface RebuildFeedItem {
  kind: "rebuild";
  key: string;
  at: string;
  build: GalleryBuild;
  /** The first line of the rebuild note, or null. See rebuildDisplay.ts. */
  note: string | null;
}

/**
 * Somebody other than the creator ran a build and wrote something about it.
 *
 * NOT a card. A reproduction note is one sentence about somebody else's build,
 * and giving it the same 168px body and the same weight as the build itself
 * would say they were the same kind of thing.
 */
export interface ReproNoteFeedItem {
  kind: "repro_note";
  key: string;
  /** The keyset cursor this row sits at: confirmed_at. */
  at: string;
  buildId: string;
  slug: string;
  title: string;
  /** The reproducer's handle, without the @. Null if their profile is gone. */
  handle: string | null;
  /** The model they ran it on. Null means they did not say — never guess. */
  model: string | null;
  note: string;
  /** Whether it worked for them. The strip says so either way. */
  worked: boolean;
}

export type FeedItem = BuildFeedItem | RebuildFeedItem | ReproNoteFeedItem;

export interface BuildFeedPage {
  items: FeedItem[];
  /**
   * The cursor for the next page, or null at the end of the feed.
   *
   * Null when the page came back short: a page smaller than the one asked for
   * means the function ran out of rows, and asking again would cost a round
   * trip to be told the same thing. A full last page costs one empty page
   * before the feed stops, which is the ordinary price of keyset paging.
   */
  nextBefore: string | null;
}

export interface GetBuildFeedOptions {
  /**
   * Rows strictly older than this. Omitted for the first page, and thereafter
   * the `at` of the last item held.
   */
  before?: string;
  /** Capped at 50 inside the function, whatever is passed. */
  pageSize?: number;
}

/**
 * One page of the feed, in one request.
 *
 * The arguments are passed by name because the function's are named and
 * defaulted; omitting `before` lets the database use now() rather than making
 * the browser's clock the cursor, which matters when they disagree.
 */
export async function getBuildFeed(
  options: GetBuildFeedOptions = {}
): Promise<BuildFeedPage> {
  const pageSize = options.pageSize ?? FEED_PAGE_SIZE;

  const args: Record<string, unknown> = { page_size: pageSize };
  if (options.before) args.before = options.before;

  // The cast is the generated types not knowing this function's name yet; see
  // the note at the top of the file. It narrows straight back to BuildFeedRow.
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: BuildFeedRow[] | null; error: unknown }>
  )("get_build_feed", args);

  if (error) throw buildLayerError("getBuildFeed", error);

  const rows = data ?? [];
  const items = rows.map(toFeedItem);

  return {
    items,
    nextBefore:
      rows.length < pageSize ? null : rows[rows.length - 1]?.item_at ?? null,
  };
}

// =============================================================================
// The mapper
// =============================================================================

/**
 * The build a card renders, assembled from one flat feed row.
 *
 * WHY THE NODE LIST IS EMPTY AND THAT IS NOT A DEGRADED CARD. The bodies pick
 * what they show from the node window the gallery query embeds, and every one
 * of them ends at DefaultCardBody, whose chain is cover media -> evidence words
 * -> the outcome set large. A feed row carries the cover and the outcome, so
 * the chain lands on its first link for a build with a cover and its last for
 * one without — which is exactly where a gallery card with the same material
 * lands. What the feed does not get is the prompt excerpt, the comparison table
 * and the variant grid: those need the nodes, and the nodes are the difference
 * between a card and a page of them. Adding them here would put every node of
 * every card on the wire for a body that shows at most one.
 *
 * THE FIELDS SET TO NULL ARE THE ONES NO CARD READS. completeness decides
 * gallery membership, which the function has already decided; made_with feeds
 * the gallery's filters, which the feed does not have; hero_node_id and
 * repo_url are read only through nodes that are not here. live_url is the one
 * worth naming: AppCardBody reads it, but only after the live_app node's
 * payload says the app consents to being framed — with no nodes that test is
 * false, so a live_url here could never reach the iframe branch anyway.
 */
function toGalleryBuild(row: BuildFeedRow): GalleryBuild {
  return {
    id: row.build_id,
    creator_id: row.creator_id,
    slug: row.slug,
    title: row.title,
    outcome: row.outcome,
    shape: row.shape,
    status: row.status,
    made_for: row.made_for ?? [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: row.cover_media_id,
    completeness: null,
    reproduction_count: row.reproduction_count,
    last_confirmed_at: row.last_confirmed_at,
    last_confirmed_model: row.last_confirmed_model,
    // item_at IS published_at on a build and a rebuild row, and isStale() reads
    // this column when a build has never been confirmed.
    published_at: row.item_at,
    parent_build_id: row.parent_build_id,
    rebuild_count: row.rebuild_count,
    rebuild_note: row.rebuild_note,
    source_title_at_fork: row.source_title_at_fork,
    source_handle_at_fork: row.source_handle_at_fork,
    nodes: [],
    media: coverRows(row),
  };
}

/**
 * The cover, as the one-row media list resolveCover() walks.
 *
 * The function returns the cover's bucket, path and kind rather than its id
 * alone because build-media is a private bucket: an id cannot be signed, and
 * the browser needs the path to ask for a URL. A row missing its path — no
 * cover, or a cover row deleted out from under the build — returns an empty
 * list, and the card falls down the chain exactly as a build with no cover has
 * always done.
 */
function coverRows(row: BuildFeedRow): GalleryMedia[] {
  if (!row.cover_media_id || !row.cover_path || !row.cover_bucket) return [];
  return [
    {
      id: row.cover_media_id,
      node_id: null,
      bucket: row.cover_bucket,
      path: row.cover_path,
      kind: row.cover_kind ?? "image",
      // The card scales its picture into a fixed 168px body with object-fit,
      // so the image's own dimensions are never read. Null is honest here;
      // a guess would not be.
      width: null,
      height: null,
      poster_path: row.cover_poster_path,
    },
  ];
}

/**
 * The first line of a note, or null.
 *
 * A card gets one line; the build's own page renders all of it. Duplicated in
 * spirit from rebuildDisplay.firstLine, which takes the same position for the
 * Rebuilds tab — this file cannot import it without the data layer depending
 * on a component module, which is the wrong direction.
 */
function firstLine(note: string | null): string | null {
  const text = (note ?? "").trim();
  if (!text) return null;
  const line = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line.length > 0 ? line : null;
}

/**
 * A key that is stable across renders and unique within a page.
 *
 * The kind is part of it because one build can appear twice on one page — as
 * itself and as somebody's reproduction note — and two React children keyed
 * the same is a rendering bug that looks like a data bug.
 */
function feedKey(row: BuildFeedRow): string {
  return `${row.item_kind}:${row.build_id}:${row.item_at}`;
}

/** One row, as the thing the tab renders. */
export function toFeedItem(row: BuildFeedRow): FeedItem {
  if (row.item_kind === "repro_note") {
    return {
      kind: "repro_note",
      key: feedKey(row),
      at: row.item_at,
      buildId: row.build_id,
      slug: row.slug,
      title: row.title,
      handle: row.repro_user_username,
      model: row.repro_model,
      // The function admits no empty note, so this is prose. The fallback is
      // for a row that arrived from somewhere else.
      note: (row.repro_note ?? "").trim(),
      // NOT defaulted to true. A null here means the column did not arrive,
      // and "it worked" is not the thing to assume on somebody else's behalf.
      worked: row.repro_worked === true,
    };
  }

  if (row.item_kind === "rebuild") {
    return {
      kind: "rebuild",
      key: feedKey(row),
      at: row.item_at,
      build: toGalleryBuild(row),
      note: firstLine(row.rebuild_note),
    };
  }

  return {
    kind: "build",
    key: feedKey(row),
    at: row.item_at,
    build: toGalleryBuild(row),
  };
}
