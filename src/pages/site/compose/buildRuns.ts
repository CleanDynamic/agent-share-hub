/* CA-22: the build page's runs, in one place so the page and its motion read them the same way. */

import type { Step } from "@/lib/build/graph";

import type { BuildListProps } from "./BuildList";
import type { SourceSession } from "./sourcesModel";

/** A run of steps on the page: a session's head and the prompts that follow it, or one step that stands alone. */
export interface Run {
  key: string;
  head: SourceSession | null;
  steps: Step[];
}

/**
 * The runs on the page. A session's head starts its run and every step after it, of any kind, belongs to it until the next
 * head (CA-14: a session holds every kind of step, so an agent or a manual step in it is drawn inside it). Steps before any
 * head, and every step of a draft that has no heads, stand on their own, as they did.
 */
export function runsOf(steps: readonly Step[], dividers: BuildListProps["dividers"]): Run[] {
  const runs: Run[] = [];
  for (const step of steps) {
    const head = dividers.get(step.number) ?? null;
    const last = runs[runs.length - 1];
    if (head || !last || !last.head) runs.push({ key: step.id, head, steps: [step] });
    else last.steps.push(step);
  }
  return runs;
}

/** CA-14 P1: sessions with no tile yet are drawn too, each in the place its number gives it: before the first session numbered after it. */
export function withEmptySessions(runs: readonly Run[], empties: readonly SourceSession[]): Run[] {
  const out = [...runs];
  for (const head of [...empties].sort((a, b) => a.number - b.number)) {
    const at = out.findIndex((run) => run.head !== null && run.head.number > head.number);
    out.splice(at < 0 ? out.length : at, 0, { key: `empty:${head.key}`, head, steps: [] });
  }
  return out;
}

