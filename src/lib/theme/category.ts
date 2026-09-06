// buildgallery.ai — the part-category resolver.
//
// Nine hues, one per part category, plus a fallback for a category nothing in
// the registry names. This module is the ONLY sanctioned way to turn a category
// string into a colour, and it is the layer that takes precedence over the
// database: `node_types.colour` still holds the values NS-P02 seeded, and every
// consumer now ignores that column in favour of `categoryColour(row.category)`.
// See the deprecation note above CATEGORY_COLOUR in src/components/build/tokens.ts.
//
//   categoryColour("evidence")  ->  "var(--cat-evidence)"
//   categoryFill("evidence")    ->  { background: "var(--cat-evidence-fill)",
//                                     color:      "var(--cat-evidence)" }
//
// Both return `var()` references rather than resolved colours, so a chip written
// with them follows <html data-theme="…"> with no re-render, exactly like every
// other token in this directory.
//
// WHY A FILL PAIR AND NOT AN ALPHA. The pattern this replaces was
// `background: hexToRgba(colour, 0.15), color: colour` — a fill computed at
// render time from a hex. Two things are wrong with it: it cannot work at all
// once the colour is a `var()` string, and 0.15 was never measured, so several
// of the nine failed 4.5:1 on their own tint. `categoryFill` returns a pair that
// was measured instead — see `primitives.ts` for the method and
// `category.test.ts` for the arithmetic, which runs on every test run.
//
// A FILL IS OPAQUE ON PURPOSE. Each was measured as the hue at a low alpha over
// `--bg`, then flattened to that composite. Flattened, the pairing holds on any
// ground — a glass card, a thumbnail, the page — rather than only over `--bg`,
// which is what a translucent fill would have guaranteed.

import { tokenVar, type TokenName } from "./tokens";

/** The nine. In the order the buildgallery-theme skill lists them. */
export const CATEGORIES = [
  "instruction",
  "configuration",
  "data",
  "artefact",
  "evidence",
  "narrative",
  "agents",
  "breakage",
  "media",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Spellings that are one of the nine under another name.
 *
 * `node_types.category` is a CHECK constraint over six values and none of them
 * needs an alias; these are the names the app already had in flight. `agent`
 * singular is what `CATEGORY_COLOUR` called the violet, and `gap` is the second
 * half of the skill's own "breakage / gap" row — a gap and a breakage are the
 * same hue because they are the same claim, that a piece is missing.
 *
 * A synonym goes here. A NEW MEANING DOES NOT: there are nine hues, there is a
 * fallback for everything else, and a tenth hue is not invented to fit a label.
 *
 * A `Map` rather than an object literal, because the argument to
 * `normaliseCategory` comes off a database row: an object lookup would answer
 * `"__proto__"` and `"constructor"` out of the prototype chain and hand a chip a
 * colour that is not a colour. A `Map` has no prototype keys to answer with.
 */
const ALIASES = new Map<string, Category>([
  ["agent", "agents"],
  ["gap", "breakage"],
]);

const KNOWN = new Set<string>(CATEGORIES);

/**
 * A category string as one of the nine, or `null` when it is none of them.
 *
 * Trims and lowercases first, so a label that arrived capitalised from a form or
 * a legacy row still lands. Anything else — an empty string, a category from a
 * newer migration than this build, `null` widened to a string by a caller — is
 * `null` here and the fallback everywhere else.
 */
export function normaliseCategory(category: string): Category | null {
  const key = (category ?? "").trim().toLowerCase();
  if (KNOWN.has(key)) return key as Category;
  return ALIASES.get(key) ?? null;
}

/**
 * The hue a category is drawn in, as a `var()` reference.
 *
 * An unknown category returns `var(--cat-fallback)`, which is `--text2`: the
 * part still renders, still reads, and is visibly not one of the nine. It never
 * throws — a build page rendering a category this deploy has not heard of is a
 * thing that happens, and it is not a crash.
 */
export function categoryColour(category: string): string {
  const known = normaliseCategory(category);
  return tokenVar((known ? `cat-${known}` : "cat-fallback") as TokenName);
}

/** A chip's measured background and the hue that is legal on it. */
export interface CategoryFill {
  /** The ground. Opaque, and measured against the hue below. */
  readonly background: string;
  /** The hue. At least 4.5:1 on `background`, in both themes. */
  readonly color: string;
}

/**
 * The measured background/foreground pair for a chip in this category.
 *
 * `color` is the same value `categoryColour` returns, so a chip and a bare label
 * of the same category are the same hue. Unknown categories get the fallback
 * pair — `--text2` on `--recess`, 4.55:1 on Exhibition and 5.73:1 on Dusk.
 *
 * Use it for both halves or neither. Putting this `color` on some other ground,
 * or this `background` under some other ink, is a pairing nobody measured.
 */
export function categoryFill(category: string): CategoryFill {
  const known = normaliseCategory(category);
  const stem = known ? `cat-${known}` : "cat-fallback";
  return {
    background: tokenVar(`${stem}-fill` as TokenName),
    color: tokenVar(stem as TokenName),
  };
}
