// listRebuildCards (UI-P30): a build's published rebuilds, as gallery cards.
//
// A stand-in for the PostgREST builder records every call and answers when it
// is awaited, which is when supabase-js goes to the network. The claims are
// about the one request: what it selects, what it filters on, how it orders and
// how many rows it may return, and that the rows come back as cards.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: { data: unknown[] | null; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "order", "limit"]) {
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

import { gallerySelect } from "@/lib/build/gallery";
import { REBUILDS_PAGE_SIZE, listRebuildCards } from "@/lib/build/rebuild";

/** The row order the request asks for: its own order calls, not an embed's. */
const rowOrder = () =>
  calls
    .filter((call) => call.method === "order" && !(call.args[1] as { referencedTable?: string } | undefined)?.referencedTable)
    .map((call) => call.args);
/** The cap on the rows themselves, not on an embed. */
const rowLimits = () =>
  calls
    .filter((call) => call.method === "limit" && !(call.args[1] as { referencedTable?: string } | undefined)?.referencedTable)
    .map((call) => call.args[0]);

beforeEach(() => {
  calls = [];
  answer = { data: [], error: null };
});

describe("listRebuildCards", () => {
  it("asks once, on the gallery card's select, for this build's published children, newest first", async () => {
    await listRebuildCards("build-1");

    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls[0].table).toBe("builds");
    expect(calls.find((call) => call.method === "select")?.args[0]).toBe(gallerySelect(false));
    expect(calls.find((call) => call.method === "eq" && call.args[0] === "parent_build_id")?.args).toEqual([
      "parent_build_id",
      "build-1",
    ]);
    expect(calls.find((call) => call.method === "in" && call.args[0] === "status")?.args).toEqual([
      "status",
      ["published", "gallery"],
    ]);
    expect(rowOrder()).toEqual([["created_at", { ascending: false }]]);
    expect(rowLimits()).toEqual([REBUILDS_PAGE_SIZE]);
  });

  it("carries the card's embeds: its nodes, its pictures and its open ask", async () => {
    await listRebuildCards("build-1");
    const embedded = calls.filter(
      (call) => (call.method === "in" || call.method === "eq") && String(call.args[0]).includes("."),
    );
    expect(embedded.map((call) => call.args[0])).toEqual(["build_nodes.type", "build_media.kind", "bounties.status"]);
  });

  it("caps a larger ask at the page size and never asks for fewer than one", async () => {
    await listRebuildCards("build-1", { limit: 500 });
    expect(rowLimits()).toEqual([REBUILDS_PAGE_SIZE]);
    calls = [];
    await listRebuildCards("build-1", { limit: 0 });
    expect(rowLimits()).toEqual([1]);
  });

  it("returns the rows as cards, with their embeds renamed and never absent", async () => {
    answer = {
      data: [
        {
          id: "r1",
          slug: "r1",
          title: "Rebuild one",
          build_nodes: [{ id: "n1", type: "prompt", title: "P", payload: {}, position: 0, is_gap: false }],
          build_media: null,
          bounties: [{ id: "b1", reward_gbp: 50, status: "open" }],
        },
      ],
      error: null,
    };
    const cards = await listRebuildCards("build-1");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "r1", nodes: [{ id: "n1" }], media: [], bounties: [{ id: "b1" }] });
    expect(cards[0]).not.toHaveProperty("build_nodes");
  });

  it("names itself when the request fails", async () => {
    answer = { data: null, error: { message: "boom" } };
    await expect(listRebuildCards("build-1")).rejects.toThrow(/listRebuildCards/);
  });
});
