// The solvers board's data layer (RC-P13).
//
// A stand-in for supabase-js records a REQUEST when one would reach the
// network: an rpc call, or a PostgREST builder being awaited. Each answer is a
// fixture, so the claims are about how many requests the board costs, what
// they name, and which answer lands on which solver.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let rpcAnswer: { data: unknown; error: unknown } = { data: [], error: null };
let profilesAnswer: { data: unknown; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(profilesAnswer).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: unknown) => {
      calls.push({ table: `rpc:${fn}`, method: "request", args: [params] });
      return Promise.resolve(rpcAnswer);
    },
  },
}));

import { TOP_SOLVERS_LIMIT, listTopSolvers } from "@/lib/bounty/solvers";

const requests = () => calls.filter((call) => call.method === "request");

function ranked(id: string, solved: number | string, reward: number | string | null) {
  return { user_id: id, solved, reward_total: reward, last_solved_at: "2026-09-20T10:00:00.000Z" };
}

function person(id: string) {
  return { id, username: `handle-${id}`, display_name: `Name ${id}`, avatar_url: null };
}

beforeEach(() => {
  calls = [];
  rpcAnswer = { data: [], error: null };
  profilesAnswer = { data: [], error: null };
});

describe("listTopSolvers", () => {
  it("asks for the ranking and the names in two requests", async () => {
    rpcAnswer = { data: [ranked("a", 3, 150), ranked("b", 2, null), ranked("c", 1, 20)], error: null };
    profilesAnswer = { data: [person("a"), person("b"), person("c")], error: null };

    await listTopSolvers();

    expect(requests().map((call) => call.table)).toEqual(["rpc:top_solvers", "profiles"]);
    expect(requests()[0].args[0]).toEqual({ max_results: TOP_SOLVERS_LIMIT });
    expect(TOP_SOLVERS_LIMIT).toBe(25);

    const profileCalls = calls.filter((call) => call.table === "profiles");
    expect(profileCalls.find((call) => call.method === "select")?.args[0]).toBe(
      "id, username, display_name, avatar_url",
    );
    expect(profileCalls.find((call) => call.method === "in")?.args).toEqual(["id", ["a", "b", "c"]]);
    expect(profileCalls.find((call) => call.method === "limit")?.args).toEqual([3]);
  });

  it("passes a smaller limit through to the function", async () => {
    await listTopSolvers({ limit: 10 });
    expect(requests()[0].args[0]).toEqual({ max_results: 10 });
  });

  it("keeps the function's order whatever order the names come back in", async () => {
    rpcAnswer = { data: [ranked("c", 5, 10), ranked("a", 4, null), ranked("b", 4, null)], error: null };
    profilesAnswer = { data: [person("a"), person("b"), person("c")], error: null };

    const solvers = await listTopSolvers();

    expect(solvers.map((solver) => solver.id)).toEqual(["c", "a", "b"]);
    expect(solvers.map((solver) => solver.username)).toEqual(["handle-c", "handle-a", "handle-b"]);
  });

  it("keeps a solver whose name cannot be read in their place, with no name", async () => {
    rpcAnswer = { data: [ranked("a", 3, null), ranked("ghost", 2, null), ranked("b", 1, null)], error: null };
    profilesAnswer = { data: [person("a"), person("b")], error: null };

    const solvers = await listTopSolvers();

    expect(solvers.map((solver) => solver.id)).toEqual(["a", "ghost", "b"]);
    expect(solvers[1]).toMatchObject({ username: null, display_name: null, avatar_url: null, solved: 2 });
  });

  it("reads bigint and numeric columns as numbers, and no reward as null", async () => {
    rpcAnswer = {
      data: [ranked("a", "12", "480.50"), ranked("b", 7, null), ranked("c", 1, "0")],
      error: null,
    };
    profilesAnswer = { data: [person("a"), person("b"), person("c")], error: null };

    const solvers = await listTopSolvers();

    expect(solvers.map((solver) => [solver.solved, solver.rewardTotalGbp])).toEqual([
      [12, 480.5],
      [7, null],
      [1, 0],
    ]);
    expect(solvers[0].lastSolvedAt).toBe("2026-09-20T10:00:00.000Z");
  });

  it("asks for no names when nobody has solved a bounty", async () => {
    rpcAnswer = { data: [], error: null };

    await expect(listTopSolvers()).resolves.toEqual([]);
    expect(requests().map((call) => call.table)).toEqual(["rpc:top_solvers"]);
  });

  it("names itself when the ranking is refused", async () => {
    rpcAnswer = { data: null, error: { code: "42501", message: "permission denied for function top_solvers" } };

    await expect(listTopSolvers()).rejects.toThrow(/^listTopSolvers failed/);
  });

  it("names itself when the names are refused", async () => {
    rpcAnswer = { data: [ranked("a", 1, null)], error: null };
    profilesAnswer = { data: null, error: { code: "PGRST301", message: "JWT expired" } };

    await expect(listTopSolvers()).rejects.toThrow(/^listTopSolvers failed/);
  });
});
