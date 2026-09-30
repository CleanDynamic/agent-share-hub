// A maker's own numbers, per published build (RC-P23).
//
// A stand-in for supabase-js records every request: a PostgREST builder being
// awaited, or an rpc call. The claims: three requests on load (the builds, then
// maker_build_metrics and maker_stats for the same maker), none of them a
// legacy post; the builds read in maker_build_metrics' own order and cap; the
// two answers merged by build; and errors that carry identifiers only.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  target: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let session: { user: { id: string } } | null = { user: { id: "maker-1" } };
let buildsAnswer: { data: unknown; error: unknown; status?: number } = { data: [], error: null, status: 200 };
const rpcAnswers: Record<string, { data: unknown; error: unknown; status?: number }> = {};

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ target: table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ target: table, method: "request", args: [] });
    return Promise.resolve(buildsAnswer).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: unknown) => {
      calls.push({ target: `rpc:${fn}`, method: "request", args: [params] });
      return Promise.resolve(rpcAnswers[fn] ?? { data: [], error: null, status: 200 });
    },
    auth: { getSession: async () => ({ data: { session } }) },
  },
}));

import { isPermissionError } from "@/lib/errors/permission";
import { BUILD_STATS_LIMIT, BuildStatsError, getMyBuildStats } from "./buildStats";

const requests = () => calls.filter((call) => call.method === "request").map((call) => call.target);

function buildRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    slug: `slug-${id}`,
    title: `Title ${id}`,
    reproduction_count: 3,
    last_confirmed_at: "2026-09-20T10:00:00.000Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T10:00:00.000Z",
    rebuild_count: 1,
    like_count: 4,
    comment_count: 2,
    save_count: 5,
    ...over,
  };
}

beforeEach(() => {
  calls = [];
  session = { user: { id: "maker-1" } };
  buildsAnswer = { data: [], error: null, status: 200 };
  for (const key of Object.keys(rpcAnswers)) delete rpcAnswers[key];
  rpcAnswers.maker_stats = {
    data: [{ builds: 2, reproductions_received: 7, rebuilds_of_their_work: 1, gaps_solved: 0 }],
    error: null,
    status: 200,
  };
});

describe("getMyBuildStats", () => {
  it("costs three requests: the builds, maker_build_metrics and maker_stats, none of them a legacy post", async () => {
    await getMyBuildStats();

    expect(requests().sort()).toEqual(["builds", "rpc:maker_build_metrics", "rpc:maker_stats"]);
    expect(requests().some((target) => target.includes("content_items"))).toBe(false);
    expect(calls.find((call) => call.target === "rpc:maker_build_metrics")?.args).toEqual([{ uid: "maker-1" }]);
    expect(calls.find((call) => call.target === "rpc:maker_stats")?.args).toEqual([{ uid: "maker-1" }]);
  });

  it("reads the maker's published builds in maker_build_metrics' own order and cap", async () => {
    await getMyBuildStats();

    const on = (method: string) => calls.filter((call) => call.target === "builds" && call.method === method).map((call) => call.args);
    expect(on("eq")).toEqual([["creator_id", "maker-1"]]);
    expect(on("in")).toEqual([["status", ["published", "gallery"]]]);
    expect(on("order").map((args) => args[0])).toEqual(["reproduction_count", "last_confirmed_at", "published_at", "id"]);
    expect(on("limit")).toEqual([[BUILD_STATS_LIMIT]]);
    expect(BUILD_STATS_LIMIT).toBe(50);
    const columns = String(on("select")[0][0]);
    for (const column of ["like_count", "comment_count", "save_count", "rebuild_count", "last_confirmed_at", "published_at"]) {
      expect(columns).toContain(column);
    }
    expect(columns).not.toContain("*");
  });

  it("puts each build's metrics on its row, and zeros on a row the metrics did not answer", async () => {
    buildsAnswer = { data: [buildRow("a"), buildRow("b")], error: null, status: 200 };
    rpcAnswers.maker_build_metrics = {
      data: [{ build_id: "a", runs: "5", worked: 4, failed_last_30_days: 1, open_bounties: 2, solutions_waiting: 3 }],
      error: null,
      status: 200,
    };

    const stats = await getMyBuildStats();
    expect(stats.figures).toEqual({ builds: 2, reproductionsReceived: 7, rebuildsOfTheirWork: 1, gapsSolved: 0 });
    expect(stats.builds[0]).toMatchObject({ id: "a", runs: 5, worked: 4, failed_last_30_days: 1, open_bounties: 2, solutions_waiting: 3, like_count: 4, save_count: 5 });
    expect(stats.builds[1]).toMatchObject({ id: "b", runs: 0, worked: 0, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 });
  });

  it("says a refused read is a refusal, and names the maker's id and nothing a reader wrote", async () => {
    buildsAnswer = { data: null, error: { code: "42501", message: "permission denied for table builds (Failing row contains secret)" }, status: 403 };

    const error = await getMyBuildStats().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BuildStatsError);
    expect((error as Error).message).toBe("getMyBuildStats (builds) failed (user maker-1)");
    expect(isPermissionError(error)).toBe(true);
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("asks nothing when nobody is signed in, and says so as a refusal", async () => {
    session = null;
    const error = await getMyBuildStats().catch((caught: unknown) => caught);
    expect(isPermissionError(error)).toBe(true);
    expect(requests()).toEqual([]);
  });
});
