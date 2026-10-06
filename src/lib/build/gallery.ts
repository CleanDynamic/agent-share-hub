// The gallery: which published builds are worth putting in front of a reader
// who has not come looking for any one of them.
//
// MEMBERSHIP IS COMPUTED, NOT STORED. There is no 'in the gallery' flag on a
// build. A record qualifies when its completeness clears the threshold for its
// shape, and that is evaluated when the gallery is queried. The alternative —
// a stored flag, or the 'gallery' status used for everything — drifts out of
// date the moment a creator edits a record, and nothing in the product would
// ever notice.
//
// status = 'gallery' IS RESERVED FOR EDITORIAL PROMOTION by an admin, and such
// a build is included whatever its completeness. That is the escape hatch for
// the record a rule table gets wrong, and it is the only one.
//
// ONE QUERY. The home feed's fifteen-query pattern is the thing this file
// exists not to repeat. Everything a card renders — the header, the nodes its
// shape body reads, the media rows those nodes point at — arrives in a single
// PostgREST request through embedded resources, with the page count on the
// same response. The facets are a second request and are cached across filter
// changes, so changing a filter costs exactly one request.

import { supabase } from "@/integrations/supabase/client";
import type { Bounty } from "@/lib/bounty/types";
import { MODEL_VERSIONS, normaliseModel, type Lab, type ModelVersion } from "@/lib/models/registry";
import { weekStartUtc } from "@/lib/progress/weekly";
import { WEEKLY_REPRODUCTION_GOAL } from "@/lib/progress/goals";
import { normaliseQuery, searchBuildIds } from "./search";
import {
  SHAPE_RULES,
  STALE_AFTER_DAYS,
  countRunsThisWeek,
  getReproductionsByModel,
  type MissingItem,
  type ModelProof,
  type RequirementKey,
} from "./signals";
import {
  buildLayerError,
  type Build,
  type BuildMedia,
  type BuildNode,
  type BuildShape,
  type NodeCategory,
} from "./types";

// =============================================================================
// The threshold
// =============================================================================

/**
 * What the gallery asks for, on top of nothing.
 *
 * The three minimum publishable items, plus who the build is for and what it
 * was made with. Those last two are not decoration: they are what the Made for
 * and Made with filters read, and a build carrying neither cannot be found
 * through either of them. A gallery of records nobody can filter to is a wall.
 */
export const GALLERY_REQUIREMENT_KEYS: readonly RequirementKey[] = [
  "outcome",
  "instruction_or_artefact",
  "evidence",
  "made_for",
  "made_with",
] as const;

/**
 * The bar never asks for a perfect record.
 *
 * Without this cap the small shapes price themselves out: a prompt's rules
 * total 72 across five items, so "the core plus the audience" IS every rule it
 * has, and the threshold would land on 100. A gallery whose entry price is a
 * flawless record is a gallery with nothing in it, and it leaves a creator no
 * headroom — there would be no such thing as a build that is in and could still
 * be better.
 */
export const GALLERY_MAX_THRESHOLD = 90;

/**
 * The completeness a build of each shape must reach, out of 100.
 *
 * Derived from SHAPE_RULES rather than hand-picked, so a weight changed in the
 * rule table moves the bar with it and the two cannot disagree. The numbers it
 * produces today:
 *
 *   app, agent, workflow  72   nine rules; the core, plus both audience fields
 *   dataset, study        88   eight rules
 *   media, technique      90   capped from 92
 *   prompt, other         90   capped from 100
 *
 * Read the low number for an app carefully: it is low because an app's rules
 * total 100 across nine items, so the same five items are a smaller share of a
 * bigger record. That is what shape-relative means. It is not a lower standard.
 */
export const GALLERY_THRESHOLD: Record<BuildShape, number> =
  deriveGalleryThresholds();

function deriveGalleryThresholds(): Record<BuildShape, number> {
  const wanted = new Set<string>(GALLERY_REQUIREMENT_KEYS);
  const out = {} as Record<BuildShape, number>;

  for (const shape of Object.keys(SHAPE_RULES) as BuildShape[]) {
    const rules = SHAPE_RULES[shape];
    const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
    const asked = rules
      .filter((rule) => wanted.has(rule.key))
      .reduce((sum, rule) => sum + rule.weight, 0);

    const bar = total === 0 ? 100 : Math.round((asked / total) * 100);
    out[shape] = Math.min(bar, GALLERY_MAX_THRESHOLD);
  }

  return out;
}

/** The bar for one shape. An unknown shape is held to 'other'. */
export function galleryThreshold(shape: string | null | undefined): number {
  return GALLERY_THRESHOLD[(shape ?? "other") as BuildShape] ?? GALLERY_THRESHOLD.other;
}

/** Whether one loaded build would appear in the gallery, by the same rule. */
export function inGallery(
  build: Pick<Build, "status" | "shape" | "completeness">
): boolean {
  if (build.status === "gallery") return true;
  if (build.status !== "published") return false;
  return (build.completeness ?? 0) >= galleryThreshold(build.shape);
}

/**
 * What would put this build in the gallery: the outstanding items, heaviest
 * first, taken until they close the gap to the threshold.
 *
 * NOT simply "every gallery requirement it is missing". Membership is decided
 * by the SCORE, and the weights are fungible — an app that has stated its cost
 * and how long it takes clears 72 without naming an audience. Listing items
 * the build does not actually need would be telling a creator to do work that
 * changes nothing, so this answers the question the query will actually ask.
 *
 * Returns an empty array when the build already qualifies.
 */
export function galleryShortfall(
  shape: string | null | undefined,
  score: number,
  missing: MissingItem[]
): MissingItem[] {
  const threshold = galleryThreshold(shape);
  if (score >= threshold) return [];

  const rules = SHAPE_RULES[(shape ?? "other") as BuildShape] ?? SHAPE_RULES.other;
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
  const weightOf = new Map(rules.map((rule) => [rule.key, rule.weight]));

  // Heaviest first, so the list is the shortest one that closes the gap. Ties
  // keep rule order, which is the order the checklist already shows.
  const byWeight = [...missing].sort(
    (a, b) => (weightOf.get(b.key) ?? 0) - (weightOf.get(a.key) ?? 0)
  );

  const needed = Math.ceil((threshold / 100) * total) - (score / 100) * total;
  const out: MissingItem[] = [];
  let gained = 0;

  for (const item of byWeight) {
    if (gained >= needed) break;
    out.push(item);
    gained += weightOf.get(item.key) ?? 0;
  }

  return out;
}

// =============================================================================
// The query
// =============================================================================

/** One page of cards. Twenty-four divides into two, three and four columns. */
export const GALLERY_PAGE_SIZE = 24;

/**
 * The node types a card body can read.
 *
 * Embedding a build's whole tree would put every node of every card on the
 * wire for a grid that shows at most one of them. This is the closed list the
 * five bodies actually reach for — the prompt they truncate, the comparison
 * table they shrink, the variants they grid, the artefact or evidence node
 * they fall back to, and whatever the hero points at.
 *
 * A card whose build has none of these still renders: every body ends at the
 * outcome, set large. That is the guarantee, not an accident of this list.
 */
export const GALLERY_NODE_TYPES: readonly string[] = [
  "prompt",
  "system_prompt",
  "live_app",
  "repo",
  "document",
  "code",
  "generated_media",
  "result",
  "comparison_table",
  "eval_run",
  "screenshot",
  "recording",
  "dataset",
] as const;

/**
 * The part category each of those node types belongs to, as `node_types.category`
 * has it (the NS-P02 registry seed).
 *
 * A STATIC TABLE, AND ONLY FOR THE TYPES THE CARD'S OWN QUERY CARRIES. A card
 * must not ask the registry for itself — twenty-four cards would mean twenty-four
 * subscribers to a read that only one page needs — and the window above is
 * closed, so a table over exactly that window cannot be wrong about a type it
 * will never be handed. `partCategories` skips anything not named here rather
 * than guessing, and gallery.test.ts holds this table to GALLERY_NODE_TYPES in
 * both directions so adding a type to the window without a category fails there.
 */
export const GALLERY_NODE_CATEGORY: Readonly<Record<string, NodeCategory>> = {
  prompt: "instruction",
  system_prompt: "instruction",
  dataset: "data",
  code: "artefact",
  live_app: "artefact",
  repo: "artefact",
  generated_media: "artefact",
  document: "artefact",
  result: "evidence",
  comparison_table: "evidence",
  eval_run: "evidence",
  screenshot: "evidence",
  recording: "evidence",
};

