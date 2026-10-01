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
// UI-P03 REPLACED THE GLASS VALUES with the design kit's, and the four
// `text/glass` / `text2/glass` figures the earlier palette could not reproduce
// now agree with the declared tokens. See SPEC_DIVERGENCE below, which now
// records that nothing diverges, and where a future divergence has to be added.

import { describe, expect, it } from "vitest";
import { dusk, noon, type TokenName } from "./semantics";

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

const THEMES = { noon, dusk } as const;
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
  // Noon
  { theme: "noon", label: "text/bg", fg: "text", bg: "bg", spec: 13.41, floor: TEXT_FLOOR },
  { theme: "noon", label: "text/glass", fg: "text", bg: "glass", spec: 15.24, floor: TEXT_FLOOR },
  { theme: "noon", label: "text2/bg", fg: "text2", bg: "bg", spec: 5.96, floor: TEXT_FLOOR },
  { theme: "noon", label: "text2/glass", fg: "text2", bg: "glass", spec: 6.78, floor: TEXT_FLOOR },
  { theme: "noon", label: "action/bg", fg: "action", bg: "bg", spec: 6.26, floor: TEXT_FLOOR },
  { theme: "noon", label: "on-action/action", fg: "on-action", bg: "action", spec: 7.07, floor: TEXT_FLOOR },
  { theme: "noon", label: "evidence/bg", fg: "evidence", bg: "bg", spec: 5.6, floor: TEXT_FLOOR },
  { theme: "noon", label: "text/evidence-fill", fg: "text", bg: "evidence-fill", spec: 11.86, floor: TEXT_FLOOR },
  { theme: "noon", label: "text/lit", fg: "text", bg: "lit", spec: 7.15, floor: TEXT_FLOOR },
  // BG-P09 — the card's two layers, measured here rather than published by the
  // skill, so `spec` IS the measurement this prompt reports.
  { theme: "noon", label: "text/card-frame", fg: "text", bg: "card-frame", spec: 14.45, floor: TEXT_FLOOR },
  // RC-P04b — the pairings docs/reconciliation/STATES.md adds, measured here in
  // the same way, so `spec` IS the measurement. A border and an icon are UI
  // marks, floored at 3.0:1; the same colours as text are floored at 4.5:1.
  { theme: "noon", label: "text/recess", fg: "text", bg: "recess", spec: 11.48, floor: TEXT_FLOOR },
  { theme: "noon", label: "text2/recess", fg: "text2", bg: "recess", spec: 5.11, floor: TEXT_FLOOR },
  { theme: "noon", label: "text border/recess", fg: "text", bg: "recess", spec: 11.48, floor: UI_FLOOR },
  { theme: "noon", label: "action icon/bg", fg: "action", bg: "bg", spec: 6.26, floor: UI_FLOOR },
  // UI-P04 — the focus ring against the ground. A ring is UI state, floored at
  // 3.0:1, and is measured here, so `spec` IS the measurement.
  { theme: "noon", label: "focus-ring/bg", fg: "focus-ring", bg: "bg", spec: 13.41, floor: UI_FLOOR },
  // UI-P03 — the pairings the kit's values were measured against, on the
  // flattened glass surface.
  { theme: "noon", label: "action/glass", fg: "action", bg: "glass", spec: 7.12, floor: TEXT_FLOOR },
  { theme: "noon", label: "evidence/glass", fg: "evidence", bg: "glass", spec: 6.37, floor: TEXT_FLOOR },
  { theme: "noon", label: "on-evidence-fill/evidence-fill", fg: "on-evidence-fill", bg: "evidence-fill", spec: 11.86, floor: TEXT_FLOOR },
  { theme: "noon", label: "label/glass", fg: "label", bg: "glass", spec: 6.78, floor: TEXT_FLOOR },
  // Dusk
  { theme: "dusk", label: "text/bg", fg: "text", bg: "bg", spec: 14.51, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text/glass", fg: "text", bg: "glass", spec: 14.26, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text2/bg", fg: "text2", bg: "bg", spec: 7.83, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text2/glass", fg: "text2", bg: "glass", spec: 7.69, floor: TEXT_FLOOR },
  { theme: "dusk", label: "action/bg", fg: "action", bg: "bg", spec: 6.48, floor: TEXT_FLOOR },
  { theme: "dusk", label: "on-action/action", fg: "on-action", bg: "action", spec: 6.35, floor: TEXT_FLOOR },
  { theme: "dusk", label: "evidence/bg", fg: "evidence", bg: "bg", spec: 8.38, floor: TEXT_FLOOR },
  { theme: "dusk", label: "lit/bg", fg: "lit", bg: "bg", spec: 7.65, floor: UI_FLOOR },
  { theme: "dusk", label: "text/card-frame", fg: "text", bg: "card-frame", spec: 11.73, floor: TEXT_FLOOR },
  // RC-P04b, as above.
  { theme: "dusk", label: "text/recess", fg: "text", bg: "recess", spec: 10.62, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text2/recess", fg: "text2", bg: "recess", spec: 5.73, floor: TEXT_FLOOR },
  { theme: "dusk", label: "text border/recess", fg: "text", bg: "recess", spec: 10.62, floor: UI_FLOOR },
  { theme: "dusk", label: "action icon/bg", fg: "action", bg: "bg", spec: 6.48, floor: UI_FLOOR },
  { theme: "dusk", label: "label/glass", fg: "label", bg: "glass", spec: 6.6, floor: TEXT_FLOOR },
  { theme: "dusk", label: "action/glass", fg: "action", bg: "glass", spec: 6.37, floor: TEXT_FLOOR },
  { theme: "dusk", label: "evidence/glass", fg: "evidence", bg: "glass", spec: 8.24, floor: TEXT_FLOOR },
  { theme: "dusk", label: "on-evidence-fill/evidence-fill", fg: "on-evidence-fill", bg: "evidence-fill", spec: 6.16, floor: TEXT_FLOOR },
  // UI-P04, as above.
  { theme: "dusk", label: "focus-ring/bg", fg: "focus-ring", bg: "bg", spec: 7.65, floor: UI_FLOOR },
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

const CATEGORY_FLOOR = { noon: 4.83, dusk: 5.75 } as const;

const TOLERANCE = 0.05;

/** UI-P03 — every category hue on the flattened glass surface. */
const CATEGORY_ON_GLASS_FLOOR = { noon: 5.72, dusk: 5.78 } as const;

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
    (["noon", "dusk"] as const).flatMap((theme) =>
      CATEGORIES.map((token) => ({ theme, token, floor: CATEGORY_FLOOR[theme] })),
    ),
  )("$theme $token clears $floor:1 on the ground", ({ theme, token, floor }) => {
    const actual = round(contrast(ground(theme, token), ground(theme, "bg")));
    expect(actual, `${theme} ${token} is ${actual}:1 on --bg`).toBeGreaterThanOrEqual(floor);
  });
});

