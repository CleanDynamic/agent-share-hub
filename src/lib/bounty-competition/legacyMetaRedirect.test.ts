// Tier 3 — the legacy meta-bounty surfaces still find their sub-definitions
// with the shims gone (NS-P50).
//
// WHAT CHANGED UNDERNEATH THIS DATA LAYER, TWICE. Until NS-P48,
// meta_bounty_sub_definitions.meta_bounty_id held the content_items id that a
// legacy meta-bounty page carries in its route and that the home strip and the
// discover expansion both work in, so every query here could filter on it
// directly. NS-P48 moved it and spawned_bounty_id onto public.bounties and kept
// the reads working through derived legacy_meta_item_id and
// legacy_spawned_item_id columns. NS-P50 dropped both: every read resolves the
// header first and filters meta_bounty_id, and every id handed back to a caller
// that routes on /content/:id is mapped back through bounties.legacy_item_id.
//
// WHAT THIS FILE ASSERTS, AND WHY IT ASSERTS ON THE QUERY. A redirect is
// exactly the kind of change no rendered output can distinguish: a strip
// filtered on the wrong column returns nothing, which looks identical to a
// meta-bounty nobody has broken into sub-bounties yet. So these tests read the
// query that was built.
//
// WHY NOT A BROWSER SPEC. The same reason NS-P46 and NS-P47 gave:
// public.bounties answers PGRST205 against the project in supabase/config.toml,
// so no page in that database has been repointed and a browser assertion would
// be about the old shape. The browser half lives in
// e2e/tier3/legacy-meta-bounty.spec.ts, which states its price of entry and
// skips until the migration is applied. The database half — anon reading a
// legacy meta's sub-definitions under RLS, the author writing on their own, a
// third party refused, and the freeze holding — is proven for real in
// supabase/tests/ns-p48-repoint-meta-sub-definitions.sql, checks 5 and 6.

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

import { clearBountyResolutionCache } from "@/lib/bounty/resolveLegacy";
import { getMetaBountyState } from "./getMetaBountyState";
import { pledgeToSubBounty } from "./pledgeToSubBounty";
import { createMetaBounty } from "./createMetaBounty";

/**
 * The id in the route of a legacy meta-bounty page, and the id the home strip
 * and the discover query both work in: a content_items row. This is the only id
 * these callers have, and the whole reason the resolve exists.
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
  spawned_bounty_id: SPAWNED_HEADER_ID,
  meta_bounty_id: META_HEADER_ID,
  position: 0,
};

/** The two header rows the resolve reads, in whichever direction it is asked. */
const META_HEADER = { id: META_HEADER_ID, legacy_item_id: LEGACY_META_ID };
const SPAWNED_HEADER = { id: SPAWNED_HEADER_ID, legacy_item_id: LEGACY_SPAWNED_ID };

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
  // The resolve memoises for the life of the session, which is the point of it
  // and would otherwise leak one test's mapping into the next.
  clearBountyResolutionCache();
});

