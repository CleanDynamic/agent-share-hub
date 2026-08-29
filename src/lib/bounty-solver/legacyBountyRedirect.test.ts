// Tier 3 — the legacy bounty page still finds its solutions with the shim gone
// (NS-P50).
//
// WHAT THIS FILE WAS, AND WHY IT IS STILL HERE. It was legacyBountyShim.test.ts
// and it asserted the opposite of what it asserts now: that every read named
// solutions.legacy_bounty_item_id, the derived column NS-P46 added so a page
// routed on a content_items id could keep working after the repoint. NS-P50
// dropped that column and rewired the callers onto public.bounties, so the
// assertions moved with them. The QUESTION did not change — does the legacy
// bounty page still find its own solutions? — and that is why this is a rewrite
// rather than a deletion.
//
// WHY IT ASSERTS ON THE QUERY. A redirect is exactly the kind of change no
// rendered output can distinguish: a listing that filters on the wrong column
// returns nothing, which looks identical to a bounty nobody has solved yet. So
// these tests read the query that was built. The one extra round trip the
// redirect costs is asserted too — once per session, not once per read — because
// a resolve that stopped being memoised would show up as latency on a page
// nobody is watching and nowhere else.
//
// WHY NOT A BROWSER SPEC. The same reason NS-P46 gave, unchanged: public.
// bounties answers PGRST205 on the project in supabase/config.toml, so no page
// in that database has been repointed and a browser assertion would be about
// the old shape. The browser half lives in
// e2e/tier3/legacy-bounty-solutions.spec.ts, which states its price of entry
// and skips until the migrations are applied. The database half — anon listing
// a bounty's solutions and a signed-in reader voting on one, under real RLS —
// is proven in supabase/tests/ns-p46-repoint-solutions.sql, check 6.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** One recorded builder call: the method, and what it was given. */
type Op = { method: string; args: unknown[] };
/** One recorded query: the table, and the chain that was built against it. */
type Query = { table: string; ops: Op[] };

const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  /**
   * Responses to hand back, per table, in call order. A table with nothing
   * queued answers with an empty result, which is what an unrelated read in a
   * best-effort block should get.
   */
  next: {} as Record<string, { data: unknown; error: unknown; count?: number }[]>,
  channels: [] as { name: string; config: Record<string, unknown> }[],
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
      rpc: () => chainFor("__rpc"),
      channel: (name: string) => {
        const rec = { name, config: {} as Record<string, unknown> };
        db.channels.push(rec);
        const ch = {
          on: (_event: string, config: Record<string, unknown>) => {
            rec.config = config;
            return ch;
          },
          subscribe: () => ch,
        };
        return ch;
      },
      removeChannel: () => {},
    },
  };
});

vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/metadata/recomputeMetadata", () => ({
  recomputeMetadata: vi.fn(() => Promise.resolve()),
}));

import { clearBountyResolutionCache } from "@/lib/bounty/resolveLegacy";
import { acceptSolution } from "./acceptSolution";
import { createSolutionDraft } from "./createSolutionDraft";
import { getProvenance } from "./getProvenance";
import { getSolutions } from "./getSolutions";
import { voteOnSolution } from "./voteOnSolution";

/**
 * The id in the route of a legacy bounty page: a content_items row. This is the
 * only id these callers have, and the whole reason the resolve exists.
 */
const LEGACY_ITEM_ID = "c0ffee00-0000-4000-8000-000000000001";
/** The public.bounties row NS-P45's backfill wrote for it. */
const BOUNTY_ROW_ID = "b0b0b0b0-0000-4000-8000-000000000001";

const SOLUTION = {
  id: "50100000-0000-4000-8000-000000000001",
  bounty_id: BOUNTY_ROW_ID,
  slot_kind: "stage" as const,
  slot_id: "51070000-0000-4000-8000-000000000001",
  solver_id: "50fe0000-0000-4000-8000-000000000001",
  solver_note: null,
  content_payload: { answer: "yes" },
  vote_count: 1,
  i_would_implement_count: 0,
  status: "submitted" as const,
  submitted_at: "2026-08-20T10:00:00Z",
  accepted_at: null,
  created_at: "2026-08-20T09:00:00Z",
  updated_at: "2026-08-20T10:00:00Z",
};

/** The header row the resolve reads, in both directions. */
const HEADER = { id: BOUNTY_ROW_ID, legacy_item_id: LEGACY_ITEM_ID };

/** Every query built against `table`, in the order it was built. */
function queriesFor(table: string): Query[] {
  return db.queries.filter((q) => q.table === table);
}

/** The argument list of the first `.eq()` naming `column`, or undefined. */
function eqOn(query: Query | undefined, column: string): unknown[] | undefined {
  return query?.ops.find((o) => o.method === "eq" && o.args[0] === column)?.args;
}

/** Every column any `.eq()` in this query filtered on. */
function eqColumns(query: Query | undefined): string[] {
  return (query?.ops ?? [])
    .filter((o) => o.method === "eq")
    .map((o) => String(o.args[0]));
}

