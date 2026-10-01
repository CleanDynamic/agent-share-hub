// A maker's five figures. getMakerStats has its own tests (makerStats.test.ts);
// what is asserted here is that its four are carried across by name, and that
// the earnings are the rewards of the same bounties the solved count is.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

const mocks = vi.hoisted(() => ({ getMakerStats: vi.fn() }));

let calls: Recorded[] = [];
let builders = 0;
let accepted: { data: unknown; error: unknown; status?: number };
let bounties: Array<{ data: unknown; error: unknown }>;

vi.mock("./makerStats", () => ({ getMakerStats: mocks.getMakerStats }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const id = (builders += 1);
      const self: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "not", "limit"]) {
        self[method] = (...args: unknown[]) => {
          calls.push({ table, method, args, builder: id });
          return self;
        };
      }
      self.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(table === "solutions" ? accepted : (bounties.shift() ?? { data: [], error: null })).then(resolve);
      return self;
    },
  },
}));

import { MakerFiguresError, getMakerFigures } from "./figures";

const USER = "user-1";
const of = (table: string, method: string) =>
  calls.filter((call) => call.table === table && call.method === method).map((call) => call.args);

beforeEach(() => {
  calls = [];
  builders = 0;
  accepted = { data: [], error: null };
  bounties = [];
  mocks.getMakerStats.mockReset().mockResolvedValue({
    builds: 12,
    reproductionsReceived: 40,
    rebuildsOfTheirWork: 6,
    gapsSolved: 3,
  });
});

describe("getMakerFigures", () => {
  it("carries maker_stats' four figures across under the stats row's names", async () => {
    const figures = await getMakerFigures(USER);

    expect(mocks.getMakerStats).toHaveBeenCalledWith(USER);
    expect(figures).toEqual({
      buildsHung: 12,
      reproducedByOthers: 40,
      rebuildsOfWork: 6,
      bountiesSolved: 3,
      bountyEarningsGbp: 0,
    });
  });

  it("sums the rewards of the bounties their accepted solutions answered", async () => {
    accepted = { data: [{ bounty_id: "b1" }, { bounty_id: "b2" }, { bounty_id: "b3" }], error: null };
    bounties = [{ data: [{ id: "b1", reward_gbp: 500 }, { id: "b2", reward_gbp: "250.00" }, { id: "b3", reward_gbp: null }], error: null }];

    expect((await getMakerFigures(USER)).bountyEarningsGbp).toBe(750);
  });

  it("reads only their accepted solutions, and only bounties that live on a build", async () => {
    accepted = { data: [{ bounty_id: "b1" }], error: null };
    await getMakerFigures(USER);

    expect(of("solutions", "select")).toEqual([["bounty_id"]]);
    expect(of("solutions", "eq")).toEqual([["solver_id", USER], ["status", "accepted"]]);
    expect(of("solutions", "limit")).toEqual([[200]]);
    expect(of("bounties", "select")).toEqual([["id, reward_gbp"]]);
    expect(of("bounties", "in")).toEqual([["id", ["b1"]]]);
    expect(of("bounties", "not")).toEqual([["build_id", "is", null]]);
  });

  it("asks once for a bounty that appears twice, and in chunks of a hundred", async () => {
    accepted = {
      data: [...Array.from({ length: 150 }, (_, index) => ({ bounty_id: `b${index}` })), { bounty_id: "b0" }],
      error: null,
    };
    bounties = [
      { data: [{ id: "b0", reward_gbp: 10 }], error: null },
      { data: [{ id: "b100", reward_gbp: 5 }], error: null },
    ];

    const figures = await getMakerFigures(USER);

    expect(of("bounties", "in").map(([, ids]) => (ids as string[]).length)).toEqual([100, 50]);
    expect(figures.bountyEarningsGbp).toBe(15);
  });

  it("keeps money a whole number of pounds", async () => {
    accepted = { data: [{ bounty_id: "b1" }, { bounty_id: "b2" }], error: null };
    bounties = [{ data: [{ id: "b1", reward_gbp: 10.5 }, { id: "b2", reward_gbp: 10.4 }], error: null }];
    expect((await getMakerFigures(USER)).bountyEarningsGbp).toBe(21);
  });

  it("reads no bounties for a maker with no accepted solutions", async () => {
    expect((await getMakerFigures(USER)).bountyEarningsGbp).toBe(0);
    expect(of("bounties", "select")).toEqual([]);
  });

  it("warns once when the accepted-solutions cap is reached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    accepted = { data: Array.from({ length: 200 }, (_, index) => ({ bounty_id: `b${index}` })), error: null };
    await getMakerFigures(USER);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("throws an error carrying the user id and the code, not the database's words", async () => {
    accepted = { data: null, error: { code: "42501", message: "secret detail" }, status: 403 };

    const error = await getMakerFigures(USER).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MakerFiguresError);
    expect(error).toMatchObject({ userId: USER, code: "42501", status: 403 });
    expect((error as Error).message).toBe(`getMakerFigures (solutions) failed (user ${USER})`);
  });

  it("throws when the bounties read fails", async () => {
    accepted = { data: [{ bounty_id: "b1" }], error: null };
    bounties = [{ data: null, error: { code: "XX000" } }];
    await expect(getMakerFigures(USER)).rejects.toThrow("getMakerFigures (bounties) failed");
  });

  it("passes on a failure of getMakerStats unchanged", async () => {
    mocks.getMakerStats.mockRejectedValue(new Error("stats down"));
    await expect(getMakerFigures(USER)).rejects.toThrow("stats down");
  });
});
