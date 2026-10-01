// The home signals: counts the home page and the gallery stats read.
//
// A stand-in for the PostgREST builder records every call, so the claims are
// about the table, the filter column, its operator and its boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: { count: number | null; error: unknown } = { count: 0, error: null };

function builder() {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "in", "gte"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, ...answer }).then(resolve);
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder();
    },
  },
}));

import { countLitToday, countReproducedToday, countRunsThisWeek } from "@/lib/build/signals";

const of = (method: string) => calls.filter((entry) => entry.method === method);

beforeEach(() => {
  calls = [];
  answer = { count: 0, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("countLitToday", () => {
  it("counts builds confirmed in the last 24 hours, rolling, as an estimated head count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:30:00Z"));
    answer = { count: 702, error: null };

    await expect(countLitToday()).resolves.toBe(702);

    expect(of("from")[0].args).toEqual(["builds"]);
    expect(of("select")[0].args).toEqual(["id", { count: "estimated", head: true }]);
    expect(of("gte")).toEqual([
      { method: "gte", args: ["last_confirmed_at", "2026-09-30T12:30:00.000Z"] },
    ]);
  });

  it("moves its boundary with the clock rather than at midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:01:00Z"));
    await countLitToday();
    expect(of("gte")[0].args).toEqual(["last_confirmed_at", "2026-09-30T00:01:00.000Z"]);
  });

  it("leaves drafts out", async () => {
    await countLitToday();
    expect(of("in")[0].args).toEqual(["status", ["published", "gallery"]]);
  });

  it("returns 0 when the count comes back empty", async () => {
    answer = { count: null, error: null };
    await expect(countLitToday()).resolves.toBe(0);
  });

  it("throws an error naming the operation when the request fails", async () => {
    answer = { count: null, error: { message: "boom" } };
    await expect(countLitToday()).rejects.toThrow("countLitToday failed: boom");
  });
});

describe("countReproducedToday", () => {
  it("counts reproductions created since 00:00 UTC, as an estimated head count", async () => {
    answer = { count: 48, error: null };

    await expect(countReproducedToday(new Date("2026-10-01T15:20:00Z"))).resolves.toBe(48);

    expect(of("from")[0].args).toEqual(["build_reproductions"]);
    expect(of("select")[0].args).toEqual(["id", { count: "estimated", head: true }]);
    expect(of("gte")).toEqual([
      { method: "gte", args: ["created_at", "2026-10-01T00:00:00.000Z"] },
    ]);
  });

  it("still counts from the same midnight at 23:59 UTC", async () => {
    await countReproducedToday(new Date("2026-09-30T23:59:00Z"));
    expect(of("gte")[0].args).toEqual(["created_at", "2026-09-30T00:00:00.000Z"]);
  });

  it("starts a new day at 00:01 UTC", async () => {
    await countReproducedToday(new Date("2026-10-01T00:01:00Z"));
    expect(of("gte")[0].args).toEqual(["created_at", "2026-10-01T00:00:00.000Z"]);
  });

  it("reads the day in UTC whatever the clock's zone", async () => {
    // 00:30 on 2 October in UTC+1 is 23:30 on 1 October in UTC.
    await countReproducedToday(new Date("2026-10-02T00:30:00+01:00"));
    expect(of("gte")[0].args).toEqual(["created_at", "2026-10-01T00:00:00.000Z"]);
  });

  it("returns 0 when the count comes back empty", async () => {
    answer = { count: null, error: null };
    await expect(countReproducedToday()).resolves.toBe(0);
  });

  it("throws an error naming the operation when the request fails", async () => {
    answer = { count: null, error: { message: "boom" } };
    await expect(countReproducedToday()).rejects.toThrow("countReproducedToday failed: boom");
  });
});

describe("countRunsThisWeek", () => {
  // 2026-10-01 is a Thursday; its week began on Monday 2026-09-28.
  it("counts reproductions created since Monday 00:00 UTC, as an estimated head count", async () => {
    answer = { count: 312, error: null };

    await expect(countRunsThisWeek(new Date("2026-10-01T15:20:00Z"))).resolves.toBe(312);

    expect(of("from")[0].args).toEqual(["build_reproductions"]);
    expect(of("select")[0].args).toEqual(["id", { count: "estimated", head: true }]);
    expect(of("gte")).toEqual([
      { method: "gte", args: ["created_at", "2026-09-28T00:00:00.000Z"] },
    ]);
  });

  it("is still last week at 23:59 UTC on Sunday", async () => {
    await countRunsThisWeek(new Date("2026-10-04T23:59:00Z"));
    expect(of("gte")[0].args).toEqual(["created_at", "2026-09-28T00:00:00.000Z"]);
  });

  it("is the new week at 00:01 UTC on Monday", async () => {
    await countRunsThisWeek(new Date("2026-10-05T00:01:00Z"));
    expect(of("gte")[0].args).toEqual(["created_at", "2026-10-05T00:00:00.000Z"]);
  });

  it("returns 0 when the count comes back empty", async () => {
    answer = { count: null, error: null };
    await expect(countRunsThisWeek()).resolves.toBe(0);
  });

  it("throws an error naming the operation when the request fails", async () => {
    answer = { count: null, error: { message: "boom" } };
    await expect(countRunsThisWeek()).rejects.toThrow("countRunsThisWeek failed: boom");
  });
});
