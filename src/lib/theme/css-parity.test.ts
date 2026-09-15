// The two theme blocks in src/index.css, held to the modules that describe
// them. Every custom property a component can read off the root element is
// declared in both blocks, and this asserts that the blocks say what the
// TypeScript says — a value edited in one place and not the other is the whole
// failure mode of mirroring a token set into a stylesheet.
//
// Four groups now share those blocks: the colour tokens (BG-P01), the radius
// scale (BG-P04), the elevation shadows (BG-P04) and the shadcn bridge
// (BG-P28). Radius is theme-independent and therefore identical in both; the
// other three are not.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TOKEN_NAMES, exhibition, dusk } from "./semantics";
import { RADIUS, RADIUS_NAMES } from "./radius";
import { ELEVATION_TOKENS, duskElevation, exhibitionElevation } from "./elevation";
import { SHADCN_NAMES, duskShadcn, exhibitionShadcn } from "./shadcn";

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
].sort();

describe("index.css mirrors semantics.ts", () => {
  it("exhibition (bare :root and [data-theme=exhibition])", () => {
    const got = parse(':root,\n:root[data-theme="exhibition"]');
    expect(Object.keys(got).sort()).toEqual(DECLARED);
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, exhibition[n]]);
  });
  it("dusk", () => {
    const got = parse(':root[data-theme="dusk"]');
    expect(Object.keys(got).sort()).toEqual(DECLARED);
    for (const n of TOKEN_NAMES) expect([n, got[n]]).toEqual([n, dusk[n]]);
  });
});

describe("index.css mirrors shadcn.ts", () => {
  /* The bridge exists so that a class name means the same thing an inline
     token does. If a name here drifts from the module, every utility spending
     it drifts with it and nothing else in the suite would notice. */
  it("exhibition declares the whole bridge", () => {
    const got = parse(':root,\n:root[data-theme="exhibition"]');
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, exhibitionShadcn[n]]);
  });

  it("dusk declares the whole bridge", () => {
    const got = parse(':root[data-theme="dusk"]');
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, duskShadcn[n]]);
  });

  /* BG-P29. The bridge has a THIRD declaration: the layered original inside
     `@layer base`, which BG-P28 left on the dark shell's palette because
     unlayered declarations beat layered ones and so it never wins against the
     theme blocks. It is repointed at Exhibition now — bare `:root` IS
     Exhibition — and held here so the three declarations cannot drift apart.
     Without this, the block a reader lands on when they search `--primary` is
     the one nothing checks. */
  it("the @layer base fallback declares Exhibition's bridge", () => {
    // The parse helper above keys off the selector text, which cannot
    // distinguish this `:root` from the unlayered ones; slice the layer first.
    const layer = css.slice(css.indexOf("@layer base {\n  :root {"));
    const inner = layer.slice(layer.indexOf("{", layer.indexOf(":root")) + 1);
    const got: Record<string, string> = {};
    for (const line of inner.slice(0, inner.indexOf("}")).split("\n")) {
      const m = /^\s*--([a-z0-9-]+):\s*(.+);\s*$/.exec(line);
      if (m) got[m[1]] = m[2];
    }
    for (const n of SHADCN_NAMES) expect([n, got[n]]).toEqual([n, exhibitionShadcn[n]]);
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
    // values declared once, painting Exhibition in the dark shell's colours.
    // The two rings are the exception and are meant to be: the theme's focus
    // ring is ONE definition, 2px --lit, identical in both rooms, and --lit is
    // the one token that does not change value between them.
    expect(SHADCN_NAMES.filter((n) => exhibitionShadcn[n] === duskShadcn[n])).toEqual([
      "ring",
      "sidebar-ring",
    ]);
  });
});

describe("index.css mirrors radius.ts", () => {
  it.each(["exhibition", "dusk"] as const)("%s declares the whole scale", (theme) => {
    const got = parse(
      theme === "exhibition"
        ? ':root,\n:root[data-theme="exhibition"]'
        : ':root[data-theme="dusk"]',
    );
    for (const n of RADIUS_NAMES) expect([n, got[n]]).toEqual([n, RADIUS[n]]);
  });

  it("declares the same values in both blocks — radius is theme-independent", () => {
    const light = parse(':root,\n:root[data-theme="exhibition"]');
    const dark = parse(':root[data-theme="dusk"]');
    for (const n of RADIUS_NAMES) expect([n, dark[n]]).toEqual([n, light[n]]);
  });
});

describe("index.css mirrors elevation.ts", () => {
  it("exhibition declares both shadows", () => {
    const got = parse(':root,\n:root[data-theme="exhibition"]');
    for (const n of ELEVATION_TOKENS) expect([n, got[n]]).toEqual([n, exhibitionElevation[n]]);
  });

  it("dusk declares both shadows", () => {
    const got = parse(':root[data-theme="dusk"]');
    for (const n of ELEVATION_TOKENS) expect([n, got[n]]).toEqual([n, duskElevation[n]]);
  });

  it("declares a DIFFERENT shadow in each block", () => {
    // The point of putting these in the theme blocks at all: a shadow on a
    // light ground and a shadow on a dark ground are not the same object.
    const light = parse(':root,\n:root[data-theme="exhibition"]');
    const dark = parse(':root[data-theme="dusk"]');
    for (const n of ELEVATION_TOKENS) expect(dark[n]).not.toBe(light[n]);
  });
});
