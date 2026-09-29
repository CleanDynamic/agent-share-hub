// The solvers board's data layer (RC-P13).
//
// A SOLVE IS AN ACCEPTED SOLUTION on a bounty that lives on a build: the
// solutions row accept_bounty_solution marks 'accepted'. The legacy
// /b/:id/leaderboard ranked people against one legacy bounty post; after the
// clear it reads nothing, and its address now lands on the board this module
// feeds.
//
// TWO REQUESTS ⟦neoscale-performance⟧: top_solvers does the counting, the
// totals, the order and the cap in one round trip
// (supabase/migrations/20261001160000_rc_top_solvers.sql), and one profiles
// read, by id, with named columns, names the people it returns. Nothing is
// asked per row.
//
// WHY THE ROW TYPE IS HAND-WRITTEN: top_solvers is newer than the generated
// types in src/integrations/supabase/types.ts, so the call is made through the
// same narrow cast src/lib/feed/getBuildFeed.ts and src/lib/build/search.ts use.

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

/** How many solvers the board shows. The function never returns more than 100. */
export const TOP_SOLVERS_LIMIT = 25;

/** One solver on the board, most solved first. */
export interface Solver {
  /** The solver's profile id (solutions.solver_id). */
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Accepted solutions on bounties that live on a build. */
  solved: number;
  /** The rewards those bounties named, in pounds; null when none named one. */
  rewardTotalGbp: number | null;
  /** When their latest solution was accepted. */
  lastSolvedAt: string | null;
}

export interface ListTopSolversOptions {
  /** At most this many solvers; 25 by default, as the board shows. */
  limit?: number;
}

/** One row of top_solvers, exactly as the migration's RETURNS TABLE declares it. */
interface TopSolversRow {
  user_id: string;
  /** bigint and numeric arrive as numbers or strings, depending on size. */
  solved: number | string;
  reward_total: number | string | null;
  last_solved_at: string | null;
}

interface SolverProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** A numeric column as a number; null for null or anything that is not one. */
function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The people whose solutions were accepted, most solved first; ties go to the
 * larger reward total, then to the most recent solve. The order is the
 * function's, and it is kept: a solver whose profile row is unreadable stays
 * in place with no name rather than dropping out and moving everyone below up.
 */
export async function listTopSolvers({
  limit = TOP_SOLVERS_LIMIT,
}: ListTopSolversOptions = {}): Promise<Solver[]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: TopSolversRow[] | null; error: unknown }>
  )("top_solvers", { max_results: limit });
  if (error) throw bountyLayerError("listTopSolvers", error);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids)
    .limit(ids.length);
  if (profilesError) throw bountyLayerError("listTopSolvers", profilesError);

  const byId = new Map(
    ((profiles ?? []) as SolverProfileRow[]).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const profile = byId.get(row.user_id);
    return {
      id: row.user_id,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      solved: toNumber(row.solved) ?? 0,
      rewardTotalGbp: toNumber(row.reward_total),
      lastSolvedAt: row.last_solved_at ?? null,
    };
  });
}
