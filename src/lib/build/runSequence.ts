// CA-13 Part 13: the run view's numbered steps for a build that has decisions, branches, helpers or an answer shape. Pure.
//
//   THE MAKER'S CODE COMES FIRST (rule 4). A Code tile that calls a Decision, or defines an agent, is the step a reader copies; the
//   Decision or agent is shown inside that step as "What this code sets up", not as a separate step to do by hand. Only when there
//   is no such code is the Decision (or the agent's setup) its own numbered step.
//   BRANCHES read as "If team is billing:" followed by that branch's steps numbered 4a, 4b; then "If team is support:" with 4c, 4d;
//   then "Then, in every case:" with the step where they join. The copied text uses the same words.
//   COSTS AND TIMES NEVER GO INTO COPIED TEXT. They are quiet lines under the step, and only when the maker shows costs.
//
// A build with none of these is not touched: `hasRuntimeFacts` is false and the run view reads exactly as before.

import { agentSpecOf, agentStartingPoint, definedInTiles, STARTING_POINT_NOTE } from "./agentCode";
import { shapeFragment, SHAPE_COPY_LEAD } from "./answerShape";
import { originalBuildLine, originalRunLine } from "./cost";
import { showsCost } from "./costView";
import { conditionKey, decisionRequest, modelShort, originalAnswer, runsWhenClause, type DecisionQuestion } from "./decision";
import { helperChip } from "./helpers";
import type { SessionGroup, Step } from "./graph";

export interface RunItemIn {
  id: string;
  title: string;
  kind: string;
  copyText: string | null;
}

export interface RunItemOut extends RunItemIn {
  /** "4", or "4a" under a branch. */
  number: string;
  /** A line before the step: "If team is billing:" or "Then, in every case:". */
  heading?: string;
  /** "What this code sets up": the decisions and agents it holds, one line each. */
  setsUp?: string[];
  /** Quiet lines: "The original took 1.2 s to make", "Each call cost the original £0.0001". Only when the maker shows costs. */
  quiet?: string[];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children.filter((child) => !child.id.endsWith(":instructions"))), ...flatten(step.sentWith ?? [])]);

/** Whether the run view has anything to say beyond what it always said. */
export const hasRuntimeFacts = (steps: readonly Step[]): boolean =>
  flatten(steps).some((step) => step.kind === "decision" || step.runsWhen || step.outputShape || (step.kind === "agent" && ((step.helpers?.length ?? 0) > 0 || (step.definedIn?.length ?? 0) > 0)));

const letters = (index: number): string => {
  let out = "";
  let n = index;
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
};

const nameOf = (step: Pick<Step, "title" | "defaultTitle">): string => step.title ?? step.defaultTitle;