beforeEach(() => {
  db.queries = [];
  db.next = {};
  db.channels = [];
  // The resolve memoises for the life of the session, which is the point of it
  // and would otherwise leak one test's mapping into the next.
  clearBountyResolutionCache();
});

describe("NS-P50 — the legacy bounty page lists its solutions through bounties", () => {
  it("resolves the header, then filters solutions on bounty_id", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.solutions = [{ data: [SOLUTION], error: null }];
    db.next.profiles = [{ data: [], error: null }];
    db.next.solution_votes = [{ data: [], error: null }];
    db.next.solution_comments = [{ data: [], error: null }];

    const { solutions } = await getSolutions({ bountyId: LEGACY_ITEM_ID });

    // The mapping NS-P45 backfilled, read from the column it lives on.
    expect(eqOn(queriesFor("bounties")[0], "legacy_item_id")).toEqual([
      "legacy_item_id",
      LEGACY_ITEM_ID,
    ]);

    const listing = queriesFor("solutions")[0];
    expect(eqOn(listing, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
    // Filtering on the route's id would return nothing at all: a content_items
    // id cannot match a bounties id, and an empty list is indistinguishable
    // from a bounty nobody has solved.
    expect(eqOn(listing, "bounty_id")).not.toEqual(["bounty_id", LEGACY_ITEM_ID]);
    expect(eqColumns(listing)).not.toContain("legacy_bounty_item_id");
    expect(solutions).toHaveLength(1);
  });

  it("reads the acceptance log on bounty_id too", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.content_items = [{ data: { id: LEGACY_ITEM_ID, creator_id: "a" }, error: null }];
    db.next.profiles = [{ data: [], error: null }];
    db.next.solution_acceptance_log = [{ data: [], error: null }];

    await getProvenance(LEGACY_ITEM_ID);

    const log = queriesFor("solution_acceptance_log")[0];
    expect(eqOn(log, "bounty_id")).toEqual(["bounty_id", BOUNTY_ROW_ID]);
    expect(eqColumns(log)).not.toContain("legacy_bounty_item_id");
  });

  it("resolves once per session, however many reads run", async () => {
    // The redirect costs one extra round trip. It costs it ONCE: the mapping is
    // immutable — one header per legacy item, enforced by
    // idx_bounties_legacy_item_unique — so a page that lists solutions and then
    // reads its provenance must not pay for it twice.
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.solutions = [{ data: [], error: null }];
    db.next.content_items = [{ data: { id: LEGACY_ITEM_ID, creator_id: "a" }, error: null }];
    db.next.solution_acceptance_log = [{ data: [], error: null }];

    await getSolutions({ bountyId: LEGACY_ITEM_ID });
    await getProvenance(LEGACY_ITEM_ID);

    expect(queriesFor("bounties")).toHaveLength(1);
  });

  it("subscribes to live solution updates on bounty_id", async () => {
    // The realtime filter is a string, not a builder, so it is the one redirect
    // no query recorder would catch. A postgres_changes filter cannot join,
    // which is why the hook resolves before it opens the channel; left on the
    // route's id it matches nothing and the page stops updating — silently.
    db.next.bounties = [{ data: HEADER, error: null }];

    const { useBountySolutionUpdates } = await import("./realtime");
    const { renderHook, waitFor } = await import("@testing-library/react");

    renderHook(() => useBountySolutionUpdates(LEGACY_ITEM_ID, () => {}));

    await waitFor(() => expect(db.channels).toHaveLength(1));
    expect(db.channels[0].config).toMatchObject({
      table: "solutions",
      filter: `bounty_id=eq.${BOUNTY_ROW_ID}`,
    });
  });
});

