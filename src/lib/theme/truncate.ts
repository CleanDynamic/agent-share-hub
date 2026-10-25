// CA-27 P2: the one rule for text that does not fit.
//
//   Titles and names: one line, then "…". The full text is in the `title` attribute (the tooltip) and in the accessible name: the
//   element still holds all of it in the document, so a screen reader reads it whole; only the eye is cut.
//   Previews: two lines, then "…", with a line clamp.
//
// Nothing else cuts text. A cell that holds a title also says `min-width: 0`, which `TITLE_LINE` carries, so a flex row gives way
// at the title first and never past the edge of its box.

import type { CSSProperties } from "react";

/** How many lines a preview keeps. */
export const PREVIEW_LINES = 2;

/** A title or a name: one line and an ellipsis. */
export const TITLE_LINE: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

/** A preview: two lines and an ellipsis. A long word with no break in it is broken, never let out of its box. */
export const PREVIEW: CSSProperties = { display: "-webkit-box", WebkitLineClamp: PREVIEW_LINES, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", minWidth: 0 };

/** What never gives way in a row: the session number and app, the date, a menu button. */
export const NO_SHRINK: CSSProperties = { flex: "none" };

/** The full text for the tooltip: `<h3 {...fullText(title)}>`. Empty text sets nothing. */
export const fullText = (text: string | null | undefined): { title?: string } => (text ? { title: text } : {});

/** A title cut to `max` characters and an ellipsis, for a place that takes a string and not an element (a menu button's value). The full text goes in the tooltip. */
export const clipTo = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
