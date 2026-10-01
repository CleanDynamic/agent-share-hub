// Runs of a maker's builds (UI-P26b, UI-P26c).
//
// A stand-in for the PostgREST builder records every call and answers each
// request by its table: reproduction rows for the series and the people count,
// and the latest rebuild for the chart's marker.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let runs: Array<Record<string, unknown>> = [];
let rebuilds: Array<{ published_at: string | null }> = [];
let failOn: "runs" | "rebuild" | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const id = (builders += 1);
      const self: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "in", "gte", "order", "limit"]) {
        self[method] = (...args: unknown[]) => {
          calls.push({ table, method, args, builder: id });
          return self;
        };
      }
      self.then = (resolve: (value: unknown) => unknown) => {
        const kind = table === "builds" ? "rebuild" : "runs";
        if (failOn === kind) return Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve);
        return Promise.resolve({ data: kind === "rebuild" ? rebuilds : runs, error: null }).then(resolve);
      };
      return self;
    },
  },
}));

import { getRunsOfMyBuilds } from "@/lib/build/runs";

const USER = "user-1";
const NOW = new Date("2026-10-01T12:00:00Z");

const of = (table: string, method: string) =>
  calls.filter((call) => call.table === table && call.method === method).map((call) => call.args);

const at = (created_at: string) => ({ created_at });

beforeEach(() => {
  calls = [];
  builders = 0;
  runs = [];
  rebuilds = [];
  failOn = null;
});

describe("getRunsOfMyBuilds", () => {
  it("returns a zero series of the asked length, and no marker, when there is nothing", async () => {
    const result = await getRunsOfMyBuilds(USER, 90, NOW);
    expect(result.series).toHaveLength(90);
    expect(result.series.every((count) => count === 0)).toBe(true);
    expect(result.rebuildLiveIndex).toBeNull();
  });

  it("defaults to 90 days", async () => {
    expect((await getRunsOfMyBuilds(USER, undefined, NOW)).series).toHaveLength(90);
  });

  it("counts each day's runs, oldest first, today last", async () => {
    runs = [
      at("2026-10-01T09:00:00Z"),
      at("2026-10-01T01:00:00Z"),
      at("2026-09-30T23:59:00Z"),
      at("2026-09-25T10:00:00Z"),
    ];

    const { series } = await getRunsOfMyBuilds(USER, 14, NOW);

    expect(series).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2]);
  });

  it("puts a run at 23:59 UTC in its own day and one at 00:01 in the next", async () => {
    runs = [at("2026-09-29T23:59:00Z"), at("2026-09-30T00:01:00Z")];
    const { series } = await getRunsOfMyBuilds(USER, 7, NOW);
    // 7 days ending 1 October: index 6 is today, 5 is 30 Sep, 4 is 29 Sep.
    expect(series[4]).toBe(1);
    expect(series[5]).toBe(1);
  });

  it("reads days in UTC whatever the clock's zone", async () => {
    // 00:30 on 2 October in UTC+1 is 23:30 on 1 October in UTC.
    const { series } = await getRunsOfMyBuilds(USER, 3, new Date("2026-10-02T00:30:00+01:00"));
    expect(series).toHaveLength(3);
    runs = [at("2026-10-01T23:00:00Z")];
    const again = await getRunsOfMyBuilds(USER, 3, new Date("2026-10-02T00:30:00+01:00"));
    expect(again.series).toEqual([0, 0, 1]);
  });

  it("ignores rows outside the window", async () => {
    runs = [at("2026-09-17T23:59:00Z"), at("2026-10-02T00:01:00Z"), at("not a date")];
    const { series } = await getRunsOfMyBuilds(USER, 14, NOW);
    expect(series.every((count) => count === 0)).toBe(true);
  });

  it("reads reproductions of this maker's builds since the window began, capped at 5000", async () => {
    await getRunsOfMyBuilds(USER, 14, NOW);

    expect(of("build_reproductions", "select")).toEqual([
      ["created_at, builds!build_reproductions_build_id_fkey!inner(creator_id)"],
    ]);
    expect(of("build_reproductions", "eq")).toEqual([["builds.creator_id", USER]]);
    // 14 UTC days ending 1 October: the first is 18 September.
    expect(of("build_reproductions", "gte")).toEqual([["created_at", "2026-09-18T00:00:00.000Z"]]);
    expect(of("build_reproductions", "limit")).toEqual([[5000]]);
  });

  it("marks the day the most recent published rebuild of their work went live", async () => {
    rebuilds = [{ published_at: "2026-09-28T16:00:00Z" }];

    const { rebuildLiveIndex } = await getRunsOfMyBuilds(USER, 14, NOW);

    // Index 13 is 1 Oct, so 28 Sep is 10.
    expect(rebuildLiveIndex).toBe(10);
  });

  it("asks for the latest published rebuild by somebody else of one of their builds, inside the window", async () => {
    await getRunsOfMyBuilds(USER, 14, NOW);

    expect(of("builds", "select")).toEqual([
      ["published_at, parent:builds!builds_parent_build_id_fkey!inner(creator_id)"],
    ]);
    expect(of("builds", "eq")).toEqual([["parent.creator_id", USER]]);
    expect(of("builds", "neq")).toEqual([["creator_id", USER]]);
    expect(of("builds", "in")).toEqual([["status", ["published", "gallery"]]]);
    expect(of("builds", "gte")).toEqual([["published_at", "2026-09-18T00:00:00.000Z"]]);
    expect(of("builds", "order")).toEqual([["published_at", { ascending: false }]]);
    expect(of("builds", "limit")).toEqual([[1]]);
  });

  it("has no marker for a rebuild outside the window or without a date", async () => {
    rebuilds = [{ published_at: null }];
    expect((await getRunsOfMyBuilds(USER, 14, NOW)).rebuildLiveIndex).toBeNull();
    rebuilds = [{ published_at: "2026-08-01T00:00:00Z" }];
    expect((await getRunsOfMyBuilds(USER, 14, NOW)).rebuildLiveIndex).toBeNull();
  });

  it("warns once when the row cap is reached, and still returns the series", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    runs = Array.from({ length: 5000 }, () => at("2026-10-01T09:00:00Z"));

    const { series } = await getRunsOfMyBuilds(USER, 14, NOW);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(series[13]).toBe(5000);
    warn.mockRestore();
  });

  it("does not warn below the cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    runs = Array.from({ length: 4999 }, () => at("2026-10-01T09:00:00Z"));
    await getRunsOfMyBuilds(USER, 14, NOW);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([["runs"], ["rebuild"]] as const)("throws an error naming the operation when the %s read fails", async (on) => {
    failOn = on;
    await expect(getRunsOfMyBuilds(USER, 14, NOW)).rejects.toThrow(
      new RegExp(`getRunsOfMyBuilds \\(${on}\\) failed: boom`),
    );
  });
});
