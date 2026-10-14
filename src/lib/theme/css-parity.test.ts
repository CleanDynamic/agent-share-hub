// The two theme blocks in src/index.css, held to the modules that describe
// them. Every custom property a component can read off the root element is
// declared in both blocks, and this asserts that the blocks say what the
// TypeScript says — a value edited in one place and not the other is the whole
// failure mode of mirroring a token set into a stylesheet.
//
// Five groups now share those blocks: the colour tokens (BG-P01), the radius
// scale (BG-P04), the elevation shadows (BG-P04), the shadcn bridge (BG-P28)
// and the motion vocabulary (BG-P32). Radius and motion are theme-independent
// and therefore identical in both; the other three are not.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TOKEN_NAMES, noon, dusk } from "./semantics";
import { RADIUS, RADIUS_NAMES, REFINED_RADIUS, REFINED_RADIUS_NAMES } from "./radius";
import { ELEVATION_TOKENS, duskElevation, noonElevation } from "./elevation";
import { SHADCN_NAMES, duskShadcn, noonShadcn, duskRefinedShadcn, noonRefinedShadcn } from "./shadcn";
import { REFINED_NAMES, REFINED_NEW_NAMES, duskRefined, noonRefined } from "./refined";
import { MOTION_NAMES, MOTION_TOKENS } from "./motion";

const css = readFileSync("src/index.css", "utf-8");
const block = (sel: string) => {
  const i = css.indexOf(sel);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
};
const parse = (sel: string) => {
  const out: Record<string, string> = {};
  for (const line of block(sel).split("\n")) {
    const m = /^\s*--([a-z0-9-]+):\s*(.+);\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
};

/** Every custom property a theme block is expected to declare. */
const DECLARED = [
  ...TOKEN_NAMES,
  ...RADIUS_NAMES,
  ...ELEVATION_TOKENS,
  ...SHADCN_NAMES,
  ...MOTION_NAMES,
].sort();

describe("index.css mirrors semantics.ts", () => {
  it("noon (bare :root and [data-theme=noon])", () => {
    const got = parse(':root,\n:root[data-theme="noon"]');
    expect(Object.keys(got).sort()).toEqual(DECLARED);
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, noon[n]]);
    for (const n of MOTION_NAMES) expect([n, got[n]]).toEqual([n, MOTION_TOKENS[n]]);
  });
  it("dusk", () => {
    const got = parse(':root[data-theme="dusk"]');
    expect(Object.keys(got).sort()).toEqual(DECLARED);
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, dusk[n]]);
    for (const n of MOTION_NAMES) expect([n, got[n]]).toEqual([n, MOTION_TOKENS[n]]);
  });
});

describe("index.css mirrors shadcn.ts", () => {
  /* The bridge exists so that a class name means the same thing an inline
     token does. If a name here drifts from the module, every utility spending
     it drifts with it and nothing else in the suite would notice. */
  it("noon declares the whole bridge", () => {
    const got = parse(':root,\n:root[data-theme="noon"]');
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, noonShadcn[n]]);
  });

  it("dusk declares the whole bridge", () => {
    const got = parse(':root[data-theme="dusk"]');
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, duskShadcn[n]]);
  });

  /* BG-P29. The bridge has a THIRD declaration: the layered original inside
     `@layer base`, which BG-P28 left on the dark shell's palette because
     unlayered declarations beat layered ones and so it never wins against the
     theme blocks. It is repointed at Noon now — bare `:root` IS
     Noon — and held here so the three declarations cannot drift apart.
     Without this, the block a reader lands on when they search `--primary` is
     the one nothing checks. */
  it("the @layer base fallback declares Noon's bridge", () => {
    // The parse helper above keys off the selector text, which cannot
    // distinguish this `:root` from the unlayered ones; slice the layer first.
    const layer = css.slice(css.indexOf("@layer base {\n  :root {"));
    const inner = layer.slice(layer.indexOf("{", layer.indexOf(":root")) + 1);
    const got: Record<string, string> = {};
    for (const line of inner.slice(0, inner.indexOf("}")).split("\n")) {
      const m = /^\s*--([a-z0-9-]+):\s*(.+);\s*$/.exec(line);
      if (m) got[m[1]] = m[2];
    }
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, noonShadcn[n]]);
    // --radius is not a colour and is not part of the bridge, but it lives in
    // this block and is live: tailwind.config.ts spends it as `rounded-lg`,
    // with `rounded-md`/`rounded-sm` as calc() steps off it. 0.75rem was 12px,
    // which is --r-control exactly, so pointing it at the scale moves no
    // measurement and stops the number being a fourth opinion.
    expect(got["radius"]).toBe("var(--r-control)");
    expect(RADIUS["r-control"]).toBe("12px");
  });

  it("gives the two rooms different values", () => {
    // Being fixed across both themes is the bug this replaced: one set of
    // values declared once, painting Noon in the dark shell's colours.
    // The two rings used to be the exception, because the ring was --lit in
    // both rooms. Since UI-P04 they follow --focus-ring, the ink on Noon and
    // the lamp gold on Dusk, so no name is shared.
    expect(SHADCN_NAMES.filter((n) => noonShadcn[n] === duskShadcn[n])).toEqual([]);
  });
});

