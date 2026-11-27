// 29e: which movement a page change makes on a phone. A dock tab switch is instant (no transition at all); opening a page
// from a root page or from another pushed page is a push (the new page enters from the right); returning to a root page is a
// back. Pure, so the rule has one place and a test.

import { dockSectionOf } from "./dockScroll";

export type PhoneNavKind = "none" | "push" | "back";

/** The movement for a change from `from` to `to` (pathnames). `popping` is a Back (the header's, or the history's). */
export function phoneNavKind(from: string, to: string, popping = false): PhoneNavKind {
  const fromRoot = dockSectionOf(from) !== null;
  const toRoot = dockSectionOf(to) !== null;
  if (fromRoot && toRoot) return "none";
  if (popping) return "back";
  return "push";
}
