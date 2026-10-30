// SV-23 P2: Runs, 12 weeks. A run is a `build_reproductions` row; its week is the calendar week (Monday 00:00 UTC) of `confirmed_at`.
// PURE. The Builds list embeds the last twelve weeks of each build's runs in its own request and counts them here.

import { weekStartUtc } from "@/lib/progress/weekly";

export const RUN_WEEKS = 12;
const WEEK_MS = 7 * 86_400_000;

/** The first moment the twelve weeks cover: Monday 00:00 UTC, eleven weeks before this week's. */
export function runsSince(now: Date): Date {
  return new Date(weekStartUtc(now).getTime() - (RUN_WEEKS - 1) * WEEK_MS);
}

/** Twelve counts, the oldest week first and this week last. A stamp outside the twelve weeks, or not a date, is not counted. */
export function runsPerWeek(stamps: readonly (string | null | undefined)[], now: Date): number[] {
  const first = runsSince(now).getTime();
  const counts = Array.from({ length: RUN_WEEKS }, () => 0);
  for (const stamp of stamps) {
    const at = Date.parse(stamp ?? "");
    if (!Number.isFinite(at) || at < first) continue;
    const week = Math.floor((at - first) / WEEK_MS);
    if (week >= 0 && week < RUN_WEEKS) counts[week] += 1;
  }
  return counts;
}

/** "Runs per week over 12 weeks, oldest first: ..." is drawn by the table; this is the total it can say in a word. */
export const totalRuns = (weeks: readonly number[]): number => weeks.reduce((sum, n) => sum + n, 0);
