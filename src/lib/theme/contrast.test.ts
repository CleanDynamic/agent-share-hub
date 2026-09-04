// buildgallery.ai — the colour contract, measured.
//
// The buildgallery-theme skill publishes a list of measured pairings and two
// rules that fell out of them. This file recomputes every one of those pairings
// from the token values actually declared in `semantics.ts`, so a value edited
// there without remeasuring fails here rather than shipping.
//
// WCAG 2.x relative luminance and contrast, implemented locally — a dependency
// for twenty lines of arithmetic is not worth the install. Translucent tokens
// (`glass`, `glass-2`, Dusk's `evidence-fill`) are composited over their own
// theme's `--bg` before measuring, because a ratio against an rgba() string is
// not a thing that exists.
//
// TWO PAIRINGS PER THEME DO NOT REPRODUCE — see SPEC_DIVERGENCE below. The
// skill's four `text/glass` and `text2/glass` figures cannot be derived from the
// glass tokens it declares: they imply an effective alpha near .39 on
// Exhibition and .32 on Dusk, where the tokens declare .55 and .42. The most
// likely explanation is that those four were read off a rendered surface, where
// `backdrop-filter: blur(16px) saturate(1.15)` had already changed what sat
// behind the glass. Following better-colors — report the pair, do not repaint
// it — this file asserts the value the declared tokens actually produce, checks
// it clears the WCAG floor, and records the skill's figure alongside.

import { describe, expect, it } from "vitest";
import { dusk, exhibition, type TokenName } from "./semantics";

/* ── measurement ──────────────────────────────────────────────────────────── */

type Rgba = [number, number, number, number];

