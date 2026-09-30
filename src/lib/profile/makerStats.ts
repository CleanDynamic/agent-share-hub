// A maker's four figures, in one request (RC-P21).
//
// A MAKER'S STANDING IS FOUR FIGURES ⟦critique-information-density › Content
// Prioritisation⟧: what they built, how many times other people got it
// working, how many times other people rebuilt it, and how many gaps they
// solved. maker_stats counts all four in the database and answers in one round
// trip ⟦neoscale-performance⟧ (supabase/migrations/20261001220000_rc_maker_stats.sql),
// under the caller's own row-level security, so a figure never counts a row
// the reader could not read for themselves.
//
// ERRORS CARRY THE USER ID ONLY ⟦neoscale-error-monitoring › Privacy⟧
// (CONTRACT §9): the database's own words never reach the message. The code
// and the HTTP status ride along as fields, never as text a reader wrote, so
// isPermissionError can tell a refusal from a failure (STATES.md row 21).
//
// WHY THE ROW TYPE IS HAND-WRITTEN: maker_stats is newer than the generated
// types in src/integrations/supabase/types.ts, so the call is made through the
// same narrow cast src/lib/bounty/solvers.ts uses for top_solvers.

import { supabase } from "@/integrations/supabase/client";

export interface MakerStats {
  /** Their published or gallery builds. */
  builds: number;
  /** Runs of those builds that worked, recorded by other people. */
  reproductionsReceived: number;
  /** Published builds by other people that name one of theirs as the parent. */
  rebuildsOfTheirWork: number;
  /** Their accepted solutions on bounties that live on a build. */
  gapsSolved: number;
}

/** One row of maker_stats, exactly as the migration's RETURNS TABLE declares it. */
interface MakerStatsRow {
  /** bigint arrives as a number, or as a string when it outgrows one. */
  builds: number | string | null;
  reproductions_received: number | string | null;
  rebuilds_of_their_work: number | string | null;
  gaps_solved: number | string | null;
}

/** What maker_stats answers for a maker nothing can be counted for. */
export const NO_MAKER_STATS: MakerStats = {
  builds: 0,
  reproductionsReceived: 0,
  rebuildsOfTheirWork: 0,
  gapsSolved: 0,
};

/** The failure of getMakerStats: the user id, and nothing a reader wrote. */
export class MakerStatsError extends Error {
  readonly userId: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(userId: string, code: string | null = null, status: number | null = null) {
    super(`getMakerStats failed (user ${userId})`);
    this.name = "MakerStatsError";
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

/** A count as a whole number; zero for null or anything that is not one. */
function toCount(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The four figures for `userId`, in one request. */
export async function getMakerStats(userId: string): Promise<MakerStats> {
  const { data, error, status } = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: MakerStatsRow[] | MakerStatsRow | null; error: unknown; status?: number }>
  )("maker_stats", { uid: userId });

  if (error) {
    const { code } = error as { code?: unknown };
    throw new MakerStatsError(
      userId,
      typeof code === "string" && code ? code : null,
      typeof status === "number" && status > 0 ? status : null,
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ...NO_MAKER_STATS };
  return {
    builds: toCount(row.builds),
    reproductionsReceived: toCount(row.reproductions_received),
    rebuildsOfTheirWork: toCount(row.rebuilds_of_their_work),
    gapsSolved: toCount(row.gaps_solved),
  };
}