describe("every category hue on glass", () => {
  it.each(
    (["noon", "dusk"] as const).flatMap((theme) =>
      CATEGORIES.map((token) => ({ theme, token, floor: CATEGORY_ON_GLASS_FLOOR[theme] })),
    ),
  )("$theme $token clears $floor:1 on --glass", ({ theme, token, floor }) => {
    const actual = round(contrast(ground(theme, token), ground(theme, "glass")));
    expect(actual, `${theme} ${token} is ${actual}:1 on --glass`).toBeGreaterThanOrEqual(floor);
  });
});

/* ── the card's two layers (BG-P09) ───────────────────────────────────────── */
//
// A build card stacks THREE translucencies, and body text sits on the last of
// them: the room's ground, the frame over it, and the thread box over that. No
// pairing in the published contract describes that composite, so it is measured
// here — a card whose text failed the floor because the box lightened the frame
// under it would fail invisibly, since every layer clears the floor on its own.
//
// COMPOSITED IN ORDER, not averaged. `--card-thread` is translucent over
// `--card-frame`, which is translucent over `--bg`, so the ground each layer
// gets is the one the layer beneath it produced. The `backdrop-filter` on the
// frame is NOT modelled: it blurs what is behind the card rather than tinting
// it, and on a flat page ground a blur of a flat colour is that colour. Where a
// card sits over patterned content the blur mixes in the pattern — that is the
// same unmodelled case the four glass divergences above record, and the reason
// the floors here are cleared with room to spare rather than exactly.

