// Mobile 28 D: the reader's level and XP, for the Level module on the phone's Your progress.
//
// THE CURVE IS THE DATABASE'S. `calc_level_from_xp` (migration 20260629162842) is level = floor((xp / 75)^(1 / 1.7)) + 1, at
// least 1, and XP-DESIGN.md keeps it. The database writes `user_progress.level` from it on every award; this reads that row
// and works out the figures around it with the same curve, so the bar and "260 to level 8" agree with the stored level.
//
// READ ONLY. XP is only ever written by the database (XP-DESIGN.md, RULES.md: no client path to award_xp). This module reads
// the reader's own row, which row-level security lets its owner read, and nothing else. A reader with no row yet is where a
// new account starts: 0 XP, level 1.
//
// ERRORS CARRY IDENTIFIERS ONLY, through progressFailure, as every progress read does.

import { supabase } from "@/integrations/supabase/client";
import { progressFailure } from "@/lib/progress/errors";

/** The curve's two constants, as calc_level_from_xp has them. */
export const LEVEL_SCALE = 75;
export const LEVEL_EXPONENT = 1.7;

/** The least XP that reaches `level`: 75 × (level − 1)^1.7, rounded up to a whole point. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return 0;
  return Math.ceil(LEVEL_SCALE * Math.pow(Math.floor(level) - 1, LEVEL_EXPONENT));
}

/**
 * The level a total reaches, as calc_level_from_xp works it out. The power is computed in floating point, so the answer is
 * checked against the thresholds either side and moved by one where rounding put it on the wrong side of a boundary.
 */
export function levelOf(xp: number): number {
  const total = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = Math.max(1, Math.floor(Math.pow(total / LEVEL_SCALE, 1 / LEVEL_EXPONENT)) + 1);
  while (xpForLevel(level + 1) <= total) level += 1;
  while (level > 1 && xpForLevel(level) > total) level -= 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  /** The total that reaches the next level. */
  next: number;
  /** XP still to earn for it. */
  toNext: number;
  /** How far through this level, 0 to 1. */
  fraction: number;
}

/**
 * The figures for the module. `stored` is `user_progress.level`; the curve decides when it is missing, and when it disagrees
 * with the total (a row written before a correction) the higher of the two is kept, since the database never lowers a level.
 */
export function levelProgress(xpTotal: number, stored?: number | null): LevelProgress {
  const xp = Number.isFinite(xpTotal) && xpTotal > 0 ? Math.floor(xpTotal) : 0;
  const level = Math.max(levelOf(xp), stored && Number.isFinite(stored) && stored >= 1 ? Math.floor(stored) : 1);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - start;
  return { level, xp, next, toNext: Math.max(0, next - xp), fraction: span > 0 ? Math.min(1, Math.max(0, (xp - start) / span)) : 0 };
}

/** "1,240 XP · 260 to level 8". */
export function levelLine(progress: LevelProgress): string {
  return `${progress.xp.toLocaleString("en-GB")} XP · ${progress.toNext.toLocaleString("en-GB")} to level ${progress.level + 1}`;
}

/** XP-DESIGN.md's principle, in its own words: the line under the bar. */
export const XP_LINE = "Nobody can award XP to themselves.";

interface LevelRow {
  xp_total: number | null;
  level: number | null;
}

/** The reader's own total and level: one request. No row yet is the start, 0 XP at level 1. */
export async function getMyLevel(userId: string): Promise<LevelProgress> {
  const row = await supabase.from("user_progress").select("xp_total, level").eq("user_id", userId).limit(1).maybeSingle();
  if (row.error) throw progressFailure("getMyLevel", userId, row);
  const data = (row.data ?? null) as LevelRow | null;
  return levelProgress(Number(data?.xp_total ?? 0), data?.level ?? null);
}
