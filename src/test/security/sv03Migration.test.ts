// SV-03 P8: the one migration for the speed work, read as text: the missing index, the policies that run their auth call
// once per row, and the plans to run once it is applied.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261025130000_sv03_indexes_and_policies.sql";
const sql = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => sql().replace(/--[^\n]*/g, "");

describe("the SV-03 migration", () => {
  /* It was the newest when SV-03 wrote it; later prompts add migrations after it (SV-22 to SV-24), so what lasts is that
     its timestamp is its own and orders it against every other migration. */
  it("has a timestamp of its own, so it runs in a defined place among the others", () => {
    const stamp = FILE.slice(0, 14);
    const others = readdirSync(DIR).filter((name) => name !== FILE && name.endsWith(".sql"));
    expect(others.filter((name) => name.startsWith(stamp))).toEqual([]);
    expect(FILE).toMatch(/^\d{14}_/);
  });

  it("adds the drafts index, only if it is missing, and does not add the two that already exist", () => {
    expect(code()).toMatch(/CREATE INDEX IF NOT EXISTS idx_builds_creator_status_updated\s+ON public\.builds \(creator_id, status, updated_at DESC\)/);
    expect(code()).not.toMatch(/idx_build_saves_user_created/);
    expect(code()).not.toMatch(/build_sessions_build_position_key/);
    expect(sql()).toMatch(/already exists as idx_build_saves_user_created/i);
  });

  it("wraps the auth call of every policy that has it bare, from the live catalogue, and leaves the logic alone", () => {
    expect(code()).toMatch(/FROM pg_policies/);
    expect(code()).toMatch(/ALTER POLICY/);
    expect(code()).toMatch(/\(select auth\.uid\(\)\)/);
    expect(code()).toMatch(/\(select auth\.jwt\(\)\)/);
    expect(code()).not.toMatch(/DROP POLICY|CREATE POLICY/);
  });

  it("carries the plan to run for the Drafts read, the Saved read and the Gallery list, and what each should show", () => {
    const text = sql();
    expect((text.match(/EXPLAIN \(ANALYZE, BUFFERS\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(text).toMatch(/idx_builds_creator_status_updated/);
    expect(text).toMatch(/idx_build_saves_user_created/);
    expect(text).toMatch(/no sequential scan on public\.builds/i);
  });

  it("has no em dash", () => {
    expect(sql()).not.toContain("\u2014");
  });
});
