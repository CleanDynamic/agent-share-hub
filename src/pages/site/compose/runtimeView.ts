/* CA-13 — the runtime side of a tile, as the Details panel's view of it.

   PURE. A runtime tile (agent, team, code, tool, decision) can run when a decision above it went a certain way (rule 1);
   nothing else is offered "Runs when". The panel reads this; it never reads payloads. */

import { decisionRefsOf, topIndexOf, type Step } from "@/lib/build/graph";
import { canRunWhen, runsWhenChoices, runsWhenLabel, runsWhenOf, runsWhenRefusal, type RunsWhen, type RunsWhenIs } from "@/lib/build/decision";

export interface RunsWhenQuestion {
  id: string;
  choices: { label: string; is: RunsWhenIs }[];
}

export interface RunsWhenDecision {
  id: string;
  /** "3 · team", the step's number and its title. */
  label: string;
  questions: RunsWhenQuestion[];
}

export interface RunsWhenView {
  current: RunsWhen | null;
  /** "Runs when team is billing", or null when it always runs. */
  currentLabel: string | null;
  /** Why the stored condition no longer holds (a decision that was removed...), or null. */
  broken: string | null;
  /** The decisions above this step, nearest first. */
  decisions: RunsWhenDecision[];
}

export interface RuntimeView {
  runsWhen?: RunsWhenView;
}

/** The kind a step has for `canRunWhen`: a tool tile is "tool"; an agent inside a team is not a top-level tile. */
export function runsWhenViewOf(step: Step, steps: readonly Step[]): RunsWhenView | undefined {
  if (!canRunWhen(step.kind)) return undefined;
  const index = steps.findIndex((candidate) => candidate.id === step.id);
  // Only a tile placed at the top level is placed after a decision; an agent inside a team follows its team.
  if (index < 0) return undefined;
  const refs = decisionRefsOf(steps);
  const above = refs.filter((ref) => ref.index < index && ref.id !== step.id);
  const current = step.runsWhen ?? runsWhenOf(undefined);
  const owner = current ? refs.find((ref) => ref.id === current.decision) : undefined;
  return {
    current,
    currentLabel: current ? runsWhenLabel(current, owner?.facts?.questions.find((q) => q.id === current.question)) : null,
    broken: current ? runsWhenRefusal(step.kind, topIndexOf(steps, step.id), current, refs) : null,
    decisions: above
      .reverse()
      .map((ref) => {
        const found = steps[ref.index];
        return {
          id: ref.id,
          label: `${found.number} · ${found.title ?? found.defaultTitle}`,
          questions: (ref.facts?.questions ?? []).map((q) => ({ id: q.id, choices: runsWhenChoices(q) })),
        };
      }),
  };
}

export const runtimeViewOf = (step: Step, steps: readonly Step[]): RuntimeView | undefined => {
  const runsWhen = runsWhenViewOf(step, steps);
  return runsWhen ? { runsWhen } : undefined;
};
