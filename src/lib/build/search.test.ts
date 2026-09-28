// RC-P07 — the search's data layer: the query rules the browser applies, the
// one RPC it makes, and the privacy rule on its errors (CONTRACT §9).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import { SEARCH_MAX, SEARCH_MIN, normaliseQuery, searchBuildIds } from "./search";

beforeEach(() => {
  mocks.rpc.mockReset();
});

describe("normaliseQuery", () => {
  it("is null for no input at all", () => {
    expect(normaliseQuery(null)).toBeNull();
    expect(normaliseQuery(undefined)).toBeNull();
  });

  it("is null below the minimum length", () => {
    expect(SEARCH_MIN).toBe(2);
    expect(normaliseQuery("a")).toBeNull();
    expect(normaliseQuery("   a   ")).toBeNull();
  });

  it("trims the ends and collapses every run of whitespace to one space", () => {
    expect(normaliseQuery("  two   words ")).toBe("two words");
    expect(normaliseQuery("\ttabs\nand newlines ")).toBe("tabs and newlines");
  });

  it("cuts an 81-character query to 80", () => {
    expect(SEARCH_MAX).toBe(80);
    const long = "x".repeat(81);
    expect(normaliseQuery(long)).toBe("x".repeat(80));
  });
});

describe("searchBuildIds", () => {
  it("calls search_build_ids once with the query and a cap of 200", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ build_id: "b1" }, { build_id: "b2" }], error: null });

    const ids = await searchBuildIds("claude");

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("search_build_ids", { q: "claude", max_results: 200 });
    expect(ids).toEqual(["b1", "b2"]);
  });

  it("answers an empty list when nothing matches", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(searchBuildIds("zebra")).resolves.toEqual([]);
  });

  it("throws an error that names the function and never contains the query", async () => {
    // A server message that quotes the input, which is the case to guard.
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "22P02", message: 'invalid input: "private words"', details: "private words" },
    });

    let thrown: Error | null = null;
    try {
      await searchBuildIds("private words");
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("searchBuildIds");
    expect(thrown!.message).toContain("22P02");
    expect(thrown!.message).not.toContain("private words");
    expect(JSON.stringify((thrown as Error & { cause?: unknown }).cause)).not.toContain("private words");
  });
});
