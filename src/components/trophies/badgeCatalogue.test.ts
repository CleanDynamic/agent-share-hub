// RC-P26 — the catalogue is one fact in three places.
//
// XP-DESIGN.md lists the ten badges and the three weekly challenges, the
// migration inserts them, and badge-data draws the badges. Three copies of one
// fact drift apart without anyone noticing, so this reads all three and holds
// them together. It then holds the migration to the promises it makes, by
// reading it the way rcGuards.test.ts reads the RC-P02 to RC-P25 files: the
// database awards, nobody on the client can call the award, a badge never
// writes XP, and after the file the active challenges are three.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BadgeCheck, Flag, GitFork, Hammer, Network, Play, Puzzle, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { describe, expect, it } from "vitest";

import { BADGES, tierLabel, type Tier } from "./badge-data";

const DESIGN = join("docs", "reconciliation", "XP-DESIGN.md");
const MIGRATION = join("supabase", "migrations", "20261001260000_rc_badge_catalogue.sql");
const XP_EVENTS = join("supabase", "migrations", "20261001240000_rc_xp_build_events.sql");
const SIGNALS = join("src", "lib", "build", "signals.ts");

/** A migration's SQL with its comments removed, so prose about a statement is not taken for one. */
function statements(file: string): string {
  return readFileSync(file, "utf8").replace(/--[^\n]*/g, "");
}

const unquote = (literal: string): string => literal.replace(/''/g, "'");

/* ── XP-DESIGN.md ─────────────────────────────────────────────────────────── */

function designSection(heading: string): string {
  const text = readFileSync(DESIGN, "utf8");
  const from = text.indexOf(`\n## ${heading}`);
  expect(from, `XP-DESIGN.md has a section "${heading}"`).toBeGreaterThanOrEqual(0);
  const body = text.slice(from + 1);
  const next = body.indexOf("\n## ", 1);
  return next === -1 ? body : body.slice(0, next);
}

interface Row {
  slug: string;
  name: string;
  description: string;
  tier: Tier;
}

const DESIGN_BADGES: Row[] = [
  ...designSection("Badges").matchAll(/^- ([a-z][a-z-]*) "([^"]+)" — (.+) — (common|rare|highest)$/gm),
].map((m) => ({ slug: m[1], name: m[2], description: m[3], tier: m[4] as Tier }));

const DESIGN_CHALLENGES: string[] = designSection("Challenges")
  .split("\n")
  .slice(1)
  .find((line) => line.includes(" · "))!
  .split(" · ")
  .map((title) => title.trim());

/* ── the migration ────────────────────────────────────────────────────────── */

const SQL = statements(MIGRATION);

function valuesOf(table: string): string {
  const match = new RegExp(`insert\\s+into\\s+public\\.${table}\\b[^;]*?\\bvalues\\b([\\s\\S]*?)\\bon\\s+conflict\\b`, "i").exec(SQL);
  expect(match, `the migration inserts into public.${table}`).not.toBeNull();
  return match![1];
}

interface MigrationBadge extends Row {
  icon: string;
  order: number;
  active: boolean;
}

const MIGRATION_BADGES: MigrationBadge[] = [
  ...valuesOf("badges").matchAll(
    /\(\s*'([a-z-]+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'(common|rare|highest)',\s*'([A-Za-z]+)',\s*(\d+),\s*(true|false)\s*\)/g,
  ),
].map((m) => ({
  slug: m[1],
  name: unquote(m[2]),
  description: unquote(m[3]),
  tier: m[4] as Tier,
  icon: m[5],
  order: Number(m[6]),
  active: m[7] === "true",
}));

interface MigrationChallenge {
  slug: string;
  cadence: string;
  title: string;
  criteria: string;
  order: number;
  active: boolean;
}

const MIGRATION_CHALLENGES: MigrationChallenge[] = [
  ...valuesOf("challenges").matchAll(
    /\(\s*'([a-z-]+)',\s*'(weekly|daily)',\s*'((?:[^']|'')+)',\s*'(\{[^']*\})',\s*(\d+),\s*(true|false)\s*\)/g,
  ),
].map((m) => ({
  slug: m[1],
  cadence: m[2],
  title: unquote(m[3]),
  criteria: m[4],
  order: Number(m[5]),
  active: m[6] === "true",
}));

/** The slugs of the two `_keep` arrays: the delete step's and the read-back's. */
function keepArrays(): string[][] {
  return [...SQL.matchAll(/_keep\s+constant\s+text\[\]\s*:=\s*ARRAY\[([^\]]*)\]/gi)].map((m) =>
    [...m[1].matchAll(/'([a-z-]+)'/g)].map((slug) => slug[1]),
  );
}

