// A maker's five figures, for the Profile stats row (UI-P26a).
//
// FOUR OF THE FIVE ALREADY HAVE A HOME. getMakerStats (maker_stats, RC-P21)
// counts what they published, runs and rebuilds by other people, and accepted
// solutions in one round trip, and Profile.tsx hands its answer to MakerFigures
// and the header's EarnedNumbers as props. This function takes those four from
// it rather than counting them a second way, so the row here and the figures
// there cannot disagree; what it adds is the one figure no function returned,
// the money.
//
// bountiesSolved and bountyEarningsGbp describe the SAME bounties: accepted
// solutions on bounties that live on a build, as maker_stats counts them. A
// reward on a legacy post's bounty is not in the earnings, because that bounty
// is not in the count beside it.
//
// ERRORS CARRY THE USER ID ONLY ⟦neoscale-error-monitoring › Privacy⟧, with the
// code and status isPermissionError reads, as MakerStatsError does.

import { supabase } from "@/integrations/supabase/client";
import { getMakerStats } from "./makerStats";

/** What a maker has done and earned, as the Profile stats row shows it. */
export interface MakerFigures {
  /** Builds they published (published or gallery). */
  buildsHung: number;
  /** Runs of those builds that worked, recorded by anyone other than them. */
  reproducedByOthers: number;
  /** Published rebuilds by other people whose source is one of their builds. */
  rebuildsOfWork: number;
  /** Bounties on a build where their solution was accepted. */
  bountiesSolved: number;
  /** The rewards of those bounties, summed, in whole pounds. */
  bountyEarningsGbp: number;
}

/** The failure of a figures read: the user id, and nothing a reader wrote. */
export class MakerFiguresError extends Error {
  readonly operation: string;
  readonly userId: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(operation: string, userId: string, code: string | null = null, status: number | null = null) {
    super(`${operation} failed (user ${userId})`);
    this.name = "MakerFiguresError";
    this.operation = operation;
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

function failure(operation: string, userId: string, response: { error: unknown; status?: number }) {
  const { code } = (response.error ?? {}) as { code?: unknown };
  return new MakerFiguresError(
    operation,
    userId,
    typeof code === "string" && code ? code : null,
    typeof response.status === "number" && response.status > 0 ? response.status : null,
  );
}

/** The most accepted solutions read to total the earnings. */
const ACCEPTED_LIMIT = 200;

/** Bounty ids per read; a uuid is 36 characters, so a hundred is about 4KB of URL. */
const BOUNTY_CHUNK = 100;

/** The five figures for `userId`: maker_stats' four, and what their accepted solutions paid. */
export async function getMakerFigures(userId: string): Promise<MakerFigures> {
  const [stats, bountyEarningsGbp] = await Promise.all([
    getMakerStats(userId),
    getBountyEarningsGbp(userId),
  ]);

  return {
    buildsHung: stats.builds,
    reproducedByOthers: stats.reproductionsReceived,
    rebuildsOfWork: stats.rebuildsOfTheirWork,
    bountiesSolved: stats.gapsSolved,
    bountyEarningsGbp,
  };
}

/**
 * The summed rewards of the build bounties where this maker's solution was
 * accepted, in whole pounds: their accepted solutions, then the rewards of the
 * bounties those answered. An unpriced bounty adds nothing.
 */
async function getBountyEarningsGbp(userId: string): Promise<number> {
  const accepted = await supabase
    .from("solutions")
    .select("bounty_id")
    .eq("solver_id", userId)
    .eq("status", "accepted")
    .limit(ACCEPTED_LIMIT);
  if (accepted.error) throw failure("getMakerFigures (solutions)", userId, accepted);

  const rows = (accepted.data ?? []) as Array<{ bounty_id: string }>;
  if (rows.length >= ACCEPTED_LIMIT) {
    // TODO: an aggregate RPC (security invoker) beside maker_stats, with no cap.
    console.warn(`[getMakerFigures] read the ${ACCEPTED_LIMIT}-row cap; the earnings are partial`);
  }

  const ids = [...new Set(rows.map((row) => row.bounty_id))];
  const chunks: string[][] = [];
  for (let at = 0; at < ids.length; at += BOUNTY_CHUNK) chunks.push(ids.slice(at, at + BOUNTY_CHUNK));

  const rewards = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("bounties")
        .select("id, reward_gbp")
        .in("id", chunk)
        .not("build_id", "is", null)
        .limit(chunk.length),
    ),
  );

  let total = 0;
  for (const response of rewards) {
    if (response.error) throw failure("getMakerFigures (bounties)", userId, response);
    for (const row of (response.data ?? []) as Array<{ reward_gbp: number | string | null }>) {
      const reward = Number(row.reward_gbp);
      if (Number.isFinite(reward) && reward > 0) total += reward;
    }
  }
  return Math.round(total);
}
