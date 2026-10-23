/* CA-13 — the runtime side of a tile, as the Details panel's view of it.

   PURE. A runtime tile (agent, team, code, tool, decision) can run when a decision above it went a certain way (rule 1);
   nothing else is offered "Runs when". The panel reads this; it never reads payloads. */

import { decisionRefsOf, topIndexOf, type RuntimePatch, type Step } from "@/lib/build/graph";
import type { CostFigures, RunCost } from "@/lib/build/cost";
import type { Helper } from "@/lib/build/helpers";
import { schemaFileNames, type OutputShape } from "@/lib/build/answerShape";
import { canBranchOn, canRunWhen, runsWhenChoices, runsWhenLabel, runsWhenOf, runsWhenRefusal, type RunsWhen, type RunsWhenIs } from "@/lib/build/decision";

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
  /** An agent: its helpers, the Code tiles it is defined in, its trace link and install line. */
  agent?: {
    helpers: Helper[];
    definedIn: string[];
    traceUrl: string | null;
    install: string | null;
    codeTiles: { id: string; label: string; source: string }[];
    decisions: { id: string; label: string }[];
    toolNames: string[];
  };
  /** A decision's install line, shown beside its settings. */
  install?: string | null;
  /** A prompt or an agent: its answer shape, and any `*.schema.json` file in the build. */
  shape?: { shape: OutputShape | null; schemaFiles: string[] };
  /** Any tile: what it took to make; a runtime tile also what it costs to run (rule 3). */
  costs?: { build: CostFigures | null; run: RunCost | null; runtime: boolean };
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
          questions: (ref.facts?.questions ?? []).filter(canBranchOn).map((q) => ({ id: q.id, choices: runsWhenChoices(q) })),
        };
      }),
  };
}

/** The runtime side of a selected tile; undefined when there is none to show. `names` gives tool and file names by node id. */
export const runtimeViewOf = (step: Step, steps: readonly Step[], names: Readonly<Record<string, string>> = {}, fileNames: readonly string[] = []): RuntimeView | undefined => {
  const out: RuntimeView = {};
  const runsWhen = runsWhenViewOf(step, steps);
  if (runsWhen) out.runsWhen = runsWhen;
  const top = steps.some((candidate) => candidate.id === step.id);
  if (step.kind === "agent" && top) {
    out.agent = {
      helpers: step.helpers ?? [],
      definedIn: step.definedIn ?? [],
      traceUrl: step.traceUrl ?? null,
      install: step.install ?? null,
      codeTiles: steps.filter((candidate) => candidate.kind === "code").map((candidate) => ({ id: candidate.id, label: candidate.filename ?? candidate.title ?? candidate.defaultTitle, source: candidate.text })),
      decisions: steps.filter((candidate) => candidate.kind === "decision").map((candidate) => ({ id: candidate.id, label: candidate.title ?? candidate.defaultTitle })),
      toolNames: (step.toolRefs ?? []).map((id) => names[id]).filter((name): name is string => Boolean(name)),
    };
  }
  if ((step.kind === "agent" && top) || step.kind === "prompt") out.shape = { shape: step.outputShape ?? null, schemaFiles: schemaFileNames(fileNames) };
  if (!step.id.endsWith(":instructions") && (top || step.kind === "prompt")) out.costs = { build: step.buildCost ?? null, run: step.runCost ?? null, runtime: canRunWhen(step.kind) };
  return Object.keys(out).length ? out : undefined;
};

/**
 * CA-18: the runtime view with a patch laid over it, as it would read once the patch was written. A window that holds its writes
 * until Save shows this, so a second change builds on the first.
 */
export function withRuntimePatch(runtime: RuntimeView, patch: RuntimePatch): RuntimeView {
  const next: RuntimeView = { ...runtime };
  if (runtime.agent) {
    next.agent = {
      ...runtime.agent,
      ...("helpers" in patch ? { helpers: [...(patch.helpers ?? [])] } : null),
      ...("definedIn" in patch ? { definedIn: [...(patch.definedIn ?? [])] } : null),
      ...("traceUrl" in patch ? { traceUrl: patch.traceUrl ?? null } : null),
      ...("install" in patch ? { install: patch.install ?? null } : null),
    };
  }
  if ("install" in patch && !runtime.agent && runtime.install !== undefined) next.install = patch.install ?? null;
  if ("outputShape" in patch && runtime.shape) next.shape = { ...runtime.shape, shape: patch.outputShape ?? null };
  if (runtime.costs && ("buildCost" in patch || "runCost" in patch)) {
    next.costs = { ...runtime.costs, ...("buildCost" in patch ? { build: patch.buildCost ?? null } : null), ...("runCost" in patch ? { run: patch.runCost ?? null } : null) };
  }
  return next;
}
