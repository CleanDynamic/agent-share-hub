// The open bounties board's data layer (RC-P12).
//
// A stand-in for the PostgREST builder records every call and records a
// REQUEST only when a builder is awaited, which is when supabase-js goes to
// the network. Each table answers from its own fixture, so the claims are about
// requests and about which answer lands on which card.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answers: Record<string, unknown[]> = {};

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "in", "overlaps", "lt", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve({ data: answers[table] ?? [], error: null }).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table) },
}));

import { bountyFacetsMadeWith, listOpenBountyCards } from "@/lib/bounty/bounties";

function ask(n: number, over: Record<string, unknown> = {}) {
  return {
    id: `bounty-${n}`,
    build_id: `build-${n}`,
    gap_node_id: n % 2 === 0 ? `node-${n}` : null,
    legacy_item_id: null,
    author_id: `maker-${n % 2}`,
    status: "open",
    reward_gbp: n === 1 ? null : 50,
    closes_at: null,
    is_meta: false,
    meta_parent_id: null,
    accepted_solution_id: null,
    me_too_count: 0,
    created_at: `2026-09-${String(20 - n).padStart(2, "0")}T10:00:00.000Z`,
    solved_at: null,
    builds: {
      id: `build-${n}`,
      slug: `build-${n}`,
      title: `Build ${n}`,
      made_with: ["Claude"],
      creator_id: `maker-${n % 2}`,
    },
    build_nodes: n % 2 === 0 ? { title: `Gap ${n}` } : null,
    ...over,
  };
}

const requests = () => calls.filter((call) => call.method === "request");

describe("listOpenBountyCards", () => {
  beforeEach(() => {
    calls = [];
    answers = {
      bounties: [ask(1), ask(2), ask(3)],
      solutions: [
        { id: "s1", bounty_id: "bounty-2" },
        { id: "s2", bounty_id: "bounty-2" },
        { id: "s3", bounty_id: "bounty-3" },
      ],
      profiles: [
        { id: "maker-0", username: "sam", display_name: "Sam Ilori", avatar_url: null },
        { id: "maker-1", username: "maya", display_name: "Maya Okafor", avatar_url: null },
      ],
    };
  });

  it("costs three requests a page: the asks, their solutions, their makers", async () => {
    await listOpenBountyCards({ limit: 20 });

    expect(requests().map((call) => call.table)).toEqual(["bounties", "solutions", "profiles"]);
  });

  it("asks for open asks on published builds, newest first, one row long", async () => {
    await listOpenBountyCards({ limit: 2 });
    const on = (method: string) => calls.filter((c) => c.table === "bounties" && c.method === method);

    expect(on("select")[0].args[0]).toContain("builds!bounties_build_id_fkey!inner(id, slug, title, made_with, creator_id)");
    expect(on("select")[0].args[0]).toContain("build_nodes!bounties_gap_node_id_fkey(title)");
    expect(on("select")[0].args[0]).not.toContain("*");
    expect(on("eq")).toContainEqual({ table: "bounties", method: "eq", args: ["status", "open"] });
    expect(on("not")).toContainEqual({ table: "bounties", method: "not", args: ["build_id", "is", null] });
    expect(on("in")).toContainEqual({
      table: "bounties",
      method: "in",
      args: ["builds.status", ["published", "gallery"]],
    });
    expect(on("order")[0].args).toEqual(["created_at", { ascending: false }]);
    expect(on("limit")[0].args).toEqual([3]);
  });

  it("gives the next cursor as the last card's created_at when one more row came back", async () => {
    const page = await listOpenBountyCards({ limit: 2 });

    expect(page.cards.map((card) => card.bounty.id)).toEqual(["bounty-1", "bounty-2"]);
    expect(page.nextCursor).toBe(ask(2).created_at);
  });

  it("gives no cursor on the last page, and pages by created_at", async () => {
    const page = await listOpenBountyCards({ limit: 20, before: "2026-09-19T00:00:00.000Z" });

    expect(page.nextCursor).toBeNull();
    expect(calls).toContainEqual({
      table: "bounties",
      method: "lt",
      args: ["created_at", "2026-09-19T00:00:00.000Z"],
    });
  });

  it("drops an ask whose build did not come back", async () => {
    answers.bounties = [ask(1), ask(2, { builds: null }), ask(3)];
    const page = await listOpenBountyCards({ limit: 20 });

    expect(page.cards.map((card) => card.bounty.id)).toEqual(["bounty-1", "bounty-3"]);
  });

  it("narrows by Made with on the embedded build, and not at all without it", async () => {
    await listOpenBountyCards({ madeWith: ["Claude", " n8n ", ""] });
    expect(calls.filter((c) => c.method === "overlaps").map((c) => c.args)).toEqual([
      ["builds.made_with", ["Claude", "n8n"]],
    ]);

    calls = [];
    await listOpenBountyCards({ madeWith: [] });
    expect(calls.filter((c) => c.method === "overlaps")).toHaveLength(0);
  });

  it("attaches each count, maker and gap title to its own ask", async () => {
    const page = await listOpenBountyCards({ limit: 20 });
    const byId = Object.fromEntries(page.cards.map((card) => [card.bounty.id, card]));

    expect(byId["bounty-1"]).toMatchObject({
      solutions: 0,
      gapTitle: null,
      author: { username: "maya", display_name: "Maya Okafor" },
      build: { slug: "build-1", title: "Build 1", made_with: ["Claude"] },
    });
    expect(byId["bounty-2"]).toMatchObject({ solutions: 2, gapTitle: "Gap 2", author: { username: "sam" } });
    expect(byId["bounty-3"]).toMatchObject({ solutions: 1 });
  });

  it("asks nothing more when the board is empty", async () => {
    answers.bounties = [];
    const page = await listOpenBountyCards();

    expect(page).toEqual({ cards: [], nextCursor: null });
    expect(requests().map((call) => call.table)).toEqual(["bounties"]);
  });
});

describe("bountyFacetsMadeWith", () => {
  beforeEach(() => {
    calls = [];
  });

  it("counts Made with over open asks on published builds, highest first, in one request", async () => {
    answers = {
      bounties: [
        { id: "a", builds: { made_with: ["Claude", "n8n"] } },
        { id: "b", builds: { made_with: ["Claude"] } },
        { id: "c", builds: { made_with: ["Claude", "Claude", "Zapier"] } },
        { id: "d", builds: null },
      ],
    };
    const facets = await bountyFacetsMadeWith();

    expect(facets).toEqual([
      { value: "Claude", count: 3 },
      { value: "n8n", count: 1 },
      { value: "Zapier", count: 1 },
    ]);
    expect(requests()).toHaveLength(1);
    expect(calls).toContainEqual({
      table: "bounties",
      method: "in",
      args: ["builds.status", ["published", "gallery"]],
    });
  });

  it("offers at most twelve", async () => {
    answers = {
      bounties: Array.from({ length: 20 }, (_, n) => ({ id: `x${n}`, builds: { made_with: [`tool-${n}`] } })),
    };
    expect(await bountyFacetsMadeWith()).toHaveLength(12);
  });
});
