// SV-01 Part 6. The repo has no SQL tests, so this holds the migration to what it
// promises by reading it. The behaviour (signed out refused, wrong owner
// refused, owner allowed) is the check list in the SV-01 report, to run against
// the database after the migration is applied.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("supabase/migrations/20261025120000_sv01_function_access.sql", "utf8");

describe("SV-01 P6: sv01_function_access migration", () => {
  it("refuses another reader's id in the two progress reads", () => {
    for (const fn of ["get_quest_state", "get_visible_surfaces"]) {
      const body = SQL.slice(SQL.indexOf(`public.${fn}(`), SQL.indexOf("END $$;", SQL.indexOf(`public.${fn}(`)));
      expect(body, fn).toContain("_user_id IS DISTINCT FROM auth.uid()");
      expect(body.indexOf("RAISE EXCEPTION"), fn).toBeLessThan(body.indexOf("INSERT INTO public.user_progress"));
    }
  });

  it("filters lineage to what the reader may see, on the root and on every child", () => {
    const body = SQL.slice(SQL.indexOf("public.get_post_lineage"));
    expect(body.match(/sv01_lineage_visible\(ci\.status/g)).toHaveLength(2);
  });

  it("takes rc_notify from everybody, and anon from the signed-in-only functions", () => {
    expect(SQL).toMatch(/p\.proname = 'rc_notify'[\s\S]*REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    expect(SQL).toMatch(/'mark_welcome_xp_shown'[\s\S]*REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon/);
  });

  it("finds functions in the catalogue, so a function the live database lacks is skipped", () => {
    expect(SQL).toContain("FROM pg_proc p");
    expect(SQL).not.toMatch(/REVOKE EXECUTE ON FUNCTION public\.(?!sv01_)/);
  });

  it("sets a search_path on definer functions that have none, and drops nothing", () => {
    expect(SQL).toContain("SET search_path = public, extensions");
    expect(SQL).not.toMatch(/\bDROP\b/i);
  });

  it("leaves get_email_by_username and the counters alone", () => {
    expect(SQL).not.toMatch(/(REVOKE|GRANT|CREATE OR REPLACE)[^;]*get_email_by_username/);
    expect(SQL).not.toMatch(/(REVOKE|GRANT|CREATE OR REPLACE)[^;]*increment_/);
  });
});