describe("index.css mirrors radius.ts", () => {
  it.each(["noon", "dusk"] as const)("%s declares the whole scale", (theme) => {
    const got = parse(
      theme === "noon"
        ? ':root,\n:root[data-theme="noon"]'
        : ':root[data-theme="dusk"]',
    );
    for (const n of RADIUS_NAMES) expect([n, got[n]]).toEqual([n, RADIUS[n]]);
  });

  it("declares the same values in both blocks — radius is theme-independent", () => {
    const light = parse(':root,\n:root[data-theme="noon"]');
    const dark = parse(':root[data-theme="dusk"]');
    for (const n of RADIUS_NAMES) expect([n, dark[n]]).toEqual([n, light[n]]);
  });
});

describe("index.css mirrors elevation.ts", () => {
  it("noon declares both shadows", () => {
    const got = parse(':root,\n:root[data-theme="noon"]');
    for (const n of ELEVATION_TOKENS) expect([n, got[n]]).toEqual([n, noonElevation[n]]);
  });

  it("dusk declares both shadows", () => {
    const got = parse(':root[data-theme="dusk"]');
    for (const n of ELEVATION_TOKENS) expect([n, got[n]]).toEqual([n, duskElevation[n]]);
  });

  it("declares a DIFFERENT shadow in each block", () => {
    // The point of putting these in the theme blocks at all: a shadow on a
    // light ground and a shadow on a dark ground are not the same object.
    const light = parse(':root,\n:root[data-theme="noon"]');
    const dark = parse(':root[data-theme="dusk"]');
    for (const n of ELEVATION_TOKENS) expect(dark[n]).not.toBe(light[n]);
  });
});

describe("index.css mirrors refined.ts (UI-P79)", () => {
  const dusk_ = parse(':root[data-theme="dusk"][data-look="refined"]');
  const noon_ = parse(':root[data-theme="noon"][data-look="refined"]');
  // UI-P81 adds the refined radius scale to the same two blocks: seven radius
  // names, which the current blocks already declare (so none is a new name).
  const expected = [...REFINED_NAMES, ...SHADCN_NAMES, ...REFINED_RADIUS_NAMES].sort();

  it("holds both refined blocks to the same set of names", () => {
    expect(Object.keys(dusk_).sort()).toEqual(Object.keys(noon_).sort());
    expect(Object.keys(noon_).sort()).toEqual(expected);
  });

  it("declares the refined radius scale (UI-P81), and leaves --r-full to the theme blocks", () => {
    for (const n of REFINED_RADIUS_NAMES) {
      expect([n, dusk_[n]]).toEqual([n, REFINED_RADIUS[n]]);
      expect([n, noon_[n]]).toEqual([n, REFINED_RADIUS[n]]);
    }
    expect(dusk_["r-full"]).toBeUndefined();
    expect(noon_["r-full"]).toBeUndefined();
  });

  it("declares every refined value, as written", () => {
    for (const n of REFINED_NAMES) {
      expect([n, dusk_[n]]).toEqual([n, duskRefined[n]]);
      expect([n, noon_[n]]).toEqual([n, noonRefined[n]]);
    }
  });

  it("declares the shadcn bridge, repointed", () => {
    for (const n of SHADCN_NAMES) {
      expect([n, dusk_[n]]).toEqual([n, duskRefinedShadcn[n]]);
      expect([n, noon_[n]]).toEqual([n, noonRefinedShadcn[n]]);
    }
  });

  it("repoints only names the theme blocks already declare, plus the new ones", () => {
    const declared = new Set<string>(DECLARED);
    const stray = REFINED_NAMES.filter((n) => !declared.has(n));
    expect(stray).toEqual([]);
  });

  it("aliases every new name in the current look, so the switch off changes nothing", () => {
    const light = parse(':root,\n:root[data-theme="noon"]');
    const dark = parse(':root[data-theme="dusk"]');
    for (const n of REFINED_NEW_NAMES) {
      expect(light[n], `--${n} in the noon block`).toBeDefined();
      expect([n, dark[n]]).toEqual([n, light[n]]);
    }
  });

  it("keeps the refined blocks after the theme blocks and out of the bare :root", () => {
    const at = (sel: string) => css.indexOf(sel);
    expect(at(':root[data-theme="dusk"][data-look="refined"]')).toBeGreaterThan(at(':root[data-theme="dusk"] {'));
    expect(at(':root[data-theme="noon"][data-look="refined"]')).toBeGreaterThan(at(':root[data-theme="dusk"][data-look="refined"]'));
  });
});