describe("the card's frame and thread box", () => {
  const COMPOSITE = {
    noon: { text: 15.38, text2: 6.84 },
    dusk: { text: 9.91, text2: 5.35 },
  } as const;

  /** The colour body text actually lands on: thread over frame over bg. */
  const composite = (theme: ThemeKey) =>
    over(THEMES[theme]["card-thread"], over(THEMES[theme]["card-frame"], THEMES[theme].bg));

  it.each(["noon", "dusk"] as const)(
    "%s puts --text on frame+thread above the body floor",
    (theme) => {
      const actual = round(contrast(THEMES[theme].text, composite(theme)));
      expect(actual).toBe(COMPOSITE[theme].text);
      expect(actual, `${theme} text/frame+thread is ${actual}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    },
  );

  it.each(["noon", "dusk"] as const)(
    "%s puts --text2 on frame+thread above the body floor too",
    (theme) => {
      // The control row's "Show thread · 3 more" is --text2 on this composite,
      // so it is the same measurement rather than a different surface.
      const actual = round(contrast(THEMES[theme].text2, composite(theme)));
      expect(actual).toBe(COMPOSITE[theme].text2);
      expect(actual, `${theme} text2/frame+thread is ${actual}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    },
  );

  it("lightens the frame in BOTH rooms, so the card reads as one object", () => {
    // The STEP is the structure (law-of-common-region). Its DIRECTION has to be
    // the same in both themes or the card is two different objects, which is why
    // Dusk's box is struck from the room's light rather than from the stone.
    for (const theme of ["noon", "dusk"] as const) {
      const frame = over(THEMES[theme]["card-frame"], THEMES[theme].bg);
      const step = luminance(composite(theme)) - luminance(frame);
      expect(step, `${theme}'s thread box is not lighter than its frame`).toBeGreaterThan(0);
    }
  });

  it("keeps the step visible without making the box a second card", () => {
    // Measured as the contrast between the two layers. Below about 1.05 the
    // box disappears; a big step would read as a nested card rather than as an
    // inset. Both rooms land inside that window.
    for (const theme of ["noon", "dusk"] as const) {
      const frame = over(THEMES[theme]["card-frame"], THEMES[theme].bg);
      const ratio = contrast(composite(theme), frame);
      expect(ratio, `${theme}'s step is ${round(ratio)}:1`).toBeGreaterThan(1.04);
      expect(ratio, `${theme}'s step is ${round(ratio)}:1`).toBeLessThan(1.6);
    }
  });
});

/* ── the two rules ────────────────────────────────────────────────────────── */

describe("amber is light, never type", () => {
  it("--lit is not legal as text on Noon's ground", () => {
    const ratio = round(contrast(noon.lit, noon.bg));
    expect(ratio, `--lit is ${ratio}:1 on --bg; text needs ${TEXT_FLOOR}:1`).toBeLessThan(TEXT_FLOOR);
  });

  it("...nor as a border carrying state there", () => {
    expect(round(contrast(noon.lit, noon.bg))).toBeLessThan(UI_FLOOR);
  });

  it("is legal as a fill, with --on-lit on it, in both themes", () => {
    expect(round(contrast(noon["on-lit"], noon.lit))).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(round(contrast(dusk["on-lit"], dusk.lit))).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("is legal as light on Dusk's ground", () => {
    expect(round(contrast(dusk.lit, dusk.bg))).toBeGreaterThanOrEqual(UI_FLOOR);
  });
});

describe("salmon changes value across themes, not hue", () => {
  const SALMON = "#D98C6B";

  it("#D98C6B is never used on a light ground", () => {
    const ratio = round(contrast(SALMON, noon.bg));
    expect(ratio, `#D98C6B is ${ratio}:1 on Noon's ground`).toBeLessThan(TEXT_FLOOR);
    for (const [token, value] of Object.entries(noon)) {
      expect(value.toUpperCase(), `Noon --${token} is the salmon`).not.toBe(SALMON);
    }
  });

  it("Dusk's action is the salmon, Noon's is the burnt orange", () => {
    expect(dusk.action.toUpperCase()).toBe(SALMON);
    expect(noon.action.toUpperCase()).toBe("#8C3B36");
    expect(round(contrast(noon.action, noon.bg))).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});

/* ── divergence from the published figures ────────────────────────────────── */

describe("SPEC_DIVERGENCE", () => {
  it("records no glass pairing the declared tokens fail to reproduce", () => {
    // UI-P03 struck the glass values from the design kit, and the figures
    // above are the kit's own, measured on the flattened glass surface. The
    // four divergences the earlier palette recorded here are gone: nothing in
    // CONTRACT carries a `measured` override any more. A new one has to be
    // added to this list, with the reason, rather than slipped into CONTRACT.
    const diverged = CONTRACT.filter((p) => p.measured !== undefined).map((p) => ({
      pairing: `${p.theme} ${p.label}`,
      skill: p.spec,
      declared: round(contrast(ground(p.theme, p.fg), ground(p.theme, p.bg))),
    }));

    expect(diverged).toEqual([]);
  });

  it("records that --lit on Noon measures lower than the skill's prose", () => {
    // The skill says 3.01:1; the declared tokens give 1.87:1. Both are below the
    // 4.5:1 text floor, so the rule the figure justifies is unaffected.
    expect(round(contrast(noon.lit, noon.bg))).toBe(1.87);
    expect(round(contrast("#D98C6B", noon.bg))).toBe(2.21); // skill says 2.05
  });
});

/* ── the password strength meter's three colours (BG-P27) ─────────────────── */
//
// `--cat-breakage` / `--cat-artefact` / `--evidence` LOOK like a traffic light
// and are not one: they are three of the nine part-category hues doing a second,
// legitimate job. That is what makes them measurable, and this is the
// measurement — the ramp they replaced was `#ef4444 / #f59e0b / #2EC4B6`, picked
// by eye, of which the amber measures 2.28:1 on Noon's ground.
//
// ON THE CARD, NOT ON THE PAGE. The meter sits inside an auth card, which is
// `--glass` over `--bg`, so the ground under it is the composite rather than the
// room. The category floors above already hold each hue against `--bg`; these
// hold the three against the surface they are actually painted on, in both
// rooms, because a hue that clears the floor on the page and fails on the card
// fails where a reader is looking. Noon's card LIGHTENS the ground and
// Dusk's DARKENS it, so neither room's figure can be inferred from the other.
//
// The `backdrop-filter` is not modelled, for the reason the glass divergences
// above record: it blurs what is behind the card rather than tinting it, and
// behind an auth card is one flat token plus AuthShell's ≤10% wash.
describe("the password strength meter", () => {
  const METER: TokenName[] = ["cat-breakage", "cat-artefact", "evidence"];

  const CARD = {
    noon: { "cat-breakage": 6.13, "cat-artefact": 6.68, evidence: 6.37 },
    dusk: { "cat-breakage": 5.78, "cat-artefact": 9.5, evidence: 8.24 },
  } as const;

  /** The auth card's ground: `--glass` composited over the room. */
  const card = (theme: ThemeKey) => over(THEMES[theme].glass, THEMES[theme].bg);

  it.each(
    (["noon", "dusk"] as const).flatMap((theme) =>
      METER.map((token) => ({ theme, token })),
    ),
  )("$theme reads $token as a label on the auth card", ({ theme, token }) => {
    const actual = round(contrast(THEMES[theme][token], card(theme)));
    expect(actual).toBe(CARD[theme][token as keyof (typeof CARD)[ThemeKey]]);
    expect(
      actual,
      `${theme} ${token} is ${actual}:1 on the auth card, under the text floor`,
    ).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it.each(
    (["noon", "dusk"] as const).flatMap((theme) =>
      METER.map((token) => ({ theme, token })),
    ),
  )("$theme separates a filled $token segment from the track", ({ theme, token }) => {
    // The FILLED-against-UNFILLED step is what carries the reading, so it is
    // floored at 3.0:1 as UI state. The track itself is `--recess` and is
    // deliberately quiet against the card — it is the bar's extent, not its
    // value.
    const actual = round(contrast(THEMES[theme][token], THEMES[theme].recess));
    expect(
      actual,
      `${theme} ${token} is ${actual}:1 against the --recess track`,
    ).toBeGreaterThanOrEqual(UI_FLOOR);
  });
});
