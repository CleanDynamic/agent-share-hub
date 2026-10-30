// SV-23: a number filter's address form, and the address that carries it.

import { describe, expect, it } from "vitest";

import { galleryHref, parseGalleryParams } from "./galleryParams";
import { formatRange, parseRange, rangeWords } from "./galleryRanges";

describe("parseRange", () => {
  it("reads from-to, from and up-to", () => {
    expect(parseRange("5-30")).toEqual({ min: 5, max: 30 });
    expect(parseRange("5-")).toEqual({ min: 5 });
    expect(parseRange("-30")).toEqual({ max: 30 });
    expect(parseRange("4-4")).toEqual({ min: 4, max: 4 });
  });

  it("drops anything else: empty, backwards, negative, words, too long", () => {
    for (const bad of [null, undefined, "", "-", "30-5", "-5-3", "five", "1-2-3", "12345-", "5.5-9"]) expect(parseRange(bad)).toBeNull();
  });

  it("writes what it reads", () => {
    for (const range of ["5-30", "5-", "-30"]) expect(formatRange(parseRange(range))).toBe(range);
    expect(formatRange({})).toBeNull();
  });

  it("says the range in words", () => {
    expect(rangeWords({ min: 3 })).toBe("3 or more");
    expect(rangeWords({ max: 30 })).toBe("up to 30");
    expect(rangeWords({ min: 5, max: 30 })).toBe("5 to 30");
    expect(rangeWords({ min: 4, max: 4 })).toBe("exactly 4");
  });
});

describe("the address", () => {
  it("keeps the number filters, and writes the same address it reads", () => {
    const params = parseGalleryParams(new URLSearchParams("steps=5-30&sessions=2-&bogus=1&reps=x"));
    expect(params.ranges).toEqual({ steps: { min: 5, max: 30 }, sessions: { min: 2 } });
    expect(galleryHref(params)).toBe("/builds?steps=5-30&sessions=2-");
  });

  it("has no ranges when none is set, and drops one that does not read", () => {
    expect(parseGalleryParams(new URLSearchParams("steps=30-5")).ranges).toBeUndefined();
    expect(galleryHref({ ranges: {} })).toBe("/builds");
  });
});
