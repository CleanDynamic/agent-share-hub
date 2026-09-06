// buildgallery.ai — the category resolver, and the chip fills it hands out.
//
// `contrast.test.ts` proves the nine hues clear their floor on `--bg`. This file
// proves the other half: that every one of them also clears 4.5:1 on the fill a
// chip puts it on, in both themes, and that the resolver in `category.ts` hands
// out those pairs and nothing else.
//
// The arithmetic is recomputed here from the values `semantics.ts` declares
// rather than trusted from the measuring run that produced them, so a fill
// edited by hand — or a hue moved under a fill that was measured against the old
// one — fails here instead of shipping a chip nobody can read.

import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  categoryColour,
  categoryFill,
  normaliseCategory,
  type Category,
} from "./category";
import { dusk, exhibition, TOKEN_NAMES, type TokenName } from "./semantics";

/* ── measurement ──────────────────────────────────────────────────────────── */

const THEMES = { exhibition, dusk } as const;
type ThemeKey = keyof typeof THEMES;
const THEME_KEYS = ["exhibition", "dusk"] as const;

/** `"var(--text2)"` -> `"text2"`. Null for anything that is not a bare `var()`. */
function varName(value: string): TokenName | null {
  const match = /^var\(--([a-z0-9-]+)\)$/.exec(value.trim());
  if (!match) return null;
  const name = match[1] as TokenName;
  return (TOKEN_NAMES as readonly string[]).includes(name) ? name : null;
}

/**
 * A token's value in a theme, following `var()` aliases to the colour at the end.
 *
 * `--cat-fallback` is declared as `var(--text2)` and `--cat-fallback-fill` as
 * `var(--recess)`, so a measurement that stopped at the first hop would have
 * nothing to measure. The hop limit is what turns a cycle into a failed test
 * rather than a hung one.
 */
function resolve(theme: ThemeKey, token: TokenName): string {
  let value = THEMES[theme][token];
  for (let hop = 0; hop < 8; hop += 1) {
    const next = varName(value);
    if (!next) return value;
    value = THEMES[theme][next];
  }
  throw new Error(`--${token} does not resolve to a colour on ${theme}`);
}

type Rgb = [number, number, number];

