// Tier 3 — the legacy meta-bounty surfaces still find their sub-definitions
// after the repoint (NS-P48).
//
// WHAT CHANGED UNDERNEATH THIS DATA LAYER. Until NS-P48,
// meta_bounty_sub_definitions.meta_bounty_id held the content_items id that a
// legacy meta-bounty page carries in its route and that the home strip and the
// discover expansion both work in, so every query here could filter on it
// directly. It now holds a public.bounties id, and the content_items id lives
// in legacy_meta_item_id, which the database derives from
// bounties.legacy_item_id on every write. spawned_bounty_id moved the same way
// and has legacy_spawned_item_id beside it. Each read that starts from a
// content_items id was moved onto those columns and flagged `// NS-P48 shim`;
// each WRITE resolves or creates the header first, because an insert has to
// supply the real thing. NS-P50 removes both columns when it rewires these
// callers onto bounties directly.
//
// WHAT THIS FILE ASSERTS, AND WHY IT ASSERTS ON THE QUERY. A shim is exactly
// the kind of change no rendered output can distinguish: a strip filtered on
// the wrong column returns nothing, which looks identical to a meta-bounty
// nobody has broken into sub-bounties yet. So these tests read the query that
// was built. If one of them fails after NS-P50, that is the point — the shim it
// names is the thing NS-P50 is removing, and the test should be removed with
// it.
//
// WHY NOT A BROWSER SPEC. The same reason NS-P46 and NS-P47 gave:
// public.bounties answers PGRST205 against the project in supabase/config.toml,
// so no page in that database has been repointed and a browser assertion would
// be about the old shape. The browser half lives in
// e2e/tier3/legacy-meta-bounty.spec.ts, which states its price of entry and
// skips until the migration is applied. The database half — anon reading a
// legacy meta's sub-definitions through the shim under RLS, the author writing
// on their own, a third party refused, and the freeze holding — is proven for
// real in supabase/tests/ns-p48-repoint-meta-sub-definitions.sql, checks 5
// and 6.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** One recorded builder call: the method, and what it was given. */
type Op = { method: string; args: unknown[] };
/** One recorded query: the table, and the chain that was built against it. */
type Query = { table: string; ops: Op[] };

const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  next: {} as Record<string, { data: unknown; error: unknown; count?: number }[]>,
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
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

vi.mock("@/lib/notifications/triggers", () => ({
  notifyMetaBountySubSpawned: vi.fn(() => Promise.resolve()),
}));

import { getMetaBountyState } from "./getMetaBountyState";
import { pledgeToSubBounty } from "./pledgeToSubBounty";
import { createMetaBounty } from "./createMetaBounty";

/**
 * The id in the route of a legacy meta-bounty page, and the id the home strip
 * and the discover query both work in: a content_items row. This is the only id
 * these callers have, and the whole reason the shim columns exist.
 */
const LEGACY_META_ID = "c0ffee00-0000-4000-8000-0000000000a1";
/** The public.bounties row NS-P45's backfill wrote for it. */
const META_HEADER_ID = "b0b0b0b0-0000-4000-8000-0000000000b1";
/** A sub-bounty that has already spawned: a content item, and its header. */
const LEGACY_SPAWNED_ID = "c0ffee00-0000-4000-8000-0000000000a2";
const SPAWNED_HEADER_ID = "b0b0b0b0-0000-4000-8000-0000000000b2";
const AUTHOR_ID = "50fe0000-0000-4000-8000-0000000000f1";

const SUB = {
  id: "5b5b0000-0000-4000-8000-0000000000d1",
  title: "Citation checker",
  description: "Verify every citation resolves",
  target_amount: 120,
  spawn_threshold_pct: 100,
  legacy_spawned_item_id: LEGACY_SPAWNED_ID,
  spawned_bounty_id: SPAWNED_HEADER_ID,
  meta_bounty_id: META_HEADER_ID,
  position: 0,
};

