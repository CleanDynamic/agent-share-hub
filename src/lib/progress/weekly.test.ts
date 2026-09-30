// RC-P27 — this week's challenges: which three, when the week starts, and how
// far each has come.
//
// The catalogue is one fact in three places, as the badges are: XP-DESIGN.md
// names the three, 20261001260000_rc_badge_catalogue.sql inserts them with
// their criteria, and lib/progress/weekly.ts draws them. This holds the three
// together, then holds the counting to its promises: distinct builds or
// solutions, never past the target, never a row from last week, never more
// than three challenges ⟦hicks-law › Budgets⟧.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WEEKLY_CHALLENGE_LIMIT,
  WEEKLY_CHALLENGES,
  weekStartUtc,
  weeklyProgress,
  type WeekEvent,
  type WeeklyChallenge,
} from "./weekly";

const DESIGN = join("docs", "reconciliation", "XP-DESIGN.md");
const MIGRATION = join("supabase", "migrations", "20261001260000_rc_badge_catalogue.sql");

function designChallenges(): string[] {
  const text = readFileSync(DESIGN, "utf8");
  const from = text.indexOf("\n## Challenges");
  expect(from, "XP-DESIGN.md has a Challenges section").toBeGreaterThanOrEqual(0);
  const line = text
    .slice(from + 1)
    .split("\n")
    .slice(1)
    .find((candidate) => candidate.includes(" · "));
  return line!.split(" · ").map((title) => title.trim());
}

interface MigrationChallenge {
  slug: string;
  title: string;
  criteria: { event: string; count: number; window: string; distinct?: string };
  active: boolean;
}

function migrationChallenges(): MigrationChallenge[] {
  const sql = readFileSync(MIGRATION, "utf8").replace(/--[^\n]*/g, "");
  const insert = /insert\s+into\s+public\.challenges\b[^;]*?\bvalues\b([\s\S]*?)\bon\s+conflict\b/i.exec(sql);
  expect(insert, "the migration inserts into public.challenges").not.toBeNull();
  return [
    ...insert![1].matchAll(
      /\(\s*'([a-z-]+)',\s*'weekly',\s*'((?:[^']|'')+)',\s*'(\{[^']*\})',\s*\d+,\s*(true|false)\s*\)/g,
    ),
  ].map((m) => ({
    slug: m[1],
    title: m[2].replace(/''/g, "'"),
    criteria: JSON.parse(m[3]),
    active: m[4] === "true",
  }));
}

const at = (iso: string) => new Date(iso);
const row = (reason: string, source: string | null, iso: string): WeekEvent => ({
  reason,
  source_id: source,
  created_at: iso,
});

describe("the three weekly challenges", () => {
  it("are XP-DESIGN.md's three, in its words and its order", () => {
    expect(WEEKLY_CHALLENGES.map((challenge) => challenge.title)).toEqual(designChallenges());
  });

  it("match the migration's rows: slug, title, the ledger reason they count and how many", () => {
    const rows = migrationChallenges();
    expect(rows).toHaveLength(3);
    expect(rows.every((migration) => migration.active && migration.criteria.window === "week")).toBe(true);
    expect(
      WEEKLY_CHALLENGES.map(({ slug, title, event, count }) => ({ slug, title, event, count })),
    ).toEqual(rows.map(({ slug, title, criteria }) => ({ slug, title, event: criteria.event, count: criteria.count })));
  });

  it("never show more than three, even when handed more", () => {
    const four: WeeklyChallenge[] = [
      ...WEEKLY_CHALLENGES,
      { slug: "fourth", title: "A fourth", event: "run_reported", count: 1 },
    ];
    expect(WEEKLY_CHALLENGE_LIMIT).toBe(3);
    expect(weeklyProgress([], at("2026-09-30T12:00:00Z"), four)).toHaveLength(3);
  });
});

describe("the week", () => {
  it("starts on Monday at 00:00 UTC", () => {
    expect(weekStartUtc(at("2026-09-30T15:30:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekStartUtc(at("2026-09-28T00:00:00Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("still holds on Sunday night and turns over at Monday midnight", () => {
    expect(weekStartUtc(at("2026-10-04T23:59:59Z")).toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(weekStartUtc(at("2026-10-05T00:00:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("how far each challenge has come", () => {
  const now = at("2026-09-30T12:00:00Z");

  it("counts distinct builds for the runs, and never past the target", () => {
    const progress = weeklyProgress(
      [
        row("run_reported", "b1", "2026-09-29T10:00:00Z"),
        row("run_reported", "b1", "2026-09-29T11:00:00Z"),
        row("run_reported", "b2", "2026-09-30T09:00:00Z"),
        row("run_reported", "b3", "2026-09-30T10:00:00Z"),
        row("run_reported", "b4", "2026-09-30T11:00:00Z"),
      ],
      now,
    );
    expect(progress.map(({ challenge, done, target }) => [challenge.slug, done, target])).toEqual([
      ["run-three-new", 3, 3],
      ["solve-a-gap", 0, 1],
      ["reconfirm-stale", 0, 1],
    ]);
  });

  it("leaves out last week's rows and other reasons", () => {
    const progress = weeklyProgress(
      [
        row("run_reported", "b1", "2026-09-27T23:59:59Z"),
        row("solution_accepted", "s1", "2026-09-28T00:00:00Z"),
        row("build_published", "b9", "2026-09-29T00:00:00Z"),
      ],
      now,
    );
    expect(progress.map(({ done }) => done)).toEqual([0, 1, 0]);
  });

  it("counts a row with no source as its own", () => {
    const progress = weeklyProgress(
      [row("run_reported", null, "2026-09-29T10:00:00Z"), row("run_reported", null, "2026-09-29T11:00:00Z")],
      now,
    );
    expect(progress[0].done).toBe(2);
  });
});
