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
import { SHAPE_RULES, type MissingItem, type RequirementKey } from "./signals";
import {
  buildLayerError,
  type Build,
  type BuildMedia,
  type BuildNode,
  type BuildShape,
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
 */
const GALLERY_MEDIA_COLUMNS =
  "id, node_id, bucket, path, kind, width, height, poster_path";

/**
 * The select string, embeds and all.
 *
 * The !hint on build_nodes is required rather than decorative: builds carries
 * hero_node_id, so there are TWO foreign keys between builds and build_nodes
 * and PostgREST refuses an ambiguous embed. The hint names the one that means
 * "the nodes of this build".
 */
const GALLERY_SELECT = `${GALLERY_BUILD_COLUMNS}, build_nodes!build_nodes_build_id_fkey(${GALLERY_NODE_COLUMNS}), build_media!build_media_build_id_fkey(${GALLERY_MEDIA_COLUMNS})`;

/** A card's node: the embedded columns, nothing more. */
export type GalleryNode = Pick<
  BuildNode,
  "id" | "type" | "title" | "payload" | "position" | "is_gap"
>;

/** A card's media row. Satisfies MediaRef, so mediaUrl takes it as it stands. */
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
}

export interface GalleryFilters {
  /** Roles from made_for. Several are an OR: any one of them matches. */
  madeFor?: string[];
  /** Tools from made_with. Several are an OR. */
  madeWith?: string[];
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

  let query = supabase
    .from("builds")
    .select(GALLERY_SELECT, { count: "exact" })
    // Never drafts. The RLS policy would hand a creator their own back.
    .in("status", ["published", "gallery"])
    .or(galleryPredicate())
    // Filters on an embedded column, without !inner, narrow the EMBEDDED rows
    // and leave the parent alone — a build with no prompt node still gets a
    // card, with an empty nodes array.
    .in("build_nodes.type", [...GALLERY_NODE_TYPES])
    .in("build_media.kind", [...GALLERY_MEDIA_KINDS]);

  const madeFor = cleanList(options.madeFor);
  if (madeFor.length > 0) query = query.overlaps("made_for", madeFor);

  const madeWith = cleanList(options.madeWith);
  if (madeWith.length > 0) query = query.overlaps("made_with", madeWith);

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
interface GalleryRow
  extends Omit<GalleryBuild, "nodes" | "media"> {
  build_nodes: GalleryNode[] | null;
  build_media: GalleryMedia[] | null;
}

function toGalleryBuild(row: GalleryRow): GalleryBuild {
  const { build_nodes, build_media, ...header } = row;
  return {
    ...header,
    nodes: build_nodes ?? [],
    media: build_media ?? [],
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