describe("NS-P50 — reads and writes both name the bounties id", () => {
  it("resolves the header once and uses it for the lookup and the insert", async () => {
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.solutions = [
      { data: null, error: null }, // no existing draft
      { data: { ...SOLUTION, status: "draft" }, error: null }, // the insert's returning row
    ];

    await createSolutionDraft({
      bountyId: LEGACY_ITEM_ID,
      slotKind: "stage",
      slotId: SOLUTION.slot_id,
      solverId: SOLUTION.solver_id,
    });

    // One resolve, two uses. Before NS-P50 the lookup read the shim column and
    // only the insert resolved, so this is the assertion that the pair now
    // agrees on one id.
    expect(queriesFor("bounties")).toHaveLength(1);
    expect(eqOn(queriesFor("solutions")[0], "bounty_id")).toEqual([
      "bounty_id",
      BOUNTY_ROW_ID,
    ]);

    // And the row written names the bounty, not the content item. Writing the
    // content_items id here would be rejected by the foreign key — this asserts
    // the client sends the right thing rather than relying on the database to
    // reject the wrong one.
    const insert = queriesFor("solutions")[1].ops.find((o) => o.method === "insert");
    expect(insert?.args[0]).toMatchObject({ bounty_id: BOUNTY_ROW_ID });
    expect(insert?.args[0]).not.toMatchObject({ bounty_id: LEGACY_ITEM_ID });
  });

  it("refuses to file a draft against a bounty that has no header", async () => {
    // The NS-P45 backfill wrote one header per legacy bounty, so this cannot
    // happen for anything published before it. It can happen for a bounty
    // created afterwards by a path that does not write one — and a silent
    // no-op there would lose the solver's work. Since NS-P50 the refusal comes
    // before the read as well as before the write.
    db.next.bounties = [{ data: null, error: null }];

    await expect(
      createSolutionDraft({
        bountyId: LEGACY_ITEM_ID,
        slotKind: "stage",
        slotId: SOLUTION.slot_id,
        solverId: SOLUTION.solver_id,
      }),
    ).rejects.toThrow(/no bounties record/i);

    expect(queriesFor("solutions")).toHaveLength(0);
  });

  it("accepts a solution against the legacy content item, and logs the bounty", async () => {
    db.next.solutions = [
      { data: SOLUTION, error: null }, // 1. load the solution
      { data: null, error: null }, // 2. nothing accepted on this slot yet
      { data: [], error: null }, // 3a. the status update
    ];
    // The reverse resolve: the solution carries a bounties id, and the legacy
    // merge below needs the content_items id its header names.
    db.next.bounties = [{ data: HEADER, error: null }];
    db.next.content_items = [
      {
        data: {
          id: LEGACY_ITEM_ID,
          creator_id: "acc00000-0000-4000-8000-000000000001",
          stage_grids: {},
          bounty_solved_count: 0,
          bounty_total_slots: 2,
          bounty_reward_amount: 0,
          bounty_reward_type: "none",
        },
        error: null,
      },
      { data: [], error: null }, // the stage_grids merge
    ];
    db.next.solution_acceptance_log = [{ data: [], error: null }];
    db.next.profiles = [{ data: null, error: null }, { data: [], error: null }];

    await acceptSolution({
      solutionId: SOLUTION.id,
      accepterId: "acc00000-0000-4000-8000-000000000001",
    });

    // The header is looked up by its own id, which is what the solution holds.
    expect(eqOn(queriesFor("bounties")[0], "id")).toEqual(["id", BOUNTY_ROW_ID]);

    // Both content_items touches use the legacy id: the bounty read that
    // authorises the accept, and the stage_grids write that merges the answer
    // back into the blueprint.
    for (const q of queriesFor("content_items")) {
      expect(eqOn(q, "id")).toEqual(["id", LEGACY_ITEM_ID]);
    }

    // The acceptance log takes the bounties id, which is exactly what
    // solution.bounty_id holds.
    const logged = queriesFor("solution_acceptance_log")[0].ops.find(
      (o) => o.method === "insert",
    );
    expect(logged?.args[0]).toMatchObject({
      solution_id: SOLUTION.id,
      bounty_id: BOUNTY_ROW_ID,
    });
  });

  it("will not accept a build-backed solution down the legacy path", async () => {
    // A bounty that lives on a build has no legacy item and no stage_grids to
    // merge into. Left unguarded, this function would read content_items with a
    // null id, fail the author check, and could merge an answer into whatever
    // row it did find. The header says which kind of bounty it is; before
    // NS-P50 a derived column on the solution said it.
    db.next.solutions = [{ data: SOLUTION, error: null }];
    db.next.bounties = [{ data: { id: BOUNTY_ROW_ID, legacy_item_id: null }, error: null }];

    await expect(
      acceptSolution({
        solutionId: SOLUTION.id,
        accepterId: "acc00000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow(/build bounty/i);

    // Nothing was written on the way to that throw.
    expect(queriesFor("content_items")).toHaveLength(0);
    expect(queriesFor("solution_acceptance_log")).toHaveLength(0);
  });
});

describe("NS-P50 — voting is untouched by the redirect", () => {
  it("votes by solution id and needs no bounty id at all", async () => {
    // solution_votes foreign-keys solutions(id), which NS-P46 did not move and
    // NS-P50 does not either, so this path should not have changed. Asserted
    // rather than assumed: it is the second half of the live acceptance, and a
    // vote that started needing a bounty id would be a sign the redirect had
    // leaked into it.
    db.next.solution_votes = [
      { data: null, error: null }, // not voted yet
      { data: [], error: null }, // the insert
    ];
    db.next.solutions = [{ data: { vote_count: 2, i_would_implement_count: 0 }, error: null }];

    const result = await voteOnSolution({
      solutionId: SOLUTION.id,
      voterId: "40e70000-0000-4000-8000-000000000001",
      voteKind: "upvote",
    });

    expect(result).toEqual({ voted: true, newCount: 2 });
    expect(queriesFor("bounties")).toHaveLength(0);
    for (const q of [...queriesFor("solution_votes"), ...queriesFor("solutions")]) {
      expect(eqColumns(q)).not.toContain("bounty_id");
      expect(eqColumns(q)).not.toContain("legacy_bounty_item_id");
    }
  });
});
