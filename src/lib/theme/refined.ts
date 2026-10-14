// UI-P79 — the refined look's colour tokens.
//
// Values are exactly as written in design/prompts/UI-P79.md, in the order that
// prompt gives them: the new names and the existing ones it repoints, then the
// category colours. They are declared in `:root[data-theme="…"][data-look="refined"]`
// blocks in src/index.css; css-parity.test.ts holds the two together. Nothing
// reads a refined value directly: a component spends a token through `t`, and
// the cascade picks the look. With `data-look` absent none of this applies.
//
// ONLY THE THEME'S OWN `TOKEN_NAMES` APPEAR HERE, PLUS THE TWO ELEVATION NAMES
// the prompt repoints (`elev-raised`, `elev-overlay`), which `elevation.ts`
// owns for the current look.

/** The names UI-P79 adds to `TOKEN_NAMES`. Each has a current-look alias in semantics.ts. */
export const REFINED_NEW_NAMES = ["frame","surface","surface-border","surface-shadow","module","module-border","module-shadow","tile","tile-border","well","well-border","well-shadow","hairline-module","control","control-border","control-shadow","control-on","seg-track","seg-border","action-shadow","tag-fill","on-tag","pill","on-pill","lit-mark","nav-mark","breakage","breakage-fill","info","frozen","selected-edge","selected-fill","selected-ring","window","window-border","window-shadow","sheet-shadow","dot-grid","avatar-fill","on-avatar","logo-ink","bar-mid","paper","dim-filter"] as const;

