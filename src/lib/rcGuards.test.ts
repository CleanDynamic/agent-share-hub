// Decisions the RC series made that must not be quietly undone.
//
// RC-P03 deleted the four seed edge functions: seed-demo-data, seed-ecosystem,
// seed-new-posts and update-seed-data. They wrote with the service-role key and
// no guard of their own, and any of them could refill content_items after the
// legacy clear. A seeder folder that comes back is one deploy from being live
// again, and a screen that calls one is a button that refills the clear.
//
// RC-P02 also ships a migration that runs against the live database, and it
// made a promise a later edit could break without any test noticing: the
// backup writes nothing in public and opens nothing to the API roles. This
// reads the file and holds it to that.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SEED_FUNCTIONS = ["seed-demo-data", "seed-ecosystem", "seed-new-posts", "update-seed-data"];
const SEED_CALLS = ["/functions/v1/seed-", "/functions/v1/update-seed-data"];
const THIS_FILE = join("src", "lib", "rcGuards.test.ts");

const MIGRATIONS = join("supabase", "migrations");
const BACKUP = join(MIGRATIONS, "20261001120000_rc_backup_legacy.sql");

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
});
