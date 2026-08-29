// The bounty data layer over builds (NS-P50).
//
// WHAT THIS FILE PROVES. Four claims, each of which is a way the new path can
// be wrong without looking wrong:
//
//   1. A bounty can only be filed against a real gap. The database enforces it
//      too (trg_bounties_gap_node_valid), so this is about the refusal arriving
//      before the write and in words a creator can act on.
//   2. A solution's payload is checked against the gap node's type schema, and
//      a payload that does not fit is refused rather than stored. This is the
//      one that matters most: an unchecked payload is not rejected later, it is
//      SUBSTITUTED INTO SOMEBODY'S BUILD on acceptance.
//   3. Acceptance goes through the transaction, not through five client writes,
//      and hands back the node it filled and the event it appended.
//   4. The legacy seam resolves in both directions and memoises.
//
// WHY IT ASSERTS ON THE QUERY. The same reason the two redirect specs do: a
// data layer that filters the wrong column returns an empty list, which renders
// identically to a bounty nobody has answered. The rendered output cannot tell
// the difference, so the test reads the query that was built.
//
// WHAT IT DOES NOT PROVE. Row level security, and the transaction. Both live in
// Postgres: the policies are NS-P45's and NS-P46's and are exercised by
// supabase/tests/*.sql, and accept_bounty_solution's atomicity is a property of
// the function body that no mock can demonstrate. What is asserted here is that
// the client asks for the transaction rather than doing the five writes itself.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { method: string; args: unknown[] };
type Query = { table: string; ops: Op[] };

const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  next: {} as Record<string, { data: unknown; error: unknown; count?: number }[]>,
  rpcCalls: [] as { fn: string; args: unknown }[],
  rpcNext: [] as { data: unknown; error: unknown }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chainFor = (table: string) => {
    const query = { table, ops: [] as { method: string; args: unknown[] }[] };
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
 * The node type registry, mocked to one type with one required text field and
 * one number field. getFieldsFor caches for the session and reads a table this
 * suite has no business queueing rows for; the payload rules are the subject
 * here, not how the registry is fetched.
 */
vi.mock("@/lib/build/nodeTypes", () => ({
  getFieldsFor: vi.fn(async () => [
    { key: "text", label: "Prompt text", type: "text", required: true },
    { key: "temperature", label: "Temperature", type: "number" },
  ]),
}));

import {
  acceptSolution,
  clearBountyResolutionCache,
  createBountyForGap,
  getBounty,
  legacyItemForBounty,
  listOpenBounties,
  resolveBountyByLegacyItem,
  submitSolution,
} from "./index";

const BUILD_ID = "b111d000-0000-4000-8000-000000000001";
const CREATOR_ID = "c9ea1000-0000-4000-8000-000000000001";
const GAP_NODE_ID = "9a900000-0000-4000-8000-000000000001";
const OTHER_NODE_ID = "9a900000-0000-4000-8000-000000000002";
const BOUNTY_ID = "b0b0b0b0-0000-4000-8000-000000000001";
const SOLVER_ID = "50fe0000-0000-4000-8000-000000000001";
const SOLUTION_ID = "50100000-0000-4000-8000-000000000001";
const LEGACY_ITEM_ID = "c0ffee00-0000-4000-8000-000000000001";

const OPEN_BOUNTY = {
  id: BOUNTY_ID,
  build_id: BUILD_ID,
  gap_node_id: GAP_NODE_ID,
  legacy_item_id: null,
  author_id: CREATOR_ID,
  status: "open",
  reward_gbp: 50,
  closes_at: null,
  is_meta: false,
  meta_parent_id: null,
  accepted_solution_id: null,
  me_too_count: 0,
  created_at: "2026-08-28T09:00:00Z",
  solved_at: null,
};

const GAP_NODE = {
  id: GAP_NODE_ID,
  build_id: BUILD_ID,
  type: "prompt",
  is_gap: true,
  title: "The retry prompt",
};

function queriesFor(table: string): Query[] {
  return db.queries.filter((q) => q.table === table);
}
function eqOn(query: Query | undefined, column: string): unknown[] | undefined {
  return query?.ops.find((o) => o.method === "eq" && o.args[0] === column)?.args;
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
  clearBountyResolutionCache();
});

