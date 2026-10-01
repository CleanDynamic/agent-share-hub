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
import { WEEKLY_REPRODUCTION_GOAL } from "@/lib/progress/goals";
import { normaliseQuery, searchBuildIds } from "./search";
import {
  SHAPE_RULES,
  STALE_AFTER_DAYS,
  countRunsThisWeek,
  type MissingItem,
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
