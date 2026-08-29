// Solving a bounty by rebuilding it (NS-P53).
//
// WHAT THIS FILE PROVES. The three refusals the acceptance criteria name, and
// the one behaviour that is the whole point of the feature:
//
//   1. submitSolutionRebuild refuses an UNPUBLISHED build. An accepted answer
//      has to be one a reader can open, and a draft is one person's workings.
//   2. It refuses a build that solves a DIFFERENT gap. A rebuild declares what
//      it is answering when it is started; one started elsewhere is somebody
//      else's answer and its node has no relationship to this question.
//   3. It refuses a build whose matched node is STILL A GAP — or is empty. A
//      rebuild that published the question unchanged has not answered it, and
//      accepting one would clear the flag on the author's node while
//      substituting nothing.
//   4. Acceptance PULLS THE SOLVER'S PAYLOAD. The row's content_payload is a
//      summary written at submission; the build is the published record. Where
//      the two disagree, acceptance takes the build's, and it names the node it
//      took it from so the database can re-prove every fact about it.
//
// WHY IT ASSERTS ON THE RPC ARGUMENTS. p_solved_node_id is the entire seam
// between the client's matching heuristic and the database's verification. A
// client that resolved the right node and then failed to name it would accept
// the stale snapshot silently — the acceptance would succeed, the build would
// look filled, and the wrong payload would be in it. Nothing rendered can tell
// the difference, so the test reads the call.
//
// WHAT IT DOES NOT PROVE. The database half: that accept_bounty_solution
// refuses a node from the wrong build, of the wrong type, or inside a rebuild
// that is not the solver's. Those live in the function body and no mock can
// demonstrate them — they are asserted by the tier-3 spec against a real
// database, and by the migration's own checks.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { method: string; args: unknown[] };
type Query = { table: string; ops: Op[] };

const db = vi.hoisted(() => ({
  queries: [] as Query[],
  next: {} as Record<string, { data: unknown; error: unknown; count?: number }[]>,
  rpcCalls: [] as { fn: string; args: unknown }[],
  rpcNext: [] as { data: unknown; error: unknown }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const query: Query = { table, ops: [] };
    db.queries.push(query);

    const answer = () => {
      const queued = db.next[table]?.shift();
      return queued ?? { data: [], error: null, count: 0 };
    };

    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) => resolve(answer());
          }
          if (prop === "maybeSingle" || prop === "single") {
            return (...args: unknown[]) => {
              query.ops.push({ method: String(prop), args });
              const res = answer() as { data: unknown; error: unknown };
              const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
              return Promise.resolve({ data, error: res.error ?? null });
            };
          }
          return (...args: unknown[]) => {
            query.ops.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => chainFor(table),
      rpc: (fn: string, args: unknown) => {
        db.rpcCalls.push({ fn, args });
        return Promise.resolve(db.rpcNext.shift() ?? { data: null, error: null });
      },
    },
  };
});

vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

/**
 * One node type, one required text field. The registry caches per session and
 * reads a table this suite has no business queueing rows for; what is under
 * test is which payload is pulled, not how the schema is fetched.
 */
const FIELDS = [{ key: "text", label: "Prompt text", type: "text", required: true }];
vi.mock("@/lib/build/nodeTypes", () => ({
  getFieldsFor: vi.fn(async () => FIELDS),
  getNodeTypes: vi.fn(async () => []),
}));

/**
 * THE REAL matchNodes, and mocked reads around it.
 *
 * importOriginal rather than a bare factory on purpose: the matching heuristic
 * is the part of this path most likely to be wrong, and a suite that mocked it
 * would prove only that the mock returns what it was told to. What is stubbed
 * is the four functions that would otherwise reach the network.
 */
const buildMocks = vi.hoisted(() => ({
  getBuild: vi.fn(),
  startRebuild: vi.fn(),
  updateBuild: vi.fn(),
  deleteBuild: vi.fn(),
}));

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return { ...actual, ...buildMocks };
});

import {
  acceptSolution,
  isEmptyPayload,
  matchSolutionNode,
  startSolutionRebuild,
  submitSolutionRebuild,
} from "./index";