function parse(colour: string): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (!hex) throw new Error(`a fill must be an opaque hex, got: ${colour}`);
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x relative luminance. */
function luminance(colour: string): number {
  const [r, g, b] = parse(colour).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const TEXT_FLOOR = 4.5;

/** The nine, plus the tenth entry that is not a hue. */
const RESOLVABLE = [...CATEGORIES, "fallback"] as const;

const CASES = THEME_KEYS.flatMap((theme) =>
  RESOLVABLE.map((name) => ({ theme, name })),
);

/* ── every category resolves, in both themes ──────────────────────────────── */

describe("every category resolves in both themes", () => {
  it.each(CATEGORIES)("categoryColour(%s) is that category's token", (category) => {
    expect(categoryColour(category)).toBe(`var(--cat-${category})`);
  });

  it.each(CASES)("$theme --cat-$name is a colour", ({ theme, name }) => {
    expect(() => parse(resolve(theme, `cat-${name}` as TokenName))).not.toThrow();
  });

  it.each(CASES)("$theme --cat-$name-fill is a colour", ({ theme, name }) => {
    expect(() => parse(resolve(theme, `cat-${name}-fill` as TokenName))).not.toThrow();
  });

  it("the two themes name the same ten categories", () => {
    const names = (theme: ThemeKey) =>
      TOKEN_NAMES.filter((n) => n.startsWith("cat-") && theme in THEMES).sort();
    expect(names("exhibition")).toEqual(names("dusk"));
    expect(names("exhibition")).toHaveLength(RESOLVABLE.length * 2);
  });

  it("the nine hues keep their hue across the themes, changing only their value", () => {
    // Not a contrast claim — a claim about the system. If a category's two
    // values ever became the same colour, the theme would have stopped being a
    // theme for that chip.
    for (const category of CATEGORIES) {
      const light = resolve("exhibition", `cat-${category}` as TokenName);
      const dark = resolve("dusk", `cat-${category}` as TokenName);
      if (category === "evidence") continue; // teal/sky: the one deliberate share
      expect(light.toUpperCase(), `${category} is one value in both themes`).not.toBe(
        dark.toUpperCase(),
      );
    }
  });
});

/* ── every fill pair is measured, in both themes ──────────────────────────── */

describe("every chip fill clears 4.5:1, measured", () => {
  it.each(CASES)("$theme $name on its own fill", ({ theme, name }) => {
    const hue = resolve(theme, `cat-${name}` as TokenName);
    const fill = resolve(theme, `cat-${name}-fill` as TokenName);
    const ratio = contrast(hue, fill);
    expect(
      ratio,
      `${theme} --cat-${name} is ${ratio}:1 on --cat-${name}-fill`,
    ).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("records the measured pairs, so a moved value has to be re-recorded here", () => {
    const table = CASES.map(({ theme, name }) => ({
      pair: `${theme} ${name}`,
      hue: resolve(theme, `cat-${name}` as TokenName).toUpperCase(),
      fill: resolve(theme, `cat-${name}-fill` as TokenName).toUpperCase(),
      ratio: contrast(
        resolve(theme, `cat-${name}` as TokenName),
        resolve(theme, `cat-${name}-fill` as TokenName),
      ),
    }));

    expect(table).toEqual([
      { pair: "exhibition instruction", hue: "#9C3E12", fill: "#DBD2CE", ratio: 4.54 },
      { pair: "exhibition configuration", hue: "#0F6B31", fill: "#CDD8D4", ratio: 4.54 },
      { pair: "exhibition data", hue: "#1D4ED8", fill: "#CCD4E6", ratio: 4.51 },
      { pair: "exhibition artefact", hue: "#8F4309", fill: "#D7CEC7", ratio: 4.55 },
      { pair: "exhibition evidence", hue: "#0E635C", fill: "#C2D1D2", ratio: 4.51 },
      { pair: "exhibition narrative", hue: "#565B63", fill: "#D0D3D5", ratio: 4.54 },
      { pair: "exhibition agents", hue: "#6D28D9", fill: "#D2CAE6", ratio: 4.51 },
      { pair: "exhibition breakage", hue: "#B91C1C", fill: "#E1D6D8", ratio: 4.56 },
      { pair: "exhibition media", hue: "#BE185D", fill: "#E2DEE2", ratio: 4.54 },
      { pair: "exhibition fallback", hue: "#565E66", fill: "#D3D7DB", ratio: 4.55 },
      { pair: "dusk instruction", hue: "#F0865A", fill: "#493034", ratio: 4.71 },
      { pair: "dusk configuration", hue: "#5CCB7C", fill: "#2B3E3B", ratio: 5.55 },
      { pair: "dusk data", hue: "#6AA1FF", fill: "#2E3655", ratio: 4.59 },
      { pair: "dusk artefact", hue: "#F5B83D", fill: "#4A3A2F", ratio: 6.09 },
      { pair: "dusk evidence", hue: "#86BDD3", fill: "#343B4D", ratio: 5.45 },
      { pair: "dusk narrative", hue: "#A8A6A3", fill: "#3A3743", ratio: 4.78 },
      { pair: "dusk agents", hue: "#A78BFA", fill: "#372F50", ratio: 4.58 },
      { pair: "dusk breakage", hue: "#F26D6D", fill: "#412836", ratio: 4.54 },
      { pair: "dusk media", hue: "#F472B6", fill: "#4A2C47", ratio: 4.55 },
      { pair: "dusk fallback", hue: "#B3ABC6", fill: "#372F4A", ratio: 5.73 },
    ]);
  });

  it("each fill is its hue at a low alpha over the ground, and nothing else", () => {
    // The rule the fills were produced under: adjust the alpha, never the hue.
    // Recovering an alpha in [0.01, 0.20] from the composite is what proves the
    // hue did not move to make the pairing legal.
    for (const { theme, name } of CASES) {
      const hue = parse(resolve(theme, `cat-${name}` as TokenName));
      const bg = parse(resolve(theme, "bg"));
      const fill = parse(resolve(theme, `cat-${name}-fill` as TokenName));

      const alphas = [0, 1, 2].map((i) =>
        hue[i] === bg[i] ? null : (fill[i] - bg[i]) / (hue[i] - bg[i]),
      );
      const found = alphas.filter((a): a is number => a !== null);
      const mean = found.reduce((sum, a) => sum + a, 0) / found.length;

      expect(mean, `${theme} ${name} fill is not a low alpha of its hue`).toBeGreaterThan(0);
      expect(mean, `${theme} ${name} fill is not a LOW alpha of its hue`).toBeLessThanOrEqual(0.21);
      for (const a of found) {
        // Rounding to 8-bit channels moves each channel's implied alpha a
        // little; a channel that has drifted further than that is a hue that
        // was nudged, which is the thing this test exists to catch.
        expect(Math.abs(a - mean), `${theme} ${name} fill is off-hue`).toBeLessThan(0.05);
      }
    }
  });
});

/* ── the fallback ─────────────────────────────────────────────────────────── */

describe("a category the registry does not know", () => {
  const UNKNOWN = [
    "",
    "   ",
    "sculpture",
    "Prompt File",
    "cat-instruction",
    "instruction ",
    "1",
    "__proto__",
    "constructor",
    "toString",
  ];

  it.each(UNKNOWN)("categoryColour(%j) is the fallback and does not throw", (value) => {
    expect(() => categoryColour(value)).not.toThrow();
    // "instruction " trims into the nine; everything else here does not.
    const expected = value.trim() === "instruction" ? "var(--cat-instruction)" : "var(--cat-fallback)";
    expect(categoryColour(value)).toBe(expected);
  });

  it.each(UNKNOWN)("categoryFill(%j) is a legal pair and does not throw", (value) => {
    expect(() => categoryFill(value)).not.toThrow();
    const fill = categoryFill(value);
    expect(varName(fill.background)).not.toBeNull();
    expect(varName(fill.color)).not.toBeNull();
  });

  it("the fallback is --text2, not a tenth hue", () => {
    expect(categoryColour("sculpture")).toBe("var(--cat-fallback)");
    for (const theme of THEME_KEYS) {
      expect(THEMES[theme]["cat-fallback"]).toBe("var(--text2)");
      expect(resolve(theme, "cat-fallback")).toBe(THEMES[theme].text2);
    }
  });

  it("null and undefined widened to a string are the fallback, not a crash", () => {
    const loose = categoryColour as (value: unknown) => string;
    expect(loose(null)).toBe("var(--cat-fallback)");
    expect(loose(undefined)).toBe("var(--cat-fallback)");
  });
});

/* ── the synonyms ─────────────────────────────────────────────────────────── */

describe("the spellings that are one of the nine under another name", () => {
  it.each([
    ["agent", "agents"],
    ["agents", "agents"],
    ["gap", "breakage"],
    ["breakage", "breakage"],
    ["Instruction", "instruction"],
    ["  DATA  ", "data"],
  ])("%j resolves to %j", (input, expected) => {
    expect(normaliseCategory(input)).toBe(expected as Category);
    expect(categoryColour(input)).toBe(`var(--cat-${expected})`);
    expect(categoryFill(input)).toEqual({
      background: `var(--cat-${expected}-fill)`,
      color: `var(--cat-${expected})`,
    });
  });

  it("a gap is the breakage hue, and keeps it", () => {
    // The skill: a gap keeps its own category chip, and a chip is never
    // recoloured red because the part is unsolved. The red belongs to the
    // dashed edge, which resolves the same way.
    expect(categoryColour("gap")).toBe(categoryColour("breakage"));
  });
});
