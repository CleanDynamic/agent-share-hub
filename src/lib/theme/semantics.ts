// buildgallery.ai — semantic tokens.
//
// TIER TWO OF TWO. A semantic token names a *job*. This is the only tier a
// component ever touches, and it touches it through `tokens.ts` — never through
// these objects directly, and never through `primitives.ts`.
//
// `exhibition` and `dusk` are light and dark modes of one product, not two
// brands: same token names, same jobs, only the values differ. Every name in
// TOKEN_NAMES therefore appears in both objects, which `Record<TokenName,…>`
// enforces at compile time. Adding a token means adding it to TOKEN_NAMES, to
// both objects, and to all three `:root` blocks in `src/index.css`.
//
// Use a token only in its role. If a surface needs a colour no token names, add
// the token; never borrow one because its value happens to be right today.
//
// `porthole`, `chrome-hi` and `chrome-lo` are retained from the dropped shape
// language because media wells and hairline highlights still need them. Do not
// invent decorative uses for them.

import {
  amber,
  blue,
  clay,
  green,
  grey,
  greyAlpha,
  lavender,
  lavenderAlpha,
  magenta,
  ochre,
  red,
  rust,
  sky,
  skyAlpha,
  stone,
  teal,
  violet,
} from "./primitives";

/**
 * Every semantic token, in the order the buildgallery-theme skill lists them.
 * The single source of truth: `TokenName`, both theme objects and the accessor
 * in `tokens.ts` are all derived from this array, so none of them can drift.
 */
export const TOKEN_NAMES = [
  "bg",
  "recess",
  "text",
  "text2",
  "line",
  "glass",
  "glass-2",
  "glass-border",
  "glass-hi",
  "action",
  "on-action",
  "evidence",
  "evidence-fill",
  "lit",
  "on-lit",
  "porthole",
  "chrome-hi",
  "chrome-lo",
  "cat-instruction",
  "cat-configuration",
  "cat-data",
  "cat-artefact",
  "cat-evidence",
  "cat-narrative",
  "cat-agents",
  "cat-breakage",
  "cat-media",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type ThemeName = "exhibition" | "dusk";

/** Exhibition — light. A cool luminous grey gallery. The default theme. */
export const exhibition: Record<TokenName, string> = {
  bg: grey[50],
  recess: grey[100],
  text: grey[950],
  text2: grey[600],
  line: grey[200],

  glass: greyAlpha["0/55"],
  "glass-2": greyAlpha["0/34"],
  "glass-border": greyAlpha["0/80"],
  "glass-hi": greyAlpha["0/95"],

  action: clay[700],
  "on-action": grey[25],
  evidence: teal[600],
  "evidence-fill": teal[200],
  lit: amber[500],
  "on-lit": grey[950],

  porthole: grey[700],
  "chrome-hi": grey[0],
  "chrome-lo": grey[400],

  "cat-instruction": rust[700],
  "cat-configuration": green[700],
  "cat-data": blue[700],
  "cat-artefact": ochre[700],
  "cat-evidence": teal[700],
  "cat-narrative": stone[600],
  "cat-agents": violet[700],
  "cat-breakage": red[700],
  "cat-media": magenta[700],
};

/** Dusk — dark. Lavender stone at dusk, lit by a violet-to-salmon horizon. */
export const dusk: Record<TokenName, string> = {
  bg: lavender[900],
  recess: lavender[700],
  text: lavender[50],
  text2: lavender[200],
  line: lavender[600],

  glass: lavenderAlpha["650/42"],
  "glass-2": lavenderAlpha["650/26"],
  "glass-border": lavenderAlpha["50/14"],
  "glass-hi": lavenderAlpha["50/22"],

  action: clay[400],
  "on-action": clay[950],
  evidence: sky[400],
  "evidence-fill": skyAlpha["400/16"],
  lit: amber[500],
  "on-lit": clay[950],

  porthole: lavender[950],
  "chrome-hi": lavender[100],
  "chrome-lo": lavender[500],

  "cat-instruction": rust[400],
  "cat-configuration": green[400],
  "cat-data": blue[400],
  "cat-artefact": ochre[400],
  "cat-evidence": sky[400],
  "cat-narrative": stone[400],
  "cat-agents": violet[400],
  "cat-breakage": red[400],
  "cat-media": magenta[400],
};

export const themes: Record<ThemeName, Record<TokenName, string>> = {
  exhibition,
  dusk,
};
