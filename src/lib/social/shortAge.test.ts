import { describe, expect, it } from "vitest";

import { shortAge } from "./time";

const NOW = new Date(2026, 9, 16, 12, 0, 0).getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("shortAge", () => {
  it("says now under a minute, and for a date ahead of the clock", () => {
    expect(shortAge(ago(0), NOW)).toBe("now");
    expect(shortAge(ago(59_000), NOW)).toBe("now");
    expect(shortAge(ago(-5 * MIN), NOW)).toBe("now");
  });

  it("says minutes, hours and days, rounding down", () => {
    expect(shortAge(ago(MIN), NOW)).toBe("1m");
    expect(shortAge(ago(5 * MIN + 30_000), NOW)).toBe("5m");
    expect(shortAge(ago(59 * MIN), NOW)).toBe("59m");
    expect(shortAge(ago(2 * HOUR), NOW)).toBe("2h");
    expect(shortAge(ago(23 * HOUR + 59 * MIN), NOW)).toBe("23h");
    expect(shortAge(ago(DAY), NOW)).toBe("1d");
    expect(shortAge(ago(2 * DAY + HOUR), NOW)).toBe("2d");
    expect(shortAge(ago(6 * DAY + 23 * HOUR), NOW)).toBe("6d");
  });

  it("then the date, with the year when it is not this year's", () => {
    expect(shortAge(new Date(2026, 9, 6, 9).toISOString(), NOW)).toBe("6 Oct");
    expect(shortAge(new Date(2026, 0, 1, 9).toISOString(), NOW)).toBe("1 Jan");
    expect(shortAge(new Date(2025, 11, 30, 9).toISOString(), NOW)).toBe("30 Dec 2025");
  });

  it("is empty for a date it cannot read", () => {
    expect(shortAge("nope", NOW)).toBe("");
    expect(shortAge(null, NOW)).toBe("");
    expect(shortAge(undefined, NOW)).toBe("");
  });
});
