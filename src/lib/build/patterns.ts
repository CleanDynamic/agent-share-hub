// CA-13 Part 10: the patterns a build uses, worked out from the build itself. Pure; nothing is typed, nothing is guessed.

import type { SessionGroup, Step } from "./graph";

export type Pattern = "router" | "long-running" | "structured-output";

export const PATTERNS: readonly Pattern[] = ["router", "long-running", "structured-output"];

/** The words the Gallery's filter, a card's mark and the build page's facts line use. */
export const PATTERN_LABEL: Record<Pattern, string> = {
  router: "Uses a router",
  "long-running": "Long-running agent",
  "structured-output": "Structured output",
};

/** A session marked background whose facts show it ran over an hour. */
export const LONG_SESSION_MS = 3_600_000;

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children.filter((child) => !child.id.endsWith(":instructions"))), ...flatten(step.sentWith ?? [])]);

/**
 * `router`: a Decision with at least one step that runs when it went a certain way. `long-running`: an agent with at least one
 * helper, or a background session whose facts show over an hour. `structured-output`: a Decision, or any step with an answer shape.
 * In `PATTERNS` order, each at most once.
 */
export function buildPatterns(steps: readonly Step[], groups: readonly SessionGroup[] = []): Pattern[] {
  const all = flatten(steps);
  const decisions = new Set(all.filter((step) => step.kind === "decision").map((step) => step.id));
  const found = new Set<Pattern>();
  if (all.some((step) => step.runsWhen && decisions.has(step.runsWhen.decision))) found.add("router");
  if (all.some((step) => step.kind === "agent" && (step.helpers?.length ?? 0) > 0) || groups.some((group) => group.extras?.background === true && (group.extras.ms ?? 0) > LONG_SESSION_MS)) found.add("long-running");
  if (decisions.size > 0 || all.some((step) => step.outputShape)) found.add("structured-output");
  return PATTERNS.filter((pattern) => found.has(pattern));
}

/** Whether a stored value is one of the three, for a column's check. */
export const isPattern = (value: unknown): value is Pattern => PATTERNS.includes(value as Pattern);

/** "Uses a router · Long-running agent", for the build page's facts line; empty for none. */
export const patternsLine = (patterns: readonly Pattern[]): string => patterns.map((pattern) => PATTERN_LABEL[pattern]).join(" · ");
