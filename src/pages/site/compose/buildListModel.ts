/* UI-P65 — what the List draws, from the steps the build already has.

   PURE. `buildSteps` gives the steps and their numbers (UI-P62); this works out
   the parts that need more than one step to decide: where the session dividers
   fall, what an input chip says, and which steps go into a result. */

import { modelRunLine } from "@/lib/build/modelRun";
import { sessionFactsLine, togetherLine } from "@/lib/build/sessionFacts";
import { groupKey, groupKind, shownGroups, stepTitle, type SessionGroup, type Step, type Use } from "@/lib/build/graph";
import { modelLabel } from "@/lib/models/registry";

import { sourceSessions, type SourceSession } from "./sourcesModel";

/** A suggested input for a step. Empty until UI-P71 finds some; Accept writes it, Dismiss keeps it from coming back. */
export interface ListSuggestion {
  stepId: string;
  use: Use;
  /** "Output of 1 · Brand brief". */
  label: string;
  /** "38 words match". */
  reason: string;
}

/** The finished thing, as the last card draws it. */
export interface ListResult {
  id: string;
  title: string;
  /** "a picture", "a link", "text". */
  holds: string;
  /** The step it came from, as a number ("3"), when known. */
  from: string | null;
}

/** The key a suggestion is dismissed under (DATA §3). */
export const suggestionKey = (use: Use): string => `${use.kind}:${use.node_id}`;

/**
 * The session divider that goes before a step: keyed by the number of the
 * first step of each run of steps from one session. A step that begins a new
 * session, or a new run of typed prompts, gets one; the steps after it do not.
 *
 * CA-04 P1: a build with exactly one session shows no head (CA-12: unless it is one made here), and an old build's
 * implicit group (its steps before any session) never has one.
 */
export function dividers(
  steps: readonly Step[],
  groups: readonly SessionGroup[],
  setupCounts: Readonly<Record<string, number>> = {},
  runsWhen: Readonly<Record<string, string>> = {},
): Map<string, SourceSession> {
  const out = new Map<string, SourceSession>();
  const shown = shownGroups(groups);
  // CA-04 P4, P6: a lone session keeps its head when it has something to say there: Setup {n}, Worked until, Runs when.
  const says = (group: SessionGroup) => Boolean(setupCounts[groupKey(group)] || runsWhen[groupKey(group)] || group.goal || sessionFactsLine({ extras: group.extras, words: group.longWords }, "maker") || togetherLine(group.extras, () => 0));
  // CA-12 P3: a session made here (Session 1 of a new post) always has its head, with its app or "No app chosen".
  if (shown.length === 0 || (shown.length === 1 && !says(shown[0]) && groupKind(shown[0]) !== "typed" && !shown[0].marked)) return out;
  const sessions = new Map(sourceSessions(groups, steps, [], {}, setupCounts, runsWhen).map((session) => [session.key, session]));
  for (const group of shown) {
    const first = group.stepNumbers[0];
    const session = sessions.get(groupKey(group));
    if (first && session) out.set(first, session);
  }
  return out;
}

/** "Output of 2 · Brand brief", "menu.pdf", "Figma": the text of an input chip. Null when what it names is gone. */
export function inputLabel(use: Use, steps: readonly Step[], names: Readonly<Record<string, string>>): string | null {
  if (use.kind === "output") {
    const named = steps.flatMap((step) => [step, ...step.children]).find((step) => step.id === use.node_id);
    return named ? `Output of ${named.number} · ${stepTitle(named)}` : null;
  }
  return names[use.node_id] ?? null;
}

/** The model as the card names it. */
export const stepModel = (step: Pick<Step, "model"> & Partial<Pick<Step, "modelRun">>): string | null => (step.model ? modelRunLine(modelLabel(step.model), step.modelRun) : null);

/** Whether text set in a clamped box is cut off: it needs more height than the box shows. */
export function isClamped(box: { scrollHeight: number; clientHeight: number }): boolean {
  return box.scrollHeight > box.clientHeight + 1;
}

/** "Agent · made in prompts 1 and 2 · Opus 5.5": the agent card's eyebrow. A team's reads "Team · made in …". */
export function agentEyebrow(made: readonly string[], model: string | null, word: "Agent" | "Team" = "Agent"): string {
  const parts: string[] = [word];
  if (made.length === 1) parts.push(`made in prompt ${made[0]}`);
  else if (made.length > 1) parts.push(`made in prompts ${made.slice(0, -1).join(", ")} and ${made[made.length - 1]}`);
  if (model) parts.push(model);
  return parts.join(" · ");
}

/**
 * CA-03 P4: a team's eyebrow. Its first agent is its lead: "Team · led by an agent in Claude Code" when the lead names
 * the tool it ran in (its harness), else "Team"; then where it was made, as any container's eyebrow says it.
 */
export function teamEyebrow(made: readonly string[], leadHarness: string | null | undefined): string {
  const base = agentEyebrow(made, null, "Team");
  return leadHarness ? base.replace(/^Team/, `Team · led by an agent in ${leadHarness}`) : base;
}

/** CA-03 P4: the words over a team's agents. */
export const TEAM_COPY = {
  lead: "Lead agent",
  handedTo: "Handed work to",
  agent: (name: string) => `Agent · ${name}`,
} as const;

/**
 * The steps an agent or a team is made from: the numbers of the steps in its
 * output uses, in the order it lists them (UI-P69). Empty when it uses none.
 */
export function madeIn(step: Pick<Step, "uses">, steps: readonly Step[]): string[] {
  const numbers: string[] = [];
  for (const use of step.uses) {
    if (use.kind !== "output") continue;
    const from = steps.find((candidate) => candidate.id === use.node_id);
    if (from) numbers.push(from.number);
  }
  return numbers;
}

/** "Makes brand-guide.md": the files a step makes, two names and then "+{n}". Null when it makes none. */
export function madeLine(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const more = names.length - 2;
  return `Makes ${names.slice(0, 2).join(", ")}${more > 0 ? ` +${more}` : ""}`;
}
