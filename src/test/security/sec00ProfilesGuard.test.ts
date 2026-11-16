// Security step 0. The behaviour is proven by supabase/tests/sec-00-profiles-guard.sql against a database; this holds
// the migration and the admin page to their shape, so a later edit cannot quietly undo them.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILE = readdirSync("supabase/migrations").find((name) => name.endsWith("_sec00_profiles_guard.sql"));
const SQL = FILE ? readFileSync(`supabase/migrations/${FILE}`, "utf8") : "";
const ADMIN = readFileSync("src/pages/Admin.tsx", "utf8");

describe("step 0: a member cannot raise their own privileges", () => {
  it("has its migration", () => {
    expect(FILE).toBeTruthy();
  });

  it("guards is_admin, is_curator and is_creator for anon and authenticated only, by current_user, as SECURITY INVOKER", () => {
    const fn = SQL.slice(SQL.indexOf("FUNCTION public.profiles_lock_privileged_flags"), SQL.indexOf("END $$;", SQL.indexOf("FUNCTION public.profiles_lock_privileged_flags")));
    expect(fn).toContain("SECURITY INVOKER");
    expect(fn).toMatch(/current_user NOT IN \('anon', 'authenticated'\)/);
    for (const flag of ["is_admin", "is_curator", "is_creator"]) {
      expect(fn).toContain(`NEW.${flag} := false`);
      expect(fn).toContain(`NEW.${flag} IS DISTINCT FROM OLD.${flag}`);
    }
  });

  it("installs a BEFORE UPDATE and a BEFORE INSERT trigger, re-pointable on a second run", () => {
    expect(SQL).toMatch(/CREATE OR REPLACE TRIGGER profiles_lock_privileged_flags_update\s+BEFORE UPDATE ON public\.profiles/);
    expect(SQL).toMatch(/CREATE OR REPLACE TRIGGER profiles_lock_privileged_flags_insert\s+BEFORE INSERT ON public\.profiles/);
  });

  it("adds WITH CHECK to the own-row update policy, found by name", () => {
    expect(SQL).toMatch(/polname = 'Users can update their own profile'/);
    expect(SQL).toMatch(/WITH CHECK \(\(SELECT auth\.uid\(\)\) = id\)/);
  });

  it("leaves the live profiles_guard_privileged trigger alone", () => {
    expect(SQL).not.toMatch(/(CREATE|ALTER|DROP)[^;]*TRIGGER\s+profiles_guard_privileged\b/i);
    expect(SQL).not.toMatch(/FUNCTION\s+public\.profiles_guard_privileged\b/i);
  });

  it("makes admin_audit append-only: no grant but SELECT, and a trigger on update, delete and truncate", () => {
    expect(SQL).toMatch(/REVOKE ALL ON TABLE public\.admin_audit FROM PUBLIC, anon, authenticated, service_role/);
    expect(SQL).not.toMatch(/GRANT\s+(?!SELECT ON TABLE public\.admin_audit)[^;]*admin_audit/i);
    expect(SQL).toMatch(/BEFORE UPDATE OR DELETE ON public\.admin_audit/);
    expect(SQL).toMatch(/BEFORE TRUNCATE ON public\.admin_audit/);
  });

  it("admin_set_curator checks is_admin from the token and writes an audit row", () => {
    const fn = SQL.slice(SQL.indexOf("FUNCTION public.admin_set_curator"));
    expect(fn).toContain("SECURITY DEFINER");
    expect(fn).toContain("SET search_path = public, pg_temp");
    expect(fn).toMatch(/_caller uuid := auth\.uid\(\)/);
    expect(fn).toMatch(/NOT public\.is_admin\(_caller\)/);
    expect(fn).toContain("INSERT INTO public.admin_audit");
    expect(SQL).toMatch(/REVOKE EXECUTE ON FUNCTION public\.admin_set_curator\(uuid, boolean\) FROM PUBLIC, anon/);
  });

  it("drops nothing", () => {
    expect(SQL).not.toMatch(/\bDROP\s+(FUNCTION|TABLE|POLICY|SCHEMA|TRIGGER|COLUMN)\b/i);
  });

  it("the admin page changes the curator flag only through admin_set_curator", () => {
    expect(ADMIN).not.toMatch(/from\("profiles"\)\.update\(\{[^}]*is_curator/);
    expect(ADMIN.match(/adminSetCurator\(/g)?.length).toBe(2);
    expect(readFileSync("src/lib/auth/adminSetCurator.ts", "utf8")).toMatch(/rpc\("admin_set_curator"/);
  });
});
