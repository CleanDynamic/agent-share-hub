// SV-22 P3: reviews and the week's goal.

import { beforeEach, describe, expect, it, vi } from "vitest";

let tables: Record<string, { data?: unknown; error?: unknown; count?: number }> = {};
const updates: Record<string, unknown>[] = [];
const filters: { table: string; args: unknown[] }[] = [];

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "not", "order", "limit", "gte"]) {
    self[method] = (...args: unknown[]) => (filters.push({ table, args: [method, ...args] }), self);
  }
  const answer = () => ({ data: tables[table]?.data ?? [], error: tables[table]?.error ?? null, count: tables[table]?.count ?? null });
  self.range = () => Promise.resolve(answer());
  self.maybeSingle = () => Promise.resolve({ data: tables[table]?.data ?? null, error: tables[table]?.error ?? null });
  self.then = (resolve: (value: unknown) => unknown) => resolve(answer());
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));
vi.mock("@/lib/build/builds", () => ({ updateBuild: (_id: string, patch: Record<string, unknown>) => (updates.push(patch), Promise.resolve({})) }));

import { getWeekGoal, listReviews, setInReview } from "./reviews";

beforeEach(() => {
  tables = {};
  updates.length = 0;
  filters.length = 0;
});

describe("listReviews", () => {
  it("counts a build's runs, failed runs, step comments and open requests from one read each", async () => {
    tables = {
      builds: { data: [{ id: "b1", slug: "weekly", title: "Weekly report", in_review_since: "2026-10-29T00:00:00Z", creator: { username: "luke" } }] },
      build_reproductions: { data: [{ build_id: "b1", worked: true }, { build_id: "b1", worked: false }, { build_id: "b1", worked: true }] },
      build_comments: { data: [{ build_id: "b1" }, { build_id: "b1" }] },
      bounties: { data: [{ build_id: "b1" }] },
    };
    const page = await listReviews();
    expect(page.reviews).toEqual([{ buildId: "b1", slug: "weekly", title: "Weekly report", maker: "luke", since: "2026-10-29T00:00:00Z", runs: 3, failed: 1, stepComments: 2, requests: 1 }]);
    expect(filters.filter((f) => f.table === "build_comments").map((f) => f.args.slice(0, 3))).toContainEqual(["not", "node_id", "is"]);
  });

  it("reads as no reviews while the column is missing", async () => {
    tables = { builds: { error: { code: "42703" } } };
    await expect(listReviews()).resolves.toEqual({ reviews: [], nextOffset: null });
  });
});

describe("setInReview", () => {
  it("dates the start of a review and clears it at the end", async () => {
    tables = { builds: { data: { status: "published" } } };
    await setInReview("b1", true, new Date("2026-10-29T10:00:00Z"));
    await setInReview("b1", false);
    expect(updates).toEqual([{ in_review: true, in_review_since: "2026-10-29T10:00:00.000Z" }, { in_review: false, in_review_since: null }]);
  });

  it("refuses a build that is not published", async () => {
    tables = { builds: { data: { status: "draft" } } };
    await expect(setInReview("b1", true)).rejects.toThrow(/Publish/);
    expect(updates).toEqual([]);
  });
});

describe("getWeekGoal", () => {
  it("counts the requests solved since Monday 00:00 UTC against the goal", async () => {
    tables = { site_challenges: { data: { goal: 30 } }, bounties: { count: 18 } };
    await expect(getWeekGoal(new Date("2026-10-29T10:00:00Z"))).resolves.toEqual({ closed: 18, goal: 30 });
    expect(filters.find((f) => f.table === "bounties" && f.args[0] === "gte")?.args).toEqual(["gte", "solved_at", "2026-10-26T00:00:00.000Z"]);
  });

  it("is nothing without a goal, or before the table exists", async () => {
    tables = { site_challenges: { data: null }, bounties: { count: 4 } };
    await expect(getWeekGoal()).resolves.toBeNull();
    tables = { site_challenges: { error: { code: "42P01" } }, bounties: { count: 4 } };
    await expect(getWeekGoal()).resolves.toBeNull();
  });
});
