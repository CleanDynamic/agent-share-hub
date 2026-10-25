// SV-01 Part 1. update-user-password took a user id and a password from the
// request body and set that user's password with the service key, behind a
// gateway that only asked for a valid key (the site's public key is one).
// Nothing called it. A folder that comes back is one deploy from being open
// again, so this holds the repository to its absence.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FUNCTIONS = join("supabase", "functions");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe("SV-01: no function sets a password for someone else", () => {
  it("has no update-user-password function", () => {
    expect(existsSync(join(FUNCTIONS, "update-user-password"))).toBe(false);
  });

  it("calls updateUserById nowhere in supabase/functions", () => {
    const offenders = sources(FUNCTIONS).filter((file) => readFileSync(file, "utf8").includes("updateUserById"));
    expect(offenders).toEqual([]);
  });

  it("is not called from src", () => {
    const here = join("src", "test", "security", "passwordFunction.test.ts");
    const offenders = sources("src").filter((file) => file !== here && readFileSync(file, "utf8").includes("update-user-password"));
    expect(offenders).toEqual([]);
  });
});
