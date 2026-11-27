// CA-04 P2 — Copy together: a step and everything sent with it, as the one message it was.
//
// PURE. A step's tiles are sent at the same time, in the same message, so copying the step copies them too, in tree
// order, depth first: the prompt's text; each code tile fenced with its language and its file name; "Attach {name}"
// for each file; a nested prompt's text. A manual step says what was done by hand. Nothing is invented: a tile with
// nothing to say adds nothing.

import { attachBlock, sentLine, sentModelOf } from "./attachments";
import { bracketed } from "./changes";
import type { Step } from "./graph";
import { originNote } from "./promptOrigin";

/** A code fence longer than any run of backticks inside the text, so the text appears whole. */
function fence(body: string, info: string): string {
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const marks = "`".repeat(longest + 1);
  return `${marks}${info}\n${body}\n${marks}`;
}

/** One tile's part of the message, or null when it has none. */
function partOf(step: Step): string | null {
  switch (step.kind) {
    case "code": {
      if (!step.text) return null;
      const info = [step.language && step.language !== "other" ? step.language : null, step.filename].filter(Boolean).join(" ");
      return fence(step.text, info);
    }
    case "file":
      return `Attach ${step.filename ?? step.title ?? "the file"}`;
    default:
      // CA-05 P1: the words a reader changes go in square brackets.
      // SV-30 P3: a prompt the maker did not type says how it was sent.
      return step.text.trim() ? [bracketed(step.text, step.changes), step.kind === "prompt" ? originNote(step.origin ?? null) : null].filter(Boolean).join(" ") : null;
  }
}

/** A prompt recorded as a message: it has attachments, or says what the app added. */
export const isMessage = (step: Pick<Step, "kind" | "attachments" | "context">): boolean => step.kind === "prompt" && Boolean(step.attachments?.length || step.context);

/** Whether a step copies as Copy together's message rather than its text alone. */
export const copiesTogether = (step: Pick<Step, "kind" | "attachments" | "context" | "sentWith">): boolean => Boolean(step.sentWith?.length) || isMessage(step);

/**
 * A prompt as the one message it was: its attachments as a numbered attach list (first for "before", after the text for
 * "after"), the text word for word, and the line that says what it was sent to and from. Null parts are left out.
 */
export function messageParts(step: Step): string[] {
  const text = partOf(step);
  if (step.kind !== "prompt") return text ? [text] : [];
  const block = attachBlock(step.attachments ?? [], step.attachmentsAt ?? "before");
  // A prompt saved before attachments (none, and nothing the app added) copies exactly as it did.
  const sent = isMessage(step) ? sentLine(sentModelOf(step), step.settings, step.context) : null;
  const ordered = step.attachmentsAt === "after" ? [text, block] : [block, text];
  return [...ordered, sent].filter((part): part is string => Boolean(part));
}

/** The message a step was: its own part, then each tile sent with it, depth first. Parts are a blank line apart. */
export function copyTogether(step: Step): string {
  const parts: string[] = [];
  const visit = (tile: Step) => {
    parts.push(...messageParts(tile));
    for (const inner of tile.sentWith ?? []) visit(inner);
  };
  visit(step);
  return parts.join("\n\n");
}