/** The order a card's part chips read in: how a build is built, instruction first. */
const PART_CHIP_ORDER: readonly NodeCategory[] = [
  "instruction",
  "configuration",
  "data",
  "artefact",
  "evidence",
  "narrative",
];

/**
 * The part categories present among a card's nodes, once each, in reading order.
 *
 * `breakage` is never one of them: it is not a node category (a breakage is a
 * node of the narrative kind, or a gap), and a card says a build is missing a
 * part with its dashed edge and its open-ask line, not with a chip. A gap node
 * keeps its own category — a gap on an agent config is still configuration.
 *
 * Reads only the nodes the card was handed (at most NODES_PER_BUILD of the
 * types above), so a category the window did not carry is absent here even when
 * the build has it; the chip row says what the card can see.
 */
export function partCategories(nodes: readonly Pick<GalleryNode, "type">[]): NodeCategory[] {
  const present = new Set<NodeCategory>();
  for (const node of nodes) {
    const category = GALLERY_NODE_CATEGORY[node.type];
    if (category) present.add(category);
  }
  return PART_CHIP_ORDER.filter((category) => present.has(category));
}

/** Per build, not per page: PostgREST applies an embedded limit per parent. */
const NODES_PER_BUILD = 6;

/**
 * Files and audio are filtered out rather than counted against this: a card
 * renders neither. A build carrying more than twelve images still gets a card
 * — the bodies fall through to their non-media branch when the row they wanted
 * falls outside this window, and every branch ends somewhere that renders.
 */
const MEDIA_PER_BUILD = 12;

/** The only two kinds a card can put on screen. */
const GALLERY_MEDIA_KINDS = ["image", "video"] as const;

/**
 * The pill says "bounty", not "bounties", and it takes the largest reward it
 * can see. Four rows per build is more than enough to find that and cheap
 * enough to be free; a build with more open asks than this has a page of its
 * own to show them on.
 */
const BOUNTIES_PER_BUILD = 4;

/**
 * The header columns a card reads. Explicit, because `*` on this table would
 * put monetisation and cost columns on the wire for every card that never
 * shows them.
 *
 * THE FIVE REBUILD COLUMNS ARE HERE BECAUSE THE CARD RENDERS THEM (NS-P40).
 * source_title_at_fork and source_handle_at_fork compose the credit line, which
 * the page hands down as a prop — they are on the wire so that the line can be
 * composed WITHOUT a second query per card, which is the whole reason
 * rebuildCredit.ts reads the frozen snapshot rather than the live parent.
 * parent_build_id and rebuild_note come with them because a card that credits a
 * source should be able to say whether that source is still there and what the
 * rebuilder said about it, and rebuild_count is the second earned number, shown
 * beside the reproduction count.
 */
export const GALLERY_BUILD_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url, hero_node_id, cover_media_id, completeness, reproduction_count, last_confirmed_at, last_confirmed_model, published_at, parent_build_id, rebuild_count, rebuild_note, source_title_at_fork, source_handle_at_fork";

const GALLERY_NODE_COLUMNS = "id, type, title, payload, position, is_gap";

/**
 * poster_path is on this list because a card renders a VIDEO from its poster
 * (NS-P31): a still it can transform to the card's width, rather than a video
 * element pulling frames for a card nobody has clicked.
 *
 * width and height are what BG-P09's card RESERVES ITS MEDIA SLOTS FROM. They
 * are not decoration: an `aspect-ratio` computed from the stored pixels holds
 * the space before the picture arrives, which is the difference between a
 * gallery that settles as it loads and one that does not move at all.
 *
 * duration is the video chip's only source — a recording whose probe never got
 * one simply has no chip, which is better than a card printing "0:00".
 *
 * post_position and post_text arrived with BG-P09, and cover.ts's note on
 * CoverMedia is the prompt for them: the thread resolver needs BOTH columns on
 * every row it is handed, and until this list carried them a card could not ask
 * what the creator's post was without a query of its own. They cost two narrow
 * columns on a request the card already makes.
 */
const GALLERY_MEDIA_COLUMNS =
  "id, node_id, bucket, path, kind, width, height, poster_path, duration, post_position, post_text";

/**
 * The bounty columns a card's pill reads (NS-P52).
 *
 * Three, because that is all a pill is: whether there is an open ask, and what
 * it pays. The gap it names, its deadline and its me-too count are the build
 * page's business — a card that carried them would put four columns per bounty
 * on the wire for a badge eight characters wide.
 */
const GALLERY_BOUNTY_COLUMNS = "id, reward_gbp, status";

/**
 * The select string, embeds and all.
 *
 * The !hint on build_nodes is required rather than decorative: builds carries
 * hero_node_id, so there are TWO foreign keys between builds and build_nodes
 * and PostgREST refuses an ambiguous embed. The hint names the one that means
 * "the nodes of this build".
 *
 * THE BOUNTY EMBED IS THE PILL, AND IT IS ONE QUERY (NS-P52). It rides in on
 * the request the cards already make, filtered to open rows by the
 * `bounties.status` clause in listGallery — so a grid of twenty-four cards
 * costs the same one request whether none of them carries an ask or all of
 * them do. `inner` is the same embed with the join made inner, which is what
 * turns "show me the pill" into "show me only the builds that have one"; it is
 * a second string rather than a flag because PostgREST reads the modifier out
 * of the select and there is nothing to toggle at runtime.
 */
export function gallerySelect(openBountiesOnly: boolean): string {
  const bounties = openBountiesOnly
    ? `bounties!bounties_build_id_fkey!inner(${GALLERY_BOUNTY_COLUMNS})`
    : `bounties!bounties_build_id_fkey(${GALLERY_BOUNTY_COLUMNS})`;
  return `${GALLERY_BUILD_COLUMNS}, build_nodes!build_nodes_build_id_fkey(${GALLERY_NODE_COLUMNS}), build_media!build_media_build_id_fkey(${GALLERY_MEDIA_COLUMNS}), ${bounties}`;
}

/** The builder methods withCardEmbeds calls; every PostgREST filter builder has them. */
interface CardEmbedQuery {
  in(column: string, values: readonly unknown[]): CardEmbedQuery;
  eq(column: string, value: unknown): CardEmbedQuery;
  order(
    column: string,
    options: { referencedTable: string; ascending: boolean; nullsFirst: boolean },
  ): CardEmbedQuery;
  limit(count: number, options: { referencedTable: string }): CardEmbedQuery;
}

/**
 * RC-P14c — the card's embedded filters and caps, for a list of cards that is
 * not the gallery's.
 *
 * A card is the gallery's card only when it carries what the gallery's query
 * gives it: the nodes its body reads, the pictures it shows, the open ask on
 * its pill. Where next reads its rows with gallerySelect(false) and this, so a
 * build looks the same at the foot of a build page as it does in the gallery
 * ⟦law-of-similarity⟧. The filters and caps are listGallery's own, key for
 * key; listGallery keeps its inline copy because its ORDER BY is locked
 * (CONTRACT §4), and whereNext.test.ts holds the two equal.
 */
export function withCardEmbeds<Q>(query: Q): Q {
  return (query as unknown as CardEmbedQuery)
    .in("build_nodes.type", [...GALLERY_NODE_TYPES])
    .in("build_media.kind", [...GALLERY_MEDIA_KINDS])
    .eq("bounties.status", "open")
    .order("position", { referencedTable: "build_nodes", ascending: true, nullsFirst: false })
    .limit(NODES_PER_BUILD, { referencedTable: "build_nodes" })
    .limit(MEDIA_PER_BUILD, { referencedTable: "build_media" })
    .limit(BOUNTIES_PER_BUILD, { referencedTable: "bounties" }) as unknown as Q;
}

/** A card's node: the embedded columns, nothing more. */
export type GalleryNode = Pick<
  BuildNode,
  "id" | "type" | "title" | "payload" | "position" | "is_gap"
>;

/**
 * A card's bounty row: is there an open ask on this build, and what does it pay.
 *
 * `status` is on it even though every row that arrives is open, because the
 * filter that makes that true lives in the query and a shape that depended on
 * a caller remembering to apply it would be a shape that lies the first time
 * somebody forgets.
 */
export type GalleryBounty = Pick<Bounty, "id" | "reward_gbp" | "status">;

/**
 * A card's media row. Satisfies MediaRef, so mediaUrl takes it as it stands —
 * and, since BG-P09, PostEntryMedia, so postEntriesOf takes it too.
 */
