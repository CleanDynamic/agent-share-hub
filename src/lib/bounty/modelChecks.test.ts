// SV-22 P2: model tests and the model release check.

import { beforeEach, describe, expect, it, vi } from "vitest";

let tables: Record<string, { data: unknown; error?: unknown }> = {};
let rpcResult: { data: unknown; error?: unknown } = { data: [] };
const inserted: unknown[] = [];
const proofs = vi.hoisted(() => vi.fn());

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lte", "gt", "in", "order", "limit", "range"]) self[method] = () => self;
  self.then = (resolve: (value: unknown) => unknown) => resolve({ data: tables[table]?.data ?? [], error: tables[table]?.error ?? null });
  self.insert = (row: unknown) => (inserted.push(row), Promise.resolve({ error: tables[table]?.error ?? null }));
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: rpcResult.data, error: rpcResult.error ?? null }) } }));
vi.mock("@/lib/build/signals", () => ({ getReproductionsByModel: (ids: string[]) => proofs(ids) }));

import { addModelRelease, getReleaseCheck, listModelTests } from "./modelChecks";
import { modelTestFor, releaseBars, releasedWords } from "./modelRules";

const proof = (modelId: string | null, modelName: string, runs: number, worked: number) => ({ modelId, modelName, runs, worked, lastConfirmedAt: null });
const releases = [
  { modelId: "opus-5-5", releasedOn: "2026-10-26" },
  { modelId: "sonnet-5-5", releasedOn: "2026-09-01" },
];

beforeEach(() => {
  tables = {};
  rpcResult = { data: [] };
  inserted.length = 0;
  proofs.mockReset();
});

describe("modelTestFor", () => {
  it("asks for the newest release the build has not been run on, then shows what it was run on", () => {
    const test = modelTestFor([proof("sonnet-5-5", "Sonnet 5.5", 6, 6), proof("gpt-5", "GPT-5", 3, 0)], releases);
    expect(test?.target).toBe("Opus 5.5");
    expect(test?.rows).toEqual([
      { model: "Opus 5.5", state: "untested" },
      { model: "Sonnet 5.5", state: "worked", runs: 6, worked: 6 },
      { model: "GPT-5", state: "failed", runs: 3, worked: 0 },
    ]);
  });

  it("is no request once every recent release has been run, and counts a model by its id, not its spelling", () => {
    expect(modelTestFor([proof("opus-5-5", "Opus 5.5", 1, 1), proof("sonnet-5-5", "Sonnet 5.5", 1, 0)], releases)).toBeNull();
  });
});

describe("the release check's words", () => {
  it("sizes a bar by what it is", () => {
    expect(releaseBars([{ s: "works", n: 1 }, { s: "works", n: 20 }, { s: "fails", n: 2 }, { s: "untested", n: 0 }]).map((bar) => bar.height)).toEqual([52, 100, 34, 22]);
  });

  it("says how long ago a model came out", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    expect(releasedWords("2026-10-29", now)).toBe("released today");
    expect(releasedWords("2026-10-26", now)).toBe("released 3 days ago");
    expect(releasedWords("2026-10-01", now)).toBe("released 4 weeks ago");
    expect(releasedWords("2026-03-03", now)).toBe("released 3 Mar");
  });
});

describe("getReleaseCheck", () => {
  it("is the one row the database answers, with the model named by the registry", async () => {
    rpcResult = { data: [{ model_id: "opus-5-5", released_on: "2026-10-26", works: 94, fails: 11, untested: 15, next_slug: "x", bars: [{ s: "works", n: 2 }] }] };
    await expect(getReleaseCheck()).resolves.toMatchObject({ modelName: "Opus 5.5", works: 94, total: 120, nextSlug: "x", bars: [{ s: "works", n: 2 }] });
  });

  it("is nothing while no model has a release, or before the function exists", async () => {
    await expect(getReleaseCheck()).resolves.toBeNull();
    rpcResult = { data: null, error: { code: "PGRST202" } };
    await expect(getReleaseCheck()).resolves.toBeNull();
  });

  it("throws any other failure", async () => {
    rpcResult = { data: null, error: { code: "XX000" } };
    await expect(getReleaseCheck()).rejects.toBeTruthy();
  });
});

describe("listModelTests", () => {
  it("keeps the builds a recent release has not been run on, with their proofs from one read", async () => {
    tables = {
      builds: { data: [{ id: "b1", slug: "a", title: "A", last_confirmed_at: null, creator: { username: "maya" } }, { id: "b2", slug: "b", title: "B", last_confirmed_at: null, creator: null }] },
      model_releases: { data: [{ model_id: "opus-5-5", released_on: "2026-10-26" }] },
    };
    proofs.mockResolvedValue({ b1: [proof("opus-5-5", "Opus 5.5", 1, 1)], b2: [proof("sonnet-5-5", "Sonnet 5.5", 2, 2)] });
    const page = await listModelTests({ now: Date.parse("2026-10-29T00:00:00Z") });
    expect(proofs).toHaveBeenCalledTimes(1);
    expect(proofs).toHaveBeenCalledWith(["b1", "b2"]);
    expect(page.tests.map((test) => [test.slug, test.target])).toEqual([["b", "Opus 5.5"]]);
  });

  it("reads nothing more while no model has been released", async () => {
    tables = { builds: { data: [{ id: "b1", slug: "a", title: "A", last_confirmed_at: null, creator: null }] }, model_releases: { data: [] } };
    await expect(listModelTests()).resolves.toEqual({ tests: [], nextOffset: null });
    expect(proofs).not.toHaveBeenCalled();
  });
});

describe("addModelRelease", () => {
  it("writes the registry id and the day", async () => {
    await addModelRelease({ modelId: " opus-5-5 ", releasedOn: "2026-10-26" });
    expect(inserted).toEqual([{ model_id: "opus-5-5", released_on: "2026-10-26" }]);
  });
});
