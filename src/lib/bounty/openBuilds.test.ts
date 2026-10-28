// SV-14: OpenBuilds' reads. A stand-in for supabase-js records each request when it would reach the network (a builder
// being awaited), with when it started relative to the others, so the claims are about rounds, what each request names,
// and which answer lands where.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
/** Each awaited request, in order, with the number of requests already answered when it started. */
let started: { table: string; answeredBefore: number }[] = [];
let answered = 0;
type Answer = { data: unknown; error: unknown; count?: number };
/** A table's answer, or one worked out from that request's own calls. */
let answers: Record<string, Answer | ((own: Recorded[]) => Answer)> = {};

function builder(table: string) {
  const self: Record<string, unknown> = {};
  const own: Recorded[] = [];
  for (const method of ["select", "eq", "neq", "in", "not", "or", "order", "range", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      own.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    started.push({ table, answeredBefore: answered });
    return Promise.resolve()
      .then(() => {
        answered += 1;
        const answer = answers[table];
        return typeof answer === "function" ? answer(own) : (answer ?? { data: [], error: null });
      })
      .then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));

import { getMyRecord, listMyOpenRequests, listStepRequests } from "@/lib/bounty/openBuilds";

const of = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method).map((call) => call.args);

function ask(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `q${n}`,
    build_id: `b${n}`,
    gap_node_id: `g${n}`,
    legacy_item_id: null,
    author_id: `u${n}`,
    status: "open",
    reward_gbp: 40,
    closes_at: null,
    is_meta: false,
    meta_parent_id: null,
    accepted_solution_id: null,
    me_too_count: 4,
    created_at: "2026-10-20T10:00:00.000Z",
    solved_at: null,
    builds: { id: `b${n}`, slug: `build-${n}`, title: `Build ${n}`, creator_id: `u${n}` },
    build_nodes: { title: `Gap ${n}` },
    ...extra,
  };
}

beforeEach(() => {
  calls = [];
  started = [];
  answered = 0;
  answers = {};
});

describe("listStepRequests", () => {
  it("takes two rounds: the asks, then counts, makers, strips and Me too together", async () => {
    answers.bounties = { data: [ask(1), ask(2)], error: null };
    answers.solutions = { data: [{ id: "s1", bounty_id: "q1" }], error: null };
    answers.profiles = { data: [{ id: "u1", username: "mira", avatar_url: null }], error: null };
    answers.build_nodes = {
      data: [
        { id: "a", build_id: "b1", parent_id: null, type: "prompt", title: "First", position: 1, is_gap: false, tested: null, setup: null, step: null, gap_problem: null },
        { id: "g1", build_id: "b1", parent_id: null, type: "code", title: "Gap 1", position: 2, is_gap: true, tested: null, setup: null, step: null, gap_problem: "Stops on paywalls." },
      ],
      error: null,
    };
    answers.bounty_me_too_marks = { data: [{ bounty_id: "q2", user_id: "me" }], error: null };

    const page = await listStepRequests({ viewerId: "me" });

    expect(started[0]).toEqual({ table: "bounties", answeredBefore: 0 });
    expect(started.slice(1).every((request) => request.answeredBefore === 1)).toBe(true);
    expect(started.slice(1).map((request) => request.table).sort()).toEqual(["bounty_me_too_marks", "build_nodes", "profiles", "solutions"].sort());

    expect(page.requests.map((request) => [request.bounty.id, request.gapTitle, request.problem, request.solutions, request.meToo, request.maker?.username ?? null])).toEqual([
      ["q1", "Gap 1", "Stops on paywalls.", 1, false, "mira"],
      ["q2", "Gap 2", "", 0, true, null],
    ]);
    expect(page.strips[1]).toEqual({ id: "g1", build_id: "b1", parent_id: null, type: "code", title: "Gap 1", position: 2, is_gap: true, payload: { tested: null, setup: null, step: null } });
    expect(page.nextOffset).toBeNull();
  });

  it("reads the strips by named columns and payload paths, for the page's builds, top-level steps and gaps only", async () => {
    answers.bounties = { data: [ask(1), ask(2, { gap_node_id: null, build_nodes: null })], error: null };
    await listStepRequests();
    expect(of("build_nodes", "select")[0][0]).toBe(
      "id, build_id, parent_id, type, title, position, is_gap, tested:payload->tested, setup:payload->setup, step:payload->step, gap_problem:payload->>gap_problem",
    );
    expect(of("build_nodes", "in")[0]).toEqual(["build_id", ["b1", "b2"]]);
    expect(of("build_nodes", "or")[0]).toEqual(["parent_id.is.null,id.in.(g1)"]);
    expect(of("build_nodes", "limit")[0]).toEqual([400]);
  });

  it("asks nothing more for a signed-out reader's marks, or for an empty page", async () => {
    answers.bounties = { data: [], error: null };
    await listStepRequests();
    expect(started.map((request) => request.table)).toEqual(["bounties"]);
  });

  it.each([
    ["needed", [["me_too_count", { ascending: false }]]],
    ["newest", []],
    ["closing", [["closes_at", { ascending: true, nullsFirst: false }]]],
    ["reward", [["reward_gbp", { ascending: false, nullsFirst: false }]]],
  ] as const)("orders %s on the server, then newest and by id", async (sort, first) => {
    await listStepRequests({ sort });
    expect(of("bounties", "order")).toEqual([...first, ["created_at", { ascending: false }], ["id", { ascending: false }]]);
  });

  it("pages by offset, one row long", async () => {
    answers.bounties = { data: [ask(1), ask(2), ask(3)], error: null };
    const page = await listStepRequests({ limit: 2, offset: 4 });
    expect(of("bounties", "range")[0]).toEqual([4, 6]);
    expect(page.requests).toHaveLength(2);
    expect(page.nextOffset).toBe(6);
  });

  it("lists only open asks on published builds, of every size", async () => {
    await listStepRequests();
    expect(of("bounties", "eq")).toEqual([["status", "open"]]);
    expect(of("bounties", "in")).toEqual([["builds.status", ["published", "gallery"]]]);
    expect(of("bounties", "not")).toEqual([["build_id", "is", null]]);
  });

  it("reads steps only when asked: asks that name a gap node", async () => {
    await listStepRequests({ size: "step" });
    expect(of("bounties", "not")).toEqual([
      ["build_id", "is", null],
      ["gap_node_id", "is", null],
    ]);
  });

  it("reads a whole-build ask's build steps for its step count, with no gap to name", async () => {
    answers.bounties = { data: [ask(1, { gap_node_id: null, build_nodes: null })], error: null };
    const page = await listStepRequests();
    expect(of("build_nodes", "or")[0]).toEqual(["parent_id.is.null"]);
    expect(page.requests[0]).toMatchObject({ gapTitle: null, problem: "" });
  });
});