export type GalleryMedia = Pick<
  BuildMedia,
  | "id"
  | "node_id"
  | "bucket"
  | "path"
  | "kind"
  | "width"
  | "height"
  | "poster_path"
  | "duration"
  | "post_position"
  | "post_text"
>;

/** One card: a build header, the nodes its body reads, and their media. */
export interface GalleryBuild
  extends Pick<
    Build,
    | "id"
    | "creator_id"
    | "slug"
    | "title"
    | "outcome"
    | "shape"
    | "status"
    | "made_for"
    | "made_with"
    | "live_url"
    | "repo_url"
    | "hero_node_id"
    | "cover_media_id"
    | "completeness"
    | "reproduction_count"
    | "last_confirmed_at"
    | "last_confirmed_model"
    | "published_at"
    | "parent_build_id"
    | "rebuild_count"
    | "rebuild_note"
    | "source_title_at_fork"
    | "source_handle_at_fork"
  > {
  nodes: GalleryNode[];
  media: GalleryMedia[];
  /**
   * The open bounties on this build, when the caller's query asked for them.
   *
   * OPTIONAL, and the difference matters: an empty array means "asked, and
   * there are none", while absent means "nobody asked" — which is the honest
   * answer for a build assembled from a feed row that carried no bounty
   * columns. A card renders the pill for the first case and nothing for the
   * second, rather than announcing that a build has no ask on the strength of
   * a question that was never put.
   */
  bounties?: GalleryBounty[];
}

/**
 * The four ways a reader arrives at the gallery (RC-P10; CONTRACT §14), in the
 * order the lens row shows them ⟦hicks-law › Budgets: lens row⟧.
 *
 *   all        nothing narrowed: the gallery as it has always been
 *   proven     reproduced at least once and confirmed working within
 *              STALE_AFTER_DAYS: "does it work?"
 *   rebuilt    rebuilt at least once: "can I build on it?"
 *   unsolved   carrying an open bounty: "where can I help?"
 *
 * A LENS FILTERS; IT NEVER REORDERS. Every lens reads the same ORDER BY below,
 * so a build keeps its place relative to its neighbours whichever lens is on.
 */
export type GalleryLens = "all" | "proven" | "rebuilt" | "unsolved";

export const GALLERY_LENSES: readonly GalleryLens[] = ["all", "proven", "rebuilt", "unsolved"];

/** One day in milliseconds, for the proven lens's freshness cut-off. */
const DAY_MS = 86_400_000;

export interface GalleryFilters {
  /** Roles from made_for. Several are an OR: any one of them matches. */
  madeFor?: string[];
  /** Tools from made_with. Several are an OR. */
  madeWith?: string[];
  /**
   * Shapes (UI-P28). Several are an OR, and the whole is an AND with the other
   * filters. Values that are not one of GALLERY_SHAPES are dropped. Additive:
   * omitted or empty is the gallery exactly as it was.
   */
  shapes?: string[];
  /**
   * Only builds carrying an open bounty (NS-P52).
   *
   * An AND with the other two, like they are with each other: made for
   * lawyers, made with Claude, and asking for help. Additive — omitted or
   * false is the gallery exactly as it was. The Unsolved lens sets it.
   */
  openBounties?: boolean;
  /**
   * The lens (RC-P10). An AND with the facets and the query. Omitted, or a
   * value that is not one of GALLERY_LENSES, is "all".
   */
  lens?: GalleryLens;
  /**
   * What the reader searched for (RC-P10): SEARCH IS THE GALLERY WITH A QUERY.
   * Tidied by normaliseQuery here, so a query under two characters is no
   * query. It never appears in an error (CONTRACT §9).
   */
  query?: string;
}

export interface ListGalleryOptions extends GalleryFilters {
  limit?: number;
  offset?: number;
}

export interface GalleryPage {
  builds: GalleryBuild[];
  /** Total matching the filters, for pagination. Null if the count came back
   *  empty, which PostgREST does under some proxies rather than erroring. */
  total: number | null;
}

/** The one builder method applyLensFilters calls; every PostgREST filter builder has it. */
interface LensQuery {
  gte(column: string, value: string | number): LensQuery;
}

/** The oldest last_confirmed_at that still counts as fresh: the window isStale reads. */
function freshSince(now: number): string {
  return new Date(now - STALE_AFTER_DAYS * DAY_MS).toISOString();
}

/**
 * What a lens adds to a gallery query, on top of the membership clauses.
 *
 * Shared by listGallery and the counts (countGalleryLenses, getGalleryStats),
 * so a lens' number and its page cannot drift apart. Unsolved adds nothing
 * here: it is the inner bounty embed in the select and the `bounties.status`
 * clause, which a caller applies with the select it builds (see
 * gallerySelect and countGalleryBuilds).
 */
function applyLensFilters<Q>(query: Q, lens: GalleryLens, now: number = Date.now()): Q {
  const builder = query as unknown as LensQuery;
  if (lens === "proven") {
    // Confirmed within the same window isStale reads, from the same constant.
    return builder.gte("reproduction_count", 1).gte("last_confirmed_at", freshSince(now)) as unknown as Q;
  }
  if (lens === "rebuilt") {
    return builder.gte("rebuild_count", 1) as unknown as Q;
  }
  return query;
}

/**
 * One page of the gallery, in one request.
 *
 * THE ORDER, and what each key is for:
 *
 *   reproduction_count desc     someone other than the creator ran it. Nothing
 *                               else on the page is evidence in the same way.
 *   last_confirmed_at desc,     THE STALENESS DOWN-WEIGHT. Among builds with
 *     nulls last                the same reproduction count, the one confirmed
 *                               working most recently leads, so a stale build
 *                               falls below a fresh one of equal standing
 *                               without a second concept being invented for it.
 *   published_at desc           the tiebreak among never-confirmed builds.
 *
 * The residual case this ordering does not cover: a long-stale build with one
 * reproduction still outranks a never-confirmed build published yesterday,
 * because the second key sorts nulls last within the tie group rather than
 * against a clock. Fixing that needs now() in the ORDER BY, which means a view
 * or an RPC; the cards mark staleness in the freshness line either way.
 */