describe("NS-P50 — the legacy meta-bounty page reads through bounties", () => {
  it("resolves the header, then filters sub-definitions on meta_bounty_id", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.bounties = [{ data: META_HEADER, error: null }, { data: [SPAWNED_HEADER], error: null }];
    db.next.meta_bounty_sub_definitions = [{ data: [SUB], error: null }];
    db.next.meta_bounty_pledges = [{ data: [], error: null }];

    const state = await getMetaBountyState(LEGACY_META_ID);
    expect(state.subBounties).toHaveLength(1);

    expect(eqOn(queriesFor("bounties")[0], "legacy_item_id")).toEqual([
      "legacy_item_id",
      LEGACY_META_ID,
    ]);

    const subs = queriesFor("meta_bounty_sub_definitions")[0];
    expect(eqOn(subs, "meta_bounty_id")).toEqual(["meta_bounty_id", META_HEADER_ID]);
    // The route's id in that filter matches nothing at all: a content_items id
    // cannot match a bounties id, so a caller that skipped the resolve renders
    // a meta-bounty with no sub-bounties rather than an error.
    expect(eqOn(subs, "meta_bounty_id")).not.toEqual(["meta_bounty_id", LEGACY_META_ID]);
    expect(eqColumns(subs)).not.toContain("legacy_meta_item_id");
  });

  it("maps spawnedBountyId back to a content_items id, because its caller routes on it", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.bounties = [{ data: META_HEADER, error: null }, { data: [SPAWNED_HEADER], error: null }];
    db.next.meta_bounty_sub_definitions = [{ data: [SUB], error: null }];
    db.next.meta_bounty_pledges = [{ data: [], error: null }];

    const state = await getMetaBountyState(LEGACY_META_ID);

    // MetaBountyBody navigates to `/content/${sub.spawnedBountyId}`. A bounties
    // id there is a 404 on a bounty that exists — the quiet kind of wrong. The
    // reverse resolve is what NS-P50 replaced legacy_spawned_item_id with, and
    // it runs once for every spawn on the page.
    expect(state.subBounties[0].spawnedBountyId).toBe(LEGACY_SPAWNED_ID);
    expect(state.subBounties[0].spawnedBountyId).not.toBe(SPAWNED_HEADER_ID);
    expect(selectList(queriesFor("meta_bounty_sub_definitions")[0])).toContain(
      "spawned_bounty_id",
    );
    expect(selectList(queriesFor("meta_bounty_sub_definitions")[0])).not.toContain(
      "legacy_spawned_item_id",
    );
  });

  it("leaves meta_bounty_pledges on the content_items id — that is NS-P49's move", async () => {
    db.next.content_items = [
      { data: { id: LEGACY_META_ID, title: "Meta", bounty_is_meta: true }, error: null },
    ];
    db.next.bounties = [{ data: META_HEADER, error: null }, { data: [SPAWNED_HEADER], error: null }];
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

describe("NS-P50 — the discover free-text expansion maps its matches back", () => {
  it("selects meta_bounty_id and returns the content_items ids those headers name", async () => {
    const { queryBlueprints } = await import("@/lib/discover/queryBlueprints");

    db.next.meta_bounty_sub_definitions = [
      { data: [{ meta_bounty_id: META_HEADER_ID }], error: null },
    ];
    db.next.bounties = [{ data: [META_HEADER], error: null }];
    db.next.content_items = [
      { data: [], error: null },
      { data: [], error: null, count: 0 },
    ];

    await queryBlueprints({ query: "citation", postType: "bounty" });

    const expansion = queriesFor("meta_bounty_sub_definitions")[0];
    expect(selectList(expansion)).toBe("meta_bounty_id");

    // The caller OR-includes what comes back into a content_items id filter, so
    // handing it bounties ids would match no content_items row — the search
    // would quietly stop matching sub-bounty titles rather than fail. The
    // reverse resolve is what turns them back.
    const mapping = queriesFor("bounties")[0];
    expect(mapping.ops.find((o) => o.method === "in")?.args).toEqual([
      "id",
      [META_HEADER_ID],
    ]);
    // The rows query OR-includes them as `id.in.(...)`, alongside its own
    // free-text predicate. The id in that list has to be a content_items one.
    const idFilters = queriesFor("content_items")[0].ops
      .filter((o) => o.method === "or")
      .map((o) => String(o.args[0] ?? ""))
      .filter((f) => f.startsWith("id.in."));
    expect(idFilters).toEqual([`id.in.(${LEGACY_META_ID})`]);
  });
});

describe("NS-P50 — the writes supply a bounties id, as they always have", () => {
  // UPDATED BY NS-P54, NOT DELETED. Until NS-P54 this case asserted the NS-P48
  // filing claim — that createMetaBounty attaches a LEGACY header and files its
  // sub-definitions against that header's id rather than against the content
  // item's. That claim is no longer assertable from here, because
  // createMetaBounty is frozen and can no longer reach the write. It has not
  // gone untested: the sibling case below proves the same header-versus-content
  // -item distinction on the spawn path, which is NOT frozen and is the one a
  // reader can still reach.
  //
  // What this case asserts instead is the thing that IS now in question: that
  // the freeze is a refusal rather than a failed write. Restoring the original
  // assertions is a step of the NS-P54 rollback in docs/retired-surfaces.md.
  it("createMetaBounty is frozen — it refuses before it writes anything", async () => {
    db.next.content_items = [{ data: { id: LEGACY_META_ID }, error: null }];
    db.next.bounties = [{ data: { id: META_HEADER_ID }, error: null }];
    db.next.meta_bounty_sub_definitions = [{ data: null, error: null }];

    await expect(
      createMetaBounty({
        authorId: AUTHOR_ID,
        title: "Meta",
        subBountyDefinitions: [{ title: "Citation checker", targetAmount: 120 }],
        fundingDeadline: "2026-09-30T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "BOUNTY_RETIRED" });

    // Not a rolled-back write: no query of any kind was built.
    expect(queriesFor("content_items")).toEqual([]);
    expect(queriesFor("bounties")).toEqual([]);
    expect(queriesFor("meta_bounty_sub_definitions")).toEqual([]);
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
      { data: [{ ...SUB, spawned_bounty_id: null }], error: null },
      { data: null, error: null },
    ];
    db.next.meta_bounty_pledges = [
      { data: { id: "9e0d0000-0000-4000-8000-000000000001" }, error: null },
      { data: [{ amount: 120, pledger_id: AUTHOR_ID }], error: null },
    ];
    db.next.bounties = [
      // the resolve of the meta the pledge names, then the spawned header's insert
      { data: META_HEADER, error: null },
      { data: { id: SPAWNED_HEADER_ID }, error: null },
    ];

    await pledgeToSubBounty({
      metaBountyId: LEGACY_META_ID,
      subBountyIndex: 0,
      pledgerId: AUTHOR_ID,
      amount: 120,
    });

    // The sub-definitions are found through the resolved header...
    expect(eqOn(queriesFor("meta_bounty_sub_definitions")[0], "meta_bounty_id"))
      .toEqual(["meta_bounty_id", META_HEADER_ID]);

    // ...the spawned bounty gets a header carrying the pledged total...
    expect(insertPayload(queriesFor("bounties")[1])[0]).toMatchObject({
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
