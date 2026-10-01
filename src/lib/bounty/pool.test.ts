// The open bounty pool: the money and counts on the Gallery stats and the
// Bounties orbs. Counting the solutions and the open builds are other
// functions' jobs; what is asserted here is the sum, the filter, and how the
// pieces are put together.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

const mocks = vi.hoisted(() => ({
  countOpenBountyBuilds: vi.fn(),
  countSolutionsByBounty: vi.fn(),
}));

let calls: Recorded[] = [];
let answer: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      const self: Record<string, unknown> = {};
      for (const method of ["select", "eq", "limit"]) {
        self[method] = (...args: unknown[]) => {
          calls.push({ method, args });
          return self;
        };
      }
      self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(answer).then(resolve);
      return self;
    },
  },
}));

vi.mock("@/lib/build/gallery", () => ({ countOpenBountyBuilds: mocks.countOpenBountyBuilds }));
vi.mock("./solutions", () => ({ countSolutionsByBounty: mocks.countSolutionsByBounty }));

import { getOpenBountyPool } from "./bounties";

const of = (method: string) => calls.filter((entry) => entry.method === method).map((entry) => entry.args);

const bounty = (id: string, reward: number | string | null) => ({ id, reward_gbp: reward });

beforeEach(() => {
  calls = [];
  answer = { data: [], error: null };
  mocks.countOpenBountyBuilds.mockReset().mockResolvedValue(0);
  mocks.countSolutionsByBounty.mockReset().mockResolvedValue(new Map());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOpenBountyPool", () => {
  it("sums the open bounties' rewards and takes open from countOpenBountyBuilds", async () => {
    answer = { data: [bounty("a", 2000), bounty("b", 1500), bounty("c", 750)], error: null };
    mocks.countOpenBountyBuilds.mockResolvedValue(23);

    const pool = await getOpenBountyPool();

    expect(pool.poolGbp).toBe(4250);
    expect(pool.open).toBe(23);
  });

  it("asks for open bounties only, on the id and reward columns, capped at 1000", async () => {
    await getOpenBountyPool();

    expect(of("from")).toEqual([["bounties"]]);
    expect(of("select")).toEqual([["id, reward_gbp"]]);
    expect(of("eq")).toEqual([["status", "open"]]);
    expect(of("limit")).toEqual([[1000]]);
  });

  it("counts an unpriced bounty as nothing and reads a numeric string as a number", async () => {
    answer = { data: [bounty("a", null), bounty("b", "250.00"), bounty("c", 0)], error: null };
    expect((await getOpenBountyPool()).poolGbp).toBe(250);
  });

  it("keeps money a whole number of pounds", async () => {
    answer = { data: [bounty("a", 10.5), bounty("b", 10.4)], error: null };
    expect((await getOpenBountyPool()).poolGbp).toBe(21);
  });

  it("sums solutions over the open bounties and counts the ones with at least one", async () => {
    answer = { data: [bounty("a", 100), bounty("b", 100), bounty("c", 100)], error: null };
    mocks.countSolutionsByBounty.mockResolvedValue(new Map([["a", 3], ["c", 1]]));

    const pool = await getOpenBountyPool();

    expect(mocks.countSolutionsByBounty).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(pool.solutions).toBe(4);
    expect(pool.withSolutions).toBe(2);
  });

  it("counts solutions in chunks, so no request carries a thousand ids", async () => {
    answer = {
      data: Array.from({ length: 250 }, (_, index) => bounty(`id-${index}`, 1)),
      error: null,
    };
    mocks.countSolutionsByBounty
      .mockResolvedValueOnce(new Map([["id-0", 2]]))
      .mockResolvedValueOnce(new Map([["id-100", 1]]))
      .mockResolvedValueOnce(new Map());

    const pool = await getOpenBountyPool();

    expect(mocks.countSolutionsByBounty.mock.calls.map(([ids]) => (ids as string[]).length)).toEqual([100, 100, 50]);
    expect(pool.solutions).toBe(3);
    expect(pool.withSolutions).toBe(2);
  });

  it("returns zeros for no bounties, and counts no solutions", async () => {
    await expect(getOpenBountyPool()).resolves.toEqual({
      poolGbp: 0,
      open: 0,
      solutions: 0,
      withSolutions: 0,
    });
    expect(mocks.countSolutionsByBounty).not.toHaveBeenCalled();
  });

  it("treats an empty result as zero bounties", async () => {
    answer = { data: null, error: null };
    expect((await getOpenBountyPool()).poolGbp).toBe(0);
  });

  it("warns once when the cap is reached, and still returns the pool", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answer = {
      data: Array.from({ length: 1000 }, (_, index) => bounty(`id-${index}`, 5)),
      error: null,
    };

    const pool = await getOpenBountyPool();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(pool.poolGbp).toBe(5000);
  });

  it("does not warn below the cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answer = { data: [bounty("a", 5)], error: null };
    await getOpenBountyPool();
    expect(warn).not.toHaveBeenCalled();
  });

  it("throws an error naming the operation when the read fails", async () => {
    answer = { data: null, error: { message: "boom" } };
    await expect(getOpenBountyPool()).rejects.toThrow(/getOpenBountyPool/);
  });
});
