// getRebuildDraft (UI-P31): the reader's own draft rebuild of a build, if any.
//
// A stand-in for the PostgREST builder records every call and answers when the
// row is asked for. The claims are about the one request: which draft it asks
// for, in what order, how many, and what comes back.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: { data: unknown; error: unknown } = { data: null, error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.maybeSingle = async () => {
    calls.push({ table, method: "request", args: [] });
    return answer;
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), rpc: vi.fn() },
}));

import { BUILD_COLUMNS } from "@/lib/build/builds";
import { getRebuildDraft } from "@/lib/build/rebuild";

beforeEach(() => {
  calls = [];
  answer = { data: null, error: null };
});

describe("getRebuildDraft", () => {
  it("asks once for the reader's latest draft whose parent is the source, on the header's columns", async () => {
    await getRebuildDraft({ sourceBuildId: "src", creatorId: "me" });

    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls[0].table).toBe("builds");
    expect(calls.find((call) => call.method === "select")?.args[0]).toBe(BUILD_COLUMNS);
    expect(calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["parent_build_id", "src"],
      ["creator_id", "me"],
      ["status", "draft"],
    ]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual(["updated_at", { ascending: false }]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([1]);
  });

  it("returns the draft, or null when there is none", async () => {
    answer = { data: { id: "draft-1", slug: "draft-1", status: "draft" }, error: null };
    expect(await getRebuildDraft({ sourceBuildId: "src", creatorId: "me" })).toMatchObject({ id: "draft-1" });
    answer = { data: null, error: null };
    expect(await getRebuildDraft({ sourceBuildId: "src", creatorId: "me" })).toBeNull();
  });

  it("names itself when the request fails", async () => {
    answer = { data: null, error: { message: "boom" } };
    await expect(getRebuildDraft({ sourceBuildId: "src", creatorId: "me" })).rejects.toThrow(/getRebuildDraft/);
  });
});
