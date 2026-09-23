// The provenance sentence, composed in one place (EX-P14).
//
// WHY THIS IS NOT THE COMPONENT. The copy is the whole of this feature's
// surface, so it is worth testing on its own — every client name, every count
// word, and the two ways it comes out as nothing — without mounting anything.
// Keeping it beside CreatedViaLine.tsx rather than inside it also keeps that
// file exporting a component and only a component, which is what the
// react-refresh rule asks for. rebuildCredit.ts beside ForkAttribution.tsx is
// the same arrangement for the same reason.
//
// THE CLIENT NAME IS NOT CONVERSATION CONTENT. It comes from
// import_sessions.client, a column whose CHECK constraint admits exactly six
// values, mapped below to four display names and one fallback. Nothing found
// inside an imported conversation can reach this string.

import type { CreatedVia } from "@/lib/build/provenance";

/**
 * The connector's six clients, as a reader would write them.
 *
 * `web` and `unknown` are deliberately absent: neither names a tool a reader
 * would recognise, so both fall through to the unnamed sentence rather than
 * printing "a web conversation". An unrecognised seventh value does the same,
 * which matters because the CHECK constraint can be widened by a later
 * migration before this map hears about it.
 */
const CLIENT_NAMES: Record<string, string> = {
  claude: "Claude",
  "claude-code": "Claude Code",
  chatgpt: "ChatGPT",
  cursor: "Cursor",
};

/**
 * Two to ten in words, because a sentence of prose does not carry a numeral.
 *
 * Past ten it is "several": a reader counting eleven conversations is being
 * given precision they cannot use, and this line is a caption rather than a
 * figure. One never reaches here — one import is the singular sentence, which
 * names the tool instead of the count.
 */
const COUNT_WORDS = [
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
] as const;

const MANY = "several";

/** 2 → "two", 10 → "ten", 11 → "several". */
export function countWord(count: number): string {
  return COUNT_WORDS[count - 2] ?? MANY;
}

/**
 * The sentence for one build, or null when there is nothing true to say.
 *
 * Null is the normal case: every build made before this step, and every build
 * made by hand, has no provenance recorded and gets no line.
 *
 * ONE CONVERSATION NAMES ITS TOOL; MORE THAN ONE COUNTS INSTEAD. Two imports
 * can come from two different tools, and a sentence that named only the first
 * would be describing a fraction of the build as though it were the whole.
 */
export function createdViaSentence(createdVia: CreatedVia | null | undefined): string | null {
  const count = createdVia?.imports.length ?? 0;
  if (count === 0) return null;

  if (count > 1) {
    return `Drafted from ${countWord(count)} AI conversations, reviewed by the creator.`;
  }

  const name = createdVia?.client ? CLIENT_NAMES[createdVia.client] : undefined;
  return name
    ? `Drafted from a ${name} conversation, reviewed by the creator.`
    : "Drafted from an AI conversation, reviewed by the creator.";
}
