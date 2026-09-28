// Decisions the RC series made that must not be quietly undone.
//
// RC-P03 deleted the four seed edge functions: seed-demo-data, seed-ecosystem,
// seed-new-posts and update-seed-data. They wrote with the service-role key and
// no guard of their own, and any of them could refill content_items after the
// legacy clear. A seeder folder that comes back is one deploy from being live
// again, and a screen that calls one is a button that refills the clear.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SEED_FUNCTIONS = ["seed-demo-data", "seed-ecosystem", "seed-new-posts", "update-seed-data"];
const SEED_CALLS = ["/functions/v1/seed-", "/functions/v1/update-seed-data"];
const THIS_FILE = join("src", "lib", "rcGuards.test.ts");

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
});
