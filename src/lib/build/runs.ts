// Runs of a maker's builds: the Activity page's chart and its people count
// (UI-P26).
//
// ONE REQUEST EACH, WITH THE MAKER'S BUILDS EMBEDDED RATHER THAN LISTED. A maker
// can have hundreds of builds and an `in.(id, id, …)` of them is a URL no proxy
// accepts, so the reproductions are read through the build they belong to and
// filtered on its creator (`!inner`, as the gallery's bounty embed is). Row level
// security still decides what counts: a reproduction is readable when its build
// is, so the numbers are the ones the reader could have counted for themselves.
//
// A creator cannot reproduce their own build (an INSERT policy on
// build_reproductions), so every row here is somebody else's run.

import { supabase } from "@/integrations/supabase/client";
import { weekStartUtc } from "@/lib/progress/weekly";
import { buildLayerError } from "./types";

/** The most reproduction rows read to draw the chart; past it the series is partial. */
const RUNS_ROWS_LIMIT = 5000;

const DAY_MS = 86_400_000;

/** The statuses a reader can open: a rebuild counts once it is out. */
const PUBLISHED = ["published", "gallery"];

export interface RunsOfMyBuilds {
  /** Reproductions per UTC day, oldest first, today last; `days` long. */
  series: number[];
  /**
   * The index in `series` of the day the most recent published rebuild of one
   * of their builds went out, inside the window; null when there is none.
   */
  rebuildLiveIndex: number | null;
}

/** 00:00 UTC of the day that holds `at`, in epoch milliseconds. */
function utcDay(at: Date | number): number {
  const date = new Date(at);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Daily reproductions of this maker's builds over the last `days` UTC days
 * (today included), oldest first, and where the latest rebuild of their work
 * went live.
 *
 * Counted in code from `created_at` rows, newest window only, capped at
 * RUNS_ROWS_LIMIT; if the cap is reached the series is partial, which is logged
 * and still returned.
 */
export async function getRunsOfMyBuilds(
  userId: string,
  days: number = 90,
  now: Date = new Date(),
): Promise<RunsOfMyBuilds> {
  const length = Math.max(1, Math.floor(days) || 1);
  const today = utcDay(now);
  const since = new Date(today - (length - 1) * DAY_MS).toISOString();

  const [runs, rebuild] = await Promise.all([
    supabase
      .from("build_reproductions")
      .select("created_at, builds!build_reproductions_build_id_fkey!inner(creator_id)")
      .eq("builds.creator_id", userId)
      .gte("created_at", since)
      .limit(RUNS_ROWS_LIMIT),
    supabase
      .from("builds")
      .select("published_at, parent:builds!builds_parent_build_id_fkey!inner(creator_id)")
      .eq("parent.creator_id", userId)
      .neq("creator_id", userId)
      .in("status", PUBLISHED)
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(1),
  ]);

  if (runs.error) throw buildLayerError("getRunsOfMyBuilds (runs)", runs.error);
  if (rebuild.error) throw buildLayerError("getRunsOfMyBuilds (rebuild)", rebuild.error);

  const rows = (runs.data ?? []) as unknown as Array<{ created_at: string }>;
  if (rows.length >= RUNS_ROWS_LIMIT) {
    // TODO: replace with an RPC that returns per-day counts for a maker's
    // builds, which has no row cap to bucket around.
    console.warn(`[getRunsOfMyBuilds] read the ${RUNS_ROWS_LIMIT}-row cap; the series is partial`);
  }

  const dayIndex = (iso: string | null | undefined): number | null => {
    const at = Date.parse(iso ?? "");
    if (!Number.isFinite(at)) return null;
    const index = length - 1 - Math.floor((today - utcDay(at)) / DAY_MS);
    return index >= 0 && index < length ? index : null;
  };

  const series = new Array<number>(length).fill(0);
  for (const { created_at } of rows) {
    const index = dayIndex(created_at);
    if (index !== null) series[index] += 1;
  }

  const latest = ((rebuild.data ?? []) as unknown as Array<{ published_at: string | null }>)[0];
  return { series, rebuildLiveIndex: dayIndex(latest?.published_at) };
}

/** The most reproduction rows read to de-duplicate the people; past it the count is partial. */
const PEOPLE_ROWS_LIMIT = 2000;

/**
 * How many different people ran this maker's builds since Monday 00:00 UTC of
 * the week `now` falls in: distinct reproducers, never the maker themselves.
 *
 * Distinct in code, from `user_id` rows, because PostgREST cannot count
 * distinct. The read is capped at PEOPLE_ROWS_LIMIT rows; if the cap is reached
 * the count covers only those rows (so it errs low), which is logged and still
 * returned.
 */
export async function countPeopleWhoRanMyBuildsThisWeek(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const { data, error } = await supabase
    .from("build_reproductions")
    .select("user_id, builds!build_reproductions_build_id_fkey!inner(creator_id)")
    .eq("builds.creator_id", userId)
    .neq("user_id", userId)
    .gte("created_at", weekStartUtc(now).toISOString())
    .limit(PEOPLE_ROWS_LIMIT);

  if (error) throw buildLayerError("countPeopleWhoRanMyBuildsThisWeek", error);

  const rows = (data ?? []) as unknown as Array<{ user_id: string }>;
  if (rows.length >= PEOPLE_ROWS_LIMIT) {
    // TODO: replace with an RPC that returns count(distinct user_id), which has
    // no row cap.
    console.warn(
      `[countPeopleWhoRanMyBuildsThisWeek] read the ${PEOPLE_ROWS_LIMIT}-row cap; the count is partial`,
    );
  }

  return new Set(rows.map((row) => row.user_id)).size;
}
