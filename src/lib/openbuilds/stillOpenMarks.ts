// UX-08 P1: the still-open marks of a draft, read from `making` and the tree. Pure, and light: the composer reads it to count them.

import { collectGaps, gapProblem } from "@/lib/build/gaps";
import { openTargetsOf } from "@/lib/build/openTargets";
import type { NodeTree } from "@/lib/build/types";

export interface StillOpenMark {
  size: "session" | "part" | "step";
  /** The session's key in `sessions_meta`, the part's key, or the step tile's node id. */
  key: string;
  /** What is missing, in the maker's words (may be empty for a step tile marked without words). */
  problem: string;
}

/** Parts first, then sessions (each in the order `making` holds them), then step tiles in the order the build reads. */
export function stillOpenMarksOf(making: unknown, tree: readonly NodeTree[]): StillOpenMark[] {
  const steps = collectGaps(tree).map((node) => ({ size: "step" as const, key: node.id, problem: gapProblem(node.payload).trim() }));
  return [...openTargetsOf(making), ...steps];
}
