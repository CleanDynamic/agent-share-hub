// CA-03 P8: one line that says what kind of build it is. PURE.
//
// Built from what the build holds, in this order, joined by " · ", leaving out what is not there:
//
//   the kind       One prompt, {n} prompts, An agent, {n} agents, A team of {n} agents (a team counts its agents),
//                  {n} teams. A team outranks agents, and agents outrank prompts: the kind is the biggest thing in it.
//   how it ran     only when it is not When I asked, read from the build's own top-level agents and teams (an agent
//                  inside a team says how it ran in its own row): runs on a schedule, runs when something happens,
//                  repeats until a condition is met. Several at the same time is how many, not when, and is not said.
//   a check        checks its own work
//   code           1 code file, {n} code files
//   manual steps   1 manual step, {n} manual steps
//
// A build with nothing but a title is the empty string, and nothing is drawn.

import type { RunsHow, Step } from "./graph";

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const RUNS_WORDS: Partial<Record<RunsHow, string>> = {
  schedule: "runs on a schedule",
  event: "runs when something happens",
  until: "repeats until a condition is met",
};

const RUNS_ORDER: readonly RunsHow[] = ["schedule", "event", "until"];

/** The kind of build: its biggest thing, counted. */
function kindOf(steps: readonly Pick<Step, "kind" | "children">[]): string | null {
  const teams = steps.filter((step) => step.kind === "team");
  if (teams.length > 1) return `${teams.length} teams`;
  if (teams.length === 1) {
    const agents = teams[0].children.filter((child) => child.kind === "agent").length;
    return `A team of ${agents} ${agents === 1 ? "agent" : "agents"}`;
  }
  const agents = steps.filter((step) => step.kind === "agent").length;
  if (agents === 1) return "An agent";
  if (agents > 1) return `${agents} agents`;
  const prompts = steps.filter((step) => step.kind === "prompt").length;
  if (prompts === 1) return "One prompt";
  if (prompts > 1) return `${prompts} prompts`;
  return null;
}

/** "A team of 3 agents · checks its own work · 2 code files". `steps` are the build's top-level steps, in order. */
export function buildSummary(steps: readonly Pick<Step, "kind" | "children" | "runs">[]): string {
  const hows = new Set(steps.filter((step) => step.kind === "agent" || step.kind === "team").map((step) => step.runs?.how ?? "once"));
  const code = steps.filter((step) => step.kind === "code").length;
  const manual = steps.filter((step) => step.kind === "manual").length;
  return [
    kindOf(steps),
    ...RUNS_ORDER.filter((how) => hows.has(how)).map((how) => RUNS_WORDS[how] as string),
    steps.some((step) => step.kind === "check") ? "checks its own work" : null,
    code > 0 ? count(code, "code file", "code files") : null,
    manual > 0 ? count(manual, "manual step", "manual steps") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