function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]*))?\)$/.exec(
    colour.replace(/\s/g, ""),
  );
  if (!rgb) throw new Error(`unparseable colour: ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
}

/** Source-over composite. A translucent token has no ratio until it has a ground. */
function over(fg: string, bg: string): string {
  const f = parse(fg);
  const b = parse(bg);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(f[i] * f[3] + b[i] * (1 - f[3])));
  return `rgb(${r},${g},${bl})`;
}

/** WCAG 2.x relative luminance. Throws on a translucent input: composite first. */
function luminance(colour: string): number {
  const [r, g, b, a] = parse(colour);
  if (a !== 1) throw new Error(`luminance needs an opaque colour, got ${colour}`);
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

/* ── the two rooms ────────────────────────────────────────────────────────── */

const THEMES = { exhibition, dusk } as const;
type ThemeKey = keyof typeof THEMES;

/** A token's rendered colour: itself, or itself composited over the theme's ground. */
function ground(theme: ThemeKey, token: TokenName): string {
  const value = THEMES[theme][token];
  return parse(value)[3] === 1 ? value : over(value, THEMES[theme].bg);
}

const TEXT_FLOOR = 4.5;
const UI_FLOOR = 3.0;

interface Pairing {
  theme: ThemeKey;
  label: string;
  fg: TokenName;
  bg: TokenName;
  /** The figure the buildgallery-theme skill publishes. */
  spec: number;
  /** Present only where the declared tokens do not reproduce `spec`. */
  measured?: number;
  floor: number;
}

const CONTRACT: Pairing[] = [
  // Exhibition
  { theme: "exhibition", label: "text/bg", fg: "text", bg: "bg", spec: 13.1, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "text/glass", fg: "text", bg: "glass", spec: 14.37, measured: 14.88, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "text2/bg", fg: "text2", bg: "bg", spec: 5.26, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "text2/glass", fg: "text2", bg: "glass", spec: 5.78, measured: 5.98, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "action/bg", fg: "action", bg: "bg", spec: 4.8, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "on-action/action", fg: "on-action", bg: "action", spec: 5.65, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "evidence/bg", fg: "evidence", bg: "bg", spec: 4.89, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "text/evidence-fill", fg: "text", bg: "evidence-fill", spec: 11.89, floor: TEXT_FLOOR },
  { theme: "exhibition", label: "text/lit", fg: "text", bg: "lit", spec: 7.29, floor: TEXT_FLOOR },
  // Dusk
  { theme: "dusk", label: "text/bg", fg: "text", bg: "bg", spec: 14.17, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text/glass", fg: "text", bg: "glass", spec: 12.04, measured: 11.48, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text2/bg", fg: "text2", bg: "bg", spec: 7.65, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text2/glass", fg: "text2", bg: "glass", spec: 6.5, measured: 6.19, floor: TEXT_FLOOR },
  { theme: "dusk", label: "action/bg", fg: "action", bg: "bg", spec: 6.33, floor: TEXT_FLOOR },
  { theme: "dusk", label: "on-action/action", fg: "on-action", bg: "action", spec: 6.35, floor: TEXT_FLOOR },
  { theme: "dusk", label: "evidence/bg", fg: "evidence", bg: "bg", spec: 8.19, floor: TEXT_FLOOR },
  { theme: "dusk", label: "lit/bg", fg: "lit", bg: "bg", spec: 7.47, floor: UI_FLOOR },
];

const CATEGORIES: TokenName[] = [
  "cat-instruction",
  "cat-configuration",
  "cat-data",
  "cat-artefact",
  "cat-evidence",
  "cat-narrative",
  "cat-agents",
  "cat-breakage",
  "cat-media",
];

const CATEGORY_FLOOR = { exhibition: 4.83, dusk: 5.75 } as const;

const TOLERANCE = 0.05;

/* ── the contract ─────────────────────────────────────────────────────────── */

describe("the colour contract", () => {
  it.each(CONTRACT)(
    "$theme $label is $spec:1",
    ({ theme, label, fg, bg, spec, measured, floor }) => {
      const actual = round(contrast(ground(theme, fg), ground(theme, bg)));
      expect(
        Math.abs(actual - (measured ?? spec)),
        `${theme} ${label} measured ${actual}, expected ${measured ?? spec}`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(actual, `${theme} ${label} is below its ${floor}:1 floor`).toBeGreaterThanOrEqual(floor);
    },
  );

  it.each(
    (["exhibition", "dusk"] as const).flatMap((theme) =>
      CATEGORIES.map((token) => ({ theme, token, floor: CATEGORY_FLOOR[theme] })),
    ),
  )("$theme $token clears $floor:1 on the ground", ({ theme, token, floor }) => {
    const actual = round(contrast(ground(theme, token), ground(theme, "bg")));
    expect(actual, `${theme} ${token} is ${actual}:1 on --bg`).toBeGreaterThanOrEqual(floor);
  });
});

/* ── the two rules ────────────────────────────────────────────────────────── */

describe("amber is light, never type", () => {
  it("--lit is not legal as text on Exhibition's ground", () => {
    const ratio = round(contrast(exhibition.lit, exhibition.bg));
    expect(ratio, `--lit is ${ratio}:1 on --bg; text needs ${TEXT_FLOOR}:1`).toBeLessThan(TEXT_FLOOR);
  });

  it("...nor as a border carrying state there", () => {
    expect(round(contrast(exhibition.lit, exhibition.bg))).toBeLessThan(UI_FLOOR);
  });

  it("is legal as a fill, with --on-lit on it, in both themes", () => {
    expect(round(contrast(exhibition["on-lit"], exhibition.lit))).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(round(contrast(dusk["on-lit"], dusk.lit))).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("is legal as light on Dusk's ground", () => {
    expect(round(contrast(dusk.lit, dusk.bg))).toBeGreaterThanOrEqual(UI_FLOOR);
  });
});

describe("salmon changes value across themes, not hue", () => {
  const SALMON = "#D98C6B";

  it("#D98C6B is never used on a light ground", () => {
    const ratio = round(contrast(SALMON, exhibition.bg));
    expect(ratio, `#D98C6B is ${ratio}:1 on Exhibition's ground`).toBeLessThan(TEXT_FLOOR);
    for (const [token, value] of Object.entries(exhibition)) {
      expect(value.toUpperCase(), `Exhibition --${token} is the salmon`).not.toBe(SALMON);
    }
  });

  it("Dusk's action is the salmon, Exhibition's is the burnt orange", () => {
    expect(dusk.action.toUpperCase()).toBe(SALMON);
    expect(exhibition.action.toUpperCase()).toBe("#9E4B2C");
    expect(round(contrast(exhibition.action, exhibition.bg))).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});

/* ── divergence from the published figures ────────────────────────────────── */

describe("SPEC_DIVERGENCE", () => {
  it("records the four glass pairings the declared tokens do not reproduce", () => {
    const diverged = CONTRACT.filter((p) => p.measured !== undefined).map((p) => ({
      pairing: `${p.theme} ${p.label}`,
      skill: p.spec,
      declared: round(contrast(ground(p.theme, p.fg), ground(p.theme, p.bg))),
    }));

    expect(diverged).toEqual([
      { pairing: "exhibition text/glass", skill: 14.37, declared: 14.88 },
      { pairing: "exhibition text2/glass", skill: 5.78, declared: 5.98 },
      { pairing: "dusk text/glass", skill: 12.04, declared: 11.48 },
      { pairing: "dusk text2/glass", skill: 6.5, declared: 6.19 },
    ]);
    for (const d of diverged) expect(d.declared).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("records that --lit on Exhibition measures lower than the skill's prose", () => {
    // The skill says 3.01:1; the declared tokens give 1.80:1. Both are below the
    // 4.5:1 text floor, so the rule the figure justifies is unaffected.
    expect(round(contrast(exhibition.lit, exhibition.bg))).toBe(1.8);
    expect(round(contrast("#D98C6B", exhibition.bg))).toBe(2.12); // skill says 2.05
  });
});