const BUILD_ID = "b111d000-0000-4000-8000-000000000001";
const REBUILD_ID = "b111d000-0000-4000-8000-000000000002";
const AUTHOR_ID = "c9ea1000-0000-4000-8000-000000000001";
const SOLVER_ID = "50fe0000-0000-4000-8000-000000000001";
const GAP_NODE_ID = "9a900000-0000-4000-8000-000000000001";
const SOLVED_NODE_ID = "9a900000-0000-4000-8000-000000000002";
const BOUNTY_ID = "b0b0b0b0-0000-4000-8000-000000000001";
const SOLUTION_ID = "50100000-0000-4000-8000-000000000001";

const OPEN_BOUNTY = {
  id: BOUNTY_ID,
  build_id: BUILD_ID,
  gap_node_id: GAP_NODE_ID,
  status: "open",
  author_id: AUTHOR_ID,
};

const GAP_NODE = { id: GAP_NODE_ID, build_id: BUILD_ID, type: "prompt", is_gap: true };

/** The solver's published rebuild, as the header read returns it. */
const REBUILD = {
  id: REBUILD_ID,
  slug: "retry-prompt-that-works",
  title: "Retry prompt that works",
  status: "published",
  creator_id: SOLVER_ID,
  solves_node_id: GAP_NODE_ID,
  reproduction_count: 3,
  published_at: "2026-08-29T10:00:00Z",
};

/** What the solver actually wrote. The payload acceptance must pull. */
const SOLVER_PAYLOAD = { text: "Retry with the tool result quoted verbatim." };
/** What the row remembers. Deliberately different, so a pull can be seen. */
const STALE_SNAPSHOT = { text: "an older draft of the same idea" };

function node(over: Record<string, unknown>) {
  return {
    id: GAP_NODE_ID,
    build_id: BUILD_ID,
    parent_id: null,
    position: 1,
    type: "prompt",
    title: "The retry prompt",
    note: null,
    payload: {},
    source_ref: null,
    is_gap: false,
    children: [],
    ...over,
  };
}

/** A one-node record. matchNodes pairs the two roots on type and title. */
function record(build: Record<string, unknown>, tree: unknown[]) {
  return { build, tree, tray: [], events: [], nodeTypes: [] } as never;
}

const sourceRecord = () =>
  record({ id: BUILD_ID, creator_id: AUTHOR_ID }, [node({ is_gap: true, payload: {} })]);

const rebuildRecord = (over: Record<string, unknown> = {}) =>
  record({ id: REBUILD_ID, creator_id: SOLVER_ID }, [
    node({ id: SOLVED_NODE_ID, build_id: REBUILD_ID, payload: SOLVER_PAYLOAD, ...over }),
  ]);

function queriesFor(table: string): Query[] {
  return db.queries.filter((q) => q.table === table);
}
function insertPayload(query: Query | undefined): Record<string, unknown> {
  const payload = query?.ops.find((o) => o.method === "insert")?.args[0];
  return (Array.isArray(payload) ? payload[0] : payload) as Record<string, unknown>;
}

beforeEach(() => {
  db.queries = [];
  db.next = {};
  db.rpcCalls = [];
  db.rpcNext = [];
  buildMocks.getBuild.mockReset();
  buildMocks.startRebuild.mockReset();
  buildMocks.updateBuild.mockReset();
  buildMocks.deleteBuild.mockReset();
});

/** getBuild is called for the source first and the rebuild second. */
function stubRecords(rebuild = rebuildRecord()) {
  buildMocks.getBuild.mockImplementation(async (id: string) =>
    id === BUILD_ID ? sourceRecord() : rebuild,
  );
}

