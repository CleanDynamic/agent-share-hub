// UX-03 P6: the maker's live builds for Home's "Your published builds": named columns, a limit, and two counts.

import { describe, expect, it, vi } from "vitest";

const calls: { table: string; ops: [string, unknown[]][] }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain = (record: { table: string; ops: [string, unknown[]][] }, result: unknown) => {
    const proxy: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "gt", "order", "limit"]) {
      proxy[op] = (...args: unknown[]) => {
        record.ops.push([op, args]);
        return proxy;
      };
    }
    proxy.then = (resolve: (value: unknown) => void) => resolve(result);
    return proxy;
  };
  return {
    supabase: {
      from: (table: string) => {
        const record = { table, ops: [] as [string, unknown[]][] };
        calls.push(record);
        // The first is the list, the second the head count of the reproduced.
        return calls.length % 2 === 1
          ? chain(record, { data: [{ id: "b1", slug: "fox", title: "Fox poster", published_at: "2026-11-02T10:00:00Z", reproduction_count: 0 }], count: 7, error: null })
          : chain(record, { data: null, count: 0, error: null });
      },
    },
  };
});

import { listPublishedBuildsByCreator, PUBLISHED_LIST_COLUMNS } from "./builds";

describe("UX-03 P6: listPublishedBuildsByCreator", () => {
  it("reads named columns of the maker's live builds, newest first, with a limit, and counts them in full", async () => {
    const result = await listPublishedBuildsByCreator("maker-1", { limit: 5 });
    expect(result).toEqual({ rows: [expect.objectContaining({ slug: "fox" })], total: 7, reproduced: 0 });
    const [list, reproduced] = calls;
    expect(list.table).toBe("builds");
    expect(list.ops).toEqual([
      ["select", [PUBLISHED_LIST_COLUMNS, { count: "exact" }]],
      ["eq", ["creator_id", "maker-1"]],
      ["in", ["status", ["published", "gallery"]]],
      ["order", ["published_at", { ascending: false }]],
      ["limit", [5]],
    ]);
    expect(PUBLISHED_LIST_COLUMNS).not.toContain("*");
    expect(reproduced.ops).toEqual([
      ["select", ["id", { count: "exact", head: true }]],
      ["eq", ["creator_id", "maker-1"]],
      ["in", ["status", ["published", "gallery"]]],
      ["gt", ["reproduction_count", 0]],
    ]);
  });
});