export async function listGallery(
  options: ListGalleryOptions = {}
): Promise<GalleryPage> {
  const limit = Math.max(1, Math.min(options.limit ?? GALLERY_PAGE_SIZE, 60));
  const offset = Math.max(0, options.offset ?? 0);

  const lens: GalleryLens = GALLERY_LENSES.includes(options.lens as GalleryLens)
    ? (options.lens as GalleryLens)
    : "all";
  // The Unsolved lens IS the open-bounty filter: it takes the existing branch
  // below rather than a second copy of it.
  const openBounties = options.openBounties === true || lens === "unsolved";
  const search = normaliseQuery(options.query);

  let query = supabase
    .from("builds")
    .select(gallerySelect(openBounties), { count: "exact" })
    // Never drafts. The RLS policy would hand a creator their own back.
    .in("status", ["published", "gallery"]);

  // SEARCH FINDS EVERY PUBLISHED BUILD (RC-P10). The completeness bar decides
  // what the gallery puts in front of a reader who came looking for nothing in
  // particular; a reader who typed a name is looking for one build, and a
  // record under the bar is still the record they meant. So with a query only
  // the status clause above holds, and the predicate is left off.
  if (search === null) query = query.or(galleryPredicate());

  query = query
    // Filters on an embedded column, without !inner, narrow the EMBEDDED rows
    // and leave the parent alone — a build with no prompt node still gets a
    // card, with an empty nodes array.
    .in("build_nodes.type", [...GALLERY_NODE_TYPES])
    .in("build_media.kind", [...GALLERY_MEDIA_KINDS])
    // The same rule with the opposite consequence when the embed is inner: a
    // build whose only bounty is solved keeps its card in the unfiltered
    // gallery and loses it under the filter, which is what the filter means.
    .eq("bounties.status", "open");

  const madeFor = cleanList(options.madeFor);
  if (madeFor.length > 0) query = query.overlaps("made_for", madeFor);

  const madeWith = cleanList(options.madeWith);
  if (madeWith.length > 0) query = query.overlaps("made_with", madeWith);

  const shapes = cleanShapes(options.shapes);
  if (shapes.length > 0) query = query.in("shape", shapes);

  // The query narrows to the ids search_build_ids matched. When it matched
  // nothing the answer is already known, so the builds request is never made.
  if (search !== null) {
    const ids = await searchBuildIds(search);
    if (ids.length === 0) return { builds: [], total: 0 };
    query = query.in("id", ids);
  }

  query = applyLensFilters(query, lens);

  const { data, error, count } = await query
    .order("reproduction_count", { ascending: false })
    .order("last_confirmed_at", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("position", {
      referencedTable: "build_nodes",
      ascending: true,
      nullsFirst: false,
    })
    .limit(NODES_PER_BUILD, { referencedTable: "build_nodes" })
    .limit(MEDIA_PER_BUILD, { referencedTable: "build_media" })
    .limit(BOUNTIES_PER_BUILD, { referencedTable: "bounties" })
    .range(offset, offset + limit - 1);

  if (error) throw buildLayerError("listGallery", error);

  const builds = ((data ?? []) as unknown as GalleryRow[]).map(toGalleryBuild);
  return { builds, total: count ?? null };
}

/**
 * status = 'gallery', OR this shape's threshold met.
 *
 * Written per shape rather than as one number because the thresholds are
 * shape-relative and live in TypeScript, where the rule table they derive from
 * lives. The database is told the answers, not asked to work them out — which
 * is also why there is no view here to fall out of step with SHAPE_RULES.
 */
function galleryPredicate(): string {
  const clauses = (Object.keys(GALLERY_THRESHOLD) as BuildShape[]).map(
    (shape) => `and(shape.eq.${shape},completeness.gte.${GALLERY_THRESHOLD[shape]})`
  );
  return ["status.eq.gallery", ...clauses].join(",");
}

/** The row as PostgREST returns it: embeds keyed by table name. */
export interface GalleryRow
  extends Omit<GalleryBuild, "nodes" | "media" | "bounties"> {
  build_nodes: GalleryNode[] | null;
  build_media: GalleryMedia[] | null;
  bounties: GalleryBounty[] | null;
}

export function toGalleryBuild(row: GalleryRow): GalleryBuild {
  const { build_nodes, build_media, bounties, ...header } = row;
  return {
    ...header,
    nodes: build_nodes ?? [],
    media: build_media ?? [],
    // Always an array here, never absent: this query asked. See GalleryBuild.
    bounties: bounties ?? [],
  };
}

// =============================================================================
// The facets
// =============================================================================

/** One filter option: the stored value, how many builds carry it, its name. */
export interface GalleryFacet {
  /** The value as stored in made_for / made_with. What the query filters on. */
  value: string;
  count: number;
  /** The registry's name for a tool, when one matched. Null otherwise. */
  label: string | null;
  logo_url: string | null;
}

export interface GalleryFacets {
  roles: GalleryFacet[];
  tools: GalleryFacet[];
}

export const NO_FACETS: GalleryFacets = { roles: [], tools: [] };

/**
 * The values worth offering as filters, counted over the same set of builds
 * the gallery shows.
 *
 * One request, because the alternative — reading every gallery build's arrays
 * back to count them in the browser — is the fifteen-query pattern wearing a
 * different hat, and it would offer a filter for a role that only appears on
 * page four.
 *
 * The thresholds travel WITH the call rather than living in the function, for
 * the same reason the main query spells them out: SHAPE_RULES is the source,
 * and a copy of these numbers in SQL is a copy that goes stale.
 */
export async function getGalleryFacets(): Promise<GalleryFacets> {
  const { data, error } = await supabase.rpc("gallery_facets", {
    thresholds: GALLERY_THRESHOLD as unknown as Record<string, number>,
  });

  if (error) throw buildLayerError("getGalleryFacets", error);

  const payload = (data ?? {}) as Partial<GalleryFacets>;
  return {
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    tools: Array.isArray(payload.tools) ? payload.tools : [],
  };
}

/**
 * How many gallery builds carry an open bounty (NS-P52).
 *
 * ONE HEAD REQUEST, no rows. `head: true` asks PostgREST for the count and
 * nothing else, so the facet chip costs a count over the same predicate the
 * grid uses rather than a page of cards nobody rendered.
 *
 * EXACT, against this project's usual preference for estimates, and for the
 * reason NS-P50's bounty counts gave: an estimate comes from the planner's row
 * statistics, which are wrong by design for a filter this narrow — "gallery
 * builds with an open ask" is a handful of rows out of a table-wide estimate —
 * and a chip reading 4 above a grid of 7 is a bug report.
 *
 * Returns 0 rather than throwing when the count cannot be read: the chip is an
 * offer, and a gallery that failed to load because a badge could not be
 * numbered would be the wrong trade.
 */
export async function countOpenBountyBuilds(): Promise<number> {
  const { count, error } = await supabase
    .from("builds")
    .select(`id, bounties!bounties_build_id_fkey!inner(id)`, {
      count: "exact",
      head: true,
    })
    .in("status", ["published", "gallery"])
    .or(galleryPredicate())
    .eq("bounties.status", "open");

  if (error) {
    console.warn("[countOpenBountyBuilds] count unavailable", error);
    return 0;
  }
  return count ?? 0;
}

// =============================================================================
// The featured build
// =============================================================================

/** The window "most reproduced" looks back over. */
const FEATURED_WINDOW_DAYS = 30;

/** The most reproduction rows read to rank builds; past it the ranking is partial. */
const FEATURED_ROWS_LIMIT = 5000;

/**
 * The top builds by count that are checked against the gallery's rule. Ties
 * are settled among these, which is far more than ever tie at the top.
 */
const FEATURED_CANDIDATES = 100;

/** The columns inGallery reads, and the tie-break. */
const FEATURED_RANK_COLUMNS = "id, status, shape, completeness, last_confirmed_at";

/** The build the Gallery's hero shows, and the numbers beside it. */
export interface FeaturedBuild {
  build: GalleryBuild;
  /** Reproductions recorded in the 30 days before `now`. */
  reproductions30d: number;
  /** The one-line outcome, as the build header shows it. */
  outcome: string | null;
}

/**
 * "Most reproduced this month": the gallery build with the most reproductions
 * in the 30 days before `now`, or null when nothing was reproduced.
 *
 * Counted in code from `build_id` rows, newest window first, because grouping
 * is not something PostgREST does. The read is capped at FEATURED_ROWS_LIMIT
 * rows; if the cap is reached the ranking covers only those rows, which is
 * logged and still returned.
 *
 * Ties go to the most recently confirmed build. A build outside the gallery
 * (a draft is never visible; a record under its bar is) is passed over for the
 * next one down, by the rule `inGallery` applies to a loaded build.
 */
export async function getFeaturedBuild(now: Date = new Date()): Promise<FeaturedBuild | null> {
  const since = new Date(now.getTime() - FEATURED_WINDOW_DAYS * DAY_MS).toISOString();

  const reproductions = await supabase
    .from("build_reproductions")
    .select("build_id")
    .gte("created_at", since)
    .limit(FEATURED_ROWS_LIMIT);

  if (reproductions.error) throw buildLayerError("getFeaturedBuild (reproductions)", reproductions.error);

  const rows = (reproductions.data ?? []) as Array<{ build_id: string }>;
  if (rows.length >= FEATURED_ROWS_LIMIT) {
    // TODO: replace with an RPC that groups build_reproductions by build_id in
    // SQL (a `most_reproduced_builds(since, limit)` function, security invoker),
    // which has no row cap to rank around.
    console.warn(`[getFeaturedBuild] read the ${FEATURED_ROWS_LIMIT}-row cap; the ranking is partial`);
  }

  const counts = new Map<string, number>();
  for (const { build_id } of rows) counts.set(build_id, (counts.get(build_id) ?? 0) + 1);
  if (counts.size === 0) return null;

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, FEATURED_CANDIDATES);

  const candidates = await supabase
    .from("builds")
    .select(FEATURED_RANK_COLUMNS)
    .in("id", ranked.map(([id]) => id))
    .limit(FEATURED_CANDIDATES);

  if (candidates.error) throw buildLayerError("getFeaturedBuild (candidates)", candidates.error);

  type RankRow = Pick<Build, "id" | "status" | "shape" | "completeness" | "last_confirmed_at">;
  const inGalleryById = new Map<string, RankRow>();
  for (const row of (candidates.data ?? []) as unknown as RankRow[]) {
    if (inGallery(row)) inGalleryById.set(row.id, row);
  }

  const confirmedAt = (id: string) => Date.parse(inGalleryById.get(id)?.last_confirmed_at ?? "") || 0;
  const top = ranked
    .filter(([id]) => inGalleryById.has(id))
    .sort((a, b) => b[1] - a[1] || confirmedAt(b[0]) - confirmedAt(a[0]))[0];
  if (!top) return null;

  const [id, reproductions30d] = top;

  // The card's own select, so the hero has the nodes and pictures a card has.
  const loaded = await withCardEmbeds(
    supabase.from("builds").select(gallerySelect(false)).eq("id", id).limit(1),
  );
  if (loaded.error) throw buildLayerError("getFeaturedBuild (build)", loaded.error);

  const row = ((loaded.data ?? []) as unknown as GalleryRow[])[0];
  if (!row) return null;

  const build = toGalleryBuild(row);
  return { build, reproductions30d, outcome: build.outcome?.trim() || null };
}

