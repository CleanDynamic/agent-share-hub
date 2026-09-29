// A maker's four figures, in one request (RC-P21).
//
// A stand-in for supabase-js records every call that would reach the network,
// so the claims are about how many requests the figures cost, what they name,
// and what an error is allowed to say.

import { beforeEach, describe, expect, it, vi } from "vitest";

let calls: Array<{ fn: string; params: unknown }> = [];
let rpcAnswer: { data: unknown; error: unknown; status?: number } = { data: [], error: null, status: 200 };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("getMakerStats reads no table directly");
    },
    rpc: (fn: string, params: unknown) => {
      calls.push({ fn, params });
      return Promise.resolve(rpcAnswer);
    },
  },
}));

import { isPermissionError } from "@/lib/errors/permission";
import { MakerStatsError, NO_MAKER_STATS, getMakerStats } from "@/lib/profile/makerStats";

const MAKER = "00000000-0000-0000-0000-00000000000a";

beforeEach(() => {
  calls = [];
  rpcAnswer = { data: [], error: null, status: 200 };
});

describe("getMakerStats", () => {
  it("asks maker_stats once, by the maker's id, for all four figures", async () => {
    rpcAnswer = {
      data: [{ builds: 4, reproductions_received: 3, rebuilds_of_their_work: 2, gaps_solved: 1 }],
      error: null,
      status: 200,
    };

    await expect(getMakerStats(MAKER)).resolves.toEqual({
      builds: 4,
      reproductionsReceived: 3,
      rebuildsOfTheirWork: 2,
      gapsSolved: 1,
    });
    expect(calls).toEqual([{ fn: "maker_stats", params: { uid: MAKER } }]);
  });

  it("reads bigint figures that arrive as strings, and never a negative or a fraction", async () => {
    rpcAnswer = {
      data: [{ builds: "12", reproductions_received: "9007199254740993", rebuilds_of_their_work: -1, gaps_solved: null }],
      error: null,
      status: 200,
    };

    const stats = await getMakerStats(MAKER);
    expect(stats.builds).toBe(12);
    expect(stats.reproductionsReceived).toBeGreaterThan(9_000_000_000_000_000);
    expect(stats.rebuildsOfTheirWork).toBe(0);
    expect(stats.gapsSolved).toBe(0);
  });

  it("answers zeros when the function returns no row", async () => {
    rpcAnswer = { data: [], error: null, status: 200 };
    await expect(getMakerStats(MAKER)).resolves.toEqual(NO_MAKER_STATS);
  });

  it("names only the user id when it fails, never the database's words", async () => {
    rpcAnswer = {
      data: null,
      error: { code: "XX000", message: "Failing row contains (secret text a reader wrote)", details: "more text", hint: "a hint" },
      status: 500,
    };

    const error = await getMakerStats(MAKER).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MakerStatsError);
    expect((error as MakerStatsError).message).toBe(`getMakerStats failed (user ${MAKER})`);
    expect((error as MakerStatsError).userId).toBe(MAKER);
    expect(JSON.stringify(error)).not.toContain("secret");
    expect("cause" in (error as object) && (error as { cause?: unknown }).cause).toBeFalsy();
  });

  it("keeps the code and status, so a refusal reads as a refusal", async () => {
    rpcAnswer = { data: null, error: { code: "42501", message: "permission denied" }, status: 403 };

    const error = await getMakerStats(MAKER).catch((caught: unknown) => caught);
    expect(isPermissionError(error)).toBe(true);
    expect((error as MakerStatsError).code).toBe("42501");
    expect((error as MakerStatsError).status).toBe(403);
  });
});
