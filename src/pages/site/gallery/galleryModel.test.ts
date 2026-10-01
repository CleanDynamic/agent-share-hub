// UI-P28 — Gallery's view model: numbers, the week's bar and the facet lists.

import { describe, expect, it } from "vitest";

import { formatCount, formatPounds, lensLabel, percentOf, topOptions, weekBar } from "./galleryModel";

describe("numbers", () => {
  it("groups in en-GB and prints whole pounds", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatPounds(4250)).toBe("£4,250");
  });

  it("holds a percentage to 0–100 and gives a zero whole no bar", () => {
    expect(percentOf(312, 400)).toBe(78);
    expect(percentOf(500, 400)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(5, null)).toBe(0);
    expect(percentOf(Number.NaN, 10)).toBe(0);
  });

  it("follows a lens' label with an en space and its count — or nothing while it loads", () => {
    expect(lensLabel("Proven", 512)).toBe("Proven 512");
    expect(lensLabel("All", 1284)).toBe("All 1,284");
    expect(lensLabel("Rebuilt", undefined)).toBe("Rebuilt");
  });
});

describe("weekBar", () => {
  it("measures against the goal when one is set", () => {
    expect(weekBar({ reproducedThisWeek: 312, weeklyGoal: 400, reproducedLastWeek: 100 })).toEqual({ value: 78, of: 400 });
  });

  it("measures against last week while there is no goal, capped at 100", () => {
    expect(weekBar({ reproducedThisWeek: 150, weeklyGoal: null, reproducedLastWeek: 300 })).toEqual({ value: 50, of: null });
    expect(weekBar({ reproducedThisWeek: 450, weeklyGoal: null, reproducedLastWeek: 300 })).toEqual({ value: 100, of: null });
  });

  it("has no bar when it has nothing to measure against", () => {
    expect(weekBar({ reproducedThisWeek: 150, weeklyGoal: null, reproducedLastWeek: null })).toBeNull();
  });

  it("treats a quiet last week as full when this week has runs, and empty when it has none", () => {
    expect(weekBar({ reproducedThisWeek: 3, weeklyGoal: null, reproducedLastWeek: 0 })).toEqual({ value: 100, of: null });
    expect(weekBar({ reproducedThisWeek: 0, weeklyGoal: null, reproducedLastWeek: 0 })).toEqual({ value: 0, of: null });
  });
});

describe("topOptions", () => {
  const options = [
    { value: "a", count: 5 },
    { value: "b", count: 50 },
    { value: "c", count: 20 },
    { value: "d", count: 1 },
  ];

  it("keeps the most-used, by count", () => {
    expect(topOptions(options, 2, []).map((option) => option.value)).toEqual(["b", "c"]);
  });

  it("keeps a selected option that falls outside them, so it can be turned off", () => {
    expect(topOptions(options, 2, ["d"]).map((option) => option.value)).toEqual(["b", "c", "d"]);
  });

  it("does not mutate what it is given", () => {
    const before = options.map((option) => option.value);
    topOptions(options, 2, []);
    expect(options.map((option) => option.value)).toEqual(before);
  });
});
