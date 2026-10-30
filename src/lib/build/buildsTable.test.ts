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
/** Answers given first, one to a request, before `response`. */
let queue: (typeof response)[] = [];

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "overlaps", "contains", "order", "limit", "range", "eq", "gte", "lte", "ilike"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(queue.length > 0 ? queue.shift() : response).then(resolve);
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

import { getCountSpread, listBuildsTable, resetBuildsCountColumns, stackClause } from "@/lib/build/gallery";

const call = (method: string) => calls.filter((entry) => entry.method === method);

beforeEach(() => {
  resetBuildsCountColumns();
  queue = [];
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

describe("the stored counts (SV-23 P1)", () => {
  const rows = [{ id: "a", slug: "a", title: "A", shape: "app", made_with: [], reproduction_count: 1, rebuild_count: 0, step_count: 12, session_count: 2, maker: null, bounties: [] }];

  it("reads them in the list's own select, and says they are live", async () => {
    response = { data: rows, error: null, count: 1 };
    const page = await listBuildsTable();
    expect(call("select")).toHaveLength(1);
    expect(call("select")[0].args[0]).toContain("step_count, session_count");
    expect(page.countsLive).toBe(true);
    expect(page.builds[0]).toMatchObject({ stepCount: 12, sessionCount: 2 });
  });

  it("filters a range on the stored column, from and to", async () => {
    await listBuildsTable({ ranges: { steps: { min: 5, max: 30 }, sessions: { min: 2 } } });
    expect(call("gte")).toEqual([
      { method: "gte", args: ["step_count", 5] },
      { method: "gte", args: ["session_count", 2] },
    ]);
    expect(call("lte")).toEqual([{ method: "lte", args: ["step_count", 30] }]);
  });

  it("reads again without the counts when the columns are missing, and does not ask for them again", async () => {
    queue = [
      { data: [], error: { code: "42703", message: "column builds.step_count does not exist" }, count: null },
      { data: rows.map(({ step_count: _a, session_count: _b, ...rest }) => rest), error: null, count: 1 },
    ];
    const page = await listBuildsTable();
    const asked = call("select").map((entry) => entry.args[0] as string);
    expect(asked).toHaveLength(2);
    expect(asked[0]).toContain("step_count");
    expect(asked[1]).not.toContain("step_count");
    expect(page.countsLive).toBe(false);
    expect(page.builds[0].stepCount).toBeNull();

    calls = [];
    await listBuildsTable({ ranges: { steps: { min: 5 } } });
    expect(call("select")).toHaveLength(1);
    expect(call("select")[0].args[0]).not.toContain("step_count");
    expect(call("gte")).toEqual([]);
  });
});

describe("getCountSpread", () => {
  it("is null when the function is not there yet", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase as unknown as { rpc: unknown }).rpc = rpc;
    expect(await getCountSpread()).toBeNull();
  });

  it("maps each kind's values to the builds at them", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { kind: "steps", value: 4, builds: 3 },
        { kind: "steps", value: 60, builds: 1 },
        { kind: "sessions", value: 1, builds: 5 },
        { kind: "steps", value: "x", builds: 2 },
      ],
      error: null,
    });
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase as unknown as { rpc: unknown }).rpc = rpc;
    const spread = await getCountSpread();
    expect(rpc).toHaveBeenCalledWith("builds_count_spread");
    expect(spread?.steps?.get(4)).toBe(3);
    expect(spread?.steps?.get(60)).toBe(1);
    expect(spread?.sessions?.get(1)).toBe(5);
    expect(spread?.steps?.size).toBe(2);
  });
});
