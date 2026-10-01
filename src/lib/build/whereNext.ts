// Where next: three ways onward from the foot of a build page (RC-P14b).
//
// A READER WHO FINISHES A BUILD HAS NOWHERE ONWARD. The rail that offered
// paths is gone, and it offered legacy posts. This is the last piece of
// discovery: at most three rows of at most three builds, ordered by the
// reader's intent ⟦hicks-law › Readers table⟧ —
//
//   1. rebuilds of this     build on it: published builds whose parent is this
//                           one, newest first
//   2. more made with X     use the same tool: gallery-eligible builds sharing
//                           this build's first made_with value, in the
//                           gallery's own order (evidence first)
//   3. more from the maker  the same hands: the maker's other published
//                           builds, newest first
//
// Nothing here is personalised: every reader of a build sees the same rows.
//
// THREE REQUESTS AT MOST, ISSUED TOGETHER (Promise.all), each on
// GALLERY_BUILD_COLUMNS, each `.limit(3)`, each excluding this build. The
// second is not sent at all when the build names no tool. The third embeds the
// maker's name, which its row heading needs and the build page never reads.
//
// THE GALLERY'S CARD DATA (RC-P14c). Each row selects what a gallery card is
// given — gallerySelect(false): the header columns plus the nodes its body
// reads, its pictures and its open ask, capped as listGallery caps them
// (withCardEmbeds) — so a build looks the same here as in the gallery and on
// Home ⟦law-of-similarity⟧. Until RC-P14c the rows carried the header columns
// alone, and every card here drew its text body with no picture.

import { supabase } from "@/integrations/supabase/client";
import { weekStartUtc } from "@/lib/progress/weekly";
import { resolveCover } from "./cover";
import {
  GALLERY_THRESHOLD,
  gallerySelect,
  toGalleryBuild,
  withCardEmbeds,
  type GalleryBuild,
  type GalleryMedia,
  type GalleryRow,
} from "./gallery";
import { buildLayerError, type BuildShape } from "./types";

/** At most this many builds in a row. */
export const WHERE_NEXT_PER_ROW = 3;

/** The statuses that mean "a reader can open this". */
const PUBLISHED = ["published", "gallery"] as const;

export interface WhereNextInput {
  /** The build being read. It never appears in its own rows. */
  buildId: string;
  /** Its maker, for "more from". */
  creatorId: string;
  /** Its tools. Only the first is used; none sends no request for that row. */
  madeWith: readonly string[] | null | undefined;
}

export interface WhereNext {
  rebuilds: GalleryBuild[];
  /** Null when the build names no tool. */
  sharedTool: { tool: string; builds: GalleryBuild[] } | null;
  fromMaker: GalleryBuild[];
  /** The maker's name as their row names them: display name, else @handle. */
  makerName: string | null;
}

/** The card's select: the gallery's, with every open ask on the pill. */
const CARD_SELECT = gallerySelect(false);

/**
 * The gallery's eligibility rule, written from the same exported thresholds:
 * promoted to the gallery, or this shape's completeness bar met. listGallery's
 * own galleryPredicate is module-private and locked (CONTRACT §4), so this is
 * built the same way from GALLERY_THRESHOLD rather than edited out of it;
 * whereNext.test.ts holds the two strings equal.
 */
export function galleryEligible(): string {
  const clauses = (Object.keys(GALLERY_THRESHOLD) as BuildShape[]).map(
    (shape) => `and(shape.eq.${shape},completeness.gte.${GALLERY_THRESHOLD[shape]})`,
  );
  return ["status.eq.gallery", ...clauses].join(",");
}

/** The first tool this build names, tidied; null when it names none. */
export function firstTool(madeWith: readonly string[] | null | undefined): string | null {
  for (const value of madeWith ?? []) {
    const tool = value?.trim();
    if (tool) return tool;
  }
  return null;
}

interface MakerEmbed {
  username: string | null;
  display_name: string | null;
}