describe("startSolutionRebuild", () => {
  it("forks the bounty's build and declares the gap it is answering", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    buildMocks.startRebuild.mockResolvedValue({ id: REBUILD_ID });
    buildMocks.updateBuild.mockResolvedValue({ id: REBUILD_ID, solves_node_id: GAP_NODE_ID });

    const draft = await startSolutionRebuild(BOUNTY_ID);

    expect(buildMocks.startRebuild).toHaveBeenCalledWith({ sourceBuildId: BUILD_ID });
    // The declaration is the one thing this adds over the ordinary rebuild
    // door, and it is what submitSolutionRebuild later reads.
    expect(buildMocks.updateBuild).toHaveBeenCalledWith(REBUILD_ID, {
      solves_node_id: GAP_NODE_ID,
    });
    expect(draft.solves_node_id).toBe(GAP_NODE_ID);
  });

  it("refuses a closed bounty before forking anything", async () => {
    db.next.bounties = [{ data: { ...OPEN_BOUNTY, status: "solved" }, error: null }];

    await expect(startSolutionRebuild(BOUNTY_ID)).rejects.toThrow(/is solved/);
    expect(buildMocks.startRebuild).not.toHaveBeenCalled();
  });

  it("deletes the draft when the declaration cannot be written", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    buildMocks.startRebuild.mockResolvedValue({ id: REBUILD_ID });
    buildMocks.updateBuild.mockRejectedValue(new Error("updateBuild failed: nope"));
    buildMocks.deleteBuild.mockResolvedValue(undefined);

    await expect(startSolutionRebuild(BOUNTY_ID)).rejects.toThrow(/updateBuild failed/);
    // A fork that silently lost its declaration would publish as an ordinary
    // rebuild and be refused at submission with nothing explaining why.
    expect(buildMocks.deleteBuild).toHaveBeenCalledWith(REBUILD_ID);
  });
});

describe("submitSolutionRebuild", () => {
  it("files the row against the gap, carrying the build and its payload", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: REBUILD, error: null }];
    db.next.solutions = [
      { data: [], error: null },
      { data: { id: SOLUTION_ID, solution_build_id: REBUILD_ID }, error: null },
    ];
    stubRecords();

    const solution = await submitSolutionRebuild({
      bountyId: BOUNTY_ID,
      solutionBuildId: REBUILD_ID,
      solverNote: "The chunker was the problem, not the prompt.",
    });

    expect(solution.id).toBe(SOLUTION_ID);

    const written = insertPayload(queriesFor("solutions").at(-1));
    expect(written.solution_build_id).toBe(REBUILD_ID);
    expect(written.slot_kind).toBe("node");
    expect(written.slot_id).toBe(GAP_NODE_ID);
    // The solver is the build's creator, read off the row rather than passed
    // in — the insert policy admits only solver_id = auth.uid().
    expect(written.solver_id).toBe(SOLVER_ID);
    // The summary, so a reader who cannot open the build still sees the answer.
    expect(written.content_payload).toEqual(SOLVER_PAYLOAD);
  });

  it("refuses an unpublished build", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: { ...REBUILD, status: "draft" }, error: null }];
    stubRecords();

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/still a draft/);
    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a build that solves a different gap", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [
      { data: { ...REBUILD, solves_node_id: SOLVED_NODE_ID }, error: null },
    ];
    stubRecords();

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/different gap/);
    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a build whose matched node is still a gap", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: REBUILD, error: null }];
    stubRecords(rebuildRecord({ is_gap: true }));

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/still marked unsolved/);
    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a build whose matched node is empty", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: REBUILD, error: null }];
    stubRecords(rebuildRecord({ payload: {} }));

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/still empty/);
  });

  it("refuses a build that removed the gap node instead of filling it", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: REBUILD, error: null }];
    // A rebuild whose tree has nothing the gap can pair with.
    stubRecords(record({ id: REBUILD_ID, creator_id: SOLVER_ID }, []));

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/no counterpart/);
  });

  it("refuses the same rebuild filed twice", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.builds = [{ data: REBUILD, error: null }];
    db.next.solutions = [{ data: [{ id: SOLUTION_ID }], error: null }];
    stubRecords();

    await expect(
      submitSolutionRebuild({ bountyId: BOUNTY_ID, solutionBuildId: REBUILD_ID }),
    ).rejects.toThrow(/already submitted/);
    // The duplicate read happened; the insert did not.
    expect(queriesFor("solutions")).toHaveLength(1);
  });
});

