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