function makerNameOf(embed: MakerEmbed | MakerEmbed[] | null | undefined): string | null {
  const maker = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null);
  if (!maker) return null;
  return maker.display_name?.trim() || (maker.username ? `@${maker.username}` : null);
}

/** The rows of the three requests, before they become cards. */
interface WhereNextRows {
  tool: string | null;
  rebuilds: GalleryRow[];
  shared: GalleryRow[];
  maker: Array<GalleryRow & { maker?: MakerEmbed | MakerEmbed[] | null }>;
}

/**
 * The three requests behind a build's where next, issued together.
 *
 * Shared by getWhereNext (the build page) and getWhereNextForViewer (Home), so
 * a row means the same thing on both. Throws when any request fails; the
 * made-with request is not sent for a build that names no tool.
 */
async function loadWhereNextRows({
  buildId,
  creatorId,
  madeWith,
}: WhereNextInput): Promise<WhereNextRows> {
  const tool = firstTool(madeWith);

  const rebuildsRequest = withCardEmbeds(
    supabase
      .from("builds")
      .select(CARD_SELECT)
      .eq("parent_build_id", buildId)
      .in("status", [...PUBLISHED])
      .neq("id", buildId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(WHERE_NEXT_PER_ROW),
  );

  // The gallery's order, key for key: evidence, then freshness, then newest.
  const toolRequest =
    tool === null
      ? null
      : withCardEmbeds(
          supabase
            .from("builds")
            .select(CARD_SELECT)
            .in("status", [...PUBLISHED])
            .or(galleryEligible())
            .overlaps("made_with", [tool])
            .neq("id", buildId)
            .order("reproduction_count", { ascending: false })
            .order("last_confirmed_at", { ascending: false, nullsFirst: false })
            .order("published_at", { ascending: false, nullsFirst: false })
            .limit(WHERE_NEXT_PER_ROW),
        );

  const makerRequest = withCardEmbeds(
    supabase
      .from("builds")
      .select(`${CARD_SELECT}, maker:profiles!builds_creator_id_fkey(username, display_name)`)
      .eq("creator_id", creatorId)
      .in("status", [...PUBLISHED])
      .neq("id", buildId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(WHERE_NEXT_PER_ROW),
  );

  const [rebuilds, shared, maker] = await Promise.all([
    rebuildsRequest,
    toolRequest ?? Promise.resolve(null),
    makerRequest,
  ]);

  if (rebuilds.error) throw buildLayerError("getWhereNext (rebuilds)", rebuilds.error);
  if (shared?.error) throw buildLayerError("getWhereNext (made with)", shared.error);
  if (maker.error) throw buildLayerError("getWhereNext (maker)", maker.error);

  return {
    tool,
    rebuilds: (rebuilds.data ?? []) as unknown as GalleryRow[],
    shared: (shared?.data ?? []) as unknown as GalleryRow[],
    maker: (maker.data ?? []) as unknown as WhereNextRows["maker"],
  };
}

/**
 * The three rows under a build: its rebuilds, more made with its first tool,
 * and more from its maker. Each at most three builds, never this one.
 */
export async function getWhereNext(input: WhereNextInput): Promise<WhereNext> {
  const { buildId } = input;
  const { tool, rebuilds, shared, maker } = await loadWhereNextRows(input);

  const notThis = (row: GalleryRow) => row.id !== buildId;
  const cards = (rows: GalleryRow[]) =>
    rows.filter(notThis).slice(0, WHERE_NEXT_PER_ROW).map(toGalleryBuild);

  return {
    rebuilds: cards(rebuilds),
    sharedTool: tool === null ? null : { tool, builds: cards(shared) },
    fromMaker: cards(maker.map(({ maker: _maker, ...row }) => row)),
    makerName: makerNameOf(maker[0]?.maker),
  };
}

// =============================================================================
// Where next, for the viewer (UI-P25)
// =============================================================================

/** Why a build is suggested; the view turns it into a DM Mono caps label. */
export type WhereNextReason = "same_tool" | "rebuilt_from_one_you_ran" | "more_from_maker";

/** One suggested build for the Home list. */
export interface WhereNextItem {
  /** `cover` is resolveCover's pick; null means the view draws CoverFallback seeded by `id`. */
  build: { id: string; slug: string; title: string; cover: GalleryMedia | null };
  reason: WhereNextReason;
  /**
   * What the label names: the tool for `same_tool`, "@handle" for
   * `more_from_maker`, and the title of the build the viewer ran for
   * `rebuilt_from_one_you_ran`, whose label has no name in it.
   */
  reasonDetail: string;
  /** Reproductions per UTC day over the last 14 days, oldest first, today last. */
  spark: number[];
}

/** The runs this week that seed the suggestions, newest first. */
const VIEWER_RUNS_LIMIT = 20;

/** How many of those builds the suggestions are gathered from. */
const VIEWER_SOURCE_BUILDS = 3;

/** Days in a sparkline. */
const SPARK_DAYS = 14;

/** Rows read to draw every sparkline at once. */
const SPARK_ROWS_LIMIT = 1000;

const DAY_MS = 86_400_000;

interface ViewerCandidate {
  row: GalleryRow;
  reason: WhereNextReason;
  reasonDetail: string;
}

/**
 * Where next, from what the viewer ran this week: builds one step on from the
 * last few they reproduced, each with the reason and a 14-day run count.
 *
 *   1. their reproductions since Monday 00:00 UTC, newest first, at most 20
 *   2. for the newest three of those builds, getWhereNext's own requests
 *      (loadWhereNextRows): its rebuilds, more made with its first tool, more
 *      from its maker, in that order
 *   3. without the viewer's own builds and anything they have already
 *      reproduced (at any time, asked in one request), without duplicates,
 *      cut to `limit`
 *   4. one read of the chosen builds' reproductions over 14 days, bucketed by
 *      UTC day (capped at 1000 rows)
 *
 * [] for a viewer with no runs this week. A candidate whose maker has no
 * handle or name cannot be labelled "more from …", so it is left out.
 */
export async function getWhereNextForViewer(
  userId: string,
  limit: number = WHERE_NEXT_PER_ROW,
): Promise<WhereNextItem[]> {
  const now = new Date();

  const runs = await supabase
    .from("build_reproductions")
    .select("build_id, created_at")
    .eq("user_id", userId)
    .gte("created_at", weekStartUtc(now).toISOString())
    .order("created_at", { ascending: false })
    .limit(VIEWER_RUNS_LIMIT);
  if (runs.error) throw buildLayerError("getWhereNextForViewer (runs)", runs.error);

  const ranIds = [
    ...new Set(((runs.data ?? []) as Array<{ build_id: string }>).map((row) => row.build_id)),
  ];
  if (ranIds.length === 0 || limit < 1) return [];

  const sourceIds = ranIds.slice(0, VIEWER_SOURCE_BUILDS);
  const sourceRows = await supabase
    .from("builds")
    .select("id, title, creator_id, made_with")
    .in("id", sourceIds)
    .limit(sourceIds.length);
  if (sourceRows.error) throw buildLayerError("getWhereNextForViewer (builds)", sourceRows.error);

  type Source = { id: string; title: string; creator_id: string; made_with: string[] | null };
  const byId = new Map(((sourceRows.data ?? []) as Source[]).map((row) => [row.id, row]));
  const sources = sourceIds.map((id) => byId.get(id)).filter((row): row is Source => Boolean(row));

  const gathered = await Promise.all(
    sources.map(async (source): Promise<ViewerCandidate[]> => {
      const rows = await loadWhereNextRows({
        buildId: source.id,
        creatorId: source.creator_id,
        madeWith: source.made_with,
      });

      const out: ViewerCandidate[] = rows.rebuilds.map((row) => ({
        row,
        reason: "rebuilt_from_one_you_ran",
        reasonDetail: source.title,
      }));
      if (rows.tool !== null) {
        for (const row of rows.shared) out.push({ row, reason: "same_tool", reasonDetail: rows.tool });
      }
      const handle = handleOf(rows.maker[0]?.maker);
      if (handle !== null) {
        for (const { maker: _maker, ...row } of rows.maker) {
          out.push({ row, reason: "more_from_maker", reasonDetail: handle });
        }
      }
      return out;
    }),
  );

  const seen = new Set<string>(ranIds);
  const fresh: ViewerCandidate[] = [];
  for (const candidate of gathered.flat()) {
    const { id, creator_id } = candidate.row;
    if (creator_id === userId || seen.has(id)) continue;
    seen.add(id);
    fresh.push(candidate);
  }
  if (fresh.length === 0) return [];

  // Runs older than this week are not in `ranIds`, so ask once about the rest.
  const candidateIds = fresh.map((candidate) => candidate.row.id);
  const already = await supabase
    .from("build_reproductions")
    .select("build_id")
    .eq("user_id", userId)
    .in("build_id", candidateIds)
    .limit(candidateIds.length);
  if (already.error) throw buildLayerError("getWhereNextForViewer (already run)", already.error);
  const ran = new Set(((already.data ?? []) as Array<{ build_id: string }>).map((row) => row.build_id));

  const chosen = fresh.filter((candidate) => !ran.has(candidate.row.id)).slice(0, limit);
  if (chosen.length === 0) return [];

  const sparks = await sparksFor(
    chosen.map((candidate) => candidate.row.id),
    now,
  );

  return chosen.map(({ row, reason, reasonDetail }) => {
    const card = toGalleryBuild(row);
    return {
      build: {
        id: card.id,
        slug: card.slug,
        title: card.title,
        cover: resolveCover(card, card.nodes, card.media),
      },
      reason,
      reasonDetail,
      spark: sparks.get(card.id) ?? new Array<number>(SPARK_DAYS).fill(0),
    };
  });
}

/** "@handle" for a maker, else their display name; null when the profile gave neither. */
function handleOf(embed: MakerEmbed | MakerEmbed[] | null | undefined): string | null {
  const maker = Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null);
  if (!maker) return null;
  if (maker.username) return `@${maker.username}`;
  return maker.display_name?.trim() || null;
}

/**
 * Each build's daily reproduction counts over the 14 UTC days ending today,
 * oldest first, from one read of `build_id, created_at`.
 */
async function sparksFor(buildIds: readonly string[], now: Date): Promise<Map<string, number[]>> {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const since = new Date(today - (SPARK_DAYS - 1) * DAY_MS);

  const { data, error } = await supabase
    .from("build_reproductions")
    .select("build_id, created_at")
    .in("build_id", [...buildIds])
    .gte("created_at", since.toISOString())
    .limit(SPARK_ROWS_LIMIT);
  if (error) throw buildLayerError("getWhereNextForViewer (sparks)", error);

  const rows = (data ?? []) as Array<{ build_id: string; created_at: string }>;
  if (rows.length >= SPARK_ROWS_LIMIT) {
    // TODO: replace with an RPC that returns per-build daily counts, which has
    // no row cap to bucket around.
    console.warn(`[getWhereNextForViewer] read the ${SPARK_ROWS_LIMIT}-row cap; the sparklines are partial`);
  }

  const out = new Map<string, number[]>(buildIds.map((id) => [id, new Array<number>(SPARK_DAYS).fill(0)]));
  for (const { build_id, created_at } of rows) {
    const at = Date.parse(created_at);
    if (!Number.isFinite(at)) continue;
    const ago = Math.floor((today - Math.floor(at / DAY_MS) * DAY_MS) / DAY_MS);
    // A row from later today has ago 0; one from the future (a skewed clock) is skipped.
    if (ago < 0 || ago >= SPARK_DAYS) continue;
    const days = out.get(build_id);
    if (days) days[SPARK_DAYS - 1 - ago] += 1;
  }
  return out;
}
