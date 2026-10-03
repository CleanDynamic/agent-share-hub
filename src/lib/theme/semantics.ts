// buildgallery.ai — semantic tokens.
//
// NOON WAS CALLED EXHIBITION BEFORE UI-P02. Same theme, same values; only the
// name changed. A preference stored under the old name is migrated to "noon" by
// the boot script in index.html and by ThemeContext.
//
// TIER TWO OF TWO. A semantic token names a *job*. This is the only tier a
// component ever touches, and it touches it through `tokens.ts` — never through
// these objects directly, and never through `primitives.ts`.
//
// `noon` and `dusk` are light and dark modes of one product, not two
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
//
// THE CARD IS ONE SURFACE (UI-P14). `card-frame` and `card-thread` were the two
// layers of a build card — the frame the record, the thread box inset in it the
// post, the whole structure carried by the tonal STEP between them — and the
// build card no longer has either layer. It is a single `--glass` surface (a
// `--glass-border` hairline, `--r-card`, `--shadow-card`) with the cover, the
// title and the plaque directly on it, and it never blurs: the page's blurred
// surfaces are the header, the Build page's title plate and, on phones, the dock.
//
// BOTH TOKENS ARE KEPT, for one reason each and until UI-P41 removes them:
// `card-thread` is still the ground of CardThread, the feed's unfolding post,
// which draws inside the one card; `card-frame` is spent by nothing the card
// draws any more and stays only so a stale reader of the pair does not break.
// Neither is a general-purpose surface and neither is `--glass` by another name:
// do not reach for them for a new component.
//
// THE CATEGORY BLOCK (BG-P05). Nine hues, a tenth fallback, and a chip fill for
// each of the ten. `cat-*-fill` is the measured background a chip may put its
// own hue on — see the note in `primitives.ts` for how the ten were measured,
// and `category.ts` for the resolver that is the only sanctioned way to spend
// them. Two of the twenty are written as `var()` rather than as a value:
//
//   cat-fallback       →  var(--text2)    a category the registry does not know
//   cat-fallback-fill  →  var(--recess)   and the ground that pairs with it
//
// An alias, not a copy, so the fallback cannot drift from the secondary text it
// is meant to be. `--recess` is reused rather than a twenty-first value struck,
// because text2-on-recess already measures 5.11:1 on Noon and 5.73:1 on
// Dusk — the skill's order is reuse a legal pairing first, and this is one.

// `--recess` IS A SURFACE AND NEVER INK (BG-P30). It is the token for inset
// surfaces, screens and wells, and it is one step from `--bg` by design — which
// makes it 1.16:1 on the Noon ground and 1.33:1 on Dusk's if anything
// paints text with it. The audit sweep found it doing exactly that on the shell
// tabs, and a scan for the cause found fourteen more: every one an INACTIVE
// state — an unselected tab, an unchosen sort, a section that is not the
// current one — reaching for "quieter than the text" and landing on a surface.
//
// The token that names quiet ink is `--text2`, and text2/bg is a published
// contract pairing at 5.96:1 and 7.83:1. If a state needs to be quieter than
// that, it is quieter than legible, and the answer is weight or size, not a
// paler colour.

import {
  amber,
  aubergine,
  birch,
  blush,
  blue,
  brick,
  clay,
  duskKit,
  green,
  grey,
  greyAlpha,
  lavender,
  lavenderAlpha,
  magenta,
  noonKit,
  ochre,
  pine,
  red,
  rust,
  sage,
  salmon,
  sky,
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
  "card-frame",
  "card-thread",
  "action",
  "on-action",
  "evidence",
  "evidence-fill",
  "lit",
  "on-lit",
  "focus-ring",
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
  "cat-fallback",
  "cat-instruction-fill",
  "cat-configuration-fill",
  "cat-data-fill",
  "cat-artefact-fill",
  "cat-evidence-fill",
  "cat-narrative-fill",
  "cat-agents-fill",
  "cat-breakage-fill",
  "cat-media-fill",
  "cat-fallback-fill",
  /* UI-P03 — the design kit. */
  "backdrop",
  "ambient",
  "label",
  "on-text",
  "hairline",
  "header",
  "header-border",
  "cell",
  "row-highlight",
  "solid",
  "flat",
  "viewer-block",
  "tab",
  "field",
  "media-tag",
  "plate",
  "scrim",
  "dock",
  "dock-border",
  "dock-tile",
  "on-evidence-fill",
  "inverse-evidence-fill",
  "on-inverse-evidence-fill",
  "lit-ink",
  "ring-glow",
  "bar-base",
  "tagline-chip",
  "on-tagline-chip",
  "tagline-lamp",
  "inverse",
  "on-inverse",
  "on-inverse-2",
  "orb-glass",
  "orb-glass-edge",
  "on-orb-glass",
  "orb-solid",
  "on-orb-solid",
  "on-orb-solid-2",
  "arc-1",
  "arc-2",
  "arc-3",
  "arc-haze",
  "arc-outer",
  "shadow-float",
  "panel-highlight",
  "glass-fill",
  "glass-rim",
  "panel-highlight-color",
  "glass-halo",
  "ring-track",
  "lamp-glow",
  "picture-lamp-glow",
  "picture-lamp-wash",
  "shadow-card",
  "nav-lamp-glow",
  "rank-glow",
  "banner-scrim",
  "inset",
  "turn",
  "on-evidence",
  "secret-fill",
  "sheet-dim",
  "shadow-square",
  "shadow-dock",
  "shadow-sheet",
  "signin-edge",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];
