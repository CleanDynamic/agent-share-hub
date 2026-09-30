// Decisions the RC series made that must not be quietly undone.
//
// RC-P03 deleted the four seed edge functions: seed-demo-data, seed-ecosystem,
// seed-new-posts and update-seed-data. They wrote with the service-role key and
// no guard of their own, and any of them could refill content_items after the
// legacy clear. A seeder folder that comes back is one deploy from being live
// again, and a screen that calls one is a button that refills the clear.
//
// RC-P02, RC-P03 and RC-P04 also ship three migrations that run against the
// live database, and each made promises a later edit could break without any
// test noticing: the backup writes nothing in public, the clear is one guarded
// block that drops nothing and leaves storage alone, and the rotation carries
// no password. These read the files and hold them to that.
//
// RC-P08 sent every new-build control to the composer. The old type picker
// asked "Blueprint, Blog or Bounty?" before anything existed, and what it made
// would refill content_items after the clear. Until RC-P08b deletes it, the
// picker may be opened only from its own files, the legacy /upload page and
// the frozen legacy-bounty code; anywhere else, a call to it is a regression.
//
// RC-P25 closed the XP hole. award_xp let any signed-in reader write XP to
// themselves, so it is now executable by no client role, and XP is written only
// by rc_grant_xp, which only the database's own triggers can call. The two
// migrations that do this make promises a later edit could break quietly: the
// SQL carries its own copy of the stale window, which must stay equal to
// STALE_AFTER_DAYS, and nothing they create may be executable by anon or
// authenticated.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SEED_FUNCTIONS = ["seed-demo-data", "seed-ecosystem", "seed-new-posts", "update-seed-data"];
const SEED_CALLS = ["/functions/v1/seed-", "/functions/v1/update-seed-data"];
const THIS_FILE = join("src", "lib", "rcGuards.test.ts");

const MIGRATIONS = join("supabase", "migrations");
const BACKUP = join(MIGRATIONS, "20261001120000_rc_backup_legacy.sql");
const ROTATION = join(MIGRATIONS, "20261001123000_rc_rotate_demo_passwords.sql");
const CLEAR = join(MIGRATIONS, "20261001130000_rc_clear_legacy_posts.sql");
const XP_CLOSE = join(MIGRATIONS, "20261001230000_rc_xp_close.sql");
const XP_EVENTS = join(MIGRATIONS, "20261001240000_rc_xp_build_events.sql");
const SIGNALS = join("src", "lib", "build", "signals.ts");

/** The only files that may still open the type picker, until RC-P08b removes it. */
const PICKER_FILES = [
  join("src", "contexts", "UploadPickerContext.tsx"),
  join("src", "components", "upload", "UploadTypePicker.tsx"),
  join("src", "pages", "UploadTypeSelector.tsx"),
];
const BOUNTY_LEGACY = join("src", "lib", "bounty-legacy") + sep;

/** A migration's SQL with its comments removed, so prose about a statement is not taken for one. */
function statements(file: string): string {
  return readFileSync(file, "utf8").replace(/--[^\n]*/g, "");
}

