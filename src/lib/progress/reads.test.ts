// RC-P27 — the progress page's reads ask for what they need and fail honestly.
//
// Each read is recorded through a stand-in for supabase-js: the table, the
// columns (named, never *), the filters and the cap (CONTRACT §2.8). A failed
// read throws a ProgressReadError carrying identifiers only, and a refusal is
// one isPermissionError recognises (STATES.md row 21). The badge order is
// earned first, catalogue order kept.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];

const stand = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; chain: Call[] }>,
  answer: { data: null as unknown, error: null as unknown, status: 200 },
}));

vi.mock("@/integrations/supabase/client", () => {
  const builder = (record: { table: string; chain: Call[] }): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(stand.answer).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            record.chain.push([prop, ...args]);
            return builder(record);
          };
        },
      },
    );
  return {
    supabase: {
      from: (table: string) => {
        const record = { table, chain: [] as Call[] };
        stand.calls.push(record);
        return builder(record);
      },
    },
  };
});

import { isPermissionError } from "@/lib/errors/permission";
import { getProgressFigures } from "./index";
import { badgesInOrder, getMyBadgeKeys } from "./badges";
import { ProgressReadError } from "./errors";
import { WEEK_EVENTS_LIMIT, getMyWeekEvents } from "./weekly";

const USER = "reader-1";
const SLUGS = ["first-build", "runner", "solver", "proven", "rebuilt", "keeper", "founder", "well-proven", "family", "fixer"];

beforeEach(() => {
  stand.calls = [];
  stand.answer = { data: null, error: null, status: 200 };
});

const only = () => {
  expect(stand.calls).toHaveLength(1);
  return stand.calls[0];
};
const method = (chain: Call[], name: string) => chain.filter(([prop]) => prop === name).map(([, ...args]) => args);

describe("getProgressFigures", () => {
  it("reads two named columns of the reader's one user_progress row", async () => {
    stand.answer = { data: { xp_total: 412, level: 3 }, error: null, status: 200 };

    await expect(getProgressFigures(USER)).resolves.toEqual({ xp_total: 412, level: 3 });
    const { table, chain } = only();
    expect(table).toBe("user_progress");
    expect(method(chain, "select")).toEqual([["xp_total, level"]]);
    expect(method(chain, "eq")).toEqual([["user_id", USER]]);
    expect(method(chain, "maybeSingle")).toEqual([[]]);
  });

  it("answers null when the reader has no row yet, which is the start", async () => {
    await expect(getProgressFigures(USER)).resolves.toBeNull();
  });

  it("throws a refusal it can be told by, never the start", async () => {
    stand.answer = { data: null, error: { code: "42501", message: "permission denied for table user_progress" }, status: 403 };

    const error = await getProgressFigures(USER).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProgressReadError);
    expect(isPermissionError(error)).toBe(true);
    expect((error as ProgressReadError).message).toBe(`getProgressFigures failed (user ${USER})`);
    expect((error as ProgressReadError).message).not.toContain("permission denied");
  });
});

describe("getMyWeekEvents", () => {
  it("reads this week's rows of the three challenge reasons from the ledger, capped", async () => {
    stand.answer = { data: [], error: null, status: 200 };

    await getMyWeekEvents(USER, new Date("2026-09-30T12:00:00Z"));
    const { table, chain } = only();
    expect(table).toBe("xp_events");
    expect(method(chain, "select")).toEqual([["reason, source_id, created_at"]]);
    expect(method(chain, "eq")).toEqual([["user_id", USER]]);
    expect(method(chain, "in")).toEqual([["reason", ["run_reported", "solution_accepted", "build_reconfirmed"]]]);
    expect(method(chain, "gte")).toEqual([["created_at", "2026-09-28T00:00:00.000Z"]]);
    expect(method(chain, "order")).toEqual([["created_at", { ascending: false }]]);
    expect(method(chain, "limit")).toEqual([[WEEK_EVENTS_LIMIT]]);
  });

  it("throws with the code and status only", async () => {
    stand.answer = { data: null, error: { code: "XX000", message: "internal" }, status: 500 };

    const error = (await getMyWeekEvents(USER).catch((caught: unknown) => caught)) as ProgressReadError;
    expect(error.operation).toBe("getMyWeekEvents");
    expect([error.code, error.status]).toEqual(["XX000", 500]);
    expect(isPermissionError(error)).toBe(false);
  });
});

describe("getMyBadgeKeys", () => {
  it("asks for the ten slugs only, at most ten rows, and answers the held set", async () => {
    stand.answer = { data: [{ badge_key: "founder" }, { badge_key: "runner" }], error: null, status: 200 };

    const held = await getMyBadgeKeys(USER, SLUGS);
    expect([...held].sort()).toEqual(["founder", "runner"]);
    const { table, chain } = only();
    expect(table).toBe("user_badges");
    expect(method(chain, "select")).toEqual([["badge_key"]]);
    expect(method(chain, "eq")).toEqual([["user_id", USER]]);
    expect(method(chain, "in")).toEqual([["badge_key", SLUGS]]);
    expect(method(chain, "limit")).toEqual([[10]]);
  });
});

describe("the badge order", () => {
  it("puts the earned first and keeps the catalogue's order within each group", () => {
    const catalogue = SLUGS.map((id) => ({ id }));
    const ordered = badgesInOrder(catalogue, new Set(["well-proven", "runner"]));
    expect(ordered.map(({ badge, earned }) => `${badge.id}:${earned ? "earned" : "not yet"}`)).toEqual([
      "runner:earned",
      "well-proven:earned",
      "first-build:not yet",
      "solver:not yet",
      "proven:not yet",
      "rebuilt:not yet",
      "keeper:not yet",
      "founder:not yet",
      "family:not yet",
      "fixer:not yet",
    ]);
  });
});