function queriesFor(table: string): Query[] {
  return db.queries.filter((q) => q.table === table);
}
function eqOn(query: Query | undefined, column: string): unknown[] | undefined {
  return query?.ops.find((o) => o.method === "eq" && o.args[0] === column)?.args;
}
function eqColumns(query: Query | undefined): string[] {
  return (query?.ops ?? [])
    .filter((o) => o.method === "eq")
    .map((o) => String(o.args[0]));
}
function selectList(query: Query | undefined): string {
  return String(query?.ops.find((o) => o.method === "select")?.args[0] ?? "");
}
/** Whatever was handed to `.insert()`, always as a list of rows. */
function insertPayload(query: Query | undefined): Record<string, unknown>[] {
  const payload = query?.ops.find((o) => o.method === "insert")?.args[0];
  return (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
}
function updatePayload(query: Query | undefined): Record<string, unknown> {
  return query?.ops.find((o) => o.method === "update")?.args[0] as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  db.queries = [];
  db.next = {};
});

describe("NS-P48 — the legacy meta-bounty page reads through the shim", () => {
  it("filters sub-definitions on legacy_meta_item_id, never on meta_bounty_id", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.meta_bounty_sub_definitions = [{ data: [SUB], error: null }];
    db.next.meta_bounty_pledges = [{ data: [], error: null }];

    const state = await getMetaBountyState(LEGACY_META_ID);
    expect(state.subBounties).toHaveLength(1);

    const subs = queriesFor("meta_bounty_sub_definitions")[0];
    expect(eqOn(subs, "legacy_meta_item_id")).toEqual([
      "legacy_meta_item_id",
      LEGACY_META_ID,
    ]);
    // The old filter would return nothing at all: a content_items id cannot
    // match a bounties id, so an un-migrated caller renders a meta-bounty with
    // no sub-bounties rather than an error.
    expect(eqColumns(subs)).not.toContain("meta_bounty_id");
  });

  it("returns a content_items id as spawnedBountyId, because its caller routes on it", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.meta_bounty_sub_definitions = [{ data: [SUB], error: null }];
    db.next.meta_bounty_pledges = [{ data: [], error: null }];

    const state = await getMetaBountyState(LEGACY_META_ID);

    // MetaBountyBody navigates to `/content/${sub.spawnedBountyId}`. A bounties
    // id there is a 404 on a bounty that exists — the quiet kind of wrong.
    expect(state.subBounties[0].spawnedBountyId).toBe(LEGACY_SPAWNED_ID);
    expect(state.subBounties[0].spawnedBountyId).not.toBe(SPAWNED_HEADER_ID);
    expect(selectList(queriesFor("meta_bounty_sub_definitions")[0])).toContain(
      "legacy_spawned_item_id",
    );
  });

  it("leaves meta_bounty_pledges on the content_items id — that is NS-P49's move", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.meta_bounty_sub_definitions = [{ data: [SUB], error: null }];
    db.next.meta_bounty_pledges = [{ data: [], error: null }];

    await getMetaBountyState(LEGACY_META_ID);

    const pledges = queriesFor("meta_bounty_pledges")[0];
    expect(eqOn(pledges, "meta_bounty_id")).toEqual([
      "meta_bounty_id",
      LEGACY_META_ID,
    ]);
  });
});

describe("NS-P48 — the discover free-text expansion reads the shim", () => {
  it("selects legacy_meta_item_id, because its rows are OR-included into a content_items id filter", async () => {
    const { queryBlueprints } = await import("@/lib/discover/queryBlueprints");

    db.next.meta_bounty_sub_definitions = [
      { data: [{ legacy_meta_item_id: LEGACY_META_ID }], error: null },
    ];
    db.next.content_items = [
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ];

    await queryBlueprints({ query: "citation", postType: "bounty" });

    const expansion = queriesFor("meta_bounty_sub_definitions")[0];
    expect(selectList(expansion)).toBe("legacy_meta_item_id");
    // Selecting meta_bounty_id would hand the caller bounties ids, which match
    // no content_items row — the search would quietly stop matching sub-bounty
    // titles rather than fail.
    expect(selectList(expansion)).not.toContain("meta_bounty_id");
  });
});

