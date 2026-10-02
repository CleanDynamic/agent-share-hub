// UI-P34 — the Profile's view model: what it says, in what order, and what it will not say.

import { describe, expect, it } from "vitest";

import { levelFromXp, xpForLevel } from "@/lib/progress";

import {
  ACTIVITY_DAYS,
  activityDays,
  buildsCount,
  emptyLine,
  eyebrowLine,
  handleLine,
  levelView,
  marksView,
  remainingLine,
  ringLabel,
  sinceLabel,
  streakLine,
  tabLabel,
  worksTabOf,
  xpLine,
} from "./profileModel";

describe("the banner's lines", () => {
  it("writes the eyebrow from the parts that exist", () => {
    expect(eyebrowLine("Leeds", "Feb 2026")).toBe("Maker · Leeds · since Feb 2026");
    expect(eyebrowLine("Leeds", null)).toBe("Maker · Leeds");
    expect(eyebrowLine(null, "Feb 2026")).toBe("Maker · since Feb 2026");
    expect(eyebrowLine("  ", null)).toBe("Maker");
  });

  it("leaves the date off on a phone", () => {
    expect(eyebrowLine("Leeds", "Feb 2026", true)).toBe("Maker · Leeds");
  });

  it("joins the handle and the bio, and says the handle alone without one", () => {
    expect(handleLine("maya", "builds finance agents")).toBe("@maya · builds finance agents");
    expect(handleLine("maya", "  ")).toBe("@maya");
    expect(handleLine("maya", null)).toBe("@maya");
  });

  it("reads 'since' as month and year, and nothing from a bad date", () => {
    expect(sinceLabel("2026-02-14T09:00:00Z")).toBe("Feb 2026");
    expect(sinceLabel("not a date")).toBeNull();
    expect(sinceLabel(null)).toBeNull();
  });
});

describe("the level panel", () => {
  const base = { track: "curator" as const, streakDays: 12, streakBest: 31 };

  it("takes the ring, the next level and the remainder from the progress module's own curve", () => {
    const xp = 1840;
    const view = levelView({ ...base, level: 1, xpTotal: xp });
    const level = levelFromXp(xp);
    expect(view.level).toBe(level);
    expect(view.xpNext).toBe(xpForLevel(level + 1));
    expect(view.remaining).toBe(xpForLevel(level + 1) - xp);
    expect(view.percent).toBeGreaterThanOrEqual(0);
    expect(view.percent).toBeLessThanOrEqual(100);
    expect(xpLine(view)).toBe(`1,840 / ${xpForLevel(level + 1).toLocaleString("en-GB")} xp`);
    expect(remainingLine(view)).toBe(`${(xpForLevel(level + 1) - xp).toLocaleString("en-GB")} to level ${level + 1}`);
    expect(ringLabel(view)).toBe(`Level ${level}, ${view.percent}% of the way to level ${level + 1}`);
  });

  it("knows no XP, streak or ring for somebody whose row cannot be read, and says so by saying nothing", () => {
    const view = levelView({ level: 4, xpTotal: null, track: "mentor", streakDays: 0, streakBest: 0 });
    expect(view).toMatchObject({ level: 4, percent: 0, xp: null, xpNext: null, remaining: null, streakKnown: false });
    expect(xpLine(view)).toBeNull();
    expect(remainingLine(view)).toBeNull();
    expect(streakLine(view)).toBeNull();
    expect(ringLabel(view)).toBe("Level 4");
  });

  it("writes the streak, with its best on desktop and without on a phone", () => {
    const view = levelView({ ...base, level: 1, xpTotal: 100 });
    expect(streakLine(view)).toBe("12-day streak · best 31");
    expect(streakLine(view, true)).toBe("12-day streak");
    expect(streakLine(levelView({ ...base, streakDays: 0, level: 1, xpTotal: 100 }))).toBe("No streak yet");
  });

  it("never reports a best below the current streak", () => {
    expect(levelView({ ...base, streakDays: 9, streakBest: 4, level: 1, xpTotal: 100 }).streakBest).toBe(9);
  });
});

describe("the works", () => {
  it("reads the tab from the address, and takes anything else (the old Solutions among it) as Builds", () => {
    expect(worksTabOf("rebuilds")).toBe("rebuilds");
    expect(worksTabOf("reproduced")).toBe("reproduced");
    expect(worksTabOf("collections")).toBe("collections");
    expect(worksTabOf("solutions")).toBe("builds");
    expect(worksTabOf(null)).toBe("builds");
  });

  it("labels a tab with its count, and with nothing while it loads", () => {
    expect(tabLabel("Builds", 14)).toBe("Builds 14");
    expect(tabLabel("Reproduced", 1204)).toBe("Reproduced 1,204");
    expect(tabLabel("Builds", undefined)).toBe("Builds");
  });

  it("has one sentence for every empty tab, in the owner's voice on their own profile", () => {
    for (const tab of ["builds", "rebuilds", "reproduced", "collections"] as const) {
      expect(emptyLine(tab, true).length).toBeGreaterThan(0);
      expect(emptyLine(tab, true)).not.toBe(emptyLine(tab, false));
    }
  });

  it("counts a collection's builds in the singular too", () => {
    expect(buildsCount(1)).toBe("1 build");
    expect(buildsCount(4)).toBe("4 builds");
  });
});

describe("the activity grid's days", () => {
  const today = new Date("2026-09-30T12:00:00Z");

  it("is 22 weeks of days ending today, oldest first", () => {
    const days = activityDays([], today);
    expect(days).toHaveLength(ACTIVITY_DAYS);
    expect(ACTIVITY_DAYS).toBe(22 * 7);
    expect(days[days.length - 1].date).toBe("2026-09-30");
    expect(days[0].date).toBe("2026-04-30");
  });

  it("draws an active day as a count of one, a frozen day as frozen, and the rest as empty", () => {
    const days = activityDays(
      [
        { date: "2026-09-30", kind: "active" },
        { date: "2026-09-29", kind: "frozen" },
        { date: "2025-01-01", kind: "active" },
      ],
      today,
    );
    expect(days[days.length - 1]).toMatchObject({ count: 1, frozen: false });
    expect(days[days.length - 2]).toMatchObject({ count: 0, frozen: true });
    expect(days[days.length - 3]).toMatchObject({ count: 0, frozen: false });
    expect(days.filter((day) => day.count > 0)).toHaveLength(1);
  });
});

describe("the creator marks", () => {
  it("draws what is held, lightest first, with the catalogue's names", () => {
    const marks = marksView(new Set(["fixer", "first-build", "proven"]));
    expect(marks.map((mark) => [mark.name, mark.tier])).toEqual([
      ["First build", "common"],
      ["Proven", "rare"],
      ["Fixer", "highest"],
    ]);
  });

  it("keeps the five that weigh most when more are held, and ignores a key that is not in the catalogue", () => {
    const held = new Set(["first-build", "runner", "solver", "proven", "rebuilt", "keeper", "well-proven", "family", "not-a-badge"]);
    const marks = marksView(held);
    expect(marks).toHaveLength(5);
    expect(marks.filter((mark) => mark.tier === "highest")).toHaveLength(2);
    expect(marks.map((mark) => mark.tier)).toEqual(["rare", "rare", "rare", "highest", "highest"]);
    expect(marks.map((mark) => mark.key)).not.toContain("not-a-badge");
  });

  it("is empty for a maker who holds none", () => {
    expect(marksView(new Set())).toEqual([]);
  });
});