export type ThemeName = "noon" | "dusk";

/** Noon — light. A cool luminous grey gallery. The default theme. */
export const noon: Record<TokenName, string> = {
  bg: birch[50],
  recess: birch[100],
  text: birch[950],
  text2: birch[600],
  line: noonKit["line"],

  glass: noonKit["glass"],
  "glass-2": noonKit["glass-2"],
  "glass-border": noonKit["glass-border"],
  "glass-hi": greyAlpha["0/95"],

  "card-frame": greyAlpha["0/42"],
  "card-thread": greyAlpha["0/55"],

  action: brick[700],
  "on-action": birch[25],
  evidence: pine[600],
  "evidence-fill": pine[200],
  lit: amber[500],
  "on-lit": birch[950],
  /* UI-P04. The ink, not the lamp: --lit is 1.80:1 on this ground, under the
     3.0:1 floor for UI state, and this is 13.41:1. */
  "focus-ring": birch[950],

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
  "cat-fallback": "var(--text2)",

  "cat-instruction-fill": rust[50],
  "cat-configuration-fill": green[50],
  "cat-data-fill": blue[50],
  "cat-artefact-fill": ochre[50],
  "cat-evidence-fill": teal[300],
  "cat-narrative-fill": stone[50],
  "cat-agents-fill": violet[50],
  "cat-breakage-fill": red[50],
  "cat-media-fill": magenta[50],
  "cat-fallback-fill": "var(--recess)",

  /* UI-P03 — the design kit's tokens, from design/tokens/tokens.css. */
  backdrop: noonKit["backdrop"],
  ambient: noonKit["ambient"],
  label: birch[600],
  "on-text": birch[25],
  hairline: noonKit["hairline"],
  header: noonKit["header"],
  "header-border": noonKit["header-border"],
  cell: noonKit["cell"],
  "row-highlight": noonKit["row-highlight"],
  solid: birch[25],
  flat: birch[40],
  "viewer-block": birch[50],
  tab: noonKit["tab"],
  field: noonKit["field"],
  "media-tag": noonKit["media-tag"],
  plate: noonKit["plate"],
  scrim: noonKit["scrim"],
  dock: noonKit["dock"],
  "dock-border": noonKit["dock-border"],
  "dock-tile": noonKit["dock-tile"],
  "on-evidence-fill": birch[950],
  "inverse-evidence-fill": pine[200],
  "on-inverse-evidence-fill": birch[950],
  "lit-ink": ochre[700],
  "ring-glow": noonKit["ring-glow"],
  "bar-base": birch[140],
  "tagline-chip": birch[950],
  "on-tagline-chip": birch[25],
  "tagline-lamp": amber[500],
  inverse: birch[950],
  "on-inverse": birch[25],
  "on-inverse-2": birch[130],
  "orb-glass": noonKit["orb-glass"],
  "orb-glass-edge": noonKit["orb-glass-edge"],
  "on-orb-glass": birch[950],
  "orb-solid": noonKit["orb-solid"],
  "on-orb-solid": birch[25],
  "on-orb-solid-2": birch[130],
  "arc-1": sage[400],
  "arc-2": salmon[300],
  "arc-3": brick[700],
  "arc-haze": blush[100],
  "arc-outer": sage[400],
  "shadow-float": noonKit["shadow-float"],
  "panel-highlight": noonKit["panel-highlight"],
  "glass-fill": noonKit["glass-fill"],
  "glass-rim": noonKit["glass-rim"],
  "panel-highlight-color": noonKit["panel-highlight-color"],
  "glass-halo": noonKit["glass-halo"],
  "ring-track": noonKit["ring-track"],
  "lamp-glow": noonKit["lamp-glow"],
  "picture-lamp-glow": noonKit["picture-lamp-glow"],
  "picture-lamp-wash": noonKit["picture-lamp-wash"],
  "shadow-card": noonKit["shadow-card"],
  "nav-lamp-glow": noonKit["nav-lamp-glow"],
  "rank-glow": noonKit["rank-glow"],
  "banner-scrim": noonKit["banner-scrim"],
  inset: noonKit["inset"],
  turn: grey[0],
  "on-evidence": grey[0],
  "secret-fill": noonKit["secret-fill"],
  "sheet-dim": noonKit["sheet-dim"],
  "shadow-square": noonKit["shadow-square"],
  "shadow-dock": noonKit["shadow-dock"],
  "shadow-sheet": noonKit["shadow-sheet"],
  "signin-edge": noonKit["signin-edge"],
};