// =============================================================================
// The lens counts
// =============================================================================

/**
 * An estimated head count of the gallery's builds under one lens: the same
 * membership clauses and the same lens filters listGallery applies, and no rows.
 *
 * ESTIMATED, because PostgREST answers an estimated count with the exact one
 * until the table is large enough for the planner's figure to be close, so a
 * small gallery is counted exactly and a large one cheaply. Unsolved joins
 * bounties as countOpenBountyBuilds does.
 *
 * `freshOnly` adds the confirmed-within-STALE_AFTER_DAYS clause on its own,
 * without Proven's reproduction clause: the freshness figure getGalleryStats
 * reports counts every gallery build, run by someone or not.
 */
async function countGalleryBuilds(
  operation: string,
  lens: GalleryLens,
  now: number,
  freshOnly = false,
  shape?: BuildShape,
): Promise<number> {
  const unsolved = lens === "unsolved";

  let query = supabase
    .from("builds")
    .select(unsolved ? "id, bounties!bounties_build_id_fkey!inner(id)" : "id", {
      count: "estimated",
      head: true,
    })
    .in("status", ["published", "gallery"])
    .or(galleryPredicate());

  if (unsolved) query = query.eq("bounties.status", "open");
  query = applyLensFilters(query, lens, now);
  if (freshOnly) query = query.gte("last_confirmed_at", freshSince(now));
  if (shape) query = query.eq("shape", shape);

  const { count, error } = await query;
  if (error) throw buildLayerError(operation, error);
  return count ?? 0;
}

/**
 * How many gallery builds each lens holds, for the numbers on the lens row.
 * One head request per lens, sent together.
 */
export async function countGalleryLenses(): Promise<Record<GalleryLens, number>> {
  const now = Date.now();
  const counts = await Promise.all(
    GALLERY_LENSES.map((lens) => countGalleryBuilds("countGalleryLenses", lens, now)),
  );

  const out = {} as Record<GalleryLens, number>;
  GALLERY_LENSES.forEach((lens, index) => {
    out[lens] = counts[index];
  });
  return out;
}

// =============================================================================
// The shape facet
// =============================================================================

/** The nine shapes, as the gallery's threshold table names them. */
export const GALLERY_SHAPES = Object.keys(GALLERY_THRESHOLD) as readonly BuildShape[];

/** One shape and how many gallery builds have it. */
export interface GalleryShapeFacet {
  value: BuildShape;
  count: number;
}

/**
 * The shapes worth offering as a filter, counted over the gallery's builds.
 *
 * NOT PART OF `gallery_facets`, whose roles and tools come from one RPC: adding
 * shapes to it is a database change, and this is not one. One estimated head
 * count per shape, sent together over the same membership clauses the grid and
 * the lens counts use, so a shape's number and its page cannot drift apart.
 * Shapes with no builds are left out; the rest are ordered by count, then name.
 */
export async function getGalleryShapeFacets(): Promise<GalleryShapeFacet[]> {
  const now = Date.now();
  const counts = await Promise.all(
    GALLERY_SHAPES.map((shape) => countGalleryBuilds("getGalleryShapeFacets", "all", now, false, shape)),
  );

  return GALLERY_SHAPES.map((value, index) => ({ value, count: counts[index] }))
    .filter((facet) => facet.count > 0)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** The numbers on the Gallery's stats row. */
export interface GalleryStats {
  /** Builds in the gallery: the All lens' count. */
  inGallery: number;
  /** Reproductions recorded since Monday 00:00 UTC. */
  reproducedThisWeek: number;
  /** WEEKLY_REPRODUCTION_GOAL; null while no target is set. */
  weeklyGoal: number | null;
  /** Gallery builds confirmed within STALE_AFTER_DAYS, as a whole percentage of inGallery. */
  freshPct: number;
}

/**
 * The stats row: how many builds the gallery holds, how many runs this week,
 * and how much of the gallery is still fresh. Three head counts, sent together.
 *
 * `freshPct` reads the same window isStale does, over the same builds the
 * gallery shows, and is 0 for an empty gallery rather than a divide by zero.
 */
export async function getGalleryStats(): Promise<GalleryStats> {
  const now = Date.now();
  const [inGalleryCount, freshCount, reproducedThisWeek] = await Promise.all([
    countGalleryBuilds("getGalleryStats", "all", now),
    countGalleryBuilds("getGalleryStats (fresh)", "all", now, true),
    countRunsThisWeek(new Date(now)),
  ]);

  return {
    inGallery: inGalleryCount,
    reproducedThisWeek,
    weeklyGoal: WEEKLY_REPRODUCTION_GOAL,
    // Counts are estimates, so the fresh figure can overshoot the total.
    freshPct:
      inGalleryCount > 0 ? Math.min(100, Math.round((freshCount / inGalleryCount) * 100)) : 0,
  };
}

// =============================================================================
// Shared
// =============================================================================

function cleanList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/** Only shapes the gallery knows, trimmed, first occurrence kept. */
function cleanShapes(values: string[] | undefined): BuildShape[] {
  const known = new Set<string>(GALLERY_SHAPES);
  return cleanList(values).filter((value): value is BuildShape => known.has(value));
}

// =============================================================================
// The Gallery feed (UI-P44b)
// =============================================================================
//
// Model-aware proof per build. listGallery is untouched; this is its own read,
// on the same shared select (gallerySelect) and withCardEmbeds, so a card is
// the same card.

export const FEED_PAGE_SIZE = GALLERY_PAGE_SIZE;

/** Builds the model view and the counts rank in the app. Past this a view or RPC takes over. */
const FEED_POPULATION_CAP = 500;
/** Worked reproductions read to find the builds reproduced on one model. */
const FEED_REPRODUCTION_ROWS_CAP = 500;
/** Handles matched by a handle-shaped query. */
const FEED_HANDLE_LIMIT = 20;
const FEED_ID_CHUNK = 100;

export type GalleryFeedSort = "newest" | "reproduced" | "confirmed" | "rebuilt";

export interface GalleryFeedParams {
  /** A ModelVersion id. An id the registry does not name is ignored. */
  model?: string;
  /** A made_for value. */
  audience?: string;
  sort: GalleryFeedSort;
  q?: string;
  /** Zero-based. With a model it pages both lists. */
  page: number;
}

/** One feed row: the gallery's card data plus what the feed adds. */
export interface GalleryFeedRow extends GalleryBuild {
  models_used: string[];
  /** profiles.username; null when the profile has none or was not found. */
  creatorHandle: string | null;
  /** Reproductions by model, most worked first. */
  proof: ModelProof[];
}

export interface GalleryFeedCounts {
  all: number;
  /** ModelVersion id → gallery builds with a worked reproduction on it. */
  byModel: Record<string, number>;
}

export type GalleryFeed =
  | { kind: "all"; model: null; rows: GalleryFeedRow[]; hasMore: boolean; counts: GalleryFeedCounts }
  | {
      kind: "model";
      model: ModelVersion;
      /** Builds with a worked reproduction on the model, sorted by that model's figures. */
      reproducedOn: GalleryFeedRow[];
      /** Every other gallery build, in the sort's overall order. */
      notYet: GalleryFeedRow[];
      hasMoreReproducedOn: boolean;
      hasMoreNotYet: boolean;
      counts: GalleryFeedCounts;
    };

/** The builder methods the feed calls on a builds query. */
interface FeedQuery extends PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  in(column: string, values: readonly unknown[]): FeedQuery;
  or(filters: string): FeedQuery;
  eq(column: string, value: unknown): FeedQuery;
  ilike(column: string, pattern: string): FeedQuery;
  gte(column: string, value: string | number): FeedQuery;
  contains(column: string, values: readonly unknown[]): FeedQuery;
  overlaps(column: string, values: readonly unknown[]): FeedQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): FeedQuery;
  limit(count: number): FeedQuery;
  range(from: number, to: number): FeedQuery;
}

interface FeedFrom {
  select(columns: string, options?: { count: "exact" }): FeedQuery;
}

