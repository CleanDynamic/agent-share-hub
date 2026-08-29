// The me-too counter repoint (NS-P54).
//
// WHAT IS IN QUESTION AFTER THE MIGRATION. `content_items.bounty_me_too_count`
// stopped moving; `bounties.me_too_count` did not. So every surface that reads
// the first has to read the second instead, and the failure mode if it does not
// is invisible: a frozen number renders exactly like a live one. Nobody spots
// "this bounty has been on 4 for a month" by eye.
//
// The database half — that a me-too write moves ONE counter now, and that the
// content_items column keeps its last value rather than being zeroed — is
// proven where it can be, against real Postgres, in
// supabase/tests/ns-p54-single-me-too-counter.sql. This file is the client half:
// that the read resolves through bounties.legacy_item_id, that it costs one
// round trip for a whole feed rather than one per card, and that a bounty with
// no header falls back to the frozen value rather than to zero.
//
// THE FALLBACK IS THE POINT, not a nicety. `public.bounties` answers PGRST205 on
// the project this repository points at, so on that database every one of these
// lookups fails — and a card that rendered "0 have this" over a true 4 because
// the header table is not applied yet would be a regression shipped by the fix.

import { beforeEach, describe, expect, it, vi } from "vitest";

/** Every query the module builds: the table, and the filters it named. */
const db = vi.hoisted(() => ({
  queries: [] as { table: string; ops: { method: string; args: unknown[] }[] }[],
  rows: {} as Record<string, unknown[]>,
  error: null as unknown,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const record = { table, ops: [] as { method: string; args: unknown[] }[] };
    db.queries.push(record);
    const chain: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => unknown) =>
              resolve({ data: db.rows[table] ?? [], error: db.error });
          }
          return (...args: unknown[]) => {
            record.ops.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    return chain;
  };
  return { supabase: { from } };
});

import { clearBountyResolutionCache } from "./resolveLegacy";
import { clearLegacyMeTooBatch, legacyMeTooCounts } from "./legacyMeToo";

const LEGACY_A = "c0ffee00-0000-4000-8000-0000000000a1";
const LEGACY_B = "c0ffee00-0000-4000-8000-0000000000a2";
const HEADER_A = "b0b0b0b0-0000-4000-8000-0000000000b1";
const HEADER_B = "b0b0b0b0-0000-4000-8000-0000000000b2";

function queriesFor(table: string) {
  return db.queries.filter((q) => q.table === table);
}
function opArgs(query: { ops: { method: string; args: unknown[] }[] } | undefined, method: string) {
  return query?.ops.find((o) => o.method === method)?.args;
}

beforeEach(() => {
  db.queries = [];
  db.rows = {};
  db.error = null;
  clearBountyResolutionCache();
  clearLegacyMeTooBatch();
});

describe("legacyMeTooCounts", () => {
  it("reads the bounties counter, resolved through legacy_item_id", async () => {
    db.rows.bounties = [
      // the resolve, then the counts — both served by the same stub table
      { id: HEADER_A, legacy_item_id: LEGACY_A, me_too_count: 7 },
      { id: HEADER_B, legacy_item_id: LEGACY_B, me_too_count: 2 },
    ];

    const counts = await legacyMeTooCounts([LEGACY_A, LEGACY_B]);

    expect(counts.get(LEGACY_A)).toBe(7);
    expect(counts.get(LEGACY_B)).toBe(2);

    // TWO round trips for two bounties, not four: the mapping, then the counts.
    expect(queriesFor("bounties")).toHaveLength(2);
    // Nothing asks content_items for the frozen column any more.
    expect(queriesFor("content_items")).toEqual([]);

    // The mapping query filters legacy_item_id; the counts query filters id.
    expect(opArgs(queriesFor("bounties")[0], "in")?.[0]).toBe("legacy_item_id");
    expect(opArgs(queriesFor("bounties")[1], "in")?.[0]).toBe("id");
    // Named columns and a limit on both — no select('*'), no unbounded list.
    expect(opArgs(queriesFor("bounties")[1], "select")?.[0]).toBe("id, me_too_count");
    expect(opArgs(queriesFor("bounties")[1], "limit")?.[0]).toBe(200);
  });

  it("costs the same two round trips for a screenful as for one card", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c0ffee00-0000-4000-8000-00000000${10 + i}`);
    db.rows.bounties = ids.map((legacy, i) => ({
      id: `b0b0b0b0-0000-4000-8000-00000000${10 + i}`,
      legacy_item_id: legacy,
      me_too_count: i,
    }));

    await legacyMeTooCounts(ids);

    expect(queriesFor("bounties")).toHaveLength(2);
  });

  // THE FALLBACK CASES. Absent, not zero — the caller renders the frozen value.
  it("omits a bounty with no header rather than answering zero for it", async () => {
    db.rows.bounties = [{ id: HEADER_A, legacy_item_id: LEGACY_A, me_too_count: 4 }];

    const counts = await legacyMeTooCounts([LEGACY_A, LEGACY_B]);

    expect(counts.get(LEGACY_A)).toBe(4);
    expect(counts.has(LEGACY_B)).toBe(false);
  });

  it("answers nothing at all, and does not throw, when the header table is absent", async () => {
    // PGRST205 — the shape this read actually meets on the live project today.
    db.error = { code: "PGRST205", message: "Could not find the table" };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(legacyMeTooCounts([LEGACY_A])).resolves.toEqual(new Map());
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("asks nothing at all for an empty list", async () => {
    await expect(legacyMeTooCounts([])).resolves.toEqual(new Map());
    expect(db.queries).toEqual([]);
  });
});
