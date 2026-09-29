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
// CARD DATA, NOT GALLERY DATA. The rows select the card's header columns only,
// not the gallery's node and media embeds, so each card draws its own text
// body — title, credit, plaque, chips, outcome — and a foot-of-page section
// costs no image signing. A card with no nodes and no media is a card the
// gallery already renders (every body ends at the outcome).

import { supabase } from "@/integrations/supabase/client";
import { GALLERY_BUILD_COLUMNS, GALLERY_THRESHOLD, type GalleryBuild } from "./gallery";
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

/** A card from header columns alone: no node or media rows, no bounty question asked. */
type HeaderRow = Omit<GalleryBuild, "nodes" | "media" | "bounties">;

function toCard(row: HeaderRow): GalleryBuild {
  return { ...row, nodes: [], media: [] };
}

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

/**
 * The three rows under a build: its rebuilds, more made with its first tool,
 * and more from its maker. Each at most three builds, never this one.
 */
export async function getWhereNext({
  buildId,
  creatorId,
  madeWith,
}: WhereNextInput): Promise<WhereNext> {
  const tool = firstTool(madeWith);

  const rebuildsRequest = supabase
    .from("builds")
    .select(GALLERY_BUILD_COLUMNS)
    .eq("parent_build_id", buildId)
    .in("status", [...PUBLISHED])
    .neq("id", buildId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(WHERE_NEXT_PER_ROW);

  // The gallery's order, key for key: evidence, then freshness, then newest.
  const toolRequest =
    tool === null
      ? null
      : supabase
          .from("builds")
          .select(GALLERY_BUILD_COLUMNS)
          .in("status", [...PUBLISHED])
          .or(galleryEligible())
          .overlaps("made_with", [tool])
          .neq("id", buildId)
          .order("reproduction_count", { ascending: false })
          .order("last_confirmed_at", { ascending: false, nullsFirst: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(WHERE_NEXT_PER_ROW);

  const makerRequest = supabase
    .from("builds")
    .select(`${GALLERY_BUILD_COLUMNS}, maker:profiles!builds_creator_id_fkey(username, display_name)`)
    .eq("creator_id", creatorId)
    .in("status", [...PUBLISHED])
    .neq("id", buildId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(WHERE_NEXT_PER_ROW);

  const [rebuilds, shared, maker] = await Promise.all([
    rebuildsRequest,
    toolRequest ?? Promise.resolve(null),
    makerRequest,
  ]);

  if (rebuilds.error) throw buildLayerError("getWhereNext (rebuilds)", rebuilds.error);
  if (shared?.error) throw buildLayerError("getWhereNext (made with)", shared.error);
  if (maker.error) throw buildLayerError("getWhereNext (maker)", maker.error);

  const notThis = (row: HeaderRow) => row.id !== buildId;
  const makerRows = (maker.data ?? []) as unknown as Array<HeaderRow & { maker?: MakerEmbed | MakerEmbed[] | null }>;

  return {
    rebuilds: ((rebuilds.data ?? []) as unknown as HeaderRow[]).filter(notThis).slice(0, WHERE_NEXT_PER_ROW).map(toCard),
    sharedTool:
      tool === null
        ? null
        : {
            tool,
            builds: ((shared?.data ?? []) as unknown as HeaderRow[])
              .filter(notThis)
              .slice(0, WHERE_NEXT_PER_ROW)
              .map(toCard),
          },
    fromMaker: makerRows
      .filter(notThis)
      .slice(0, WHERE_NEXT_PER_ROW)
      .map(({ maker: _maker, ...row }) => toCard(row)),
    makerName: makerNameOf(makerRows[0]?.maker),
  };
}
