// The builds on a maker's profile, by tab (RC-P21).
//
//   Builds      their published and gallery builds, in the gallery's own order:
//               reproductions, then last confirmed, then published, newest
//               first on a tie ⟦hicks-law › Readers table: Evidence⟧.
//   Rebuilds    the same, only the ones that name a parent: their rebuilds of
//               somebody's work.
//   Solutions   the builds on which a solution of theirs was accepted, the most
//               recently accepted first ⟦hicks-law › Readers table: Time⟧.
//
// EVERY BUILD IS THE GALLERY'S OWN CARD: gallerySelect(false) with
// withCardEmbeds, as where next and the Library read theirs, so a build looks
// the same on a profile as in the Gallery ⟦law-of-similarity⟧.
//
// ONE REQUEST A PAGE for Builds and Rebuilds; TWO for Solutions (the accepted
// solutions, then their builds by id). No query in a loop. Pages are keyset
// cursors, never offsets ⟦supabase-postgres-best-practices ›
// references/data-pagination.md⟧: a page asks for one row more than it shows,
// so "Show more" appears only when there is more.
//
// ERRORS CARRY IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧: the
// operation, the maker's id, the code and the status; never the database's
// words.

import { supabase } from "@/integrations/supabase/client";
import {
  gallerySelect,
  toGalleryBuild,
  withCardEmbeds,
  type GalleryBuild,
  type GalleryRow,
} from "@/lib/build/gallery";

/** A page of cards. Twenty-four divides into the one and two columns a profile draws. */
export const MAKER_BUILDS_PAGE_SIZE = 24;

/** The statuses a reader can open. */
const PUBLISHED = ["published", "gallery"] as const;

/** The card's select: the gallery's, with every open ask on the pill. */
const CARD_SELECT = gallerySelect(false);

/** Where the next page of Builds or Rebuilds starts: the last card's order keys. */
export interface MakerBuildsCursor {
  reproductionCount: number;
  lastConfirmedAt: string | null;
  publishedAt: string | null;
  id: string;
}

/** Where the next page of Solutions starts: the last accepted solution read. */
export interface SolvedBuildsCursor {
  acceptedAt: string | null;
  solutionId: string;
}

export interface MakerBuildsPage<C> {
  builds: GalleryBuild[];
  /** Null when this was the last page. */
  next: C | null;
}

export interface ListMakerBuildsOptions {
  /** Only the builds that name a parent: the Rebuilds tab. */
  rebuildsOnly?: boolean;
  after?: MakerBuildsCursor | null;
  limit?: number;
}

export interface ListMakerSolvedBuildsOptions {
  after?: SolvedBuildsCursor | null;
  limit?: number;
}

/** The failure of a profile tab's read: identifiers, a code and a status. */
export class ProfileBuildsError extends Error {
  readonly operation: string;
  readonly userId: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(operation: string, userId: string, code: string | null, status: number | null) {
    super(`${operation} failed (user ${userId})`);
    this.name = "ProfileBuildsError";
    this.operation = operation;
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

function failure(operation: string, userId: string, response: { error: unknown; status?: number }) {
  const { code } = (response.error ?? {}) as { code?: unknown };
  return new ProfileBuildsError(
    operation,
    userId,
    typeof code === "string" && code ? code : null,
    typeof response.status === "number" && response.status > 0 ? response.status : null,
  );
}

function clampLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? MAKER_BUILDS_PAGE_SIZE, 60));
}

/** A filter value PostgREST reads whole, reserved characters and all. */
const quoted = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

/**
 * The rows strictly after `cursor` in the gallery's order, as one PostgREST
 * `or` filter:
 *
 *   reproduction_count DESC, last_confirmed_at DESC NULLS LAST,
 *   published_at DESC NULLS LAST, id DESC
 *
 * Each NULLS LAST key reads "smaller, or null, or equal and on to the next
 * key" when the cursor's value is set, and "null and on to the next key" when
 * it is not.
 */
export function afterInGalleryOrder(cursor: MakerBuildsCursor): string {
  const byId = `id.lt.${cursor.id}`;
  const published =
    cursor.publishedAt === null
      ? `and(published_at.is.null,${byId})`
      : `or(published_at.lt.${quoted(cursor.publishedAt)},published_at.is.null,and(published_at.eq.${quoted(cursor.publishedAt)},${byId}))`;
  const confirmed =
    cursor.lastConfirmedAt === null
      ? `and(last_confirmed_at.is.null,${published})`
      : `or(last_confirmed_at.lt.${quoted(cursor.lastConfirmedAt)},last_confirmed_at.is.null,and(last_confirmed_at.eq.${quoted(cursor.lastConfirmedAt)},${published}))`;
  const count = Math.max(0, Math.floor(cursor.reproductionCount));
  return `reproduction_count.lt.${count},and(reproduction_count.eq.${count},${confirmed})`;
}