/** Every .ts and .tsx file under a folder, as a path from the repository root. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("RC decisions", () => {
  it("the seed edge functions cannot be redeployed from this repository", () => {
    const present = SEED_FUNCTIONS.filter((name) => existsSync(join("supabase", "functions", name)));
    expect(present).toEqual([]);
  });

  it("no screen can call a seed function", () => {
    const callers = sourceFiles("src")
      .filter((file) => file !== THIS_FILE)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return SEED_CALLS.some((call) => source.includes(call));
      });
    expect(callers).toEqual([]);
  });

  it("the legacy backup writes nothing in public and opens nothing to the API roles", () => {
    const sql = statements(BACKUP);
    expect(sql.match(/\binsert\s+into\s+(?!rc_backup\.)\S+/gi) ?? []).toEqual([]);
    expect(sql.match(/\b(update|delete\s+from|truncate|alter\s+table|drop\s+(table|schema|column))\b/gi) ?? []).toEqual([]);
    expect(sql.match(/\bgrant\b/gi) ?? []).toEqual([]);
  });

  it("the legacy clear is one guarded block that drops nothing and never touches storage", () => {
    const sql = statements(CLEAR);
    expect(sql.match(/\bdo\s+\$\$/gi) ?? []).toHaveLength(1);
    expect(sql.trim().endsWith("END $$;")).toBe(true);
    expect(sql.match(/\bdrop\s+(table|schema|column|index|view|function|trigger|policy|type)\b/gi) ?? []).toEqual([]);
    expect(sql.match(/\bstorage\./gi) ?? []).toEqual([]);
    expect(sql.match(/(^|;)\s*(commit|rollback)\s*;/gim) ?? []).toEqual([]);
    expect(sql.match(/\bgrant\b/gi) ?? []).toEqual([]);
    expect(sql.match(/raise\s+exception\s+'RC-P04:/gi)?.length ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("the demo password rotation generates passwords rather than carrying one", () => {
    const sql = statements(ROTATION);
    expect(sql).toContain("gen_random_bytes");
    expect(sql.match(/crypt\(\s*'/gi) ?? []).toEqual([]);
  });

  it("no new-build control opens a type picker", () => {
    const openers = sourceFiles("src")
      .filter((file) => !PICKER_FILES.includes(file))
      .filter((file) => !file.startsWith(BOUNTY_LEGACY))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes("openUploadTypePicker("));
    expect(openers).toEqual([]);
  });

  it("none of the three calls auth.uid() bare", () => {
    for (const file of [BACKUP, ROTATION, CLEAR]) {
      expect(statements(file).match(/(?<!select\s)auth\.uid\(\)/gi) ?? [], file).toEqual([]);
    }
  });

  // RC-P16b: a shared link and a search result are most people's first sight
  // of the site, and they said neoscaleai.com and @neoscaleai.
  it("index.html and SeoHead name buildgallery, not neoscaleai.com", () => {
    const html = readFileSync("index.html", "utf8");
    const seoHead = readFileSync(join("src", "components", "SeoHead.tsx"), "utf8");
    for (const [name, text] of [["index.html", html], ["SeoHead.tsx", seoHead]] as const) {
      expect(text.match(/neoscale/gi) ?? [], name).toEqual([]);
    }
    expect(html).toContain('<meta property="og:site_name" content="buildgallery" />');
    expect(html).not.toContain("twitter:site");
    expect(seoHead).toContain('"https://buildgallery.ai"');
    expect(seoHead).toContain('const SITE_NAME = "buildgallery";');
  });

  // RC-P25: "stale" is decided in SQL as well as in signals.ts, because the
  // database has to know when a re-confirmation is worth XP. Two numbers for one
  // fact drift apart without anyone noticing, so this reads both.
  it("the stale window in the XP migration equals STALE_AFTER_DAYS", () => {
    const declared = /export const STALE_AFTER_DAYS\s*=\s*(\d+)\s*;/.exec(readFileSync(SIGNALS, "utf8"));
    expect(declared, "STALE_AFTER_DAYS is declared in signals.ts").not.toBeNull();

    expect(readFileSync(XP_EVENTS, "utf8")).toContain("STALE_AFTER_DAYS in src/lib/build/signals.ts");

    // Read without comments, so a comment quoting a number cannot stand in for the code.
    const sql = statements(XP_EVENTS);
    const windows = [...sql.matchAll(/\bstale_days\s+constant\s+integer\s*:=\s*(\d+)\s*;/gi)];
    expect(windows).toHaveLength(1);
    expect(Number(windows[0][1])).toBe(Number(declared?.[1]));

    // The window is written once. A literal interval would be a second, unchecked copy.
    expect(sql.match(/interval\s+'\s*\d+\s*days?\s*'/gi) ?? []).toEqual([]);
  });

  it("the XP migrations leave award_xp and rc_grant_xp executable by no client role", () => {
    const close = statements(XP_CLOSE);
    expect(close).toMatch(/proname\s*=\s*'award_xp'/);
    expect(close).toMatch(/revoke\s+execute\s+on\s+function\s+public\.%I\(%s\)\s+from\s+public,\s*anon,\s*authenticated/i);

    // Every function the earning migration creates, the writer and the four triggers, is revoked.
    const earn = statements(XP_EVENTS);
    const created = [...earn.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)].map((match) => match[1]);
    expect(created).toContain("rc_grant_xp");
    expect(created).toHaveLength(5);
    for (const name of created) {
      const revoke = new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.${name}\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`, "i");
      expect(earn, name).toMatch(revoke);
    }

    // Neither file opens anything to anybody.
    for (const sql of [close, earn]) {
      expect(sql.match(/\bgrant\b/gi) ?? []).toEqual([]);
    }
  });

  // RC-P25: a screen that names either function is asking for a call the database
  // refuses, or is a reason someone reopens the door. types.ts is generated from the
  // live schema, so it lists every function and calls none of them.
  it("no client code calls award_xp or rc_grant_xp", () => {
    const GENERATED_TYPES = join("src", "integrations", "supabase", "types.ts");
    const files = sourceFiles("src");
    expect(files.length).toBeGreaterThan(100);

    const callers = files
      .filter((file) => file !== THIS_FILE && file !== GENERATED_TYPES)
      .filter((file) => /\b(?:award_xp|rc_grant_xp)\b/.test(readFileSync(file, "utf8")));
    expect(callers).toEqual([]);
  });
});
