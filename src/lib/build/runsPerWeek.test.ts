// SV-23 P2: twelve calendar weeks of runs, oldest first, Monday to Sunday in UTC.

import { describe, expect, it } from "vitest";

import { RUN_WEEKS, runsPerWeek, runsSince, totalRuns } from "./runsPerWeek";

// Thursday 29 October 2026; its week began on Monday 26 October.
const NOW = new Date("2026-10-29T12:00:00Z");

describe("runsSince", () => {
  it("is the Monday eleven weeks before this week's", () => {
    expect(runsSince(NOW).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});

describe("runsPerWeek", () => {
  it("counts each run in its own week, this week last", () => {
    const weeks = runsPerWeek(["2026-10-26T00:00:00Z", "2026-10-28T09:00:00Z", "2026-10-25T23:59:59Z", "2026-08-10T00:00:00Z"], NOW);
    expect(weeks).toHaveLength(RUN_WEEKS);
    expect(weeks[11]).toBe(2);
    expect(weeks[10]).toBe(1);
    expect(weeks[0]).toBe(1);
    expect(totalRuns(weeks)).toBe(4);
  });

  it("leaves out a run before the first week, one in the future, and a stamp that is not a date", () => {
    const weeks = runsPerWeek(["2026-08-09T23:59:59Z", "2026-11-09T00:00:00Z", "later", "", null, undefined], NOW);
    expect(totalRuns(weeks)).toBe(0);
  });

  it("is twelve zeros for a build nobody has run", () => {
    expect(runsPerWeek([], NOW)).toEqual(Array.from({ length: 12 }, () => 0));
  });
});