function feedTable(table: string): FeedFrom {
  return (supabase as unknown as { from: (name: string) => FeedFrom }).from(table);
}

const FEED_LIGHT_COLUMNS = "id, published_at, rebuild_count, reproduction_count, last_confirmed_at";

interface LightRow {
  id: string;
  published_at: string | null;
  rebuild_count: number | null;
  reproduction_count: number | null;
  last_confirmed_at: string | null;
}

/** A handle-shaped query: one word of handle characters, optionally with its @. */
const HANDLE_SHAPE = /^@?[a-z0-9_.-]{2,30}$/i;

/**
 * THE INTERIM SEARCH, until search_build_ids exists on live (audit fix 1).
 *
 * listGallery's query goes through the search_build_ids RPC, which returns 404
 * on live, so the feed does not use it. This asks the table directly: title and
 * outcome by ilike; a build whose models_used holds the named version when the
 * query is one; and the builds of a creator whose handle matches when the
 * query looks like a handle (one profiles lookup, at most FEED_HANDLE_LIMIT).
 * Returns one PostgREST `or` clause, or null when there is no query. Delete
 * this when the RPC is on live and the feed can take its ids as listGallery does.
 */
async function feedSearchClause(raw: string | undefined): Promise<string | null> {
  const q = normaliseQuery(raw);
  if (q === null) return null;

  // Characters that would end or split an `or` clause or act as a wildcard.
  const text = q.replace(/[,()"\\%*]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;

  const clauses = [`title.ilike.%${text}%`, `outcome.ilike.%${text}%`];

  const version = normaliseModel(q);
  if (version) clauses.push(`models_used.cs.{"${version.name}"}`);

  if (HANDLE_SHAPE.test(q)) {
    const handle = q.replace(/^@/, "");
    const { data, error } = await feedTable("profiles")
      .select("id")
      .ilike("username", `%${handle}%`)
      .limit(FEED_HANDLE_LIMIT);
    if (error) throw buildLayerError("listGalleryFeed", error);
    const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
    if (ids.length > 0) clauses.push(`creator_id.in.(${ids.join(",")})`);
  }

  return clauses.join(",");
}

/** The gallery's membership rule plus the feed's audience and search. */
function feedBase(
  columns: string,
  audience: string | undefined,
  search: string | null,
  withCount = false
): FeedQuery {
  let query = feedTable("builds")
    .select(columns, withCount ? { count: "exact" } : undefined)
    .in("status", ["published", "gallery"])
    // A second `or` is an AND with the first: PostgREST ANDs repeated filters.
    .or(galleryPredicate());
  if (audience) query = query.overlaps("made_for", [audience]);
  if (search) query = query.or(search);
  return query;
}

/** The sort's own database order, with id last so a page never repeats a row. */
function feedOrder(query: FeedQuery, sort: GalleryFeedSort): FeedQuery {
  const desc = { ascending: false, nullsFirst: false };
  let q = query;
  if (sort === "reproduced") {
    q = q.order("reproduction_count", desc).order("last_confirmed_at", desc);
  } else if (sort === "confirmed") {
    q = q.order("last_confirmed_at", desc);
  } else if (sort === "rebuilt") {
    q = q.order("rebuild_count", desc);
  }
  return q.order("published_at", desc).order("id", { ascending: true });
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) || 0 : 0);

/** Creator id → handle: one profiles lookup per 100 ids (a feed page is one). */
async function creatorHandles(creatorIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(creatorIds)];
  const out = new Map<string, string | null>();
  for (let i = 0; i < ids.length; i += FEED_ID_CHUNK) {
    const chunk = ids.slice(i, i + FEED_ID_CHUNK);
    const { data, error } = await feedTable("profiles")
      .select("id, username")
      .in("id", chunk)
      .limit(chunk.length);
    if (error) throw buildLayerError("listGalleryFeed", error);
    for (const row of (data ?? []) as { id: string; username: string | null }[]) {
      out.set(row.id, row.username ?? null);
    }
  }
  return out;
}

/** The card data for these ids, in the order given. One request (ids are at most two pages). */
async function feedRows(
  ids: string[],
  known: Record<string, ModelProof[]>
): Promise<GalleryFeedRow[]> {
  if (ids.length === 0) return [];

  const query = withCardEmbeds(
    feedTable("builds").select(`${gallerySelect(false)}, models_used`).in("id", ids)
  ).limit(ids.length);
  const { data, error } = await query;
  if (error) throw buildLayerError("listGalleryFeed", error);

  const byId = new Map(
    ((data ?? []) as unknown as (GalleryRow & { models_used: string[] | null })[]).map((row) => [row.id, row])
  );
  const found = ids.filter((id) => byId.has(id));

  const missing = found.filter((id) => !(id in known));
  const [handles, fetched] = await Promise.all([
    creatorHandles(found.map((id) => byId.get(id)!.creator_id)),
    missing.length > 0 ? getReproductionsByModel(missing) : Promise.resolve({} as Record<string, ModelProof[]>),
  ]);

  return found.map((id) => {
    const row = byId.get(id)!;
    return {
      ...toGalleryBuild(row),
      models_used: row.models_used ?? [],
      creatorHandle: handles.get(row.creator_id) ?? null,
      proof: known[id] ?? fetched[id] ?? [],
    };
  });
}

/**
 * The Model menu's numbers: how many gallery builds are reproduced on each
 * version, and how many there are.
 *
 * ONE GROUPED READ of getReproductionsByModel over the gallery's build ids,
 * CAPPED AT 500 BUILDS (newest first). `all` is the true total; byModel counts
 * within the 500. When the gallery passes that, a view or an RPC replaces this.
 * Unfiltered on purpose: the menu says what exists, not what the search found.
 */
