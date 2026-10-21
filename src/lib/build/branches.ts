// CA-13 P3: the list's branch groups, pure. Steps that run when the same decision went the same way, one after another,
// are one group with a head ("If team is billing"). A step after the branches with no condition is where they meet:
// "Branches join here". Session prompts never have a condition, so they are never drawn inside a branch.

import { branchHead, sameCondition, type RunsWhen } from "./decision";
import type { Step } from "./graph";

export type BranchRow =
  | { kind: "step"; step: Step; group: number | null }
  | { kind: "head"; group: number; label: string; decisionId: string; when: RunsWhen }
  | { kind: "join" };

export const JOIN_LINE = "Branches join here";

/** The decision's question, for a head's words; the step's condition names both. */
function headFor(when: RunsWhen, all: readonly Step[]): string {
  const decision = all.find((step) => step.id === when.decision)?.decision;
  return branchHead(when, decision?.questions.find((q) => q.id === when.question));
}

/** The rows of a run of top-level steps, in order. `all` is every top-level step, to find a condition's decision. */
export function branchRows(steps: readonly Step[], all: readonly Step[] = steps): BranchRow[] {
  const rows: BranchRow[] = [];
  let group = -1;
  let open: RunsWhen | null = null;
  let branched = false;
  for (const step of steps) {
    const when = step.runsWhen ?? null;
    if (when) {
      if (!open || !sameCondition(open, when)) {
        group += 1;
        open = when;
        rows.push({ kind: "head", group, label: headFor(when, all), decisionId: when.decision, when });
      }
      branched = true;
      rows.push({ kind: "step", step, group });
      continue;
    }
    if (branched) {
      rows.push({ kind: "join" });
      branched = false;
    }
    open = null;
    rows.push({ kind: "step", step, group: null });
  }
  return rows;
}

/** Whether any step in the run branches: when none does, the list is drawn exactly as it was. */
export const hasBranches = (steps: readonly Step[]): boolean => steps.some((step) => step.runsWhen);