/** Dusk — dark. Lavender stone at dusk, lit by a violet-to-salmon horizon. */
export const dusk: Record<TokenName, string> = {
  bg: aubergine[900],
  recess: lavender[700],
  text: lavender[50],
  text2: lavender[200],
  line: duskKit["line"],

  glass: duskKit["glass"],
  "glass-2": duskKit["glass-2"],
  "glass-border": duskKit["glass-border"],
  "glass-hi": lavenderAlpha["50/22"],

  "card-frame": lavenderAlpha["650/42"],
  "card-thread": lavenderAlpha["50/06"],

  action: clay[400],
  "on-action": clay[950],
  evidence: sky[400],
  "evidence-fill": duskKit["evidence-fill"],
  lit: amber[500],
  "on-lit": clay[950],
  /* UI-P04. The lamp gold, which is 7.65:1 on this ground. */
  "focus-ring": amber[500],

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
  "cat-fallback": "var(--text2)",

  "cat-instruction-fill": rust[900],
  "cat-configuration-fill": green[900],
  "cat-data-fill": blue[900],
  "cat-artefact-fill": ochre[900],
  "cat-evidence-fill": sky[900],
  "cat-narrative-fill": stone[900],
  "cat-agents-fill": violet[900],
  "cat-breakage-fill": red[900],
  "cat-media-fill": magenta[900],
  "cat-fallback-fill": "var(--recess)",

  /* UI-P03 — the design kit's tokens, from design/tokens/tokens.css. */
  backdrop: duskKit["backdrop"],
  ambient: duskKit["ambient"],
  label: aubergine[300],
  "on-text": aubergine[960],
  hairline: duskKit["hairline"],
  header: duskKit["header"],
  "header-border": duskKit["header-border"],
  cell: duskKit["cell"],
  "row-highlight": duskKit["row-highlight"],
  solid: aubergine[950],
  flat: aubergine[940],
  "viewer-block": aubergine[975],
  tab: duskKit["tab"],
  field: duskKit["field"],
  "media-tag": duskKit["media-tag"],
  plate: duskKit["plate"],
  scrim: duskKit["scrim"],
  dock: duskKit["dock"],
  "dock-border": duskKit["dock-border"],
  "dock-tile": duskKit["dock-tile"],
  "on-evidence-fill": sky[400],
  "inverse-evidence-fill": pine[200],
  "on-inverse-evidence-fill": birch[950],
  "lit-ink": amber[500],
  "ring-glow": duskKit["ring-glow"],
  "bar-base": aubergine[700],
  "tagline-chip": lavender[50],
  "on-tagline-chip": lavender[900],
  "tagline-lamp": clay[700],
  inverse: grey[25],
  "on-inverse": grey[950],
  "on-inverse-2": grey[600],
  "orb-glass": duskKit["orb-glass"],
  "orb-glass-edge": duskKit["orb-glass-edge"],
  "on-orb-glass": lavender[50],
  "orb-solid": duskKit["orb-solid"],
  "on-orb-solid": grey[950],
  "on-orb-solid-2": grey[600],
  "arc-1": grey[0],
  "arc-2": lavender[100],
  "arc-3": clay[400],
  "arc-haze": aubergine[400],
  "arc-outer": lavender[100],
  "shadow-float": duskKit["shadow-float"],
  "panel-highlight": duskKit["panel-highlight"],
  "glass-fill": duskKit["glass-fill"],
  "glass-rim": duskKit["glass-rim"],
  "panel-highlight-color": duskKit["panel-highlight-color"],
  "glass-halo": duskKit["glass-halo"],
  "ring-track": duskKit["ring-track"],
  "lamp-glow": duskKit["lamp-glow"],
  "picture-lamp-glow": duskKit["picture-lamp-glow"],
  "picture-lamp-wash": duskKit["picture-lamp-wash"],
  "shadow-card": duskKit["shadow-card"],
  "nav-lamp-glow": duskKit["nav-lamp-glow"],
  "rank-glow": duskKit["rank-glow"],
  "banner-scrim": duskKit["banner-scrim"],
  inset: duskKit["inset"],
  turn: duskKit["turn"],
  "on-evidence": aubergine[960],
  "secret-fill": duskKit["secret-fill"],
  "sheet-dim": duskKit["sheet-dim"],
  "shadow-square": duskKit["shadow-square"],
  "shadow-dock": duskKit["shadow-dock"],
  "shadow-sheet": duskKit["shadow-sheet"],
  "signin-edge": duskKit["signin-edge"],
};

export const themes: Record<ThemeName, Record<TokenName, string>> = {
  noon,
  dusk,
};