const ICONS = {
  "first-build": Hammer,
  runner: Play,
  solver: Puzzle,
  proven: BadgeCheck,
  rebuilt: GitFork,
  keeper: RefreshCw,
  founder: Flag,
  "well-proven": ShieldCheck,
  family: Network,
  fixer: Wrench,
} as const;

describe("the ten badges are one fact in three places", () => {
  it("XP-DESIGN.md lists ten, three common, four rare and three highest", () => {
    expect(DESIGN_BADGES).toHaveLength(10);
    const counts = (tier: Tier) => DESIGN_BADGES.filter((row) => row.tier === tier).length;
    expect([counts("common"), counts("rare"), counts("highest")]).toEqual([3, 4, 3]);
    expect(new Set(DESIGN_BADGES.map((row) => row.slug)).size).toBe(10);
  });

  it("badge-data has exactly the ten, with the same slugs, names, descriptions and tiers, in the same order", () => {
    expect(BADGES).toHaveLength(10);
    expect(
      BADGES.map((badge) => ({ slug: badge.id, name: badge.name, description: badge.description, tier: badge.tier })),
    ).toEqual(DESIGN_BADGES);
  });

  it("the migration inserts exactly the ten, exactly as XP-DESIGN.md writes them, all active", () => {
    expect(MIGRATION_BADGES).toHaveLength(10);
    expect(
      MIGRATION_BADGES.map(({ slug, name, description, tier }) => ({ slug, name, description, tier })),
    ).toEqual(DESIGN_BADGES);
    expect(MIGRATION_BADGES.every((row) => row.active)).toBe(true);
    expect(MIGRATION_BADGES.map((row) => row.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("both of the migration's keep lists hold those ten slugs and no other", () => {
    const arrays = keepArrays();
    expect(arrays).toHaveLength(2);
    for (const keep of arrays) expect([...keep].sort()).toEqual(DESIGN_BADGES.map((row) => row.slug).sort());
  });

  it("each badge has the one lucide icon it was given, no two alike, and the database names the same icon", () => {
    for (const badge of BADGES) {
      expect(badge.icon, badge.id).toBe(ICONS[badge.id as keyof typeof ICONS]);
    }
    expect(new Set(BADGES.map((badge) => badge.icon)).size).toBe(10);

    for (const row of MIGRATION_BADGES) {
      const icon = ICONS[row.slug as keyof typeof ICONS];
      expect(row.icon, row.slug).toBe(icon.displayName);
    }
  });

  it("nothing in the catalogue claims to be earned: earning is a person's row in user_badges", () => {
    expect(BADGES.every((badge) => badge.earned === false && badge.earnedDate === undefined)).toBe(true);
  });

  it("there are words for exactly the three tiers", () => {
    expect(Object.keys(tierLabel).sort()).toEqual(["common", "highest", "rare"]);
  });

  it("uses no word the vocabulary forbids", () => {
    const forbidden = /\b(blueprint|blog|post|reblog|remix|stage|block|rating|verification|neoscale|upload)\b/i;
    const words = [
      ...BADGES.flatMap((badge) => [badge.name, badge.description]),
      ...MIGRATION_CHALLENGES.map((challenge) => challenge.title),
      ...Object.values(tierLabel),
      "Not yet",
    ];
    for (const word of words) expect(word, word).not.toMatch(forbidden);
  });
});

describe("the three weekly challenges, read from the migration", () => {
  it("XP-DESIGN.md names three", () => {
    expect(DESIGN_CHALLENGES).toEqual([
      "Run three builds you haven't run before",
      "Solve a gap",
      "Re-confirm one of your stale builds",
    ]);
  });

  it("the migration inserts those three, weekly, active, in that order", () => {
    expect(MIGRATION_CHALLENGES.map((challenge) => challenge.title)).toEqual(DESIGN_CHALLENGES);
    expect(MIGRATION_CHALLENGES.map((challenge) => challenge.cadence)).toEqual(["weekly", "weekly", "weekly"]);
    expect(MIGRATION_CHALLENGES.map((challenge) => challenge.order)).toEqual([1, 2, 3]);
    expect(new Set(MIGRATION_CHALLENGES.map((challenge) => challenge.slug)).size).toBe(3);
    for (const challenge of MIGRATION_CHALLENGES) expect(() => JSON.parse(challenge.criteria), challenge.slug).not.toThrow();
  });

  it("every challenge is deactivated first, so the active count after the file is the three it inserts", () => {
    const deactivate = SQL.search(/update\s+public\.challenges\s+set\s+is_active\s*=\s*false\s+where\s+is_active\s*;/i);
    const insert = SQL.search(/insert\s+into\s+public\.challenges\b/i);
    expect(deactivate).toBeGreaterThanOrEqual(0);
    expect(deactivate).toBeLessThan(insert);

    // A row that already exists is brought back to active by its own upsert, so a re-run ends at three too.
    expect(SQL).toMatch(/on\s+conflict\s*\(slug\)\s+do\s+update[\s\S]*?is_active\s*=\s*excluded\.is_active/i);

    const active = MIGRATION_CHALLENGES.filter((challenge) => challenge.active).length;
    expect(active).toBe(3);
    expect(active).toBeLessThanOrEqual(3);
  });

  it("the people's running daily challenges are ended and kept, never deleted", () => {
    expect(SQL).toMatch(/update\s+public\.daily_challenges\s+set\s+expires_at\s*=\s*now\(\)\s+where\s+expires_at\s*>\s*now\(\)\s*;/i);
    expect(SQL).not.toMatch(/delete\s+from\s+public\.daily_challenges/i);
  });

  it("completing a challenge is not a source of XP: the table has no xp_reward", () => {
    const table = /create\s+table\s+if\s+not\s+exists\s+public\.challenges\s*\(([\s\S]*?)\n\);/i.exec(SQL);
    expect(table).not.toBeNull();
    expect(table![1]).not.toMatch(/xp_reward/i);
    expect(table![1]).toMatch(/cadence\s*=\s*'weekly'/i);
  });
});

describe("the migration awards, and protects, what it says it does", () => {
  const chunks = SQL.split(/create\s+or\s+replace\s+function\s+/i).slice(1);
  // A function is its header, up to the opening $$, and its body, from there to the closing $$.
  const functions = chunks.map((chunk) => {
    const open = chunk.indexOf("$$");
    const close = chunk.indexOf("$$", open + 2);
    return {
      name: /^public\.(\w+)/.exec(chunk)![1],
      header: chunk.slice(0, open),
      body: chunk.slice(open, close + 2),
    };
  });

  it("creates the writer and four trigger functions, each SECURITY DEFINER with a fixed search_path", () => {
    expect(functions.map((fn) => fn.name).sort()).toEqual([
      "rc_award_badge",
      "rc_badge_build_reconfirmed",
      "rc_badge_build_visible",
      "rc_badge_reproduction",
      "rc_badge_solution_accepted",
    ]);
    for (const fn of functions) {
      expect(fn.header, fn.name).toMatch(/security\s+definer/i);
      expect(fn.header, fn.name).toMatch(/set\s+search_path\s*=\s*public\b/i);
    }
  });

  it("revokes EXECUTE on every one of them from PUBLIC, anon and authenticated", () => {
    for (const fn of functions) {
      const revoke = new RegExp(
        `revoke\\s+execute\\s+on\\s+function\\s+public\\.${fn.name}\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
        "i",
      );
      expect(SQL, fn.name).toMatch(revoke);
    }
  });

  it("hangs four AFTER ... FOR EACH ROW triggers on the four events, and nothing BEFORE", () => {
    const triggers = [
      ...SQL.matchAll(/create\s+trigger\s+(\w+)\s+(after|before)\s+([\s\S]*?)\s+on\s+public\.(\w+)\s+for\s+each\s+row\b/gi),
    ].map((m) => ({ name: m[1], timing: m[2].toUpperCase(), event: m[3].replace(/\s+/g, " ").toUpperCase(), table: m[4] }));

    expect(triggers).toEqual([
      { name: "trg_rc_badge_build_visible", timing: "AFTER", event: "INSERT OR UPDATE OF STATUS", table: "builds" },
      { name: "trg_rc_badge_build_reconfirmed", timing: "AFTER", event: "UPDATE OF LAST_CONFIRMED_AT", table: "builds" },
      { name: "trg_rc_badge_reproduction", timing: "AFTER", event: "INSERT OR UPDATE", table: "build_reproductions" },
      { name: "trg_rc_badge_solution_accepted", timing: "AFTER", event: "INSERT", table: "solution_acceptance_log" },
    ]);
  });

  it("writes user_badges in two places only, and both are ON CONFLICT (user_id, badge_key) DO NOTHING", () => {
    const inserts = [...SQL.matchAll(/insert\s+into\s+public\.user_badges\b[^;]*;/gi)].map((m) => m[0]);
    expect(inserts).toHaveLength(2);
    for (const insert of inserts) {
      expect(insert.replace(/\s+/g, " ")).toMatch(/on conflict \(user_id, badge_key\) do nothing;$/i);
    }
  });

  it("the trigger functions write nothing themselves: they call the one writer", () => {
    for (const fn of functions.filter((f) => f.name !== "rc_award_badge")) {
      expect(fn.body, fn.name).toMatch(/public\.rc_award_badge\(/);
      expect(fn.body, fn.name).not.toMatch(/\binsert\s+into\b/i);
    }
  });

  it("counts under an advisory lock wherever a badge is a threshold, so two writes that cross it are not both short", () => {
    const locks = [...SQL.matchAll(/pg_advisory_xact_lock\(hashtextextended\('([a-z]+):'/g)].map((m) => m[1]);
    expect(locks.sort()).toEqual(["family", "proven", "runner", "solver"]);
  });

  it("gives founder to every profile that exists, from profiles", () => {
    expect(SQL).toMatch(/insert\s+into\s+public\.user_badges[^;]*from\s+public\.profiles\s+p[^;]*where\s+b\.slug\s*=\s*'founder'/i);
  });

  it("copies the badges it removes to rc_backup, then deletes from user_badges, then from badges", () => {
    const backup = SQL.search(/insert\s+into\s+rc_backup\.user_badges_pre_rc_p26/i);
    const deleteUser = SQL.search(/delete\s+from\s+public\.user_badges\b/i);
    const deleteCatalogue = SQL.search(/delete\s+from\s+public\.badges\b/i);
    expect(backup).toBeGreaterThanOrEqual(0);
    expect(backup).toBeLessThan(deleteUser);
    expect(deleteUser).toBeLessThan(deleteCatalogue);
    expect(SQL).toMatch(/revoke\s+all\s+on\s+rc_backup\.user_badges_pre_rc_p26\s+from\s+public,\s*anon,\s*authenticated/i);
  });

  it("opens nothing to a client but a read of the two catalogues", () => {
    const grants = [...SQL.matchAll(/\bgrant\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, " ").toLowerCase());
    expect(grants.sort()).toEqual([
      "grant all on public.badges to service_role;",
      "grant all on public.challenges to service_role;",
      "grant select on public.badges to anon, authenticated;",
      "grant select on public.challenges to anon, authenticated;",
    ]);
    expect(SQL).toMatch(/alter\s+table\s+public\.badges\s+enable\s+row\s+level\s+security/i);
    expect(SQL).toMatch(/alter\s+table\s+public\.challenges\s+enable\s+row\s+level\s+security/i);
  });

  it("never writes XP: a badge pays nothing", () => {
    // The ledger, the totals and the two XP writers, as patterns and not spelled out:
    // rcGuards.test.ts fails any file under src that names either writer.
    expect(SQL).not.toMatch(/\b(xp_events|user_progress|\w*grant_xp|award_\w+)\b/i);
  });

  it("calls auth.uid() once, and never bare", () => {
    expect(SQL.match(/auth\.uid\(\)/gi) ?? []).toHaveLength(1);
    expect(SQL.match(/(?<!select\s)auth\.uid\(\)/gi) ?? []).toEqual([]);
  });

  it("checks its ground before it changes anything, and every stop says RC-P26", () => {
    expect(SQL.search(/\bdo\s+\$\$/i)).toBeLessThan(SQL.search(/\bcreate\s+table\b/i));
    const messages = [...SQL.matchAll(/raise\s+exception\s+'([^']*)'/gi)].map((m) => m[1]);
    expect(messages.length).toBeGreaterThanOrEqual(10);
    for (const message of messages) expect(message).toMatch(/^RC-P26: /);
  });

  // "Stale" is decided in SQL as well as in signals.ts, here a third time: the
  // first copy is rc_xp_build_reconfirmed, the second is STALE_AFTER_DAYS. Three
  // numbers for one fact drift apart without anyone noticing, so this reads all three.
  it("the stale window equals STALE_AFTER_DAYS and the window the XP trigger uses", () => {
    const declared = /export const STALE_AFTER_DAYS\s*=\s*(\d+)\s*;/.exec(readFileSync(SIGNALS, "utf8"));
    expect(declared, "STALE_AFTER_DAYS is declared in signals.ts").not.toBeNull();

    const windows = [...SQL.matchAll(/\bstale_days\s+constant\s+integer\s*:=\s*(\d+)\s*;/gi)];
    expect(windows).toHaveLength(1);
    expect(Number(windows[0][1])).toBe(Number(declared?.[1]));

    const xp = [...statements(XP_EVENTS).matchAll(/\bstale_days\s+constant\s+integer\s*:=\s*(\d+)\s*;/gi)];
    expect(xp).toHaveLength(1);
    expect(Number(windows[0][1])).toBe(Number(xp[0][1]));

    expect(SQL.match(/interval\s+'\s*\d+\s*days?\s*'/gi) ?? []).toEqual([]);
  });
});
