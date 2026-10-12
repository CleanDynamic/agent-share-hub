/* UI-P65 — what the List draws, from the steps the build already has.

   PURE. `buildSteps` gives the steps and their numbers (UI-P62); this works out
   the parts that need more than one step to decide: where the session dividers
   fall, what an input chip says, and which steps go into a result. */

import { stepTitle, type SessionGroup, type Step, type Use } from "@/lib/build/graph";
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
 */
export function dividers(steps: readonly Step[], groups: readonly SessionGroup[]): Map<string, SourceSession> {
  const sessions = sourceSessions(groups, steps);
  const out = new Map<string, SourceSession>();
  groups.forEach((group, at) => {
    const first = group.stepNumbers[0];
    if (first) out.set(first, sessions[at]);
  });
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
export const stepModel = (step: Pick<Step, "model">): string | null => (step.model ? modelLabel(step.model) : null);

/** Whether text set in a clamped box is cut off: it needs more height than the box shows. */
export function isClamped(box: { scrollHeight: number; clientHeight: number }): boolean {
  return box.scrollHeight > box.clientHeight + 1;
}

/** "Agent · made in prompts 1 and 2 · Opus 5.5": the agent card's eyebrow. */
export function agentEyebrow(made: readonly string[], model: string | null): string {
  const parts = ["Agent"];
  if (made.length === 1) parts.push(`made in prompt ${made[0]}`);
  else if (made.length > 1) parts.push(`made in prompts ${made.slice(0, -1).join(", ")} and ${made[made.length - 1]}`);
  if (model) parts.push(model);
  return parts.join(" · ");
}
