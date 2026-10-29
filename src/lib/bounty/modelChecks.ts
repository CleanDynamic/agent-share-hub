// SV-22 P2: model tests and the model release check.
//
// A MODEL TEST is a request naming a model on a reproduced build: a published build with runs (`reproduction_count > 0`) that has
// not been run on a model released lately. Its rows are `getReproductionsByModel`. A page is two rounds: the builds and the recent
// releases together, then every build's proofs in one request.
//
// THE RELEASE CHECK is `release_check()`, one request: how many reproduced builds work, fail or are not tested on the newest
// release, counted on the database. It is started in OpenBuilds' first round.
//
// THE TABLE AND THE FUNCTION MAY NOT BE THERE YET. Reads answer "nothing to show" when the error's code says so.

import { supabase } from "@/integrations/supabase/client";
import { getReproductionsByModel } from "@/lib/build/signals";
import { bountyLayerError } from "./types";
import { modelTestFor, nameOfModel, type BarState, type ModelTestRow, type ReleasedModel } from "./modelRules";

export const MODEL_TESTS_PAGE_SIZE = 10;
/** The recent releases a model test asks about. */
export const RECENT_RELEASES = 3;

const MISSING = new Set(["42P01", "PGRST205", "42883", "PGRST202"]);
const isMissing = (error: unknown): boolean => MISSING.has(String((error as { code?: unknown } | null)?.code));

interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): Query;
  lte(column: string, value: unknown): Query;
  gt(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): Query;
  range(from: number, to: number): Query;
  limit(count: number): Query;
}
type Client = { from: (name: string) => { select: (columns: string) => Query; insert: (row: unknown) => PromiseLike<{ error: unknown }> }; rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> };
const db = () => supabase as unknown as Client;

const today = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** The newest releases that have come out, newest first. */
export async function listRecentReleases(now: number = Date.now(), limit: number = RECENT_RELEASES): Promise<ReleasedModel[]> {
  const { data, error } = await db().from("model_releases").select("model_id, released_on").lte("released_on", today(now)).order("released_on", { ascending: false }).limit(limit);
  if (error) {
    if (isMissing(error)) return [];
    throw bountyLayerError("listRecentReleases", error);
  }
  return ((data ?? []) as { model_id: string; released_on: string }[]).map((row) => ({ modelId: row.model_id, releasedOn: row.released_on }));
}

/** Admins only (the table's policy): records that a model was released on a day. */
export async function addModelRelease({ modelId, releasedOn }: { modelId: string; releasedOn: string }): Promise<void> {
  const { error } = await db().from("model_releases").insert({ model_id: modelId.trim(), released_on: releasedOn });
  if (error) throw bountyLayerError("addModelRelease", error);
}

export interface ReleaseCheck {
  modelId: string;
  modelName: string;
  releasedOn: string;
  works: number;
  fails: number;
  untested: number;
  total: number;
  /** The reproduced build to run next, when one is not tested on the model. */
  nextSlug: string | null;
  bars: { s: BarState; n: number }[];
}

interface CheckRow {
  model_id: string;
  released_on: string;
  works: number;
  fails: number;
  untested: number;
  next_slug: string | null;
  bars: { s: BarState; n: number }[] | null;
}

/** The release check for the newest release, or null while there is no release (or the migration is not applied). */
export async function getReleaseCheck(): Promise<ReleaseCheck | null> {
  const { data, error } = await db().rpc("release_check");
  if (error) {
    if (isMissing(error)) return null;
    throw bountyLayerError("getReleaseCheck", error);
  }
  const row = ((data ?? []) as CheckRow[])[0];
  if (!row) return null;
  return {
    modelId: row.model_id,
    modelName: nameOfModel(row.model_id),
    releasedOn: row.released_on,
    works: row.works,
    fails: row.fails,
    untested: row.untested,
    total: row.works + row.fails + row.untested,
    nextSlug: row.next_slug,
    bars: row.bars ?? [],
  };
}

export interface ModelTestRecord {
  buildId: string;
  slug: string;
  title: string;
  maker: string | null;
  lastConfirmedAt: string | null;
  /** The model the request asks for. */
  target: string;
  models: ModelTestRow[];
}

export interface ModelTestsPage {
  tests: ModelTestRecord[];
  nextOffset: number | null;
}

interface BuildRow {
  id: string;
  slug: string;
  title: string;
  last_confirmed_at: string | null;
  creator: { username: string | null } | { username: string | null }[] | null;
}

/** One page of model tests: reproduced builds, most recently confirmed first, that some recent release has not been run on. */
export async function listModelTests({ offset = 0, limit = MODEL_TESTS_PAGE_SIZE, now = Date.now() }: { offset?: number; limit?: number; now?: number } = {}): Promise<ModelTestsPage> {
  const size = Math.min(Math.max(1, limit), 50);
  const [builds, releases] = await Promise.all([
    db()
      .from("builds")
      .select("id, slug, title, last_confirmed_at, creator:profiles!builds_creator_id_fkey(username)")
      .gt("reproduction_count", 0)
      .in("status", ["published", "gallery"])
      .order("last_confirmed_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + size),
    listRecentReleases(now),
  ]);
  if (builds.error) throw bountyLayerError("listModelTests", builds.error);
  const all = (builds.data ?? []) as BuildRow[];
  const rows = all.slice(0, size);
  const nextOffset = all.length > size ? offset + size : null;
  if (releases.length === 0 || rows.length === 0) return { tests: [], nextOffset };

  const proofs = await getReproductionsByModel(rows.map((row) => row.id));
  const tests = rows.flatMap((row) => {
    const test = modelTestFor(proofs[row.id] ?? [], releases);
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    return test ? [{ buildId: row.id, slug: row.slug, title: row.title, maker: creator?.username ?? null, lastConfirmedAt: row.last_confirmed_at, target: test.target, models: test.rows }] : [];
  });
  return { tests, nextOffset };
}