describe("listMyOpenRequests", () => {
  it("groups the reader's waiting answers by ask, latest first, and names the latest solver", async () => {
    answers.solutions = {
      data: [
        { id: "s3", bounty_id: "q1", solver_id: "kit", bounties: { id: "q1", builds: { slug: "gbngd", title: "gbngd" }, build_nodes: { title: "Step two" } } },
        { id: "s2", bounty_id: "q1", solver_id: "dax", bounties: { id: "q1", builds: { slug: "gbngd", title: "gbngd" }, build_nodes: { title: "Step two" } } },
        { id: "s1", bounty_id: "q2", solver_id: "dax", bounties: { id: "q2", builds: { slug: "inv", title: "Invoice chaser" }, build_nodes: null } },
      ],
      error: null,
    };
    answers.profiles = { data: [{ id: "kit", username: "kit" }, { id: "dax", username: "dax" }], error: null };

    const rows = await listMyOpenRequests("me");

    expect(of("solutions", "eq")).toEqual([
      ["status", "submitted"],
      ["bounties.status", "open"],
      ["bounties.builds.creator_id", "me"],
    ]);
    expect(rows).toEqual([
      { bountyId: "q1", build: { slug: "gbngd", title: "gbngd" }, gapTitle: "Step two", answers: 2, latestSolver: "kit" },
      { bountyId: "q2", build: { slug: "inv", title: "Invoice chaser" }, gapTitle: null, answers: 1, latestSolver: "dax" },
    ]);
  });
});

describe("getMyRecord", () => {
  it("counts the reader's worked and failed runs of others' builds and accepted answers, together and exactly", async () => {
    answers.build_reproductions = (own) => ({ data: null, error: null, count: own.some((call) => call.method === "eq" && call.args[0] === "worked" && call.args[1] === true) ? 40 : 3 });
    answers.solutions = { data: null, error: null, count: 6 };
    expect(await getMyRecord("me")).toEqual({ reproduced: 40, tried: 3, accepted: 6 });
    expect(started).toHaveLength(3);
    expect(started.every((request) => request.answeredBefore === 0)).toBe(true);
    expect(of("build_reproductions", "select")[0]).toEqual(["id, builds!build_reproductions_build_id_fkey!inner(creator_id)", { count: "exact", head: true }]);
    expect(of("build_reproductions", "eq")).toEqual([
      ["user_id", "me"],
      ["worked", true],
      ["user_id", "me"],
      ["worked", false],
    ]);
    expect(of("build_reproductions", "neq")).toEqual([
      ["builds.creator_id", "me"],
      ["builds.creator_id", "me"],
    ]);
    expect(of("solutions", "eq")).toEqual([
      ["solver_id", "me"],
      ["status", "accepted"],
    ]);
  });
});
