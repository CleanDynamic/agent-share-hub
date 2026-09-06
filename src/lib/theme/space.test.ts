// BG-P04 — the spacing scale, and the one rule that comes with it.

import { describe, expect, it } from "vitest";
import { SPACE, SPACE_NAMES, SPACE_STEPS, assertPadding, isSpaceStep, px } from "./space";

describe("the spacing scale", () => {
  it("is exactly the seven steps the spec lists", () => {
    expect(SPACE).toEqual({ xs: 8, sm: 16, md: 24, lg: 40, xl: 64, "2xl": 96, "3xl": 132 });
    expect(SPACE_STEPS).toEqual([8, 16, 24, 40, 64, 96, 132]);
  });

  it("names them smallest to largest, and names nothing else", () => {
    expect(SPACE_NAMES).toEqual(["xs", "sm", "md", "lg", "xl", "2xl", "3xl"]);
    expect(SPACE_STEPS).toEqual([...SPACE_STEPS].sort((a, b) => a - b));
    expect(new Set(SPACE_STEPS).size).toBe(SPACE_STEPS.length);
  });

  it("walks in eights while the difference is legible, then opens up", () => {
    // Not a geometric ramp, and not an accident: 8/16/24 are the range where
    // 8px decides whether two elements read as one group, and the page-scale
    // steps are further apart because 8px is invisible there.
    expect([SPACE.sm - SPACE.xs, SPACE.md - SPACE.sm]).toEqual([8, 8]);
    const gaps = SPACE_STEPS.slice(1).map((v, i) => v - SPACE_STEPS[i]);
    expect(gaps).toEqual([8, 8, 16, 24, 32, 36]);
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  it("recognises its own steps and nothing between them", () => {
    for (const step of SPACE_STEPS) expect(isSpaceStep(step)).toBe(true);
    for (const between of [4, 12, 20, 32, 48, 80, 120, 160]) {
      expect(isSpaceStep(between), `${between} is not a step and must not pass`).toBe(false);
    }
  });

  it("renders a step as pixels when a string is wanted", () => {
    expect(px(SPACE.md)).toBe("24px");
    expect(px(SPACE["3xl"])).toBe("132px");
  });
});

describe("a card's padding may never exceed the gap to its neighbour", () => {
  it("passes a card padded less than its gap", () => {
    expect(assertPadding(SPACE.md, SPACE.lg)).toBeNull();
    expect(assertPadding(SPACE.sm, SPACE.md)).toBeNull();
    expect(assertPadding(SPACE.xs, SPACE["3xl"])).toBeNull();
  });

  it("passes the boundary, where padding equals the gap", () => {
    // "Never exceed", not "always less": at equal the inside and the outside
    // are the same distance, which reads as neutral rather than inverted.
    for (const step of SPACE_STEPS) expect(assertPadding(step, step)).toBeNull();
  });

  it("fails a card padded wider than its gap, and says why", () => {
    const reason = assertPadding(SPACE.lg, SPACE.md);
    expect(reason).not.toBeNull();
    expect(reason).toContain("40px");
    expect(reason).toContain("24px");
    expect(reason).toContain("reads as one band");
  });

  it("fails by one pixel, because the rule is a threshold and not a feeling", () => {
    expect(assertPadding(25, 24)).not.toBeNull();
    expect(assertPadding(24, 24)).toBeNull();
  });

  it("applies to a gap that is not a scale step", () => {
    // A grid gutter or an inherited flex gap is often not one of the seven,
    // and the rule still holds against it.
    expect(assertPadding(SPACE.md, 30)).toBeNull();
    expect(assertPadding(SPACE.md, 18)).not.toBeNull();
  });

  it("rejects a nonsense pair rather than silently passing it", () => {
    expect(assertPadding(Number.NaN, 24)).toContain("finite");
    expect(assertPadding(24, Number.POSITIVE_INFINITY)).toContain("finite");
    expect(assertPadding(-8, 24)).toContain("non-negative");
    expect(assertPadding(8, -24)).toContain("non-negative");
  });
});