describe("NS-P48 — the writes supply a bounties id, because an insert cannot use the shim", () => {
  it("createMetaBounty files its sub-definitions against a header it creates, not against the content item", async () => {
    db.next.content_items = [{ data: { id: LEGACY_META_ID }, error: null }];
    db.next.bounties = [{ data: { id: META_HEADER_ID }, error: null }];
    db.next.meta_bounty_sub_definitions = [{ data: null, error: null }];

    const { metaBountyId } = await createMetaBounty({
      authorId: AUTHOR_ID,
      title: "Meta",
      subBountyDefinitions: [{ title: "Citation checker", targetAmount: 120 }],
      fundingDeadline: "2026-09-30T00:00:00Z",
    });

    // The caller still gets the content_items id back: that is what /content/:id
    // routes on and what every legacy surface passes around.
    expect(metaBountyId).toBe(LEGACY_META_ID);

    // The header is a LEGACY one, which is what the NS-P48 freeze admits.
    const header = insertPayload(queriesFor("bounties")[0])[0];
    expect(header).toMatchObject({
      legacy_item_id: LEGACY_META_ID,
      author_id: AUTHOR_ID,
      is_meta: true,
      closes_at: "2026-09-30T00:00:00Z",
    });

    const subs = insertPayload(queriesFor("meta_bounty_sub_definitions")[0]);
    expect(subs[0].meta_bounty_id).toBe(META_HEADER_ID);
    expect(subs[0].meta_bounty_id).not.toBe(LEGACY_META_ID);
  });

  it("the spawn writes a bounties id into spawned_bounty_id and notifies with the content_items id", async () => {
    const { notifyMetaBountySubSpawned } = await import("@/lib/notifications/triggers");

    db.next.content_items = [
      // the meta, read first
      { data: { id: LEGACY_META_ID, creator_id: AUTHOR_ID, bounty_is_meta: true, title: "Meta" }, error: null },
      // the spawned content item, created when the threshold is crossed
      { data: { id: LEGACY_SPAWNED_ID }, error: null },
    ];
    db.next.meta_bounty_sub_definitions = [
      { data: [{ ...SUB, spawned_bounty_id: null, legacy_spawned_item_id: null }], error: null },
      { data: null, error: null },
    ];
    db.next.meta_bounty_pledges = [
      { data: { id: "9e0d0000-0000-4000-8000-000000000001" }, error: null },
      { data: [{ amount: 120, pledger_id: AUTHOR_ID }], error: null },
    ];
    db.next.bounties = [{ data: { id: SPAWNED_HEADER_ID }, error: null }];

    await pledgeToSubBounty({
      metaBountyId: LEGACY_META_ID,
      subBountyIndex: 0,
      pledgerId: AUTHOR_ID,
      amount: 120,
    });

    // The sub-definitions are found through the shim...
    expect(eqOn(queriesFor("meta_bounty_sub_definitions")[0], "legacy_meta_item_id"))
      .toEqual(["legacy_meta_item_id", LEGACY_META_ID]);

    // ...the spawned bounty gets a header carrying the pledged total...
    expect(insertPayload(queriesFor("bounties")[0])[0]).toMatchObject({
      legacy_item_id: LEGACY_SPAWNED_ID,
      author_id: AUTHOR_ID,
      reward_gbp: 120,
      meta_parent_id: META_HEADER_ID,
    });

    // ...and the pointer written back is that header, not the content item.
    const update = updatePayload(queriesFor("meta_bounty_sub_definitions")[1]);
    expect(update).toEqual({ spawned_bounty_id: SPAWNED_HEADER_ID });

    // The notification target is a route, so it stays the content_items id.
    expect(notifyMetaBountySubSpawned).toHaveBeenCalledWith(
      expect.objectContaining({
        metaBountyId: LEGACY_META_ID,
        spawnedBountyId: LEGACY_SPAWNED_ID,
      }),
    );
  });
});
