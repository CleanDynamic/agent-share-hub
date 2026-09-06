// BG-P04 — the radius scale and the focus ring.
//
// `css-parity.test.ts` proves the two theme blocks in index.css declare the
// scale this module describes. What is proved here is the shape of the scale
// itself: six steps and no seventh, one circular step that is not a default,
// and an accessor that hands out `var()` references rather than pixels.

import { describe, expect, it } from "vitest";
import { RADIUS, RADIUS_NAMES, r, radiusVar, type RadiusName } from "./radius";
import { FOCUS_RING_OFFSET, FOCUS_RING_WIDTH, focusRing } from "./focus";
import { TOKEN_NAMES } from "./semantics";

describe("the radius scale", () => {
  it("is exactly the six steps the spec lists", () => {
    expect(RADIUS).toEqual({
      "r-chip": "8px",
      "r-media": "10px",
      "r-control": "12px",
      "r-card": "14px",
      "r-panel": "16px",
      "r-full": "999px",
    });
  });

  it("resolves every step through the accessor, in both themes", () => {
    // One value per step, theme-independent by design, so "in both themes"
    // is the claim that the accessor names a token the blocks declare — which
    // css-parity.test.ts checks against the stylesheet itself.
    for (const name of RADIUS_NAMES) {
      const key = name.slice(2) as keyof typeof r;
      expect(r[key], `r.${key} is not --${name}`).toBe(`var(--${name})`);
      expect(radiusVar(name)).toBe(`var(--${name})`);
    }
  });

  it("hands out var() references, never pixels", () => {
    for (const value of Object.values(r)) expect(value).toMatch(/^var\(--r-[a-z]+\)$/);
  });

  it("steps upward from chip to panel, with no two steps the same", () => {
    const rectangular: RadiusName[] = ["r-chip", "r-media", "r-control", "r-card", "r-panel"];
    const px = rectangular.map((n) => parseInt(RADIUS[n], 10));
    expect(px).toEqual([...px].sort((a, b) => a - b));
    expect(new Set(px).size).toBe(px.length);
  });

  it("keeps --r-full for circular things, far above the rectangular steps", () => {
    // Not a "very rounded" step: the gap between the largest rectangular radius
    // and this one is what stops it being reached for as one.
    const panel = parseInt(RADIUS["r-panel"], 10);
    expect(parseInt(RADIUS["r-full"], 10)).toBeGreaterThan(panel * 10);
  });

  it("does not collide with the colour tokens sharing the root block", () => {
    for (const name of RADIUS_NAMES) {
      expect(TOKEN_NAMES as readonly string[]).not.toContain(name);
    }
  });

  it("leaves the legacy pill tokens alone — BG-P07 repoints their consumers", () => {
    // --radius-btn and --radius-badge are still 100px in the legacy :root block
    // and still have live consumers. Retiring them here would restyle running
    // buttons from a prompt that is meant to change nothing on screen.
    expect(RADIUS_NAMES).not.toContain("radius-btn" as RadiusName);
    expect(RADIUS_NAMES).not.toContain("radius-badge" as RadiusName);
  });
});

describe("the focus ring", () => {
  it("is 2px of --lit with a 2px offset", () => {
    expect(focusRing).toEqual({
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "var(--lit)",
      outlineOffset: "2px",
    });
    expect(FOCUS_RING_WIDTH).toBe("2px");
    expect(FOCUS_RING_OFFSET).toBe("2px");
  });

  it("spends --lit and nothing else", () => {
    expect(focusRing.outlineColor).toBe("var(--lit)");
    const spent = Object.values(focusRing).filter((v) => v.startsWith("var("));
    expect(spent).toEqual(["var(--lit)"]);
  });

  it("is an outline, so it cannot shift a layout when it appears", () => {
    const keys = Object.keys(focusRing);
    expect(keys.every((k) => k.startsWith("outline"))).toBe(true);
    expect(keys).not.toContain("border");
    expect(keys).not.toContain("boxShadow");
  });

  it("carries the offset that makes amber legal here", () => {
    // The ring is read against a band of --bg rather than against the ground
    // alone. Without the offset the 3.0:1 UI floor is the whole argument, and
    // --lit is 1.80:1 on Exhibition's ground.
    expect(focusRing.outlineOffset).not.toBe("0");
    expect(parseInt(focusRing.outlineOffset, 10)).toBeGreaterThan(0);
  });
});