async function feedCounts(): Promise<GalleryFeedCounts> {
  const { data, error, count } = await feedBase("id", undefined, null, true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(FEED_POPULATION_CAP);
  if (error) throw buildLayerError("listGalleryFeed", error);

  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  const proofs = await getReproductionsByModel(ids);

  const byModel: Record<string, number> = {};
  for (const id of ids) {
    for (const proof of proofs[id] ?? []) {
      if (proof.modelId && proof.worked > 0) byModel[proof.modelId] = (byModel[proof.modelId] ?? 0) + 1;
    }
  }
  return { all: count ?? ids.length, byModel };
}

/** The aliases to look for in build_reproductions.model_used, as one `or`. */
function aliasClause(version: ModelVersion): string {
  const spellings = [version.id, version.name, ...version.aliases].map((s) => s.toLowerCase());
  return [...new Set(spellings)].map((alias) => `model_used.ilike.%${alias}%`).join(",");
}

/**
 * The ids of builds with a worked reproduction on this version.
 *
 * Asks build_reproductions for worked rows whose model_used contains any alias
 * (newest 500), then CONFIRMS each with normaliseModel: ilike over-matches
 * ("claude-opus-5" is inside "claude-opus-5-5"), the registry is the judge.
 */
async function reproducedOnIds(version: ModelVersion): Promise<string[]> {
  const { data, error } = await feedTable("build_reproductions")
    .select("build_id, model_used")
    .eq("worked", true)
    .or(aliasClause(version))
    .order("confirmed_at", { ascending: false })
    .limit(FEED_REPRODUCTION_ROWS_CAP);
  if (error) throw buildLayerError("listGalleryFeed", error);

  const ids = new Set<string>();
  for (const row of (data ?? []) as { build_id: string; model_used: string | null }[]) {
    if (normaliseModel(row.model_used)?.id === version.id) ids.add(row.build_id);
  }
  return [...ids];
}

/**
 * One page of the Gallery feed.
 *
 * WITHOUT A MODEL: one list, ordered in the database by the sort — newest by
 * published_at; reproduced by reproduction_count (the builds' own worked
 * figure); confirmed by last_confirmed_at; rebuilt by rebuild_count — and paged
 * with a range. One request for the cards, plus one profiles lookup and one
 * proof read per page.
 *
 * WITH A MODEL: { reproducedOn, notYet }. reproducedOn is the builds with a
 * worked reproduction on that version, sorted IN THE APP by that model's own
 * figures (its worked count, its newest confirmation). notYet is the rest of
 * the gallery in the sort's overall order. Both come from at most 500 builds
 * (see feedCounts) and page separately off params.page.
 */
export async function listGalleryFeed(params: GalleryFeedParams): Promise<GalleryFeed> {
  const page = Math.max(0, Math.floor(params.page) || 0);
  const start = page * FEED_PAGE_SIZE;
  const end = start + FEED_PAGE_SIZE;
  const audience = params.audience?.trim() || undefined;
  const version = params.model ? MODEL_VERSIONS.find((v) => v.id === params.model) ?? null : null;

  const [search, counts] = await Promise.all([feedSearchClause(params.q), feedCounts()]);

  if (version === null) {
    const query = withCardEmbeds(
      feedOrder(feedBase(`${gallerySelect(false)}, models_used`, audience, search), params.sort)
    ).range(start, end);
    const { data, error } = await query;
    if (error) throw buildLayerError("listGalleryFeed", error);

    const all = (data ?? []) as unknown as (GalleryRow & { models_used: string[] | null })[];
    const pageRows = all.slice(0, FEED_PAGE_SIZE);
    const [handles, proofs] = await Promise.all([
      creatorHandles(pageRows.map((row) => row.creator_id)),
      getReproductionsByModel(pageRows.map((row) => row.id)),
    ]);
    const rows: GalleryFeedRow[] = pageRows.map((row) => ({
      ...toGalleryBuild(row),
      models_used: row.models_used ?? [],
      creatorHandle: handles.get(row.creator_id) ?? null,
      proof: proofs[row.id] ?? [],
    }));
    return { kind: "all", model: null, rows, hasMore: all.length > FEED_PAGE_SIZE, counts };
  }

  // reproducedOn: candidates from the reproductions, then the gallery's rule on them.
  const candidates = await reproducedOnIds(version);
  const light: LightRow[] = [];
  for (let i = 0; i < candidates.length; i += FEED_ID_CHUNK) {
    const chunk = candidates.slice(i, i + FEED_ID_CHUNK);
    const { data, error } = await feedBase(FEED_LIGHT_COLUMNS, audience, search)
      .in("id", chunk)
      .limit(chunk.length);
    if (error) throw buildLayerError("listGalleryFeed", error);
    light.push(...((data ?? []) as unknown as LightRow[]));
  }

  const proofs = await getReproductionsByModel(light.map((row) => row.id));
  const figure = (id: string): ModelProof | undefined => proofs[id]?.find((p) => p.modelId === version.id);

  const reproduced = light
    .filter((row) => (figure(row.id)?.worked ?? 0) > 0)
    .sort((a, b) => {
      const fa = figure(a.id);
      const fb = figure(b.id);
      const byPublished = time(b.published_at) - time(a.published_at);
      let primary = 0;
      if (params.sort === "reproduced") primary = (fb?.worked ?? 0) - (fa?.worked ?? 0);
      else if (params.sort === "confirmed") primary = time(fb?.lastConfirmedAt ?? null) - time(fa?.lastConfirmedAt ?? null);
      else if (params.sort === "rebuilt") primary = (b.rebuild_count ?? 0) - (a.rebuild_count ?? 0);
      return primary || byPublished || a.id.localeCompare(b.id);
    });
  const reproducedIds = new Set(reproduced.map((row) => row.id));

  // notYet: the rest of the (capped) gallery, in the sort's overall order.
  const { data: populationData, error: populationError } = await feedOrder(
    feedBase("id", audience, search),
    params.sort
  ).limit(FEED_POPULATION_CAP);
  if (populationError) throw buildLayerError("listGalleryFeed", populationError);
  const notYet = ((populationData ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !reproducedIds.has(id));

  const onIds = reproduced.slice(start, end).map((row) => row.id);
  const notIds = notYet.slice(start, end);
  const rows = await feedRows([...onIds, ...notIds], proofs);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is GalleryFeedRow => !!r);

  return {
    kind: "model",
    model: version,
    reproducedOn: pick(onIds),
    notYet: pick(notIds),
    hasMoreReproducedOn: reproduced.length > end,
    hasMoreNotYet: notYet.length > end,
    counts,
  };
}

// =============================================================================
// The Gallery dashboard (UI-P44c)
// =============================================================================

/**
 * The builds columns the dashboard selects: one row per build, how it was made
 * and what people did with it.
 *
 * ONLY COLUMNS UI-P42 FOUND ON LIVE (docs/proposals/UI-P42-sessions-and-making.md
 * §2, Q3). A column missing live fails the whole query, so it is left out and
 * counts as 0: `comment_count` and `save_count` are NOT live, so they are not
 * here and engagement.comments and engagement.saves are 0 until they are.
 * `reproduction_count` and `rebuild_count` are live. session_count,
 * prompt_count, ai_turn_count, models_used and making are the five columns the
 * UI-P42 migration adds (supabase/migrations/20261001280000_sessions_and_making.sql,
 * UI-P43a); the dashboard needs them, so that migration must be applied.
 */
export const DASHBOARD_BUILD_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, completeness, " +
  "reproduction_count, rebuild_count, last_confirmed_at, last_confirmed_model, published_at, " +
  "session_count, prompt_count, ai_turn_count, models_used, making";

/**
 * At most this many gallery builds. THE CAP EXISTS SO SORTING CAN HAPPEN IN THE
 * APP: engagement.total is a sum of figures from four places, so the dashboard
 * sorts it over these rows without a view. Past this a view replaces it.
 */
export const DASHBOARD_ROW_LIMIT = 200;

export interface DashboardSession {
  client: string | null;
  model: string | null;
  prompts: number;
  turns: number;
}

export interface DashboardEngagement {
  runs: number;
  rebuilds: number;
  comments: number;
  saves: number;
  total: number;
}

export interface DashboardRow {
  id: string;
  slug: string;
  title: string;
  /** handle is "" when the profile has no username. */
  creator: { id: string; handle: string };
  outcome: string | null;
  madeFor: string[];
  modelsUsed: string[];
  sessionCount: number;
  promptCount: number;
  aiTurnCount: number;
  making: { sessions: DashboardSession[] };
  // for the plaque and the gallery rule:
  reproduction_count: number;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
  status: string;
  shape: string;
  completeness: number;
  engagement: DashboardEngagement;
  /** at is "" only for a build with no published_at and nothing else on record. */
  lastActivity: { at: string; what: string };
  /** 14 weekly values, oldest first. */
  series: number[];
  proof: ModelProof[];
}

export interface GalleryDashboardParams {
  /** A ModelVersion id; matched on the version's NAME in models_used. */
  model?: string;
  lab?: Lab;
  audience?: string;
  activeWithinDays?: 7 | 30 | 90;
  report?: "month" | "multi";
  q?: string;
}

interface DashboardBuildRow {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  outcome: string | null;
  shape: string;
  status: string;
  made_for: string[] | null;
  completeness: number | null;
  reproduction_count: number | null;
  rebuild_count: number | null;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
  session_count: number | null;
  prompt_count: number | null;
  ai_turn_count: number | null;
  models_used: string[] | null;
  making: unknown;
}

const WEEK_MS = 7 * 86_400_000;
const SERIES_ROWS_PER_CHUNK = 5000;
const REBUILD_ROWS_PER_CHUNK = 1000;
export const ENGAGEMENT_WEEKS = 14;

const count = (value: number | null | undefined): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** builds.making is jsonb the maker can write: keep only what has the shape. */
function dashboardSessions(making: unknown): DashboardSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => ({
      client: typeof entry.client === "string" ? entry.client : null,
      model: typeof entry.model === "string" ? entry.model : null,
      prompts: count(entry.prompts as number),
      turns: count(entry.turns as number),
    }));
}

/** The week bucket of a timestamp, 0 = oldest of `weeks`, or -1 outside the window. */
function weekBucket(iso: string | null, thisWeek: number, weeks: number): number {
  const at = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(at)) return -1;
  const ago = Math.floor((thisWeek - weekStartUtc(new Date(at)).getTime()) / WEEK_MS);
  const index = weeks - 1 - ago;
  return index >= 0 && index < weeks ? index : -1;
}

/**
 * Per build, a count per ISO week (Monday to Sunday, UTC), oldest first, the
 * last being the week that holds `now`: reproductions of any outcome (by
 * confirmed_at) plus published rebuilds (by published_at).
 *
 * COMMENTS AND SAVES ARE LEFT OUT until their tables exist on live (UI-P42:
 * comment_count and save_count are not there); add them here when they are.
 * Every id asked for is a key; a quiet build is all zeros.
 */
