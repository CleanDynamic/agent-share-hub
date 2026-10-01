// UI-P15 — closesInLabel: the vacant frame's countdown, in deadlineLabel's own steps.

import { describe, expect, it } from "vitest";

import { closesInLabel, deadlineLabel } from "./bountyDisplay";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe("closesInLabel", () => {
  it("says nothing for no deadline, or one that is not a date", () => {
    expect(closesInLabel(null, NOW)).toBeNull();
    expect(closesInLabel(undefined, NOW)).toBeNull();
    expect(closesInLabel("soon", NOW)).toBeNull();
  });

  it("counts days, then weeks, then months", () => {
    expect(closesInLabel(inDays(0), NOW)).toBe("today");
    expect(closesInLabel(inDays(1), NOW)).toBe("1 day");
    expect(closesInLabel(inDays(9), NOW)).toBe("9 days");
    expect(closesInLabel(inDays(21), NOW)).toBe("3 weeks");
    expect(closesInLabel(inDays(90), NOW)).toBe("3 months");
  });

  it("reports a date that has passed rather than hiding it", () => {
    expect(closesInLabel(inDays(-3), NOW)).toBe("closed");
  });

  it("agrees with deadlineLabel on where each step falls", () => {
    for (const n of [0, 1, 2, 13, 14, 59, 60, 200]) {
      const long = deadlineLabel(inDays(n), NOW)!;
      const short = closesInLabel(inDays(n), NOW)!;
      if (n === 0) expect([long, short]).toEqual(["closes today", "today"]);
      else if (n === 1) expect([long, short]).toEqual(["closes tomorrow", "1 day"]);
      else expect(long.replace("closes in ", "")).toBe(short);
    }
  });
});
