// SV-23 P1: the counts a build stores for the Builds table and its filters. PURE: the composer works them out from the same steps,
// sessions and parts it draws, so a stored count is the number it shows.

import { shownGroups, type SessionGroup, type Step } from "./graph";

export interface StoredBuildCounts {
  step_count: number;
  part_count: number;
  agent_count: number;
  session_count: number;
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children), ...flatten(step.sentWith ?? [])]);

/**
 * `steps` is `buildSteps(tree)`, `groups` is `sessionGroups(...)`, `parts` the build's stored parts (`storedWorkstreamsOf`).
 * Steps are the top-level steps the composer numbers; agents are agent steps anywhere (a team is not an agent); sessions are
 * the ones the composer shows (`shownGroups`).
 */
export function storedCountsOf(steps: readonly Step[], groups: readonly SessionGroup[], parts: readonly unknown[]): StoredBuildCounts {
  return {
    step_count: steps.length,
    part_count: parts.length,
    agent_count: flatten(steps).filter((step) => step.kind === "agent").length,
    session_count: shownGroups(groups).length,
  };
}

const COLUMNS = ["step_count", "part_count", "agent_count", "session_count"] as const;

/** What the build row holds now for each count (null: not written yet). */
export function heldCountsOf(build: unknown): Record<(typeof COLUMNS)[number], number | null> {
  const row = (build && typeof build === "object" ? build : {}) as Record<string, unknown>;
  const held = (key: string) => (typeof row[key] === "number" && Number.isFinite(row[key] as number) ? (row[key] as number) : null);
  return { step_count: held("step_count"), part_count: held("part_count"), agent_count: held("agent_count"), session_count: held("session_count") };
}

/**
 * The write the composer owes: the counts that differ from the row's, or null. A build with nothing in it that was never counted
 * writes nothing (its columns stay "not written yet"), and so does one whose counts are as stored.
 */
export function countsToWrite(counts: StoredBuildCounts, build: unknown): Partial<StoredBuildCounts> | null {
  const held = heldCountsOf(build);
  const neverCounted = held.step_count === null && held.part_count === null && held.agent_count === null;
  if (neverCounted && counts.step_count === 0 && counts.part_count === 0 && counts.agent_count === 0 && counts.session_count === 0) return null;
  const patch: Partial<StoredBuildCounts> = {};
  for (const key of COLUMNS) if (held[key] !== counts[key]) patch[key] = counts[key];
  return Object.keys(patch).length > 0 ? patch : null;
}
