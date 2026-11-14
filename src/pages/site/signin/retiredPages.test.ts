// G15: the full pages for sign in, join, reset and verify are gone, and nothing imports them.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RETIRED = ["LoginPage", "SignupPage", "ResetPasswordPage", "VerifyEmailPage", "SignInShell", "SignInView", "SignInRoutes"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("the retired sign-in pages", () => {
  it.each(RETIRED)("%s has no file", (name) => {
    expect(existsSync(`src/pages/site/signin/${name}.tsx`)).toBe(false);
  });

  it("are imported by nothing", () => {
    const pattern = new RegExp(`from ["'][^"']*/(${RETIRED.join("|")})["']`);
    const importers = walk("src").filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(importers).toEqual([]);
  });
});