/** [token, Dusk, Noon], without the leading `--`. */
export const REFINED_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ["frame", "#0F0F10", "#E9E9E9"],
  ["surface", "#19191B", "#F4F4F4"],
  ["surface-border", "#232326", "#DCDCDC"],
  ["surface-shadow", "inset 0 1px 0 rgba(255,255,255,.035)", "0 1px 2px rgba(0,0,0,.05)"],
  ["module", "#1E1E21", "#FAFAFA"],
  ["module-border", "#29292D", "#E1E1E1"],
  ["module-shadow", "none", "0 1px 2px rgba(0,0,0,.04)"],
  ["tile", "#232327", "#EFEFEF"],
  ["tile-border", "#2E2E33", "#E2E2E2"],
  ["well", "#141416", "#ECECEC"],
  ["well-border", "#27272B", "#D9D9D9"],
  ["well-shadow", "inset 0 1px 1px rgba(0,0,0,.35)", "inset 0 1px 2px rgba(0,0,0,.05)"],
  ["hairline", "#26262A", "#E0E0E0"],
  ["hairline-module", "#2A2A2E", "#E7E7E7"],
  ["line", "#34343A", "#CFCFCF"],
  ["text", "#EDEDEF", "#1C1C1C"],
  ["text2", "#A0A0A6", "#575757"],
  ["label", "#8E8E94", "#666666"],
  ["control", "#27272B", "#FFFFFF"],
  ["control-border", "#323237", "#D9D9D9"],
  ["control-shadow", "inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.35)", "0 1px 2px rgba(0,0,0,.07), inset 0 -1px 0 rgba(0,0,0,.03)"],
  ["control-on", "#2F2F34", "#FFFFFF"],
  ["seg-track", "#141416", "#E6E6E6"],
  ["seg-border", "#27272B", "#D9D9D9"],
  ["action", "#EDEDEF", "#1C1C1C"],
  ["on-action", "#121214", "#FFFFFF"],
  ["action-shadow", "inset 0 -1px 0 rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.45)", "inset 0 1px 0 rgba(255,255,255,.1), 0 1px 2px rgba(0,0,0,.25)"],
  ["tag-fill", "#26262A", "#E9E9E9"],
  ["on-tag", "#A0A0A6", "#575757"],
  ["pill", "#303035", "#E6E6E6"],
  ["on-pill", "#CFCFD3", "#333333"],
  ["lit", "#F5CB4C", "#E0A21A"],
  ["lit-mark", "#F5CB4C", "#F5CB4C"],
  ["lamp-glow", "0 0 6px rgba(245,203,76,.7), 0 0 14px rgba(245,203,76,.25)", "none"],
  ["nav-mark", "#F5CB4C", "#1C1C1C"],
  ["nav-lamp-glow", "0 0 8px rgba(245,203,76,.55)", "none"],
  ["lit-ink", "#E8C468", "#8F5E00"],
  ["evidence", "#86D193", "#166F31"],
  ["evidence-fill", "rgba(134,209,147,.12)", "#E1F1E5"],
  ["breakage", "#E5807F", "#C42E1C"],
  ["breakage-fill", "rgba(229,128,127,.12)", "#F9E6E3"],
  ["info", "#82A9E8", "#2563EB"],
  ["frozen", "#8FB8D0", "#3F86B5"],
  ["selected-edge", "#8E8E95", "#1C1C1C"],
  ["selected-fill", "#222226", "#FFFFFF"],
  ["selected-ring", "0 0 0 1px #8E8E95", "0 0 0 1px #1C1C1C"],
  ["scrim", "rgba(10,10,11,.72)", "rgba(28,28,28,.32)"],
  ["window", "#1E1E21", "#FAFAFA"],
  ["window-border", "#2E2E33", "#DCDCDC"],
  ["window-shadow", "inset 0 1px 0 rgba(255,255,255,.04), 0 2px 6px rgba(0,0,0,.4), 0 32px 64px -16px rgba(0,0,0,.75)", "0 2px 6px rgba(0,0,0,.08), 0 32px 64px -16px rgba(0,0,0,.3)"],
  ["sheet-shadow", "-24px 0 64px -16px rgba(0,0,0,.7)", "-24px 0 64px -16px rgba(0,0,0,.25)"],
  ["dot-grid", "rgba(255,255,255,.055)", "rgba(0,0,0,.08)"],
  ["avatar-fill", "#2C2C30", "#E2E2E2"],
  ["on-avatar", "#CFCFD3", "#333333"],
  ["logo-ink", "#EDEDEF", "#1C1C1C"],
  ["bar-base", "#3A3A3F", "#E0E0E0"],
  ["bar-mid", "#55555B", "#C4C4C4"],
  ["paper", "#0C0C0D", "#F1F1F1"],
  ["dim-filter", "brightness(.48) saturate(.5)", "contrast(.42) brightness(1.32)"],
  ["focus-ring", "#8EB4F0", "#2563EB"],
  ["cat-instruction", "#E39A78", "#C0623A"],
  ["cat-instruction-fill", "rgba(227,154,120,.12)", "rgba(192,98,58,.10)"],
  ["cat-configuration", "#C9C27A", "#857A14"],
  ["cat-configuration-fill", "rgba(201,194,122,.12)", "rgba(133,122,20,.10)"],
  ["cat-data", "#82A9E8", "#2D6BE4"],
  ["cat-data-fill", "rgba(130,169,232,.12)", "rgba(45,107,228,.10)"],
  ["cat-artefact", "#D9B36C", "#A3741A"],
  ["cat-artefact-fill", "rgba(217,179,108,.12)", "rgba(163,116,26,.10)"],
  ["cat-evidence", "#86D193", "#23804F"],
  ["cat-evidence-fill", "rgba(134,209,147,.12)", "rgba(35,128,79,.10)"],
  ["cat-narrative", "#A0A0A6", "#5F5F5B"],
  ["cat-narrative-fill", "rgba(160,160,166,.12)", "rgba(95,95,91,.10)"],
  ["cat-agents", "#A996E8", "#6B52D6"],
  ["cat-agents-fill", "rgba(169,150,232,.12)", "rgba(107,82,214,.10)"],
  ["cat-breakage", "#E5807F", "#C93E32"],
  ["cat-breakage-fill", "rgba(229,128,127,.12)", "rgba(201,62,50,.10)"],
  ["cat-media", "#E08FB4", "#BE4C84"],
  ["cat-media-fill", "rgba(224,143,180,.12)", "rgba(190,76,132,.10)"],
  ["bg", "var(--frame)", "var(--frame)"],
  ["backdrop", "var(--frame)", "var(--frame)"],
  ["ambient", "linear-gradient(transparent, transparent)", "linear-gradient(transparent, transparent)"],
  ["recess", "var(--well)", "var(--well)"],
  ["glass", "var(--module)", "var(--module)"],
  ["glass-2", "var(--control)", "var(--control)"],
  ["glass-border", "var(--module-border)", "var(--module-border)"],
  ["glass-hi", "rgba(255,255,255,.04)", "rgba(255,255,255,.6)"],
  ["glass-fill", "var(--module)", "var(--module)"],
  ["glass-rim", "transparent", "transparent"],
  ["glass-halo", "0 0 0 0 transparent", "0 0 0 0 transparent"],
  ["panel-highlight", "var(--surface-shadow)", "var(--surface-shadow)"],
  ["panel-highlight-color", "rgba(255,255,255,.035)", "transparent"],
  ["card-frame", "var(--module)", "var(--module)"],
  ["card-thread", "var(--tile)", "var(--tile)"],
  ["on-evidence", "#121214", "#FFFFFF"],
  ["on-evidence-fill", "var(--evidence)", "var(--evidence)"],
  ["on-lit", "#111112", "#111112"],
  ["porthole", "var(--paper)", "var(--paper)"],
  ["chrome-hi", "#45454C", "#FFFFFF"],
  ["chrome-lo", "#222225", "#D6D6D6"],
  ["on-text", "#121214", "#FFFFFF"],
  ["header", "transparent", "transparent"],
  ["header-border", "transparent", "transparent"],
  ["cell", "var(--tile)", "var(--tile)"],
  ["row-highlight", "var(--tile)", "var(--tile)"],
  ["solid", "var(--module)", "var(--module)"],
  ["flat", "var(--surface)", "var(--surface)"],
  ["viewer-block", "var(--well)", "var(--well)"],
  ["tab", "var(--control-on)", "var(--control-on)"],
  ["field", "var(--well)", "var(--well)"],
  ["media-tag", "rgba(15,15,16,.78)", "rgba(255,255,255,.88)"],
  ["plate", "rgba(15,15,16,.62)", "rgba(250,250,250,.84)"],
  ["dock", "var(--surface)", "var(--surface)"],
  ["dock-border", "var(--surface-border)", "var(--surface-border)"],
  ["dock-tile", "var(--control)", "var(--control)"],
  ["inverse", "var(--text)", "var(--text)"],
  ["on-inverse", "#121214", "#FFFFFF"],
  ["on-inverse-2", "#55555B", "#BDBDBD"],
  ["inverse-evidence-fill", "#DDF2E1", "#1F3A27"],
  ["on-inverse-evidence-fill", "#14301C", "#DDF2E1"],
  ["ring-glow", "0 0 0 0 transparent", "0 0 0 0 transparent"],
  ["rank-glow", "0 0 0 0 transparent", "0 0 0 0 transparent"],
  ["tagline-chip", "var(--control)", "var(--control)"],
  ["on-tagline-chip", "var(--text)", "var(--text)"],
  ["tagline-lamp", "var(--lit)", "var(--lit)"],
  ["orb-glass", "linear-gradient(var(--module), var(--module))", "linear-gradient(var(--module), var(--module))"],
  ["orb-glass-edge", "var(--module-border)", "var(--module-border)"],
  ["on-orb-glass", "var(--text)", "var(--text)"],
  ["orb-solid", "linear-gradient(var(--module), var(--module))", "linear-gradient(var(--module), var(--module))"],
  ["on-orb-solid", "var(--text)", "var(--text)"],
  ["on-orb-solid-2", "var(--text2)", "var(--text2)"],
  ["arc-1", "transparent", "transparent"],
  ["arc-2", "transparent", "transparent"],
  ["arc-3", "transparent", "transparent"],
  ["arc-haze", "transparent", "transparent"],
  ["arc-outer", "transparent", "transparent"],
  ["shadow-float", "var(--window-shadow)", "var(--window-shadow)"],
  ["shadow-card", "var(--module-shadow)", "var(--module-shadow)"],
  ["shadow-square", "0 1px 2px rgba(0,0,0,.45)", "0 1px 2px rgba(0,0,0,.08)"],
  ["shadow-dock", "inset 0 1px 0 rgba(255,255,255,.04), 0 12px 32px rgba(0,0,0,.5)", "0 12px 32px rgba(0,0,0,.12)"],
  ["shadow-sheet", "0 -16px 48px rgba(0,0,0,.5)", "0 -16px 48px rgba(0,0,0,.14)"],
  ["ring-track", "var(--hairline-module)", "var(--hairline-module)"],
  ["picture-lamp-glow", "var(--lamp-glow)", "var(--lamp-glow)"],
  ["picture-lamp-wash", "rgba(245,203,76,.10)", "rgba(245,203,76,.16)"],
  ["banner-scrim", "rgba(15,15,16,.75)", "rgba(244,244,244,.85)"],
  ["inset", "var(--tile)", "var(--tile)"],
  ["turn", "rgba(255,255,255,.03)", "rgba(0,0,0,.025)"],
  ["secret-fill", "var(--breakage-fill)", "var(--breakage-fill)"],
  ["sheet-dim", "rgba(10,10,11,.5)", "rgba(28,28,28,.25)"],
  ["signin-edge", "inset 0 0 0 1px var(--module-border)", "inset 0 0 0 1px var(--module-border)"],
  ["elev-raised", "var(--control-shadow)", "var(--control-shadow)"],
  ["elev-overlay", "var(--window-shadow)", "var(--window-shadow)"],
];

