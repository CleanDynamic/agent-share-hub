// What the analytics page says about each build, in words (RC-P23). Pure: no
// request, no clock but the one passed in.
//
// NEEDS YOU is the short list of builds that are waiting on their maker
// ⟦better-layout › Order by importance⟧ ⟦critique-information-density ›
// Content Prioritisation⟧, one line each, the most pressing first:
//
//   waiting   solutions are waiting on one of its open bounties: somebody
//             did the work and is waiting for an answer
//   failing   a run did not work within the last 30 days, and nothing has
//             confirmed it working in that time
//   stale     nobody has confirmed it working within STALE_AFTER_DAYS
//             (isStale, src/lib/build/signals.ts): a gentle prompt, never a
//             failure ⟦buildgallery-theme › Plaque⟧
//
// YOUR BUILDS orders its table by Got working, then Last confirmed, and says
// so in one sentence; there is no sort control ⟦hicks-law⟧. "Last confirmed"
// is the Plaque's own freshness wording, with "stale" written out where the
// claim has gone stale.

import { freshnessLabel, isStale } from "@/lib/build/signals";
import type { BuildStatRow } from "./buildStats";

const DAY_MS = 86_400_000;

/** The window the failing reason looks back over, in days. */
export const RECENT_RUN_DAYS = 30;

/** The table's order, as the sentence above it states it. */
export const BUILD_TABLE_ORDER = "Most got working first, then the most recently confirmed.";

export type NeedsYouReason =
  | { kind: "waiting"; count: number }
  | { kind: "failing" }
  | { kind: "stale"; since: string | null };

export interface NeedsYouLine {
  build: BuildStatRow;
  reasons: NeedsYouReason[];
}

const URGENCY: Record<NeedsYouReason["kind"], number> = { waiting: 0, failing: 1, stale: 2 };

function within(value: string | null, days: number, now: number): boolean {
  if (!value) return false;
  const at = Date.parse(value);
  return Number.isFinite(at) && now - at <= days * DAY_MS;
}

/** Why this build needs its maker, most pressing first; empty when it does not. */
export function needsYouReasons(build: BuildStatRow, now: number = Date.now()): NeedsYouReason[] {
  const reasons: NeedsYouReason[] = [];
  if (build.solutions_waiting >= 1) reasons.push({ kind: "waiting", count: build.solutions_waiting });
  if (build.failed_last_30_days >= 1 && !within(build.last_confirmed_at, RECENT_RUN_DAYS, now)) {
    reasons.push({ kind: "failing" });
  }
  if (isStale(build, now)) reasons.push({ kind: "stale", since: build.last_confirmed_at ?? build.published_at });
  return reasons;
}

/**
 * The builds that need their maker, one line each: the most pressing reason
 * first, then in the table's order.
 */
export function needsYou(builds: readonly BuildStatRow[], now: number = Date.now()): NeedsYouLine[] {
  const ordered = orderForTable(builds);
  return ordered
    .map((build, index) => ({ build, reasons: needsYouReasons(build, now), index }))
    .filter((line) => line.reasons.length > 0)
    .sort((a, b) => URGENCY[a.reasons[0].kind] - URGENCY[b.reasons[0].kind] || a.index - b.index)
    .map(({ build, reasons }) => ({ build, reasons }));
}

/** "12 May 2026". */
export function formatDay(value: string): string {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return value;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** A reason, as its line says it. */
export function reasonText(reason: NeedsYouReason): string {
  switch (reason.kind) {
    case "waiting":
      return `${reason.count} ${reason.count === 1 ? "solution" : "solutions"} waiting`;
    case "failing":
      return "a recent run did not work";
    case "stale":
      return reason.since ? `not confirmed since ${formatDay(reason.since)}` : "not confirmed yet";
  }
}

function time(value: string | null): number {
  const at = value ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? at : -Infinity;
}

/** Got working, most first; then last confirmed, most recent first, never-confirmed last; then title. */
export function orderForTable(builds: readonly BuildStatRow[]): BuildStatRow[] {
  return [...builds].sort(
    (a, b) =>
      b.worked - a.worked ||
      time(b.last_confirmed_at) - time(a.last_confirmed_at) ||
      a.title.localeCompare(b.title),
  );
}

const FRESHNESS_PREFIX = "last confirmed working ";

/**
 * The "Last confirmed" cell: the Plaque's freshness wording under a header
 * that already says "Last confirmed" ("3 days ago, on Sonnet 4.5"); null when
 * nobody has confirmed it, which the cell says in the Plaque's own words
 * (NEVER_CONFIRMED); `stale` when the claim has gone stale.
 */
export function lastConfirmedText(build: BuildStatRow, now: number = Date.now()): { text: string | null; stale: boolean } {
  const label = freshnessLabel(build, now);
  const text = label === null ? null : label.startsWith(FRESHNESS_PREFIX) ? label.slice(FRESHNESS_PREFIX.length) : label;
  return { text, stale: isStale(build, now) };
}