export async function getEngagementSeries(
  buildIds: string[],
  weeks: number = ENGAGEMENT_WEEKS,
  now: Date = new Date()
): Promise<Record<string, number[]>> {
  const span = Math.max(1, Math.min(Math.floor(weeks) || ENGAGEMENT_WEEKS, 52));
  const ids = [...new Set(buildIds)];
  const out: Record<string, number[]> = {};
  for (const id of ids) out[id] = new Array<number>(span).fill(0);

  const thisWeek = weekStartUtc(now).getTime();
  const since = new Date(thisWeek - (span - 1) * WEEK_MS).toISOString();

  for (let i = 0; i < ids.length; i += FEED_ID_CHUNK) {
    const chunk = ids.slice(i, i + FEED_ID_CHUNK);

    const reproductions = await feedTable("build_reproductions")
      .select("build_id, confirmed_at")
      .in("build_id", chunk)
      .gte("confirmed_at", since)
      .limit(SERIES_ROWS_PER_CHUNK);
    if (reproductions.error) throw buildLayerError("getEngagementSeries", reproductions.error);
    for (const row of (reproductions.data ?? []) as { build_id: string; confirmed_at: string | null }[]) {
      const bucket = weekBucket(row.confirmed_at, thisWeek, span);
      if (bucket >= 0 && out[row.build_id]) out[row.build_id][bucket] += 1;
    }

    const rebuilds = await feedTable("builds")
      .select("parent_build_id, published_at")
      .in("parent_build_id", chunk)
      .in("status", ["published", "gallery"])
      .gte("published_at", since)
      .limit(SERIES_ROWS_PER_CHUNK);
    if (rebuilds.error) throw buildLayerError("getEngagementSeries", rebuilds.error);
    for (const row of (rebuilds.data ?? []) as { parent_build_id: string; published_at: string | null }[]) {
      const bucket = weekBucket(row.published_at, thisWeek, span);
      if (bucket >= 0 && out[row.parent_build_id]) out[row.parent_build_id][bucket] += 1;
    }
  }
  return out;
}

/** The newest published rebuild of each build, with who made it. */
async function latestRebuilds(
  buildIds: string[]
): Promise<Map<string, { creatorId: string; at: string }>> {
  const out = new Map<string, { creatorId: string; at: string }>();
  for (let i = 0; i < buildIds.length; i += FEED_ID_CHUNK) {
    const chunk = buildIds.slice(i, i + FEED_ID_CHUNK);
    const { data, error } = await feedTable("builds")
      .select("parent_build_id, creator_id, published_at")
      .in("parent_build_id", chunk)
      .in("status", ["published", "gallery"])
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(REBUILD_ROWS_PER_CHUNK);
    if (error) throw buildLayerError("listGalleryDashboard", error);
    for (const row of (data ?? []) as { parent_build_id: string; creator_id: string; published_at: string | null }[]) {
      // Newest first, so the first row seen for a parent is its latest.
      if (row.published_at && !out.has(row.parent_build_id)) {
        out.set(row.parent_build_id, { creatorId: row.creator_id, at: row.published_at });
      }
    }
  }
  return out;
}

/** The newest of the latest reproduction, the latest rebuild and publication. */
function newestActivity(
  proof: ModelProof[],
  rebuild: { handle: string; at: string } | null,
  publishedAt: string | null
): { at: string; what: string } {
  // Reproductions that worked: a failed attempt is not "reproduced on".
  const reproduced = proof
    .filter((entry) => entry.lastConfirmedAt)
    .sort((a, b) => time(b.lastConfirmedAt) - time(a.lastConfirmedAt))[0];

  // Listed in tie-break order: a reproduction beats a rebuild beats publication.
  const events: { at: string; what: string }[] = [];
  if (reproduced?.lastConfirmedAt) {
    events.push({ at: reproduced.lastConfirmedAt, what: `Reproduced on ${reproduced.modelName}` });
  }
  if (rebuild) events.push({ at: rebuild.at, what: `Rebuilt by @${rebuild.handle}` });
  if (publishedAt) events.push({ at: publishedAt, what: "Published" });

  return events.reduce((best, event) => (time(event.at) > time(best.at) ? event : best), events[0] ?? { at: "", what: "Published" });
}

/**
 * Up to DASHBOARD_ROW_LIMIT gallery builds, one row each, newest activity first.
 *
 * The database narrows by the cheap filters (audience, model name, lab,
 * multi-session) BEFORE the cap, so the 200 are the 200 that match; the ones
 * that need computed figures (activeWithinDays, report "month", q) are applied
 * here, over the rows. q therefore searches within those rows.
 */
export async function listGalleryDashboard(
  params: GalleryDashboardParams = {}
): Promise<DashboardRow[]> {
  const version = params.model ? MODEL_VERSIONS.find((v) => v.id === params.model) ?? null : null;
  const labNames = params.lab ? MODEL_VERSIONS.filter((v) => v.lab === params.lab).map((v) => v.name) : [];
  const audience = params.audience?.trim() || undefined;

  let query = feedBase(DASHBOARD_BUILD_COLUMNS, audience, null);
  if (version) query = query.contains("models_used", [version.name]);
  if (params.lab) query = query.overlaps("models_used", labNames);
  if (params.report === "multi") query = query.gte("session_count", 3);

  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(DASHBOARD_ROW_LIMIT);
  if (error) throw buildLayerError("listGalleryDashboard", error);

  const builds = (data ?? []) as unknown as DashboardBuildRow[];
  const ids = builds.map((row) => row.id);

  const rebuilt = ids.length
    ? await latestRebuilds(builds.filter((row) => count(row.rebuild_count) > 0).map((row) => row.id))
    : new Map<string, { creatorId: string; at: string }>();

  const [handles, proofs, series] = await Promise.all([
    creatorHandles([...builds.map((row) => row.creator_id), ...[...rebuilt.values()].map((r) => r.creatorId)]),
    getReproductionsByModel(ids),
    getEngagementSeries(ids, ENGAGEMENT_WEEKS),
  ]);

  const rows: DashboardRow[] = builds.map((row) => {
    const proof = proofs[row.id] ?? [];
    const rebuild = rebuilt.get(row.id);
    const rebuildHandle = rebuild ? handles.get(rebuild.creatorId) : null;
    const runs = count(row.reproduction_count);
    const rebuilds = count(row.rebuild_count);
    // comment_count and save_count are not on live (see DASHBOARD_BUILD_COLUMNS).
    const engagement = { runs, rebuilds, comments: 0, saves: 0, total: runs + rebuilds };

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      creator: { id: row.creator_id, handle: handles.get(row.creator_id) ?? "" },
      outcome: row.outcome ?? null,
      madeFor: row.made_for ?? [],
      modelsUsed: row.models_used ?? [],
      sessionCount: count(row.session_count),
      promptCount: count(row.prompt_count),
      aiTurnCount: count(row.ai_turn_count),
      making: { sessions: dashboardSessions(row.making) },
      reproduction_count: runs,
      last_confirmed_at: row.last_confirmed_at ?? null,
      last_confirmed_model: row.last_confirmed_model ?? null,
      published_at: row.published_at ?? null,
      status: row.status,
      shape: row.shape,
      completeness: row.completeness ?? 0,
      engagement,
      lastActivity: newestActivity(
        proof,
        rebuild && rebuildHandle ? { handle: rebuildHandle, at: rebuild.at } : null,
        row.published_at ?? null
      ),
      series: series[row.id] ?? new Array<number>(ENGAGEMENT_WEEKS).fill(0),
      proof,
    };
  });

  // The filters the database could not apply, and a confirmation of the ones it did.
  const windows = [params.activeWithinDays, params.report === "month" ? 30 : undefined].filter(
    (days): days is number => typeof days === "number"
  );
  const within = windows.length ? Math.min(...windows) : null;
  const cutoff = within === null ? 0 : Date.now() - within * 86_400_000;
  const needle = normaliseQuery(params.q)?.toLowerCase() ?? null;

  return rows
    .filter((row) => !version || row.modelsUsed.some((name) => normaliseModel(name)?.id === version.id))
    .filter((row) => !params.lab || row.modelsUsed.some((name) => normaliseModel(name)?.lab === params.lab))
    .filter((row) => !audience || row.madeFor.includes(audience))
    .filter((row) => params.report !== "multi" || row.sessionCount >= 3)
    .filter((row) => within === null || time(row.lastActivity.at) >= cutoff)
    .filter(
      (row) =>
        needle === null ||
        [row.title, row.creator.handle, ...row.madeFor, ...row.modelsUsed].some((text) =>
          text.toLowerCase().includes(needle)
        )
    )
    .sort((a, b) => time(b.lastActivity.at) - time(a.lastActivity.at) || a.id.localeCompare(b.id));
}
