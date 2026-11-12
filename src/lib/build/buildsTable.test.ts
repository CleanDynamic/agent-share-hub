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
  for (const method of ["select", "in", "or", "overlaps", "contains", "order", "limit", "range", "eq", "gte", "lt", "lte", "ilike"]) {
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

import { getCountSpread, getWorksOnModelCounts, listBuildsTable, resetBuildsCountColumns, stackClause } from "@/lib/build/gallery";
import { MODEL_VERSIONS, modelKeysOf, modelLabel } from "@/lib/models/registry";

const call = (method: string) => calls.filter((entry) => entry.method === method);
/** The `gte` filters on the build's own columns (the runs window on the embedded runs is its own claim). */
const gteOnBuild = () => call("gte").filter((entry) => !String(entry.args[0]).startsWith("build_reproductions."));

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
    expect(select).toContain("still_open_topics:still_open_topic_count");
    expect(select).not.toContain("bounties");
    expect(select).toContain("classification");
    for (const heavy of ["build_nodes", "build_media", "post_doc"]) expect(select).not.toContain(heavy);
    expect(call("select")[0].args[1]).toEqual({ count: "exact" });
    expect(call("in")).toContainEqual({ method: "in", args: ["status", ["published", "gallery"]] });
  });

  it("orders by reproductions by default, then newest, then id", async () => {
    await listBuildsTable();
    expect(call("order").map((entry) => entry.args[0])).toEqual(["reproduction_count", "last_confirmed_at", "published_at", "id"]);
    await listBuildsTable({ sort: "rebuilt" });
    expect(call("order").map((entry) => entry.args[0]).slice(4)).toEqual(["rebuild_count", "published_at", "id"]);
  });

  /* ── BF-12 (B3) ── */

  it("sorts by the stored steps or sessions, empty last, with the same tie-breakers", async () => {
    await listBuildsTable({ sort: "steps" });
    expect(call("order").map((entry) => entry.args)).toEqual([
      ["step_count", { ascending: false, nullsFirst: false }],
      ["published_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    calls = [];
    await listBuildsTable({ sort: "sessions", ascending: true });
    expect(call("order").map((entry) => entry.args)[0]).toEqual(["session_count", { ascending: true, nullsFirst: false }]);
  });

  it("ascending turns only the sort's own first order", async () => {
    await listBuildsTable({ sort: "reproduced", ascending: true });
    expect(call("order").map((entry) => entry.args)).toEqual([
      ["reproduction_count", { ascending: true, nullsFirst: false }],
      ["last_confirmed_at", { ascending: false, nullsFirst: false }],
      ["published_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    calls = [];
    await listBuildsTable({ sort: "newest", ascending: true });
    expect(call("order").map((entry) => entry.args)[0]).toEqual(["published_at", { ascending: true, nullsFirst: false }]);
  });

  it("without the stored counts, a steps sort keeps only the tie-breakers", async () => {
    queue = [{ data: [], error: { code: "42703", message: 'column builds.step_count does not exist' }, count: null }];
    await listBuildsTable({ sort: "steps" });
    const orders = call("order").map((entry) => entry.args[0]);
    expect(orders.slice(-2)).toEqual(["published_at", "id"]);
    expect(orders.slice(3)).not.toContain("step_count");
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

  it("UX-08 P4: the Still open lens and filter read has_open_ask (an open request or a still-open topic), not an inner join", async () => {
    await listBuildsTable({ lens: "unsolved" });
    expect(call("select")[0].args[0]).not.toContain("!inner(");
    expect(call("select")[0].args[0]).toContain("still_open_topics:still_open_topic_count");
    expect(call("eq")).toContainEqual({ method: "eq", args: ["has_open_ask", true] });
    calls = [];
    await listBuildsTable({ stillOpen: true });
    expect(call("eq")).toContainEqual({ method: "eq", args: ["has_open_ask", true] });
    calls = [];
    await listBuildsTable();
    expect(call("eq").map((entry) => entry.args[0])).not.toContain("has_open_ask");
  });

  it("reads the Reproduced lens as reproduced and fresh", async () => {
    await listBuildsTable({ lens: "proven" });
    expect(gteOnBuild().map((entry) => entry.args[0])).toEqual(["reproduction_count", "last_confirmed_at"]);
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
          still_open_topics: 2,
        },
      ],
      error: null,
      count: 1,
    };
    const page = await listBuildsTable();
    expect(page.total).toBe(1);
    expect(page.builds[0]).toMatchObject({ title: "Inbox triage", madeWith: ["Claude Code"], reproductionCount: 3, maker: { handle: "kit", name: "Kit" }, open: { count: 2 } });
    expect(page.builds[0].classifiedAs?.declared.field).toEqual([{ id: "education" }]);
  });

  it("throws a named error when the read fails", async () => {
    response = { data: [], error: { message: "boom" }, count: null };
    await expect(listBuildsTable()).rejects.toThrow(/listBuildsTable/);
  });
});

describe("the stored counts (SV-23 P1)", () => {
  const rows = [{ id: "a", slug: "a", title: "A", shape: "app", made_with: [], reproduction_count: 1, rebuild_count: 0, step_count: 12, session_count: 2, maker: null }];

  it("reads them in the list's own select, and says they are live", async () => {
    response = { data: rows, error: null, count: 1 };
    const page = await listBuildsTable();
    expect(call("select")).toHaveLength(1);
    expect(call("select")[0].args[0]).toContain("step_count, session_count");
    expect(page.countsLive).toBe(true);
    expect(page.builds[0]).toMatchObject({ stepCount: 12, sessionCount: 2 });
  });

  /* BF-03 P3 (D3): session_count defaults to 0 and an older writer filled it, so it is trusted only beside a step_count. */
  it("a row whose step_count is null has no session count, whatever session_count holds", async () => {
    response = { data: [{ ...rows[0], step_count: null, session_count: 1 }], error: null, count: 1 };
    const page = await listBuildsTable();
    expect(page.builds[0]).toMatchObject({ stepCount: null, sessionCount: null });
  });

  it("a row with both counts written keeps both", async () => {
    response = { data: [{ ...rows[0], step_count: 4, session_count: 3 }], error: null, count: 1 };
    const page = await listBuildsTable();
    expect(page.builds[0]).toMatchObject({ stepCount: 4, sessionCount: 3 });
  });

  it("filters a range on the stored column, from and to", async () => {
    await listBuildsTable({ ranges: { steps: { min: 5, max: 30 }, sessions: { min: 2 } } });
    expect(gteOnBuild()).toEqual([
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
    expect(gteOnBuild()).toEqual([]);
  });
});

describe("the proof (SV-23 P2)", () => {
  it("filters Reproductions, Rebuilds and Likes as ranges on their columns", async () => {
    await listBuildsTable({ ranges: { reproductions: { min: 3 }, rebuilds: { min: 1, max: 4 }, likes: { max: 10 } } });
    expect(gteOnBuild()).toEqual([
      { method: "gte", args: ["reproduction_count", 3] },
      { method: "gte", args: ["rebuild_count", 1] },
    ]);
    expect(call("lte")).toEqual([
      { method: "lte", args: ["rebuild_count", 4] },
      { method: "lte", args: ["like_count", 10] },
    ]);
  });

  it("reads Last confirmed as within n days of the start of today, so the request is the same all day", async () => {
    await listBuildsTable({ confirmedWithin: 30 });
    const [cutoff] = gteOnBuild().filter((entry) => entry.args[0] === "last_confirmed_at").map((entry) => String(entry.args[1]));
    const midnight = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    expect(Date.parse(cutoff)).toBe(midnight - 30 * 86_400_000);
  });

  it("reads Confirmed as run and within the stale window, and Stale as run and before it", async () => {
    await listBuildsTable({ confirmedState: "confirmed" });
    expect(gteOnBuild().map((entry) => entry.args[0])).toEqual(["reproduction_count", "last_confirmed_at"]);
    expect(call("lt")).toEqual([]);
    calls = [];
    await listBuildsTable({ confirmedState: "stale" });
    expect(gteOnBuild()).toEqual([{ method: "gte", args: ["reproduction_count", 1] }]);
    expect(call("lt")[0].args[0]).toBe("last_confirmed_at");
    const midnight = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    expect(Date.parse(String(call("lt")[0].args[1]))).toBe(midnight - 120 * 86_400_000);
  });

  it("reads Works on model as a run that worked on any spelling of the model", async () => {
    await listBuildsTable({ worksOn: "opus-5-5" });
    const [call0] = call("overlaps").filter((entry) => entry.args[0] === "worked_models");
    expect(call0).toBeDefined();
    const keys = call0.args[1] as string[];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key === key.toLowerCase() && !/[\s._]/.test(key))).toBe(true);
    calls = [];
    await listBuildsTable({ worksOn: "no-such-model" });
    expect(call("overlaps").filter((entry) => entry.args[0] === "worked_models")).toEqual([]);
  });

  it("embeds the last twelve weeks of runs in the same request, and counts them by week", async () => {
    const now = new Date();
    const thisWeek = new Date(now.getTime() - 60_000).toISOString();
    response = {
      data: [{ id: "a", slug: "a", title: "A", shape: "app", made_with: [], reproduction_count: 2, rebuild_count: 0, maker: null, build_reproductions: [{ confirmed_at: thisWeek }, { confirmed_at: thisWeek }] }],
      error: null,
      count: 1,
    };
    const page = await listBuildsTable();
    expect(call("from")).toHaveLength(1);
    expect(call("select")[0].args[0]).toContain("build_reproductions!build_reproductions_build_id_fkey(confirmed_at)");
    expect(call("gte").some((entry) => entry.args[0] === "build_reproductions.confirmed_at")).toBe(true);
    expect(call("limit").some((entry) => (entry.args[1] as { referencedTable?: string } | undefined)?.referencedTable === "build_reproductions")).toBe(true);
    expect(page.builds[0].runs).toHaveLength(12);
    expect(page.builds[0].runs?.reduce((sum, n) => sum + n, 0)).toBe(2);
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

describe("getWorksOnModelCounts", () => {
  it("is null when the function is not there yet", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase as unknown as { rpc: unknown }).rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await getWorksOnModelCounts()).toBeNull();
  });

  it("names each model the registry knows, most builds first, and leaves out a key it does not", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { model_key: "opus-5-5", builds: 4 },
        { model_key: "sonnet-5-5", builds: 9 },
        { model_key: "some-model-nobody-named", builds: 50 },
        { model_key: 7, builds: 1 },
      ],
      error: null,
    });
    (supabase as unknown as { rpc: unknown }).rpc = rpc;
    const counts = await getWorksOnModelCounts();
    expect(rpc).toHaveBeenCalledWith("works_on_model_counts");
    expect(counts?.map((entry) => [entry.model.id, entry.builds])).toEqual([
      ["sonnet-5-5", 9],
      ["opus-5-5", 4],
    ]);
  });
});