export type RefinedValues = Readonly<Record<string, string>>;

const pick = (column: 1 | 2): RefinedValues =>
  Object.fromEntries(REFINED_ROWS.map((row) => [row[0], row[column]]));

/** Every refined value in Dusk, by token name (no `--`). */
export const duskRefined: RefinedValues = pick(1);
/** Every refined value in Noon, by token name (no `--`). */
export const noonRefined: RefinedValues = pick(2);

export const REFINED_NAMES: readonly string[] = REFINED_ROWS.map((row) => row[0]);

export const refinedThemes = { noon: noonRefined, dusk: duskRefined } as const;

/**
 * A refined token's value with every `var(--other)` followed to the end, so a
 * test can measure `--glass` (→ `--module` → `#1E1E21`) rather than a reference.
 * Throws on a name the refined set does not declare and on a reference cycle.
 */
export function resolveRefined(theme: "noon" | "dusk", name: string): string {
  const values = refinedThemes[theme];
  let current = name;
  for (let hops = 0; hops < 8; hops++) {
    const value = values[current];
    if (value === undefined) throw new Error(`--${current} is not declared by the refined ${theme} look`);
    const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
    if (!ref) return value;
    current = ref[1];
  }
  throw new Error(`--${name} does not resolve: a var() cycle in the refined ${theme} look`);
}
