// SV-21 P1: a request from a failed run.

import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
let tables: Record<string, { data: unknown; error?: unknown }> = {};
let insertError: unknown = null;

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) self[method] = () => self;
  self.maybeSingle = () => Promise.resolve({ data: tables[table]?.data ?? null, error: tables[table]?.error ?? null });
  self.insert = (row: Record<string, unknown>) => {
    inserted.push(row);
    return { select: () => ({ single: () => Promise.resolve(insertError ? { data: null, error: insertError } : { data: { id: "q1", ...row }, error: null }) }) };
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));

import { canOpenFromRun } from "@/lib/bounty/runRequestRules";
import { openRequestFromRun } from "@/lib/bounty/runRequests";

const failedRun = { id: "r1", build_id: "b1", worked: false, note: "  It stops at step 3.  " };

beforeEach(() => {
  inserted.length = 0;
  insertError = null;
  tables = { build_reproductions: { data: failedRun }, builds: { data: { id: "b1", creator_id: "maker" } } };
});

describe("canOpenFromRun", () => {
  it("is for the maker, on a run that did not work", () => {
    expect(canOpenFromRun({ worked: false }, "maker", "maker")).toBe(true);
    expect(canOpenFromRun({ worked: true }, "maker", "maker")).toBe(false);
    expect(canOpenFromRun({ worked: false }, "maker", "someone")).toBe(false);
    expect(canOpenFromRun({ worked: false }, "maker", null)).toBe(false);
  });
});

describe("openRequestFromRun", () => {
  it("opens a whole-build request with the run's note as the problem and the run linked", async () => {
    await openRequestFromRun({ runId: "r1", viewerId: "maker" });
    expect(inserted).toEqual([expect.objectContaining({ build_id: "b1", gap_node_id: null, author_id: "maker", problem: "It stops at step 3.", from_run_id: "r1" })]);
  });

  it("writes nothing for a run that worked", async () => {
    tables.build_reproductions = { data: { ...failedRun, worked: true } };
    await expect(openRequestFromRun({ runId: "r1", viewerId: "maker" })).rejects.toThrow("worked");
    expect(inserted).toEqual([]);
  });

  it("writes nothing for anyone but the build's maker", async () => {
    await expect(openRequestFromRun({ runId: "r1", viewerId: "reader" })).rejects.toThrow("Only the person who made the build");
    expect(inserted).toEqual([]);
  });

  it("says so when the run is gone", async () => {
    tables.build_reproductions = { data: null };
    await expect(openRequestFromRun({ runId: "r1", viewerId: "maker" })).rejects.toThrow("not there");
  });

  it("says the run already has a request, and that the update is not live yet", async () => {
    insertError = { code: "23505" };
    await expect(openRequestFromRun({ runId: "r1", viewerId: "maker" })).rejects.toThrow("already has a request");
    insertError = { code: "42703" };
    await expect(openRequestFromRun({ runId: "r1", viewerId: "maker" })).rejects.toThrow("not available yet");
  });
});
