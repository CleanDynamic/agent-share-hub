// getReproductionsByModel and plaqueBuildFor, against a faked client.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  method: string;
  args: unknown[];
}

let calls: Call[] = [];
let rows: Record<string, unknown>[] = [];
let failure: unknown = null;

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    const ids = (calls.filter((c) => c.method === "in").at(-1)?.args[1] ?? []) as string[];
    const data = rows.filter((row) => ids.includes(row.build_id as string));
    return Promise.resolve({ data, error: failure }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
  },
}));

import { getReproductionsByModel, plaqueBuildFor, type ModelProof } from "@/lib/build/signals";
import { plaqueState } from "@/components/brand/Plaque";

beforeEach(() => {
  calls = [];
  rows = [];
  failure = null;
});

const row = (build_id: string, model_used: string | null, worked: boolean, confirmed_at: string) => ({
  build_id,
  model_used,
  worked,
  confirmed_at,
});

describe("getReproductionsByModel", () => {
  it("groups spellings of one version, counts worked rows and keeps the newest worked time", async () => {
    rows = [
      row("b1", "claude-sonnet-5-5", true, "2026-09-01T00:00:00Z"),
      row("b1", "Sonnet 5.5", true, "2026-09-10T00:00:00Z"),
      row("b1", "sonnet-5.5", false, "2026-09-20T00:00:00Z"),
    ];
    const out = await getReproductionsByModel(["b1"]);
    expect(out.b1).toEqual([
      { modelId: "sonnet-5-5", modelName: "Sonnet 5.5", worked: 2, lastConfirmedAt: "2026-09-10T00:00:00Z" },
    ]);
  });

  it("groups unknown models under their trimmed text and no model under Unknown model", async () => {
    rows = [
      row("b1", "  my-local-llama ", true, "2026-09-01T00:00:00Z"),
      row("b1", "my-local-llama", true, "2026-09-02T00:00:00Z"),
      row("b1", null, true, "2026-09-03T00:00:00Z"),
      row("b1", "  ", true, "2026-09-04T00:00:00Z"),
    ];
    const out = await getReproductionsByModel(["b1"]);
    expect(out.b1.map((p) => [p.modelId, p.modelName, p.worked])).toEqual([
      [null, "Unknown model", 2], // tie on worked, newer confirmation first
      [null, "my-local-llama", 2],
    ]);
  });

  it("keeps a model nobody got working as worked 0 with no confirmation", async () => {
    rows = [row("b1", "Opus 5.5", false, "2026-09-01T00:00:00Z")];
    expect((await getReproductionsByModel(["b1"])).b1).toEqual([
      { modelId: "opus-5-5", modelName: "Opus 5.5", worked: 0, lastConfirmedAt: null },
    ]);
  });

  it("returns [] for a build nobody reproduced and reads in chunks of 100, each with a limit", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `b${i}`);
    const out = await getReproductionsByModel(ids);
    expect(Object.keys(out)).toHaveLength(250);
    expect(out.b0).toEqual([]);

    const ins = calls.filter((c) => c.method === "in");
    expect(ins.map((c) => (c.args[1] as string[]).length)).toEqual([100, 100, 50]);
    expect(ins.every((c) => c.args[0] === "build_id")).toBe(true);
    expect(calls.filter((c) => c.method === "limit")).toHaveLength(3);
    expect(calls.filter((c) => c.method === "from").every((c) => c.args[0] === "build_reproductions")).toBe(true);
  });

  it("makes no request for no ids, and throws on an error", async () => {
    expect(await getReproductionsByModel([])).toEqual({});
    expect(calls).toEqual([]);
    failure = { message: "boom" };
    await expect(getReproductionsByModel(["b1"])).rejects.toThrow();
  });
});

describe("plaqueBuildFor", () => {
  const build = {
    reproduction_count: 5,
    last_confirmed_at: "2026-09-30T00:00:00Z",
    last_confirmed_model: "GPT-6 Luna",
    published_at: "2026-06-01T00:00:00Z",
    rebuild_count: 2,
  };

  it("with no proof returns the build's own overall fields", () => {
    expect(plaqueBuildFor(build, null)).toMatchObject({
      reproduction_count: 5,
      last_confirmed_at: "2026-09-30T00:00:00Z",
      last_confirmed_model: "GPT-6 Luna",
      rebuild_count: 2,
    });
  });

  it("with a proof speaks for that model", () => {
    const proof: ModelProof = { modelId: "opus-5-5", modelName: "Opus 5.5", worked: 3, lastConfirmedAt: "2026-09-01T00:00:00Z" };
    const plaque = plaqueBuildFor(build, proof);
    expect(plaque).toMatchObject({
      reproduction_count: 3,
      last_confirmed_at: "2026-09-01T00:00:00Z",
      last_confirmed_model: "Opus 5.5",
    });
    expect(plaqueState(plaque, Date.parse("2026-10-06T00:00:00Z"))).toBe("healthy");
  });

  it("a model with nothing working reads as not yet reproduced", () => {
    const proof: ModelProof = { modelId: null, modelName: "x", worked: 0, lastConfirmedAt: null };
    expect(plaqueState(plaqueBuildFor(build, proof))).toBe("unreproduced");
  });
});
