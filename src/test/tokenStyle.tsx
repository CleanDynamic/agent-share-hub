// Reading a token-valued style back out, in a test.
//
// WHY THIS EXISTS. jsdom's CSS parser does not understand `var()` or
// `color-mix()`: assign either to `element.style.color` and it stores NOTHING —
// not the reference, not a fallback, not even the property. So from BG-P21,
// when every colour in this codebase is a `var(--token)` string, no assertion
// that reads `element.style.*` or `toHaveStyle` can see a colour at all. The
// six tests that broke on the repoint broke for exactly that reason, and they
// were not wrong about the component.
//
// THE WAY ROUND IT is the one the BG-P11 brand tests already take: render with
// `renderToStaticMarkup`, which writes the style attribute as a string and never
// hands it to the CSS parser. This module adds the second half — parsing that
// markup back into a document so a claim can still be made about a PARTICULAR
// element ("the winner row's first cell", "each of the three sections") rather
// than about the page's whole HTML. `DOMParser` stores an attribute verbatim and
// only parses `style` when `.style` is read, so `getAttribute("style")` gives
// the declarations back exactly as React wrote them.
//
//   const doc = staticDoc(<NodeCard … />);
//   expect(styleOf(doc.querySelector("td"))).toContain("border-left:3px solid var(--evidence)");
//
// Use it for COLOUR and for anything else carried by a token. Structure,
// behaviour and text stay with @testing-library/react and the real DOM, which
// render nothing differently for having a `var()` in a style attribute.

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** The markup a component renders, with every style attribute intact. */
export function staticMarkup(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

/** That markup as a queryable document. Styles are unparsed — see `styleOf`. */
export function staticDoc(node: ReactElement): Document {
  return new DOMParser().parseFromString(staticMarkup(node), "text/html");
}

/**
 * One element's style declarations, as React wrote them.
 *
 * Whitespace-free and lower-case, which is how React serialises: a caller can
 * match `"border-left:3px solid var(--evidence)"` literally. An element with no
 * style attribute — including one whose every declaration jsdom would have
 * dropped — answers the empty string rather than throwing, so a negative claim
 * ("this row carries no breakage hue") reads the same way as a positive one.
 */
export function styleOf(element: Element | null | undefined): string {
  return element?.getAttribute("style") ?? "";
}

/**
 * Every element in `doc` whose style attribute contains `needle`.
 *
 * For the claims that are about a COUNT — three accent sections, one primary
 * action — where finding the elements by role or text would say less than
 * finding them by the token they carry.
 */
export function styledWith(doc: Document, needle: string): Element[] {
  return Array.from(doc.querySelectorAll("[style]")).filter((element) =>
    styleOf(element).includes(needle),
  );
}
