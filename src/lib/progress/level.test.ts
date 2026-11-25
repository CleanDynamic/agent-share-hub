// Mobile 28 D: the level curve agrees with calc_level_from_xp, and the Level module's figures follow from it.

import { describe, expect, it } from "vitest";

import { levelLine, levelOf, levelProgress, xpForLevel } from "./level";

/** calc_level_from_xp as the migration writes it, in exact rational steps: the smallest L with 75 × (L − 1)^1.7 > xp, less one. */
const sqlLevel = (xp: number) => Math.max(1, Math.floor(Math.pow(Math.max(xp, 0) / 75, 1 / 1.7)) + 1);

describe("the level curve", () => {
  it("starts at level 1 with 0 XP, and a negative or broken total is 0", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(-40)).toBe(1);
    expect(levelOf(Number.NaN)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
  });

  it("agrees with the database's formula for every total up to 200,000 away from a boundary", () => {
    for (let xp = 0; xp <= 200_000; xp += 7) {
      const boundary = xpForLevel(levelOf(xp) + 1) - xp <= 1 || xp - xpForLevel(levelOf(xp)) <= 1;
      if (!boundary) expect(levelOf(xp), `xp ${xp}`).toBe(sqlLevel(xp));
    }
  });

  it("reaches each level exactly at its threshold, and not a point before", () => {
    for (let level = 2; level <= 60; level++) {
      expect(levelOf(xpForLevel(level))).toBe(level);
      expect(levelOf(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });
});

describe("the module's figures", () => {
  it("says the total, what is left to the next level, and how far through this one", () => {
    const progress = levelProgress(1240);
    expect(progress.level).toBe(levelOf(1240));
    expect(progress.next).toBe(xpForLevel(progress.level + 1));
    expect(progress.toNext).toBe(progress.next - 1240);
    expect(progress.fraction).toBeGreaterThan(0);
    expect(progress.fraction).toBeLessThan(1);
    expect(levelLine(progress)).toBe(`1,240 XP · ${progress.toNext.toLocaleString("en-GB")} to level ${progress.level + 1}`);
  });

  it("keeps the stored level when it is higher than the total gives, as the database never lowers one", () => {
    expect(levelProgress(0, 3).level).toBe(3);
    expect(levelProgress(5000, 1).level).toBe(levelOf(5000));
  });
});
