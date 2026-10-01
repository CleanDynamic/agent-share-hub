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

import { countLitToday } from "@/lib/build/signals";

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