describe("acceptSolution, on a rebuild solution", () => {
  const REBUILD_SOLUTION = {
    id: SOLUTION_ID,
    bounty_id: BOUNTY_ID,
    slot_kind: "node",
    slot_id: GAP_NODE_ID,
    solver_id: SOLVER_ID,
    status: "submitted",
    content_payload: STALE_SNAPSHOT,
    solution_build_id: REBUILD_ID,
  };

  it("names the solver's filled node, so the build's payload is what is pulled", async () => {
    db.next.solutions = [{ data: REBUILD_SOLUTION, error: null }];
    db.next.build_nodes = [
      { data: { id: GAP_NODE_ID, type: "prompt", build_id: BUILD_ID }, error: null },
    ];
    db.next.builds = [{ data: REBUILD, error: null }];
    db.rpcNext = [
      {
        data: {
          bounty_id: BOUNTY_ID,
          solution_id: SOLUTION_ID,
          solver_id: SOLVER_ID,
          node_id: GAP_NODE_ID,
          event_id: "e1",
          accepted_at: "2026-08-29T12:00:00Z",
        },
        error: null,
      },
    ];
    stubRecords();

    const accepted = await acceptSolution(BOUNTY_ID, SOLUTION_ID);

    expect(accepted.nodeId).toBe(GAP_NODE_ID);
    expect(db.rpcCalls).toHaveLength(1);
    expect(db.rpcCalls[0].fn).toBe("accept_bounty_solution");
    // THE SEAM. The id is the client's whole contribution to the pull; the
    // database re-proves everything about it before it writes the payload.
    expect(db.rpcCalls[0].args).toEqual({
      p_bounty_id: BOUNTY_ID,
      p_solution_id: SOLUTION_ID,
      p_solved_node_id: SOLVED_NODE_ID,
    });
  });

  it("refuses when the rebuild has been unpublished since it was filed", async () => {
    db.next.solutions = [{ data: REBUILD_SOLUTION, error: null }];
    db.next.build_nodes = [
      { data: { id: GAP_NODE_ID, type: "prompt", build_id: BUILD_ID }, error: null },
    ];
    db.next.builds = [{ data: { ...REBUILD, status: "draft" }, error: null }];
    stubRecords();

    await expect(acceptSolution(BOUNTY_ID, SOLUTION_ID)).rejects.toThrow(/still a draft/);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("leaves the typed-payload path exactly as it was", async () => {
    db.next.solutions = [
      { data: { ...REBUILD_SOLUTION, solution_build_id: null }, error: null },
    ];
    db.next.build_nodes = [
      { data: { id: GAP_NODE_ID, type: "prompt", build_id: BUILD_ID }, error: null },
    ];
    db.rpcNext = [{ data: { node_id: GAP_NODE_ID, event_id: "e1" }, error: null }];

    await acceptSolution(BOUNTY_ID, SOLUTION_ID);

    // No third argument, no build read, no matching: NS-P50's call, unchanged.
    expect(db.rpcCalls[0].args).toEqual({
      p_bounty_id: BOUNTY_ID,
      p_solution_id: SOLUTION_ID,
    });
    expect(queriesFor("builds")).toHaveLength(0);
    expect(buildMocks.getBuild).not.toHaveBeenCalled();
  });
});

describe("matchSolutionNode", () => {
  it("pairs the gap with the node standing where it stood", () => {
    const matched = matchSolutionNode(sourceRecord(), rebuildRecord(), GAP_NODE_ID);
    expect(matched?.id).toBe(SOLVED_NODE_ID);
    expect(matched?.payload).toEqual(SOLVER_PAYLOAD);
  });

  it("returns null when the rebuild removed the node", () => {
    const empty = record({ id: REBUILD_ID, creator_id: SOLVER_ID }, []);
    expect(matchSolutionNode(sourceRecord(), empty, GAP_NODE_ID)).toBeNull();
  });
});

describe("isEmptyPayload", () => {
  it("counts absent, non-object and keyless payloads as empty", () => {
    expect(isEmptyPayload(null)).toBe(true);
    expect(isEmptyPayload(undefined)).toBe(true);
    expect(isEmptyPayload({})).toBe(true);
    expect(isEmptyPayload([])).toBe(true);
    expect(isEmptyPayload("text")).toBe(true);
    expect(isEmptyPayload({ text: "" })).toBe(false);
  });
});
