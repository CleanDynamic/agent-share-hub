// CA-29 Part 6. Who can execute a SECURITY DEFINER function in public.
//
// The repository runs its SQL tests by hand (supabase/tests/*.sql, with psql), so
// this holds the migration file to what it promises, and
// supabase/tests/ca29-function-access.sql carries the signed out / wrong owner /
// owner checks to run after it is applied.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join("supabase", "migrations");
const NAME = readdirSync(DIR).find((file) => file.endsWith("_ca29_function_access.sql"));
const sql = NAME ? readFileSync(join(DIR, NAME), "utf8") : "";
// Comments out, so a promise in a header does not stand in for a statement.
const statements = sql.replace(/--.*$/gm, "");

const SIGNED_IN_ONLY = [
  "claim_challenge",
  "get_quest_state",
  "mark_depth_revealed",
  "mark_welcome_xp_shown",
  "record_daily_activity",
  "resolve_report",
  "respec_track",
  "set_user_track",
  "soft_delete_primitive_comment",
];

describe("CA-29 P6: function access migration", () => {
  it("is one file, named for the prompt, after the newest migration", () => {
    expect(NAME).toMatch(/^\d{14}_ca29_function_access\.sql$/);
    const others = readdirSync(DIR).filter((file) => file !== NAME && /^\d{14}_/.test(file)).sort();
    expect(NAME! > others[others.length - 1]).toBe(true);
    expect(readdirSync(DIR).filter((file) => file.includes("ca29"))).toHaveLength(1);
  });

  it("leaves the signed-in-only functions to authenticated and the server", () => {
    for (const name of SIGNED_IN_ONLY) expect(statements, name).toContain(`'${name}'`);
    expect(statements).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.%I\(%s\)\s+FROM\s+PUBLIC,\s*anon/i);
    expect(statements).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.%I\(%s\)\s+TO\s+authenticated/i);
  });

  it("keeps get_visible_surfaces readable by anyone, because a signed-out reader sees a profile", () => {
    expect(statements).not.toContain("get_visible_surfaces");
  });

  it("makes get_quest_state answer only its own caller", () => {
    const replaced = /CREATE OR REPLACE FUNCTION public\.get_quest_state[\s\S]*?\$\$;/i.exec(statements)?.[0] ?? "";
    expect(replaced).toMatch(/SECURITY DEFINER SET search_path = public/);
    expect(replaced).toMatch(/_user_id IS NOT NULL AND _user_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(replaced).toMatch(/RAISE EXCEPTION/);
  });

  it("revokes the API roles from the trigger functions and sets search_path where it is missing", () => {
    expect(statements).toMatch(/prorettype\s*=\s*'trigger'::regtype/);
    expect(statements).toMatch(/prosecdef/);
    expect(statements).toMatch(/proconfig/);
    expect(statements).toMatch(/SET search_path = public/);
  });

  it("reads the catalogue, not the repository, for what exists", () => {
    expect(statements).toMatch(/FROM pg_proc/);
    expect(statements).toMatch(/pg_get_function_identity_arguments/);
  });

  it("only takes access away, apart from handing authenticated back what it keeps", () => {
    expect(statements).not.toMatch(/\bDROP\b/i);
    for (const grant of statements.match(/\bGRANT\b[^;]*;/g) ?? []) {
      expect(grant.slice(grant.search(/\bTO\b/))).toMatch(/^TO authenticated\b/);
    }
    // Already closed by RC-P25 and the RC notification and badge migrations.
    expect(statements).not.toMatch(/award_xp|rc_grant_xp|rc_award_badge|rc_notify\b/);
  });

  it("stops and rolls back when a role can still execute what it closed", () => {
    expect(statements).toMatch(/has_function_privilege/);
    expect(statements).toMatch(/RAISE EXCEPTION\s+'CA-29/);
  });

  it("has a psql check for each function it changed: signed out, wrong owner, owner", () => {
    const check = readFileSync(join("supabase", "tests", "ca29-function-access.sql"), "utf8");
    for (const name of SIGNED_IN_ONLY) expect(check, name).toContain(`'${name}'`);
    expect(check).toMatch(/get_quest_state\(current_setting\('ca29\.user_b_id'\)::uuid\)/);
    expect(check).toMatch(/SET LOCAL ROLE anon/);
    expect(check).toMatch(/SET LOCAL ROLE authenticated/);
    expect(check).toMatch(/ROLLBACK;\s*$/);
  });
});
