// CA-29 Part 1. update-user-password took a user id and a password from the body
// and set that user's password with the service key, with no login check. Nothing
// called it. A password change goes through supabase.auth.updateUser on the
// signed-in reader's own session (src/lib/auth/passwordReset.ts), so the function
// does not come back.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FUNCTIONS = join("supabase", "functions");

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe("CA-29 P1: no function sets another user's password", () => {
  it("has no update-user-password folder", () => {
    expect(existsSync(join(FUNCTIONS, "update-user-password"))).toBe(false);
  });

  it("calls auth.admin.updateUserById nowhere in supabase/functions", () => {
    const callers = filesUnder(FUNCTIONS)
      .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes("updateUserById"));
    expect(callers).toEqual([]);
  });

  it("changes a password only through the reader's own session", () => {
    const source = readFileSync(join("src", "lib", "auth", "passwordReset.ts"), "utf8");
    expect(source).toContain("supabase.auth.updateUser({ password })");
  });
});
