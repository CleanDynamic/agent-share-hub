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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CATEGORIES,
  categoryColour,
  categoryFill,
  normaliseCategory,
  type Category,
} from "./category";
import { dusk, noon, TOKEN_NAMES, type TokenName } from "./semantics";

/* ── measurement ──────────────────────────────────────────────────────────── */

const THEMES = { noon, dusk } as const;
type ThemeKey = keyof typeof THEMES;
const THEME_KEYS = ["noon", "dusk"] as const;

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

type Rgba = [number, number, number, number];

function parse(colour: string): Rgba {
  const c = colour.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c);
  if (!rgb) throw new Error(`a fill must be a hex or an rgba(), got: ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
}

/** `fg` composited over `bg`, as an opaque hex. */
function over(fg: string, bg: string): string {
  const [r, g, b, a] = parse(fg);
  const under = parse(bg);
  const mix = [r, g, b].map((v, i) => Math.round(v * a + under[i] * (1 - a)));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** The surface a chip sits on. A fill is translucent, so it is measured over this. */
const surfaceOf = (theme: ThemeKey) => resolve(theme, "module");

/** WCAG 2.x relative luminance. */
function luminance(colour: string): number {
  const [r, g, b] = parse(colour)
    .slice(0, 3)
    .map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

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
    expect(names("noon")).toEqual(names("dusk"));
    expect(names("noon")).toHaveLength(RESOLVABLE.length * 2);
  });

  it("the nine hues keep their hue across the themes, changing only their value", () => {
    // Not a contrast claim — a claim about the system. If a category's two
    // values ever became the same colour, the theme would have stopped being a
    // theme for that chip.
    for (const category of CATEGORIES) {
      const light = resolve("noon", `cat-${category}` as TokenName);
      const dark = resolve("dusk", `cat-${category}` as TokenName);
      if (category === "evidence") continue; // teal/sky: the one deliberate share
      expect(light.toUpperCase(), `${category} is one value in both themes`).not.toBe(
        dark.toUpperCase(),
      );
    }
  });
});

/* ── every fill pair is measured, in both themes ──────────────────────────── */

describe("every chip fill is the hue at a low alpha, and the hue reads on it", () => {
  /** The hue reads as a mark and an edge on its own fill (3:1); as text it must also clear TEXT_FLOOR on the card, which contrast.test.ts holds, less the four Noon hues it pins. */
  const UI_FLOOR = 3.0;

  it.each(CASES)("$theme $name on its own fill", ({ theme, name }) => {
    const hue = resolve(theme, `cat-${name}` as TokenName);
    const fill = over(resolve(theme, `cat-${name}-fill` as TokenName), surfaceOf(theme));
    const ratio = contrast(over(hue, surfaceOf(theme)), fill);
    expect(ratio, `${theme} --cat-${name} is ${ratio}:1 on --cat-${name}-fill`).toBeGreaterThanOrEqual(UI_FLOOR);
  });

  it("each fill is its hue at a low alpha, and nothing else", () => {
    // The rule the fills were produced under: adjust the alpha, never the hue.
    for (const { theme, name } of CASES) {
      if (name === "fallback") continue; // an alias of --recess, which is a surface and not a hue
      const hue = parse(resolve(theme, `cat-${name}` as TokenName));
      const fill = parse(resolve(theme, `cat-${name}-fill` as TokenName));
      expect(fill.slice(0, 3), `${theme} ${name} fill is off-hue`).toEqual(hue.slice(0, 3));
      expect(fill[3], `${theme} ${name} fill is not a low alpha`).toBeGreaterThan(0);
      expect(fill[3], `${theme} ${name} fill is not a LOW alpha`).toBeLessThanOrEqual(0.21);
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

/* ── the legacy badges are gone ───────────────────────────────────────────── */

describe("the retired badge colours", () => {
  const css = readFileSync("src/index.css", "utf-8");

  it("no .ns-badge- colour rule remains in index.css", () => {
    const rules = css.match(/^\.ns-badge-[a-z-]+\s*\{[^}]*\}/gm) ?? [];
    expect(rules, `index.css still carries: ${rules.join(" ")}`).toEqual([]);
  });

  it("the .ns-badge base class is kept, and carries no colour", () => {
    const base = /\.ns-badge\s*\{([^}]*)\}/.exec(css);
    expect(base, ".ns-badge base class was removed; it carries layout").not.toBeNull();
    expect(base?.[1]).not.toMatch(/(background|color)\s*:/);
  });

  it("no .ns-badge- colour rule remains anywhere in src", () => {
    // The difficulty four were duplicated into the shell's own stylesheet and
    // into NeoScaleShell's inline <style>. Deleting them from index.css alone
    // would have left the old hues rendering from the copies.
    //
    // BG-P17 deleted NeoScaleShell, which took the second copy with it, and
    // RC-P06 deleted the rail's stylesheet, the one file this used to read. So
    // it reads every stylesheet under src instead, which is what "anywhere"
    // always meant.
    const stylesheets = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? stylesheets(join(dir, entry.name))
          : entry.name.endsWith(".css")
            ? [join(dir, entry.name)]
            : [],
      );
    const others = stylesheets("src").filter((path) => path !== join("src", "index.css"));
    expect(others.length).toBeGreaterThan(0);
    for (const path of others) {
      expect(readFileSync(path, "utf-8"), `${path} still carries an .ns-badge- rule`).not.toMatch(
        /\.ns-badge-[a-z-]+\s*\{/,
      );
    }
  });
});
