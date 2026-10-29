// SV-21: the requests migration, checked as text. Claims and offers are written by readers, so who may write what is the point.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const FILE = "20261101120000_sv21_requests.sql";
const sql = () => readFileSync(`${DIR}/${FILE}`, "utf8");
const code = () => sql().replace(/--[^\n]*/g, "");

describe("the SV-21 migration", () => {
  it("steps after the newest migration before it", () => {
    const earlier = readdirSync(DIR).filter((name) => name !== FILE && name < "20261101").sort();
    expect(FILE > earlier[earlier.length - 1]).toBe(true);
  });

  it("adds the four bounty columns only if missing, with the checks that tie them together", () => {
    const text = code();
    for (const column of ["problem", "from_run_id", "size", "target_key"]) expect(text).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${column} `));
    expect(text).toMatch(/size IS NULL AND target_key IS NULL/);
    expect(text).toMatch(/size IN \('session', 'part'\) AND target_key IS NOT NULL AND gap_node_id IS NULL/);
    expect(text).toMatch(/uniq_bounties_from_run[\s\S]*WHERE from_run_id IS NOT NULL/);
    expect(text).toMatch(/uniq_bounties_open_target[\s\S]*status = 'open'/);
  });

  it("keys a claim by its request, so there is one at a time, and lets the claimer change only the fork", () => {
    const text = code();
    expect(text).toMatch(/request_id\s+uuid\s+PRIMARY KEY REFERENCES public\.bounties\(id\) ON DELETE CASCADE/);
    expect(text).toMatch(/GRANT INSERT \(request_id, user_id, fork_build_id\) ON public\.request_claims TO authenticated/);
    expect(text).toMatch(/GRANT UPDATE \(fork_build_id\) ON public\.request_claims TO authenticated/);
    expect(text).not.toMatch(/GRANT UPDATE \([^)]*expires_at/);
    expect(text).toMatch(/interval '3 days'/);
  });

  it("lets a claim be taken over only once it has run out", () => {
    expect(code()).toMatch(/FOR DELETE[\s\S]*USING \(user_id = \(select auth\.uid\(\)\) OR expires_at <= now\(\)\)/);
  });

  it("gives an offer to the offerer and the request's maker alone, and its decision to the maker alone", () => {
    const text = code();
    expect(text).toMatch(/GRANT UPDATE \(status, decided_at\) ON public\.request_offers TO authenticated/);
    expect(text).toMatch(/FOR SELECT[\s\S]*user_id = \(select auth\.uid\(\)\)\s+OR EXISTS[\s\S]*b\.author_id = \(select auth\.uid\(\)\)/);
    expect(text).toMatch(/FOR UPDATE[\s\S]*b\.author_id = \(select auth\.uid\(\)\)/);
    expect(text).not.toMatch(/GRANT [^;]*request_offers TO anon/);
  });

  it("never reads a bare auth.uid() in a policy", () => {
    expect(code().replace(/\(select auth\.uid\(\)\)/g, "")).not.toMatch(/auth\.uid\(\)/);
  });

  it("pins search_path on every function and revokes execute from PUBLIC, anon and authenticated on the SECURITY DEFINER one", () => {
    const text = code();
    const functions = text.match(/CREATE OR REPLACE FUNCTION public\.\w+/g) ?? [];
    expect(functions).toHaveLength(2);
    expect((text.match(/SET search_path = ''/g) ?? []).length).toBe(functions.length);
    for (const name of functions.map((f) => f.split(".")[1])) {
      expect(text).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\(\\)\\s+FROM PUBLIC, anon, authenticated`));
    }
    expect(text).toMatch(/SECURITY DEFINER\s+SET search_path = ''/);
  });

  it("carries the plans to run, and has no em dash", () => {
    expect((sql().match(/EXPLAIN \(ANALYZE, BUFFERS\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(sql()).not.toContain("—");
  });
});
