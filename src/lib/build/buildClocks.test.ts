// getBuildClocks (UI-P31): when each build in a family was made and last confirmed.
//
// A stand-in for the PostgREST builder records every call and answers when it
// is awaited, which is when supabase-js goes to the network.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: { data: unknown; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(answer).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), rpc: vi.fn() },
}));

import { REBUILD_TREE_ROW_CAP, getBuildClocks } from "@/lib/build/lineage";

beforeEach(() => {
  calls = [];
  answer = { data: [], error: null };
});

describe("getBuildClocks", () => {
  it("asks once, by id, for the two clocks and nothing else, limited to the ids asked", async () => {
    await getBuildClocks(["a", "b", "a"]);
    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls[0].table).toBe("builds");
    expect(calls.find((call) => call.method === "select")?.args[0]).toBe("id, created_at, last_confirmed_at");
    expect(calls.find((call) => call.method === "in")?.args).toEqual(["id", ["a", "b"]]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([2]);
  });

  it("asks nothing for no ids, and never for more than the family's cap and a draft", async () => {
    expect(await getBuildClocks([])).toEqual(new Map());
    expect(calls).toHaveLength(0);
    await getBuildClocks(Array.from({ length: REBUILD_TREE_ROW_CAP + 50 }, (_, index) => `id-${index}`));
    expect((calls.find((call) => call.method === "in")?.args[1] as string[]).length).toBe(REBUILD_TREE_ROW_CAP + 1);
  });

  it("returns each build's clocks by id", async () => {
    answer = {
      data: [
        { id: "a", created_at: "2026-09-01T00:00:00Z", last_confirmed_at: null },
        { id: "b", created_at: "2026-09-02T00:00:00Z", last_confirmed_at: "2026-09-20T00:00:00Z" },
      ],
      error: null,
    };
    const clocks = await getBuildClocks(["a", "b"]);
    expect(clocks.get("b")).toEqual({ created_at: "2026-09-02T00:00:00Z", last_confirmed_at: "2026-09-20T00:00:00Z" });
    expect(clocks.get("a")?.last_confirmed_at).toBeNull();
  });

  it("names itself when the request fails", async () => {
    answer = { data: null, error: { message: "boom" } };
    await expect(getBuildClocks(["a"])).rejects.toThrow(/getBuildClocks/);
  });
});