function cursorOf(build: GalleryBuild): MakerBuildsCursor {
  return {
    reproductionCount: build.reproduction_count ?? 0,
    lastConfirmedAt: build.last_confirmed_at ?? null,
    publishedAt: build.published_at ?? null,
    id: build.id,
  };
}

/**
 * A maker's published and gallery builds, in the gallery's order; with
 * `rebuildsOnly`, only those that name a parent. One request a page.
 */
export async function listMakerBuilds(
  userId: string,
  { rebuildsOnly = false, after = null, limit }: ListMakerBuildsOptions = {},
): Promise<MakerBuildsPage<MakerBuildsCursor>> {
  const operation = rebuildsOnly ? "listMakerBuilds (rebuilds)" : "listMakerBuilds";
  const size = clampLimit(limit);

  let query = supabase
    .from("builds")
    .select(CARD_SELECT)
    .eq("creator_id", userId)
    // Never drafts: row-level security would hand a maker their own back.
    .in("status", [...PUBLISHED]);
  if (rebuildsOnly) query = query.not("parent_build_id", "is", null);
  if (after) query = query.or(afterInGalleryOrder(after));

  const response = await withCardEmbeds(
    query
      .order("reproduction_count", { ascending: false })
      .order("last_confirmed_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .limit(size + 1),
  );
  if (response.error) throw failure(operation, userId, response);

  const rows = ((response.data ?? []) as unknown as GalleryRow[]).map(toGalleryBuild);
  const builds = rows.slice(0, size);
  const last = builds[builds.length - 1];
  return { builds, next: rows.length > size && last ? cursorOf(last) : null };
}

/** One accepted solution, with the build its bounty lives on. */
interface SolvedRow {
  id: string;
  accepted_at: string | null;
  bounty: { build_id: string | null } | Array<{ build_id: string | null }> | null;
}

/** The solutions strictly after `cursor`: accepted_at DESC NULLS LAST, id DESC. */
export function afterInSolvedOrder(cursor: SolvedBuildsCursor): string {
  const byId = `id.lt.${cursor.solutionId}`;
  return cursor.acceptedAt === null
    ? `and(accepted_at.is.null,${byId})`
    : `accepted_at.lt.${quoted(cursor.acceptedAt)},accepted_at.is.null,and(accepted_at.eq.${quoted(cursor.acceptedAt)},${byId})`;
}

/**
 * The builds on which a solution of this maker's was accepted, the most
 * recently accepted first; a build solved twice shows once. Two requests a
 * page: the accepted solutions on bounties that live on a build, then those
 * builds by id.
 */
export async function listMakerSolvedBuilds(
  userId: string,
  { after = null, limit }: ListMakerSolvedBuildsOptions = {},
): Promise<MakerBuildsPage<SolvedBuildsCursor>> {
  const size = clampLimit(limit);

  let query = supabase
    .from("solutions")
    .select("id, accepted_at, bounty:bounties!solutions_bounty_id_fkey!inner(build_id)")
    .eq("solver_id", userId)
    .eq("status", "accepted")
    .not("bounty.build_id", "is", null);
  if (after) query = query.or(afterInSolvedOrder(after));

  const solved = await query
    .order("accepted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(size + 1);
  if (solved.error) throw failure("listMakerSolvedBuilds (solutions)", userId, solved);

  const all = (solved.data ?? []) as unknown as SolvedRow[];
  const page = all.slice(0, size);
  const last = page[page.length - 1];
  const next = all.length > size && last ? { acceptedAt: last.accepted_at ?? null, solutionId: last.id } : null;

  const order: string[] = [];
  for (const row of page) {
    const bounty = Array.isArray(row.bounty) ? row.bounty[0] : row.bounty;
    const buildId = bounty?.build_id;
    if (buildId && !order.includes(buildId)) order.push(buildId);
  }
  if (order.length === 0) return { builds: [], next };

  const response = await withCardEmbeds(
    supabase.from("builds").select(CARD_SELECT).in("id", order).in("status", [...PUBLISHED]).limit(order.length),
  );
  if (response.error) throw failure("listMakerSolvedBuilds (builds)", userId, response);

  const byId = new Map(
    ((response.data ?? []) as unknown as GalleryRow[]).map((row) => [row.id, toGalleryBuild(row)]),
  );
  const builds = order.map((id) => byId.get(id)).filter((build): build is GalleryBuild => Boolean(build));
  return { builds, next };
}