describe("createBountyForGap", () => {
  it("files against the gap, with the build's creator as author", async () => {
    db.next.builds = [{ data: { id: BUILD_ID, creator_id: CREATOR_ID }, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];

    const bounty = await createBountyForGap({
      buildId: BUILD_ID,
      nodeId: GAP_NODE_ID,
      rewardGbp: 50,
    });

    expect(bounty.id).toBe(BOUNTY_ID);
    const written = insertPayload(queriesFor("bounties")[0]);
    expect(written).toMatchObject({
      build_id: BUILD_ID,
      gap_node_id: GAP_NODE_ID,
      // Read from the build, never taken from the caller: NS-P45's INSERT
      // policy only admits a row whose author owns the home it names.
      author_id: CREATOR_ID,
      status: "open",
      reward_gbp: 50,
    });
    // A bounty on a build never carries a legacy home. bounties_one_home would
    // reject a row with both, and a row with the wrong one renders on the wrong
    // page.
    expect(written.legacy_item_id ?? null).toBeNull();
  });

  it("refuses a node that is not a gap, and writes nothing", async () => {
    db.next.builds = [{ data: { id: BUILD_ID, creator_id: CREATOR_ID }, error: null }];
    db.next.build_nodes = [{ data: { ...GAP_NODE, is_gap: false }, error: null }];

    await expect(
      createBountyForGap({ buildId: BUILD_ID, nodeId: GAP_NODE_ID }),
    ).rejects.toThrow(/not marked as a gap/i);

    expect(queriesFor("bounties")).toHaveLength(0);
  });

  it("refuses a node that belongs to another build", async () => {
    // The database would refuse this too — the gap trigger checks both facts —
    // but "gap_node_id 9a9… is not a gap node of build b11…" is not a sentence
    // to put in front of a creator, and the row would already have been sent.
    db.next.builds = [{ data: { id: BUILD_ID, creator_id: CREATOR_ID }, error: null }];
    db.next.build_nodes = [
      { data: { ...GAP_NODE, id: OTHER_NODE_ID, build_id: "someone-elses-build" }, error: null },
    ];

    await expect(
      createBountyForGap({ buildId: BUILD_ID, nodeId: OTHER_NODE_ID }),
    ).rejects.toThrow(/different build/i);

    expect(queriesFor("bounties")).toHaveLength(0);
  });

  it("says so plainly when the gap already has a bounty", async () => {
    // idx_bounties_gap_unique is the guarantee; 23505 is what a creator who
    // double-clicked would otherwise see.
    db.next.builds = [{ data: { id: BUILD_ID, creator_id: CREATOR_ID }, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.bounties = [
      { data: null, error: { code: "23505", message: "duplicate key value" } },
    ];

    await expect(
      createBountyForGap({ buildId: BUILD_ID, nodeId: GAP_NODE_ID }),
    ).rejects.toThrow(/already has a bounty/i);
  });
});

describe("submitSolution", () => {
  it("stores a node solution whose payload fits the gap node's type", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.solutions = [
      { data: { id: SOLUTION_ID, bounty_id: BOUNTY_ID, slot_kind: "node" }, error: null },
    ];

    await submitSolution({
      bountyId: BOUNTY_ID,
      // "0.7" as a string is the same value written differently, so the field
      // dialect corrects it silently — and the row stores the corrected one.
      nodePayload: { text: "Retry with a shorter context", temperature: "0.7" },
      solverId: SOLVER_ID,
      solverNote: "worked on the third try",
    });

    const written = insertPayload(queriesFor("solutions")[0]);
    expect(written).toMatchObject({
      bounty_id: BOUNTY_ID,
      slot_kind: "node",
      slot_id: GAP_NODE_ID,
      solver_id: SOLVER_ID,
      status: "submitted",
      solver_note: "worked on the third try",
    });
    expect(written.content_payload).toEqual({
      text: "Retry with a shorter context",
      temperature: 0.7,
    });
  });

  it("refuses a payload the node type does not declare", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];

    await expect(
      submitSolution({
        bountyId: BOUNTY_ID,
        nodePayload: { text: "fine", model: "gpt-4o" },
        solverId: SOLVER_ID,
      }),
    ).rejects.toThrow(/schema does not declare/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a payload missing a required field", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];

    await expect(
      submitSolution({
        bountyId: BOUNTY_ID,
        nodePayload: { temperature: 0.7 },
        solverId: SOLVER_ID,
      }),
    ).rejects.toThrow(/missing "Prompt text"/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a value that cannot be coerced without guessing", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];

    await expect(
      submitSolution({
        bountyId: BOUNTY_ID,
        nodePayload: { text: "fine", temperature: "about 0.7" },
        solverId: SOLVER_ID,
      }),
    ).rejects.toThrow(/expects a number/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a legacy bounty, which has stages and blocks rather than nodes", async () => {
    db.next.bounties = [
      {
        data: { ...OPEN_BOUNTY, build_id: null, gap_node_id: null, legacy_item_id: LEGACY_ITEM_ID },
        error: null,
      },
    ];

    await expect(
      submitSolution({
        bountyId: BOUNTY_ID,
        nodePayload: { text: "fine" },
        solverId: SOLVER_ID,
      }),
    ).rejects.toThrow(/legacy bounty/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("refuses a bounty that is not open", async () => {
    db.next.bounties = [{ data: { ...OPEN_BOUNTY, status: "closed" }, error: null }];

    await expect(
      submitSolution({
        bountyId: BOUNTY_ID,
        nodePayload: { text: "fine" },
        solverId: SOLVER_ID,
      }),
    ).rejects.toThrow(/closed/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });
});

describe("acceptSolution", () => {
  const SUBMITTED = {
    id: SOLUTION_ID,
    bounty_id: BOUNTY_ID,
    slot_kind: "node",
    slot_id: GAP_NODE_ID,
    solver_id: SOLVER_ID,
    status: "submitted",
    content_payload: { text: "Retry with a shorter context", temperature: 0.7 },
  };

  it("hands the whole acceptance to the transaction and reports what it did", async () => {
    db.next.solutions = [{ data: SUBMITTED, error: null }];
    db.next.build_nodes = [{ data: { id: GAP_NODE_ID, type: "prompt" }, error: null }];
    db.rpcNext = [
      {
        data: {
          bounty_id: BOUNTY_ID,
          solution_id: SOLUTION_ID,
          solver_id: SOLVER_ID,
          author_id: CREATOR_ID,
          node_id: GAP_NODE_ID,
          event_id: "e5e50000-0000-4000-8000-000000000001",
          accepted_at: "2026-08-29T12:00:00Z",
        },
        error: null,
      },
    ];

    const accepted = await acceptSolution(BOUNTY_ID, SOLUTION_ID);

    expect(db.rpcCalls).toEqual([
      {
        fn: "accept_bounty_solution",
        args: { p_bounty_id: BOUNTY_ID, p_solution_id: SOLUTION_ID },
      },
    ]);
    expect(accepted).toMatchObject({
      bountyId: BOUNTY_ID,
      solutionId: SOLUTION_ID,
      solverId: SOLVER_ID,
      // The node the payload was substituted into. is_gap is false on it now,
      // its source_ref credits the solver, and a milestone naming them is on
      // the build's sequence — all five writes, or none of them.
      nodeId: GAP_NODE_ID,
      eventId: "e5e50000-0000-4000-8000-000000000001",
      acceptedAt: "2026-08-29T12:00:00Z",
    });

    // The client does none of the five writes itself. A build_nodes update
    // here, or a bounties update, would mean an acceptance that can half-apply.
    const wrote = (table: string) =>
      queriesFor(table).some((q) =>
        q.ops.some((o) => ["insert", "update", "upsert", "delete"].includes(o.method)),
      );
    expect(wrote("build_nodes")).toBe(false);
    expect(wrote("bounties")).toBe(false);
    expect(wrote("solutions")).toBe(false);
    expect(wrote("build_events")).toBe(false);
    expect(wrote("solution_acceptance_log")).toBe(false);
  });

  it("refuses a solution filed against a different bounty", async () => {
    // The database refuses it too — the function checks the pair — and the
    // client refusing first is what keeps a mis-wired UI from asking at all.
    db.next.solutions = [{ data: null, error: null }];

    await expect(acceptSolution(BOUNTY_ID, SOLUTION_ID)).rejects.toThrow(
      /not filed against this bounty/i,
    );
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("refuses a solution that is not submitted", async () => {
    db.next.solutions = [{ data: { ...SUBMITTED, status: "accepted" }, error: null }];

    await expect(acceptSolution(BOUNTY_ID, SOLUTION_ID)).rejects.toThrow(/accepted/i);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it("re-checks the payload against the node type before substituting it", async () => {
    // The payload was checked when it was submitted. A node type's schema can
    // be edited by an admin in between, and this is the last moment before the
    // payload becomes a node in somebody's published build.
    db.next.solutions = [
      { data: { ...SUBMITTED, content_payload: { text: "fine", model: "gpt-4o" } }, error: null },
    ];
    db.next.build_nodes = [{ data: { id: GAP_NODE_ID, type: "prompt" }, error: null }];

    await expect(acceptSolution(BOUNTY_ID, SOLUTION_ID)).rejects.toThrow(
      /no longer fits the node's type/i,
    );
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("getBounty", () => {
  it("composes the bounty, its build, its gap node and its counts", async () => {
    db.next.bounties = [{ data: OPEN_BOUNTY, error: null }];
    db.next.builds = [{ data: { id: BUILD_ID, title: "Inbox triage agent" }, error: null }];
    db.next.build_nodes = [{ data: GAP_NODE, error: null }];
    db.next.solutions = [
      { data: [], error: null, count: 3 },
      { data: [], error: null, count: 1 },
    ];
    db.next.bounty_discussion_comments = [{ data: [], error: null, count: 7 }];

    const record = await getBounty(BOUNTY_ID);

    expect(record?.bounty.id).toBe(BOUNTY_ID);
    expect(record?.build?.id).toBe(BUILD_ID);
    expect(record?.gapNode?.id).toBe(GAP_NODE_ID);
    expect(record?.counts).toEqual({ solutions: 3, accepted: 1, comments: 7 });

    // Counts are head-only: the rows never cross the wire.
    for (const q of [...queriesFor("solutions"), ...queriesFor("bounty_discussion_comments")]) {
      expect(q.ops.find((o) => o.method === "select")?.args[1]).toMatchObject({
        count: "exact",
        head: true,
      });
    }
  });

  it("is null for a bounty that does not exist, rather than an empty record", async () => {
    db.next.bounties = [{ data: null, error: null }];
    expect(await getBounty(BOUNTY_ID)).toBeNull();
  });
});

describe("listOpenBounties", () => {
  const page = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...OPEN_BOUNTY,
      id: `b0b0b0b0-0000-4000-8000-00000000000${i + 1}`,
      created_at: `2026-08-2${8 - i}T09:00:00Z`,
    }));

  it("reads one row more than it returns, and hands back a cursor", async () => {
    db.next.bounties = [{ data: page(3), error: null }];

    const result = await listOpenBounties({ limit: 2 });

    expect(result.bounties).toHaveLength(2);
    // The extra row is how the caller learns there is another page without a
    // count query. The cursor is the last RETURNED row, not the peeked one.
    expect(result.nextCursor).toBe(result.bounties[1].created_at);
    const q = queriesFor("bounties")[0];
    expect(q.ops.find((o) => o.method === "limit")?.args).toEqual([3]);
    expect(q.ops.find((o) => o.method === "eq")?.args).toEqual(["status", "open"]);
  });

  it("has no cursor on the last page", async () => {
    db.next.bounties = [{ data: page(2), error: null }];
    const result = await listOpenBounties({ limit: 2 });
    expect(result.nextCursor).toBeNull();
  });

  it("pages by created_at rather than by offset", async () => {
    db.next.bounties = [{ data: [], error: null }];
    await listOpenBounties({ limit: 2, before: "2026-08-27T09:00:00Z" });

    const q = queriesFor("bounties")[0];
    expect(q.ops.find((o) => o.method === "lt")?.args).toEqual([
      "created_at",
      "2026-08-27T09:00:00Z",
    ]);
    expect(q.ops.some((o) => o.method === "range")).toBe(false);
  });

  it("can narrow to the bounties that live on a build", async () => {
    db.next.bounties = [{ data: [], error: null }];
    await listOpenBounties({ home: "build" });

    const q = queriesFor("bounties")[0];
    expect(q.ops.find((o) => o.method === "not")?.args).toEqual(["build_id", "is", null]);
  });
});

describe("the legacy seam", () => {
  it("resolves a content_items id to its header, and memoises it", async () => {
    db.next.bounties = [{ data: { id: BOUNTY_ID }, error: null }];

    expect(await resolveBountyByLegacyItem(LEGACY_ITEM_ID)).toBe(BOUNTY_ID);
    expect(await resolveBountyByLegacyItem(LEGACY_ITEM_ID)).toBe(BOUNTY_ID);

    // Once. The mapping is immutable — idx_bounties_legacy_item_unique keeps
    // one header per legacy item and nothing rewrites legacy_item_id — so the
    // second read would be a round trip for an answer already in hand.
    expect(queriesFor("bounties")).toHaveLength(1);
    expect(eqOn(queriesFor("bounties")[0], "legacy_item_id")).toEqual([
      "legacy_item_id",
      LEGACY_ITEM_ID,
    ]);
  });

  it("throws rather than returning null when a legacy bounty has no header", async () => {
    // A caller that got null back would filter on it and render "no solutions
    // yet" over a bounty whose solutions are really there.
    db.next.bounties = [{ data: null, error: null }];

    await expect(resolveBountyByLegacyItem(LEGACY_ITEM_ID)).rejects.toThrow(
      /no bounties record/i,
    );
  });

  it("resolves the other way, and answers null for a bounty on a build", async () => {
    db.next.bounties = [
      { data: { id: BOUNTY_ID, legacy_item_id: LEGACY_ITEM_ID }, error: null },
      { data: { id: "b0b0b0b0-0000-4000-8000-0000000000ff", legacy_item_id: null }, error: null },
    ];

    expect(await legacyItemForBounty(BOUNTY_ID)).toBe(LEGACY_ITEM_ID);
    expect(await legacyItemForBounty("b0b0b0b0-0000-4000-8000-0000000000ff")).toBeNull();

    // The forward memo is populated by the reverse read too: one lookup answers
    // both directions for the same pair.
    expect(await resolveBountyByLegacyItem(LEGACY_ITEM_ID)).toBe(BOUNTY_ID);
    expect(queriesFor("bounties")).toHaveLength(2);
  });
});
