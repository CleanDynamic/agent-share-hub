// A maker's own numbers, per published build (RC-P23).
//
// THREE REQUESTS, TOGETHER ⟦neoscale-performance⟧: the maker's published
// builds (at most 50, their counts on the row), maker_build_metrics for the
// same builds (runs, 30-day failures, still-open topics), and
// getMakerStats for the four figures. The builds are read in exactly the order
// and with exactly the cap maker_build_metrics uses (the gallery's: most
// reproduced, then last confirmed, then published, then id; 50), so the two
// answers describe the same builds
// (supabase/migrations/20261001220000_rc_maker_stats.sql). Nothing here reads a
// legacy post.
//
// WHY THE CLIENT IS UNTYPED HERE: like_count, comment_count and save_count, and
// maker_build_metrics, are newer than the generated types in
// src/integrations/supabase/types.ts; every row is described below as the
// migrations declare it.
//
// ERRORS CARRY IDENTIFIERS ONLY ⟦neoscale-error-monitoring › Privacy⟧: the
// operation, the maker's id, the code and the status.

import { timeoutCause } from "@/lib/query/readLimit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMakerStats, type MakerStats } from "@/lib/profile/makerStats";

/** The client without the generated schema; rows are typed on the way out. */
const db = supabase as unknown as SupabaseClient;

/** The most builds the table holds; maker_build_metrics returns the same 50. */
export const BUILD_STATS_LIMIT = 50;

const BUILD_STATS_COLUMNS =
  "id, slug, title, reproduction_count, last_confirmed_at, last_confirmed_model, published_at, rebuild_count, like_count, comment_count, save_count, still_open_topics:still_open_topic_count";

/**
 * Mobile 28 D: the views, embedded on the same request along build_view_counts.build_id -> builds.id
 * (supabase/migrations/20261125120000_m28_build_views.sql). The table is readable by the build's maker only, which is who
 * reads this page.
 */
const BUILD_STATS_COLUMNS_WITH_VIEWS = `${BUILD_STATS_COLUMNS}, views:build_view_counts(views)`;

/** PostgREST's answer when an embedded relationship is not in its schema cache: the views migration is not applied yet. */
const NO_RELATIONSHIP = "PGRST200";

/** One published build, with everything the analytics page says about it. */
export interface BuildStatRow {
  id: string;
  slug: string;
  title: string;
  reproduction_count: number;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
  rebuild_count: number;
  like_count: number;
  comment_count: number;
  save_count: number;
  /** Mobile 28 D: views, one per viewer per day, the maker's own left out (0 before the views migration is applied). */
  view_count: number;
  /** Runs other people reported, worked or not. */
  runs: number;
  /** Of those, the runs that worked: the table's "Got working". */
  worked: number;
  /** Runs that did not work within the last 30 days. */
  failed_last_30_days: number;
  /** Topics still open on this build (UX-08: still_open_topic_count). */
  still_open: number;
}

export interface MyBuildStats {
  builds: BuildStatRow[];
  figures: MakerStats;
}

interface BuildRow {
  id: string;
  slug: string;
  title: string;
  reproduction_count: number | null;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string | null;
  rebuild_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  save_count: number | null;
  still_open_topics: number | null;
  /** One-to-one embed: an object, or null when nobody has viewed it; some PostgREST versions answer a one-row array. */
  views?: { views: number | string | null } | { views: number | string | null }[] | null;
}

interface MetricsRow {
  build_id: string;
  runs: number | string | null;
  worked: number | string | null;
  failed_last_30_days: number | string | null;
}

/** The failure of getMyBuildStats: identifiers, a code and a status. */
export class BuildStatsError extends Error {
  readonly operation: string;
  readonly userId: string | null;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(operation: string, userId: string | null, code: string | null = null, status: number | null = null) {
    super(`${operation} failed${userId ? ` (user ${userId})` : ""}`);
    this.name = "BuildStatsError";
    this.operation = operation;
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

function failure(operation: string, userId: string, response: { error: unknown; status?: number }) {
  const { code } = (response.error ?? {}) as { code?: unknown };
  // A read the time limit cut keeps a clean marker as its cause, so it is still known as one (lib/query/readLimit.ts).
  return Object.assign(
    new BuildStatsError(operation, userId, typeof code === "string" && code ? code : null, typeof response.status === "number" && response.status > 0 ? response.status : null),
    timeoutCause(response.error),
  );
}

/** A count as a whole number; zero for null or anything that is not one. */
function count(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The signed-in maker's published builds with their numbers, and their four
 * figures. Three requests, issued together.
 */
export async function getMyBuildStats(): Promise<MyBuildStats> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id ?? null;
  // STATES.md row 21: nobody signed in is a refusal, never an empty table.
  if (!userId) throw new BuildStatsError("getMyBuildStats", null, null, 401);

  const readBuilds = (columns: string) =>
    db
      .from("builds")
      .select(columns)
      .eq("creator_id", userId)
      .in("status", ["published", "gallery"])
      .order("reproduction_count", { ascending: false })
      .order("last_confirmed_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .limit(BUILD_STATS_LIMIT);
  const [first, metrics, figures] = await Promise.all([
    readBuilds(BUILD_STATS_COLUMNS_WITH_VIEWS),
    db.rpc("maker_build_metrics", { uid: userId }),
    getMakerStats(userId),
  ]);
  /* Before the views migration is applied the embed is refused; the builds are read again without it and Views are 0. */
  const builds = first.error && (first.error as { code?: unknown }).code === NO_RELATIONSHIP ? await readBuilds(BUILD_STATS_COLUMNS) : first;

  if (builds.error) throw failure("getMyBuildStats (builds)", userId, builds);
  if (metrics.error) throw failure("getMyBuildStats (metrics)", userId, metrics);

  const byBuild = new Map(((metrics.data ?? []) as MetricsRow[]).map((row) => [row.build_id, row]));

  return {
    figures,
    builds: ((builds.data ?? []) as unknown as BuildRow[]).map((row) => {
      const m = byBuild.get(row.id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        reproduction_count: count(row.reproduction_count),
        last_confirmed_at: row.last_confirmed_at ?? null,
        last_confirmed_model: row.last_confirmed_model ?? null,
        published_at: row.published_at ?? null,
        rebuild_count: count(row.rebuild_count),
        like_count: count(row.like_count),
        comment_count: count(row.comment_count),
        save_count: count(row.save_count),
        view_count: count((Array.isArray(row.views) ? row.views[0] : row.views)?.views),
        runs: count(m?.runs),
        worked: count(m?.worked),
        failed_last_30_days: count(m?.failed_last_30_days),
        still_open: count(row.still_open_topics),
      };
    }),
  };
}
