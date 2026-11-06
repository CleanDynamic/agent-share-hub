// UX-10: the profile is read in one request: the reader's follow comes embedded, filtered to the reader, so the profile page and
// the follow lists take one round, not two.

import { beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ calls: [] as string[], selects: [] as string[], filters: [] as unknown[][], row: null as Record<string, unknown> | null }));

vi.mock("@/lib/social/types", () => {
  const query = {
    select: (columns: string) => {
      stand.selects.push(columns);
      return query;
    },
    limit: () => query,
    eq: (...args: unknown[]) => {
      stand.filters.push(args);
      return query;
    },
    ilike: () => query,
    maybeSingle: async () => ({ data: stand.row, error: null }),
  };
  return { db: { from: (table: string) => (stand.calls.push(table), query) } };
});

import { getProfileSummary } from "./getProfileSummary";

const ROW = { id: "u-maya", username: "maya", display_name: "Maya", follower_count: 3, following_count: 1, created_at: "2026-02-01T00:00:00Z", links: ["https://maya.dev"], profile_settings: { feed_filter: "topics" } };

beforeEach(() => {
  stand.calls = [];
  stand.selects = [];
  stand.filters = [];
});

describe("getProfileSummary", () => {
  it("is one request, with the reader's follow embedded and filtered to them", async () => {
    stand.row = { ...ROW, viewer_follow: [{ id: "f1" }] };
    const summary = await getProfileSummary("maya", "u-me");
    expect(stand.calls).toEqual(["profiles"]);
    expect(stand.selects[0]).toContain("viewer_follow:follows!follows_following_id_fkey(id)");
    expect(stand.filters).toContainEqual(["viewer_follow.follower_id", "u-me"]);
    expect(summary.isFollowing).toBe(true);
    expect(summary.links).toEqual(["https://maya.dev"]);
    expect(summary.settings?.feedFilter).toBe("topics");
  });

  it("is not following with no follow row, and asks nothing about follows signed out", async () => {
    stand.row = { ...ROW, viewer_follow: [] };
    expect((await getProfileSummary("maya", "u-me")).isFollowing).toBe(false);
    stand.selects = [];
    stand.row = ROW;
    await getProfileSummary("maya", null);
    expect(stand.selects[0]).not.toContain("viewer_follow");
  });
});