/* ── BF-10 P2 ── */

describe("the four new columns' data", () => {
  const row = { id: "a", slug: "a", title: "A", shape: "app", made_with: [], reproduction_count: 1, rebuild_count: 0, maker: null };

  it("a row carries its likes, its patterns and the models it worked on", async () => {
    const key = modelKeysOf(MODEL_VERSIONS[0])[0];
    response = { data: [{ ...row, step_count: 3, session_count: 1, like_count: 4, patterns: ["router"], worked_models: [key] }], error: null, count: 1 };
    const page = await listBuildsTable();
    const select = call("select")[0].args[0] as string;
    expect(select).toContain("like_count, patterns");
    expect(select).toContain("step_count, session_count, worked_models");
    expect(call("select")).toHaveLength(1);
    expect(page.builds[0]).toMatchObject({ likeCount: 4, patterns: ["router"], workedModels: [key] });
    expect(modelLabel(key)).toBe(MODEL_VERSIONS[0].name);
  });

  it("a row read without the stored counts has no worked models", async () => {
    queue = [
      { data: [], error: { code: "42703", message: "column builds.worked_models does not exist" }, count: null },
      { data: [{ ...row, like_count: 2, patterns: null }], error: null, count: 1 },
    ];
    const page = await listBuildsTable();
    expect(call("select")[1].args[0]).not.toContain("worked_models");
    expect(page.countsLive).toBe(false);
    expect(page.builds[0].workedModels).toBeUndefined();
    expect(page.builds[0]).toMatchObject({ likeCount: 2, patterns: [] });
  });
});
