// listGalleryDashboard and getEngagementSeries against a stand-in builder.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Request {
  table: string;
  calls: { method: string; args: unknown[] }[];
}

let requests: Request[] = [];
let respond: (request: Request) => { data: unknown };

function builder(request: Request) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "or", "eq", "gte", "contains", "overlaps", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      request.calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ error: null, ...respond(request) }).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const request: Request = { table, calls: [] };
      requests.push(request);
      return builder(request);
    },
  },
}));

import {
  DASHBOARD_BUILD_COLUMNS,
  DASHBOARD_ROW_LIMIT,
  getEngagementSeries,
  listGalleryDashboard,
} from "@/lib/build/gallery";

const callsOf = (request: Request, method: string) => request.calls.filter((c) => c.method === method);
const selectOf = (request: Request) => String(callsOf(request, "select")[0]?.args[0]);
const isMain = (r: Request) => r.table === "builds" && selectOf(r) === DASHBOARD_BUILD_COLUMNS;

const NOW = Date.parse("2026-10-07T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function build(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    creator_id: `u-${id}`,
    slug: id,
    title: `Build ${id}`,
    outcome: "Does a thing",
    shape: "app",
    status: "gallery",
    made_for: ["lawyers"],
    completeness: 90,
    reproduction_count: 0,
    rebuild_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: daysAgo(60),
    session_count: 1,
    prompt_count: 10,
    ai_turn_count: 20,
    models_used: ["Sonnet 5.5"],
    making: { sessions: [{ client: "claude", model: "Sonnet 5.5", prompts: 10, turns: 20 }, "junk"] },
    ...extra,
  };
}

let builds: ReturnType<typeof build>[] = [];
let reproductions: Record<string, unknown>[] = [];
let rebuilds: Record<string, unknown>[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  requests = [];
  builds = [];
  reproductions = [];
  rebuilds = [];
  respond = (r) => {
    const select = selectOf(r);
    if (isMain(r)) return { data: builds };
    if (r.table === "profiles") {
      const ids = callsOf(r, "in")[0].args[1] as string[];
      return { data: ids.map((id) => ({ id, username: `h-${id}` })) };
    }
    if (r.table === "build_reproductions") return { data: reproductions };
    if (r.table === "builds" && select.startsWith("parent_build_id")) return { data: rebuilds };
    return { data: [] };
  };
});

describe("the select", () => {
  it("names only columns found on live: no comment_count, no save_count, no star", () => {
    expect(DASHBOARD_BUILD_COLUMNS).not.toMatch(/comment_count|save_count|\*/);
    for (const column of ["reproduction_count", "rebuild_count", "models_used", "making", "session_count"]) {
      expect(DASHBOARD_BUILD_COLUMNS).toContain(column);
    }
  });
});

