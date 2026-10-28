import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ calls: [] as { values: unknown; ids: unknown }[], error: null as unknown }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => ({
        in: (_column: string, ids: unknown) => {
          db.calls.push({ values, ids });
          return Promise.resolve({ error: db.error });
        },
      }),
    }),
  },
}));

import { contributorOf, creditColumn, creditFor, creditForInsert, creditLine, resetContributorColumn, sessionContributorIds, setTileContributor, tallyContributors, withContributorColumn, withoutCredit } from "./contributors";

const MAKER = "maker";

beforeEach(() => {
  db.calls = [];
  db.error = null;
  resetContributorColumn();
});

describe("who a tile is credited to", () => {
  it("is the maker when no contributor is set", () => {
    expect(contributorOf({ contributor_id: null }, MAKER)).toBe(MAKER);
    expect(contributorOf({ contributor_id: "kit" }, MAKER)).toBe("kit");
  });

  it("leaves the maker's own work null", () => {
    expect(creditFor(MAKER, MAKER)).toBeNull();
    expect(creditFor(undefined, MAKER)).toBeNull();
    expect(creditFor("kit", MAKER)).toBe("kit");
  });

  it("gives a tile inserted from Library its source tile's contributor, else the source's maker", () => {
    expect(creditForInsert({ contributor_id: "dax" }, "kit", MAKER)).toBe("dax");
    expect(creditForInsert({ contributor_id: null }, "kit", MAKER)).toBe("kit");
    expect(creditForInsert({ contributor_id: null }, MAKER, MAKER)).toBeNull();
  });
});

describe("the credit line", () => {
  it("names the maker alone, then up to two contributors, then how many more", () => {
    expect(creditLine("Ana", [])).toBe("Ana");
    expect(creditLine("Ana", ["kit"])).toBe("Ana with @kit");
    expect(creditLine("Ana", ["kit", "dax"])).toBe("Ana with @kit and @dax");
    expect(creditLine("Ana", ["kit", "dax", "lou", "max"])).toBe("Ana with @kit, @dax and 2 more");
  });

  it("orders contributors by number of tiles and leaves the maker out", () => {
    const nodes = [{ contributor_id: "dax" }, { contributor_id: "kit" }, { contributor_id: "kit" }, { contributor_id: MAKER }, { contributor_id: null }];
    expect(tallyContributors(nodes, MAKER)).toEqual([{ id: "kit", tiles: 2 }, { id: "dax", tiles: 1 }]);
  });

  it("counts a session's contributor too", () => {
    expect(sessionContributorIds({ a: { contributor_id: "kit" }, b: {}, c: { contributor_id: MAKER } }, MAKER)).toEqual(["kit"]);
  });
});

describe("before the migration is applied", () => {
  it("drops the credit from a write once the column is known to be missing, by code and never by words", async () => {
    db.error = { code: "42703", message: "anything" };
    expect(await setTileContributor(["n1"], "kit")).toBe(false);
    expect(withContributorColumn("id")).toBe("id");
    expect(creditColumn("kit")).toEqual({});
    expect(await setTileContributor(["n2"], "kit")).toBe(false);
    expect(db.calls).toHaveLength(1);
  });

  it("does not take another error for a missing column", async () => {
    db.error = { code: "23503", message: "column contributor_id does not exist" };
    await expect(setTileContributor(["n1"], "kit")).rejects.toMatchObject({ code: "23503" });
    expect(withContributorColumn("id")).toBe("id, contributor_id");
  });

  it("writes only contributor_id, on the ids given", async () => {
    expect(await setTileContributor(["n1", "n2"], "kit")).toBe(true);
    expect(db.calls).toEqual([{ values: { contributor_id: "kit" }, ids: ["n1", "n2"] }]);
    expect(withoutCredit([{ id: "n1", contributor_id: "kit" }])).toEqual([{ id: "n1" }]);
  });
});
