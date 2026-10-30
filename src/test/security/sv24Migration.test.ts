// SV-24 P1: the filter sets migration, read as text: who reads and writes a set, that a Group is a public set and not a guild, and the
// plans to run once it is applied.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261104120000_sv24_filter_sets.sql";
const sql = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => sql().replace(/--[^\n]*/g, "");

describe("the SV-24 migration", () => {
  it("steps after the newest migration that was there when it was written (SV-23's)", () => {
    expect(FILE > "20261103130000_sv23_proof_filters.sql").toBe(true);
    expect(readdirSync(DIR)).toContain(FILE);
  });

  it("makes filter_sets with the columns the prompt names, and members for a Group", () => {
    const text = code();
    for (const column of ["id", "user_id", "name", "query", "is_public", "created_at"]) expect(text).toMatch(new RegExp(`\\b${column}\\b`));
    expect(text).toMatch(/query\s+jsonb\s+NOT NULL/);
    expect(text).toMatch(/CREATE TABLE IF NOT EXISTS public\.filter_set_members[\s\S]*PRIMARY KEY \(filter_set_id, user_id\)/);
  });

  it("lets the owner write a set, anyone read a public one, and a reader write only their own membership", () => {
    const text = code();
    expect(text).toMatch(/ON public\.filter_sets FOR SELECT\s+TO anon, authenticated\s+USING \(is_public OR user_id = \(select auth\.uid\(\)\)\)/);
    for (const command of ["INSERT", "UPDATE", "DELETE"]) expect(text).toMatch(new RegExp(`ON public\\.filter_sets FOR ${command}\\s+TO authenticated`));
    for (const command of ["SELECT", "INSERT", "DELETE"]) expect(text).toMatch(new RegExp(`ON public\\.filter_set_members FOR ${command}`));
    expect(text).not.toMatch(/ON public\.filter_set_members FOR UPDATE/);
    expect(text).not.toMatch(/(?<!select )auth\.uid\(\)/);
    expect(text).toMatch(/WITH CHECK \(\s*user_id = \(select auth\.uid\(\)\)\s+AND EXISTS/);
  });

  it("grants explicitly, before the policies, and gives anon nothing but SELECT", () => {
    const text = code();
    expect(text).toMatch(/REVOKE ALL ON public\.filter_sets FROM anon, authenticated, service_role;/);
    expect(text).toMatch(/GRANT SELECT ON public\.filter_sets TO anon;/);
    expect(text).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.filter_sets TO authenticated;/);
    expect(text).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.filter_set_members TO authenticated;/);
    expect(text).not.toMatch(/GRANT [A-Z, ]*(INSERT|UPDATE|DELETE)[A-Z, ]* ON public\.filter_set[a-z_]* TO anon/);
    const firstPolicy = text.indexOf("CREATE POLICY");
    expect(text.lastIndexOf("GRANT", firstPolicy)).toBeGreaterThan(0);
    expect(text.indexOf("GRANT ALL ON public.filter_set_members TO service_role")).toBeLessThan(firstPolicy);
  });

  it("leaves the guild tables alone", () => {
    expect(code()).not.toMatch(/guild/i);
  });

  it("makes the Groups read invoker's, with a fixed search_path and no execute for PUBLIC", () => {
    const text = code();
    expect(text).toMatch(/FUNCTION public\.list_filter_set_groups\(p_limit integer DEFAULT 20\)/);
    expect(text).toMatch(/SECURITY INVOKER\s+SET search_path = public/);
    expect(text).not.toMatch(/SECURITY DEFINER/);
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.list_filter_set_groups\(integer\) FROM PUBLIC;/);
    expect(text).toMatch(/LIMIT greatest\(1, least\(coalesce\(p_limit, 20\), 50\)\)/);
  });

  it("writes the plans to run in its header, with what each should show", () => {
    const header = sql().split("CREATE TABLE")[0];
    expect(header).toMatch(/EXPLAIN \(ANALYZE, BUFFERS\)/g);
    expect(header.match(/SHOULD SHOW/g)?.length).toBeGreaterThanOrEqual(3);
    expect(header).toMatch(/idx_filter_sets_user_created/);
    expect(header).toMatch(/idx_filter_set_members_user/);
  });
});