describe("listGalleryDashboard", () => {
  it("reads the gallery on the named columns, capped at 200, and pushes the cheap filters down", async () => {
    await listGalleryDashboard({ audience: "lawyers", model: "sonnet-5-5", lab: "Anthropic", report: "multi" });
    const main = requests.find(isMain)!;
    expect(callsOf(main, "limit")[0].args).toEqual([DASHBOARD_ROW_LIMIT]);
    expect(callsOf(main, "in")[0].args).toEqual(["status", ["published", "gallery"]]);
    expect(String(callsOf(main, "or")[0].args[0])).toContain("status.eq.gallery");
    expect(callsOf(main, "overlaps").map((c) => c.args[0])).toEqual(["made_for", "models_used"]);
    expect(callsOf(main, "contains")[0].args).toEqual(["models_used", ["Sonnet 5.5"]]);
    expect(callsOf(main, "gte")[0].args).toEqual(["session_count", 3]);
  });

  it("maps a build to a row: handle, engagement from the columns, making kept to its shape", async () => {
    builds = [build("a", { reproduction_count: 4, rebuild_count: 2 })];
    const [row] = await listGalleryDashboard();
    expect(row).toMatchObject({
      id: "a",
      creator: { id: "u-a", handle: "h-u-a" },
      madeFor: ["lawyers"],
      modelsUsed: ["Sonnet 5.5"],
      sessionCount: 1,
      promptCount: 10,
      aiTurnCount: 20,
      making: { sessions: [{ client: "claude", model: "Sonnet 5.5", prompts: 10, turns: 20 }] },
      engagement: { runs: 4, rebuilds: 2, comments: 0, saves: 0, total: 6 },
    });
    expect(row.series).toHaveLength(14);
    expect(row.proof).toEqual([]);
  });

  it("lastActivity is the newest of reproduction, rebuild and publication", async () => {
    builds = [
      build("rep", { published_at: daysAgo(60) }),
      build("reb", { published_at: daysAgo(60), rebuild_count: 1 }),
      build("pub", { published_at: daysAgo(2) }),
    ];
    reproductions = [{ build_id: "rep", model_used: "claude-opus-5-5", worked: true, confirmed_at: daysAgo(5) }];
    rebuilds = [{ parent_build_id: "reb", creator_id: "u-x", published_at: daysAgo(9) }];

    const rows = await listGalleryDashboard();
    const by = Object.fromEntries(rows.map((r) => [r.id, r.lastActivity]));
    expect(by.rep).toEqual({ at: daysAgo(5), what: "Reproduced on Opus 5.5" });
    expect(by.reb).toEqual({ at: daysAgo(9), what: "Rebuilt by @h-u-x" });
    expect(by.pub).toEqual({ at: daysAgo(2), what: "Published" });
    // newest activity first
    expect(rows.map((r) => r.id)).toEqual(["pub", "rep", "reb"]);
  });

  it("activeWithinDays and report month filter on lastActivity; multi on session_count", async () => {
    builds = [
      build("old", { published_at: daysAgo(100), session_count: 5 }),
      build("mid", { published_at: daysAgo(20), session_count: 1 }),
      build("new", { published_at: daysAgo(3), session_count: 3 }),
    ];
    const ids = async (params: Parameters<typeof listGalleryDashboard>[0]) =>
      (await listGalleryDashboard(params)).map((r) => r.id);

    expect(await ids({ activeWithinDays: 7 })).toEqual(["new"]);
    expect(await ids({ activeWithinDays: 90 })).toEqual(["new", "mid"]);
    expect(await ids({ report: "month" })).toEqual(["new", "mid"]);
    expect(await ids({ report: "multi" })).toEqual(["new", "old"]);
  });

  it("model matches the version's name, lab any model of that lab, and q title, handle, audience and models", async () => {
    builds = [
      build("s", { title: "Contract Reader", models_used: ["Sonnet 5.5"], made_for: ["lawyers"] }),
      build("g", { title: "Chart Maker", models_used: ["GPT-6 Luna"], made_for: ["analysts"] }),
      build("n", { title: "Plain", models_used: [], made_for: [] }),
    ];
    const ids = async (params: Parameters<typeof listGalleryDashboard>[0]) =>
      (await listGalleryDashboard(params)).map((r) => r.id).sort();

    expect(await ids({ model: "sonnet-5-5" })).toEqual(["s"]);
    expect(await ids({ lab: "OpenAI" })).toEqual(["g"]);
    expect(await ids({ audience: "analysts" })).toEqual(["g"]);
    expect(await ids({ q: "contract" })).toEqual(["s"]);
    expect(await ids({ q: "H-U-N" })).toEqual(["n"]);
    expect(await ids({ q: "luna" })).toEqual(["g"]);
    expect(await ids({ q: "ANALYSTS" })).toEqual(["g"]);
  });

  it("returns [] without reading anything else when there are no builds", async () => {
    expect(await listGalleryDashboard()).toEqual([]);
    expect(requests.filter((r) => r.table === "build_reproductions")).toHaveLength(0);
  });
});

describe("getEngagementSeries", () => {
  it("counts reproductions of any outcome and published rebuilds per ISO week, oldest first", async () => {
    // NOW is Wed 7 Oct 2026; its week starts Mon 5 Oct, the 14th bucket.
    reproductions = [
      { build_id: "a", confirmed_at: "2026-10-06T10:00:00Z", worked: true },
      { build_id: "a", confirmed_at: "2026-10-05T00:00:00Z", worked: false },
      { build_id: "a", confirmed_at: "2026-10-04T23:59:59Z", worked: true }, // Sunday: last week
      { build_id: "a", confirmed_at: "2026-07-06T00:00:00Z", worked: true }, // first bucket
      { build_id: "a", confirmed_at: "2026-07-05T23:59:59Z", worked: true }, // before the window
      { build_id: "a", confirmed_at: "2026-10-12T00:00:00Z", worked: true }, // future
    ];
    rebuilds = [{ parent_build_id: "a", published_at: "2026-10-01T00:00:00Z" }];

    const series = await getEngagementSeries(["a", "quiet"], 14, new Date(NOW));
    expect(series.a).toHaveLength(14);
    expect(series.a[13]).toBe(2);
    expect(series.a[12]).toBe(2); // one reproduction, one rebuild
    expect(series.a[0]).toBe(1);
    expect(series.a.reduce((x, y) => x + y, 0)).toBe(5);
    expect(series.quiet).toEqual(new Array(14).fill(0));
  });

  it("reads only inside the window, in chunks of 100", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `b${i}`);
    await getEngagementSeries(ids, 14, new Date(NOW));
    const reads = requests.filter((r) => r.table === "build_reproductions");
    expect(reads).toHaveLength(2);
    expect(callsOf(reads[0], "gte")[0].args).toEqual(["confirmed_at", "2026-07-06T00:00:00.000Z"]);
    expect(callsOf(reads[0], "limit")).toHaveLength(1);
  });
});
