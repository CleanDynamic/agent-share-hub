// SV-11: the Builds table's read. The claims: ONE REQUEST with only the table's columns (no nodes, pictures or post),
// the maker and the open asks embedded; the gallery's membership rule; facets as an OR within and an AND across; Tools
// and stack also matching made_with; the lens and the open-requests filter; the sort; and the rows read as the table
// draws them.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let response: { data: unknown[]; error: unknown; count: number | null } = { data: [], error: null, count: 0 };

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "overlaps", "contains", "order", "limit", "range", "eq", "gte", "ilike"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
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

import { listBuildsTable, stackClause } from "@/lib/build/gallery";

const call = (method: string) => calls.filter((entry) => entry.method === method);

beforeEach(() => {
  calls = [];
  response = { data: [], error: null, count: 0 };
});

describe("listBuildsTable", () => {
  it("is one request for the table's columns, with the maker and the open asks, and nothing a table never draws", async () => {
    await listBuildsTable();
    expect(call("from").map((entry) => entry.args[0])).toEqual(["builds"]);
    const select = call("select")[0].args[0] as string;
    expect(select).toContain("maker:profiles!builds_creator_id_fkey(username, display_name)");
    expect(select).toContain("bounties!bounties_build_id_fkey(reward_gbp, status)");
    expect(select).toContain("classification");
    for (const heavy of ["build_nodes", "build_media", "post_doc"]) expect(select).not.toContain(heavy);
    expect(call("select")[0].args[1]).toEqual({ count: "exact" });
    expect(call("in")).toContainEqual({ method: "in", args: ["status", ["published", "gallery"]] });
    expect(call("eq")).toContainEqual({ method: "eq", args: ["bounties.status", "open"] });
  });

  it("orders by reproductions by default, then newest, then id", async () => {
    await listBuildsTable();
    expect(call("order").map((entry) => entry.args[0])).toEqual(["reproduction_count", "last_confirmed_at", "published_at", "id"]);
    await listBuildsTable({ sort: "rebuilt" });
    expect(call("order").map((entry) => entry.args[0]).slice(4)).toEqual(["rebuild_count", "published_at", "id"]);
  });

  it("puts facets of one kind in one OR, and each kind in an AND", async () => {
    await listBuildsTable({ facets: ["field:education", "field:law", "skill:no-coding"] });
    expect(call("overlaps")).toEqual([
      { method: "overlaps", args: ["facets", ["field:education", "field:law"]] },
      { method: "overlaps", args: ["facets", ["skill:no-coding"]] },
    ]);
  });

  it("matches a Tools and stack value on the facet or on made_with", async () => {
    await listBuildsTable({ facets: ["stack:ai-applications.claude-code"] });
    const clause = call("or").map((entry) => entry.args[0] as string).find((value) => value.startsWith("facets.ov"));
    expect(clause).toBe(stackClause(["stack:ai-applications.claude-code"]));
    expect(clause).toContain('made_with.ov.{"Claude Code"');
  });

  it("joins the open asks inner for the Open requests lens and filter", async () => {
    await listBuildsTable({ lens: "unsolved" });
    expect(call("select")[0].args[0]).toContain("bounties!bounties_build_id_fkey!inner(");
    calls = [];
    await listBuildsTable({ openBounties: true });
    expect(call("select")[0].args[0]).toContain("!inner(");
  });

  it("reads the Reproduced lens as reproduced and fresh", async () => {
    await listBuildsTable({ lens: "proven" });
    expect(call("gte").map((entry) => entry.args[0])).toEqual(["reproduction_count", "last_confirmed_at"]);
  });

  it("pages with a range", async () => {
    await listBuildsTable({ offset: 50 });
    expect(call("range")[0].args).toEqual([50, 99]);
  });

  it("reads a row as the table draws it", async () => {
    response = {
      data: [
        {
          id: "b1", slug: "inbox", title: "Inbox triage", shape: "prompt", made_with: ["Claude Code"], reproduction_count: 3,
          last_confirmed_at: "2026-10-20T00:00:00Z", last_confirmed_model: "claude-opus-5-5", published_at: "2026-09-01T00:00:00Z",
          rebuild_count: 1, classification: { declared: { field: [{ id: "education" }] } }, maker: { username: "kit", display_name: " Kit " },
          bounties: [{ reward_gbp: 40 }, { reward_gbp: null }],
        },
      ],
      error: null,
      count: 1,
    };
    const page = await listBuildsTable();
    expect(page.total).toBe(1);
    expect(page.builds[0]).toMatchObject({ title: "Inbox triage", madeWith: ["Claude Code"], reproductionCount: 3, maker: { handle: "kit", name: "Kit" }, open: { count: 2, reward: 40 } });
    expect(page.builds[0].classifiedAs?.declared.field).toEqual([{ id: "education" }]);
  });

  it("throws a named error when the read fails", async () => {
    response = { data: [], error: { message: "boom" }, count: null };
    await expect(listBuildsTable()).rejects.toThrow(/listBuildsTable/);
  });
});
