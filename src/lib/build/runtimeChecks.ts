// CA-13 Part 18: what the runtime tiles still need before publishing. Pure.
//
// BLOCKERS stop Publish and join the Missing line: a Decision with no questions or an option-less choice, and a "Runs when" that
// no longer fits its decision. REMINDERS never stop it: a helper with no job or provider, an answer shape with no schema, and a
// Decision or Deep Agents agent with no code (a copier then gets a request or a starting point, not the maker's own code).

import { definedInTiles } from "./agentCode";
import { questionsRefusal, runsWhenRefusal } from "./decision";
import { shapeRefusal } from "./answerShape";
import { decisionRefsOf, type Step } from "./graph";

export const NO_CODE_REMINDER = "People copying this will get a request, not your code. Add the code that calls it.";

export interface RuntimeChecks {
  blockers: string[];
  reminders: string[];
}

const nameOf = (step: Step): string => step.title ?? step.defaultTitle;

/** `steps` are the top-level steps in order, as `buildSteps` gives them. */
export function runtimeChecks(steps: readonly Step[]): RuntimeChecks {
  const blockers: string[] = [];
  const reminders: string[] = [];
  const refs = decisionRefsOf(steps);
  const flat = steps.flatMap(function walk(step): Step[] {
    return [step, ...step.children.filter((child) => !child.id.endsWith(":instructions")).flatMap(walk)];
  });
  steps.forEach((step, index) => {
    if (step.kind === "decision") {
      const why = questionsRefusal(step.decision?.questions ?? [], nameOf(step));
      if (why) blockers.push(why);
      else
        for (const q of step.decision?.questions ?? [])
          if (q.type === "choice" && (q.options?.length ?? 0) < 2) blockers.push(`Decision '${nameOf(step)}' needs at least two options for '${q.id}'`);
    }
    if (step.runsWhen) {
      const why = runsWhenRefusal(step.kind, index, step.runsWhen, refs);
      if (why) blockers.push(`'${nameOf(step)}': ${why}`);
    }
  });
  for (const step of flat) {
    if (step.kind === "agent") {
      for (const helper of step.helpers ?? []) if (!helper.job || !helper.provider?.trim()) reminders.push(`A helper on '${nameOf(step)}' is missing its job or its provider.`);
      if (/deep ?agents/i.test(step.harness ?? "") && definedInTiles(step, flat).length === 0) reminders.push(NO_CODE_REMINDER);
    }
    if (step.outputShape && shapeRefusal(step.outputShape)) reminders.push(`The answer shape on '${nameOf(step)}' is missing its schema.`);
    if (step.kind === "decision" && (step.decision?.calledFrom.length ?? 0) === 0) reminders.push(NO_CODE_REMINDER);
  }
  return { blockers, reminders: [...new Set(reminders)] };
}