/** A Decision on its own: the call, the request with the key as a placeholder, and what the original answered. */
export function decisionRunCopy(step: Step): string {
  const facts = step.decision;
  if (!facts) return "";
  const request = decisionRequest(facts);
  const given = facts.answer ?? facts.expected;
  const answered = given ? facts.questions.flatMap((q: DecisionQuestion) => (given[q.id] ? [originalAnswer(q, given[q.id])] : [])) : [];
  return [
    `Call ${modelShort(facts.provider, facts.model)} with this message and these questions`,
    facts.stateSample ? `\nMessage:\n${facts.stateSample}` : null,
    `\n${request.python}\n\n${request.curl}`,
    answered.length ? `\nOn the example, the original answered: ${answered.join("; ")}.` : null,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
}

/** An agent with helpers and no code: its instructions, its tools, "Helpers it used" one line each, and the labelled starting point. */
export function agentRunCopy(step: Step, names: Readonly<Record<string, string>>, decisionName: (id: string) => string | undefined): string {
  const spec = agentSpecOf(step, names);
  const lines: string[] = [];
  if (spec.instructions?.trim()) lines.push(spec.instructions.trim());
  if (spec.tools.length) lines.push(`Tools: ${spec.tools.join(", ")}`);
  if (spec.helpers.length) lines.push(["Helpers it used:", ...spec.helpers.map((helper) => `- ${helperChip(helper, decisionName)}`)].join("\n"));
  lines.push(agentStartingPoint(spec, decisionName));
  return lines.join("\n\n");
}

/** A step with an answer shape: what it copied, then "Answer in this shape:" and the schema, plus the fragment for its provider. */
export function withShape(copy: string | null, step: Step): string | null {
  const shape = step.outputShape;
  if (!shape) return copy;
  const fragment = shapeFragment(shape);
  const parts = [copy, shape.schema ? `${SHAPE_COPY_LEAD}\n${shape.schema}` : null, fragment.exact ? fragment.text : null].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join("\n\n") : copy;
}

/**
 * The run sequence, decorated. `items` are the registry's copyable parts in tree order, as the run view always walks them;
 * `steps` are the build's steps (`buildSteps`). Items for a decision or an agent that a Code tile sets up are folded into that
 * tile's step. `names` gives tool names by node id.
 */
export function decorateRun(items: readonly RunItemIn[], steps: readonly Step[], groups: readonly SessionGroup[], names: Readonly<Record<string, string>> = {}): RunItemOut[] {
  const all = flatten(steps);
  const byId = new Map(all.map((step) => [step.id, step]));
  const top = new Set(steps.map((step) => step.id));
  const present = new Set(items.map((item) => item.id));
  const money = showsCost(groups);
  const decisionName = (id: string) => (byId.get(id) ? nameOf(byId.get(id) as Step) : undefined);

  // What each Code tile sets up: the decisions that name it and the agents it defines, folded out of the sequence.
  const folded = new Set<string>();
  const sets = new Map<string, Step[]>();
  const fold = (child: Step, codeIds: readonly string[]) => {
    const home = codeIds.find((id) => present.has(id) && byId.get(id)?.kind === "code");
    if (!home) return;
    folded.add(child.id);
    sets.set(home, [...(sets.get(home) ?? []), child]);
  };
  for (const step of all) {
    if (step.kind === "decision" && step.decision) fold(step, step.decision.calledFrom);
    else if (step.kind === "agent" && top.has(step.id)) fold(step, step.definedIn ?? []);
  }

  const out: RunItemOut[] = [];
  let n = 0;
  let base = "";
  let letter = 0;
  let group: string | null = null;
  let branching = false;
  for (const item of items) {
    if (folded.has(item.id)) continue;
    const step = byId.get(item.id);
    const branch = step?.runsWhen && top.has(step.id) ? step.runsWhen : null;
    let number: string;
    let heading: string | undefined;
    if (branch) {
      branching = true;
      const key = conditionKey(branch);
      const question = byId.get(branch.decision)?.decision?.questions.find((q) => q.id === branch.question);
      if (key !== group) heading = `If ${runsWhenClause(branch, question)}:`;
      group = key;
      number = `${base || String(Math.max(n, 1))}${letters(letter++)}`;
    } else {
      if (branching) {
        heading = "Then, in every case:";
        branching = false;
        letter = 0;
        group = null;
      }
      n += 1;
      number = String(n);
      base = number;
    }

    let copyText = item.copyText;
    if (step?.kind === "decision") copyText = decisionRunCopy(step);
    else if (step?.kind === "agent" && !step.definedIn?.some((id) => present.has(id)) && ((step.helpers?.length ?? 0) > 0 || step.outputShape)) {
      copyText = (step.helpers?.length ?? 0) > 0 ? agentRunCopy(step, names, decisionName) : copyText;
    }
    if (step) copyText = withShape(copyText, step);

    const setsUp = (sets.get(item.id) ?? []).map((child) =>
      child.kind === "decision" && child.decision
        ? `Decision '${nameOf(child)}' (${modelShort(child.decision.provider, child.decision.model)}): ${child.decision.questions.map((q) => q.id).join(", ")}`
        : `Agent '${nameOf(child)}'${child.helpers?.length ? ` with helpers: ${child.helpers.map((helper) => helperChip(helper, decisionName)).join(", ")}` : ""}`,
    );

    const quiet = money
      ? [
          step ? originalBuildLine(step.buildCost, true) : null,
          step ? originalRunLine(step.runCost, true) : null,
          ...(sets.get(item.id) ?? []).map((child) => originalRunLine(child.runCost, true)),
        ].filter((line): line is string => Boolean(line))
      : [];

    out.push({ ...item, copyText, number, ...(heading ? { heading } : null), ...(setsUp.length ? { setsUp } : null), ...(quiet.length ? { quiet } : null) });
  }
  return out;
}

/** The whole sequence as plain text: the title, "Before you start", then each step with its heading, number and copy text. */
export function decoratedText(title: string, prerequisites: readonly { title: string; requirement: string | null }[], items: readonly RunItemOut[]): string {
  const blocks: string[] = [title];
  if (prerequisites.length > 0) blocks.push(["Before you start", ...prerequisites.map((item) => `- ${item.title}${item.requirement ? ` — ${item.requirement}` : ""}`)].join("\n"));
  for (const item of items) {
    const heading = `${item.number}. ${item.title}`;
    const body = [item.copyText ? `${heading}\n${item.copyText}` : heading, item.setsUp?.length ? ["What this code sets up:", ...item.setsUp.map((line) => `- ${line}`)].join("\n") : null].filter(Boolean).join("\n");
    blocks.push(item.heading ? `${item.heading}\n${body}` : body);
  }
  return `${blocks.join("\n\n")}\n`;
}

export { STARTING_POINT_NOTE, definedInTiles };
