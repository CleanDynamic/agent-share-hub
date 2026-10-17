// UI-P71 — suggested inputs from exact facts only (CONCEPT §4). Today that is
// one fact: a file of the build whose name is written word for word in a
// prompt. Nothing here guesses from meaning, names anything, or writes.

import { inputRefusal, type Step, type Use } from "./graph";

export interface Suggestion {
  stepId: string;
  use: Use;
  /** Shown as written: "named in the prompt". */
  reason: string;
}

export interface SuggestableFile {
  id: string;
  name: string;
}

export const NAMED_IN_PROMPT = "named in the prompt";

const isAlnum = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** A character that can be part of a file name, so a match touching it is not the whole name. */
const joinsName = (char: string | undefined): boolean => isAlnum(char) || char === "_" || char === "-";

/** True when `name` appears in `text` bounded on both sides by characters that cannot belong to a file name. */
export function namesFile(text: string, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) return false;
  const hay = text.toLowerCase();
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = hay[at - 1];
    const after = hay[at + needle.length];
    if (joinsName(before) || before === ".") continue;
    if (joinsName(after)) continue;
    // "CLAUDE.md." ends a sentence; "CLAUDE.md.bak" continues the name.
    if (after === "." && isAlnum(hay[at + needle.length + 1])) continue;
    return true;
  }
  return false;
}

function walk(steps: readonly Step[], out: Step[]): void {
  for (const step of steps) {
    out.push(step);
    walk(step.children, out);
  }
}

/**
 * Files offered as inputs. An agent's instructions are read from the agent
 * itself, so its "Instructions" child is skipped. Manual steps are never
 * suggested for, and a team has no text. A file a step makes (`made`) is
 * suggested only to the steps after the one that makes it.
 */
export function suggestUses(steps: readonly Step[], files: readonly SuggestableFile[], made?: ReadonlyMap<string, string>): Suggestion[] {
  const all: Step[] = [];
  walk(steps, all);
  const out: Suggestion[] = [];
  for (const step of all) {
    if (step.kind === "manual" || step.kind === "team" || step.id.endsWith(":instructions") || !step.text) continue;
    const dismissed = new Set(step.dismissed ?? []);
    for (const file of files) {
      const use: Use = { kind: "file", node_id: file.id };
      if (dismissed.has(`file:${file.id}`)) continue;
      if (!namesFile(step.text, file.name)) continue;
      if (inputRefusal(step.id, step.uses, use, steps, made) !== null) continue;
      out.push({ stepId: step.id, use, reason: NAMED_IN_PROMPT });
    }
  }
  return out;
}

/**
 * The seam for the parser change (design/sandbox/DETECTION-PROPOSAL.md): empty
 * until `parse-transcript` supplies the fields, so no interface work is needed
 * when it does.
 */
export function suggestFromProposal(_proposal: unknown, _steps: readonly Step[]): Suggestion[] {
  return [];
}
