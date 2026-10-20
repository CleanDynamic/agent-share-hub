// CA-04 P2 — Copy together: a step and everything sent with it, as the one message it was.
//
// PURE. A step's tiles are sent at the same time, in the same message, so copying the step copies them too, in tree
// order, depth first: the prompt's text; each code tile fenced with its language and its file name; "Attach {name}"
// for each file; a nested prompt's text. A manual step says what was done by hand. Nothing is invented: a tile with
// nothing to say adds nothing.

import type { Step } from "./graph";

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
      return step.text.trim() ? step.text : null;
  }
}

/** The message a step was: its own part, then each tile sent with it, depth first. Parts are a blank line apart. */
export function copyTogether(step: Step): string {
  const parts: string[] = [];
  const visit = (tile: Step) => {
    const part = partOf(tile);
    if (part) parts.push(part);
    for (const inner of tile.sentWith ?? []) visit(inner);
  };
  visit(step);
  return parts.join("\n\n");
}
