// SV-30 P2: a stopping condition with a measurable target.

import { describe, expect, it } from "vitest";

import { goalLine, goalOf, goalRefusal } from "./making";

const target = { metric: "VM speed", unit: "x", baseline: 1, target: 2, achieved: 2.1, source: "maker" as const };

describe("SV-30 P2: a goal with a target", () => {
  it("saves, reads back and says it as the prompt words it", () => {
    const goal = goalOf({ condition: "VM 2x faster", target, reached: "reached" });
    expect(goal?.target).toEqual(target);
    expect(goal?.reached).toBe("reached");
    expect(goalLine(goal!)).toBe("Worked until VM speed 2x · baseline 1x · reached 2.1x");
  });
  it("says a unit that is a word with a space, and no achieved value without one", () => {
    expect(goalLine({ condition: "x", target: { metric: "Latency", unit: "ms", baseline: 120, target: 60, source: "maker" } })).toBe("Worked until Latency 60 ms · baseline 120 ms");
  });
  it("reads a goal with no target as before", () => {
    expect(goalOf({ condition: "the tests pass", atMost: 40 })).toEqual({ condition: "the tests pass", atMost: 40 });
    expect(goalLine({ condition: "the tests pass", atMost: 40 })).toBe("Worked until the tests pass · at most 40 turns");
  });
  it("drops a target that is not whole and refuses one out of range", () => {
    expect(goalOf({ condition: "x", target: { metric: "", baseline: 1, target: 2 } })?.target).toBeUndefined();
    expect(goalOf({ condition: "x", target: { metric: "m", baseline: "1", target: 2 } })?.target).toBeUndefined();
    expect(goalRefusal({ condition: "x", target: { ...target, metric: "m".repeat(41) } })).toBe("Metric: 40 characters max");
    expect(goalRefusal({ condition: "x", target: { ...target, unit: "u".repeat(13) } })).toBe("Unit: 12 characters max");
    expect(goalRefusal({ condition: "x", target })).toBeNull();
  });
});
