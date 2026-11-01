// CA-13 P8: the build's cost lines, from its steps and sessions. Pure. "To build" reads sessions and tiles; "to run" reads
// runtime tiles only; the two never meet (rule 3).

import { buildLine, buildTotals, buildTotalsLine, partOfBuildCost, partOfSession, runLine, runTotals, runTotalsLines, type BuildPart, type RunTile } from "./cost";
import { helperSavingsLine } from "./helpers";
import type { SessionGroup, Step } from "./graph";
import { shownGroups } from "./graph";

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children.filter((child) => !child.id.endsWith(":instructions"))), ...flatten(step.sentWith ?? [])]);

/** Whether readers see money: the maker ticked Show readers on at least one session. Time and tokens show whenever they are given. */
export const showsCost = (groups: readonly SessionGroup[]): boolean => groups.some((group) => group.extras?.showCost === true);

/** The parts that could carry a build figure: every session and every tile; and which of them did. */
export function buildPartsOf(steps: readonly Step[], groups: readonly SessionGroup[]): BuildPart[] {
  return [...shownGroups(groups).map((group) => partOfSession(group.extras)), ...flatten(steps).map((step) => partOfBuildCost(step.buildCost))];
}

/** The runtime tiles of the build, top level: every one has a place on the main path unless it runs only when a decision went one way. */
export function runTilesOf(steps: readonly Step[]): RunTile[] {
  return steps
    .filter((step) => step.kind === "agent" || step.kind === "team" || step.kind === "code" || step.kind === "tool" || step.kind === "decision" || step.kind === "retrieval")
    .map((step) => ({ id: step.id, name: `${step.number} · ${step.title ?? step.defaultTitle}`, run: step.runCost ?? null, mainPath: !step.runsWhen }));
}

export interface CostLines {
  /** "To build: 4 h 12 min · 1.2M tokens · £8.40 · from 9 of 12 steps", or null. */
  build: string | null;
  /** "To run: about £0.003 a call · 0.4 s", or one line for each runtime tile; empty when none has a figure. */
  run: string[];
  /** "Helpers cut about 310k tokens a run", belonging to what it costs to run. */
  savings: string | null;
}

export function costLines(steps: readonly Step[], groups: readonly SessionGroup[], audience: "maker" | "reader"): CostLines {
  const money = audience === "maker" || showsCost(groups);
  const flat = flatten(steps);
  return {
    build: buildTotalsLine(buildTotals(buildPartsOf(steps, groups)), money),
    run: runTotalsLines(runTotals(runTilesOf(steps)), money),
    savings: helperSavingsLine(flat.flatMap((step) => step.helpers ?? [])),
  };
}

/** The quiet line a tile shows: "Made in 1.2 s · 3,400 tokens · £0.01" for what it took to make; for a runtime tile, also what it costs to run. */
export function tileCostLines(step: Pick<Step, "buildCost" | "runCost">, audience: "maker" | "reader", groups: readonly SessionGroup[]): { build: string | null; run: string | null } {
  const money = audience === "maker" || showsCost(groups);
  return { build: buildLine(step.buildCost, money), run: runLine(step.runCost, money) };
}
