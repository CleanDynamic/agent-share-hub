// The two theme blocks in src/index.css, held to the modules that describe
// them. Every custom property a component can read off the root element is
// declared in both blocks, and this asserts that the blocks say what the
// TypeScript says — a value edited in one place and not the other is the whole
// failure mode of mirroring a token set into a stylesheet.
//
// Three groups now share those blocks: the colour tokens (BG-P01), the radius
// scale (BG-P04) and the elevation shadows (BG-P04). Radius is theme-
// independent and therefore identical in both; the other two are not.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TOKEN_NAMES, exhibition, dusk } from "./semantics";
import { RADIUS, RADIUS_NAMES } from "./radius";
import { ELEVATION_TOKENS, duskElevation, exhibitionElevation } from "./elevation";

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
const DECLARED = [...TOKEN_NAMES, ...RADIUS_NAMES, ...ELEVATION_TOKENS].sort();

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
