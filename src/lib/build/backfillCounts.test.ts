// SV-23: the backfill counts every build with no step count, a batch at a time, writes only what differs, and reports done, skipped
// and failed.

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { method: string; args: unknown[] }[] = [];
let pages: unknown[][] = [];
let readError: { message: string } | null = null;

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "is", "gt", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(readError ? { data: null, error: readError } : { data: pages.shift() ?? [], error: null }).then(resolve);
  return self;
}
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => builder() } }));

const storedCountsOfBuild = vi.fn();
vi.mock("./buildCountsWrite", () => ({ storedCountsOfBuild: (...a: unknown[]) => storedCountsOfBuild(...a) }));
const updateBuild = vi.fn();
vi.mock("./builds", () => ({ updateBuild: (...a: unknown[]) => updateBuild(...a) }));

import { BACKFILL_BATCH, backfillCounts } from "./backfillCounts";

const row = (n: number) => ({ id: `b${String(n).padStart(3, "0")}`, making: {}, step_count: null, part_count: null, agent_count: null, session_count: 0 });
const COUNTS = { step_count: 4, part_count: 1, agent_count: 0, session_count: 2 };

beforeEach(() => {
  calls.length = 0;
  pages = [];
  readError = null;
  storedCountsOfBuild.mockReset().mockResolvedValue(COUNTS);
  updateBuild.mockReset().mockResolvedValue({});
});

describe("backfillCounts", () => {
  it("reads builds with no step count, and writes the counts that differ", async () => {
    pages = [[row(1), row(2)]];
    const progress = vi.fn();
    const summary = await backfillCounts(progress);
    expect(calls.find((entry) => entry.method === "is")?.args).toEqual(["step_count", null]);
    expect(updateBuild).toHaveBeenCalledTimes(2);
    expect(updateBuild).toHaveBeenCalledWith("b001", COUNTS);
    expect(summary).toEqual({ done: 2, skipped: [], failed: [] });
    expect(progress).toHaveBeenLastCalledWith({ done: 2, skipped: [], failed: [] });
  });

  it("skips a build that has nothing to write, with the reason, and reports one that fails without stopping", async () => {
    pages = [[row(1), row(2), row(3)]];
    storedCountsOfBuild.mockImplementation(async (id: string) => {
      if (id === "b001") return { step_count: 0, part_count: 0, agent_count: 0, session_count: 0 };
      if (id === "b002") throw new Error("permission denied for table build_sessions");
      return COUNTS;
    });
    const summary = await backfillCounts(() => undefined);
    expect(summary.done).toBe(1);
    expect(summary.skipped).toEqual([{ id: "b001", reason: expect.stringContaining("nothing to write") }]);
    expect(summary.failed).toEqual([{ id: "b002", reason: "permission denied for table build_sessions" }]);
  });

  it("writes in batches of twenty, and reads on from the last id when a page was full", async () => {
    pages = [Array.from({ length: 200 }, (_, at) => row(at)), [row(300)]];
    const sizes: number[] = [];
    let inFlight = 0;
    let most = 0;
    updateBuild.mockImplementation(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });
    const summary = await backfillCounts((s) => sizes.push(s.done));
    expect(BACKFILL_BATCH).toBe(20);
    expect(most).toBeLessThanOrEqual(20);
    expect(summary.done).toBe(201);
    expect(calls.find((entry) => entry.method === "gt")?.args).toEqual(["id", "b199"]);
  });

  it("stops between batches when asked", async () => {
    pages = [Array.from({ length: 50 }, (_, at) => row(at))];
    let asked = 0;
    const summary = await backfillCounts(() => undefined, () => ++asked > 1);
    expect(summary.done).toBe(20);
  });

  it("throws what it could not read, so the page can say so", async () => {
    readError = { message: "permission denied" };
    await expect(backfillCounts(() => undefined)).rejects.toThrow("permission denied");
  });
});
