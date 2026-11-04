// UX-03 P7: the untitled drafts' first prompts, read beside the drafts list: named columns, one row each, a limit.

import { describe, expect, it, vi } from "vitest";

const calls: { table: string; ops: [string, unknown[]][] }[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain = (record: { table: string; ops: [string, unknown[]][] }, result: unknown) => {
    const proxy: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "is", "order", "limit"]) {
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
        return chain(record, { data: [{ id: "d1", first_prompt: [{ text: " Write the poster copy " }] }, { id: "d2", first_prompt: [] }], error: null });
      },
    },
  };
});

import { DRAFT_PROMPT_COLUMNS, listDraftFirstPrompts } from "./drafts";

describe("UX-03 P7: listDraftFirstPrompts", () => {
  it("asks only for the maker's untitled drafts, each one's first top-level prompt's text, at most fifty", async () => {
    const prompts = await listDraftFirstPrompts("maker-1");
    expect([...prompts]).toEqual([["d1", "Write the poster copy"]]);
    expect(DRAFT_PROMPT_COLUMNS).not.toContain("*");
    expect(DRAFT_PROMPT_COLUMNS).toContain("text:payload->>text");
    expect(calls[0].table).toBe("builds");
    expect(calls[0].ops).toEqual([
      ["select", [DRAFT_PROMPT_COLUMNS]],
      ["eq", ["creator_id", "maker-1"]],
      ["eq", ["status", "draft"]],
      ["in", ["title", ["", "Untitled build"]]],
      ["eq", ["first_prompt.type", "prompt"]],
      ["is", ["first_prompt.parent_id", null]],
      ["order", ["updated_at", { ascending: false }]],
      ["order", ["position", { ascending: true, referencedTable: "first_prompt" }]],
      ["limit", [1, { referencedTable: "first_prompt" }]],
      ["limit", [50]],
    ]);
  });

  it("asks nothing without a maker", async () => {
    const before = calls.length;
    expect((await listDraftFirstPrompts(null)).size).toBe(0);
    expect(calls.length).toBe(before);
  });
});
