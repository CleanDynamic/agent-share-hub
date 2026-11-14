// G1. The repo has no SQL tests, so this holds the migration to what it promises by reading it. The live check
// (anon refused, service_role allowed) is in docs/security/auth-settings.md, to run after the migration is applied.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILE = readdirSync("supabase/migrations").find((name) => name.endsWith("_auth_hardening.sql"));
const SQL = FILE ? readFileSync(`supabase/migrations/${FILE}`, "utf8") : "";

describe("G1: the auth hardening migration takes get_email_by_username from everyone but service_role", () => {
  it("exists, after every earlier migration", () => {
    expect(FILE).toBeTruthy();
    const all = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(all.at(-1)).toBe(FILE);
  });

  it("finds every overload in the catalogue by name, so a database without it is skipped", () => {
    expect(SQL).toMatch(/FROM pg_proc p[\s\S]*p\.proname = 'get_email_by_username'/);
    expect(SQL).toContain("oid::regprocedure");
  });

  it("revokes EXECUTE from PUBLIC, anon and authenticated, and grants it to service_role only", () => {
    expect(SQL).toMatch(/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION %s TO service_role/);
    expect(SQL).not.toMatch(/GRANT[^;]*get_email_by_username[^;]*\b(anon|authenticated|PUBLIC)\b/i);
  });

  it("drops nothing, and does not redefine the function", () => {
    expect(SQL).not.toMatch(/\bDROP\s+(FUNCTION|TABLE|POLICY|SCHEMA)\b/i);
    expect(SQL).not.toMatch(/CREATE OR REPLACE FUNCTION[^;(]*get_email_by_username/i);
  });
});

describe("G4: the browser never calls get_email_by_username", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(`${dir}/${entry.name}`) : /\.(ts|tsx)$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
    );

  it("has no rpc call to it anywhere in src", () => {
    const callers = files("src").filter((file) => /rpc\(\s*["'`]get_email_by_username/.test(readFileSync(file, "utf8")));
    expect(callers).toEqual([]);
  });
});

describe("G10: the per-IP limit's table and function, in the same migration", () => {
  const code = SQL.replace(/--[^\n]*/g, "");

  it("keeps hits per bucket and window, with an expiry, and an index to clear expired rows by", () => {
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.edge_rate_limits/);
    expect(code).toMatch(/PRIMARY KEY \(bucket, window_start\)/);
    expect(code).toMatch(/expires_at timestamptz NOT NULL/);
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS edge_rate_limits_expires_at/);
  });

  it("is service role only: RLS on with no policy, and nothing granted to PUBLIC, anon or authenticated", () => {
    expect(code).toMatch(/ALTER TABLE public\.edge_rate_limits ENABLE ROW LEVEL SECURITY/);
    expect(code).not.toMatch(/CREATE POLICY/i);
    expect(code).toMatch(/REVOKE ALL ON TABLE public\.edge_rate_limits FROM PUBLIC, anon, authenticated/);
    expect(code).toMatch(/REVOKE EXECUTE ON FUNCTION public\.edge_rate_limit_hit\(text, integer, integer\) FROM PUBLIC, anon, authenticated/);
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.edge_rate_limit_hit\(text, integer, integer\) TO service_role/);
  });

  it("counts atomically, checks its arguments, and deletes expired rows", () => {
    expect(code).toMatch(/ON CONFLICT \(bucket, window_start\) DO UPDATE SET hits = r\.hits \+ 1/);
    expect(code).toMatch(/RAISE EXCEPTION/);
    expect(code).toMatch(/DELETE FROM public\.edge_rate_limits WHERE expires_at < now\(\)/);
    expect(code).toMatch(/SECURITY INVOKER/);
  });
});

describe("G11: no screen says an address already has an account", () => {
  const signin = readdirSync("src/pages/site/signin").filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name));
  const sources = [...signin.map((name) => `src/pages/site/signin/${name}`), "src/lib/auth/signUpWithEmail.ts"].map((file) => readFileSync(file, "utf8"));

  it.each(["An account with this email already exists", "That email is already registered"])("has no %j", (text) => {
    for (const source of sources) expect(source).not.toContain(text);
  });
});
