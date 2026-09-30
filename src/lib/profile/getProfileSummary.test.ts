// The profile's summary, read on the build model (RC-P28a).
//
// A stand-in for supabase-js records every table the summary asks for and the
// columns it names, so the claims are about what the header can say: the two
// counts of people, and nothing of the legacy post model: no profile_stats
// view (blueprint, blog and bounty counts over content_items) and no
// profiles.level (the approved-blueprint ladder).

import { beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({
  reads: [] as Array<{ table: string; select: string }>,
  rows: {} as Record<string, unknown>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string, select = ""): unknown =>
    new Proxy(function builder() {}, {
      get(_target, prop) {
        if (prop === "then") {
          stand.reads.push({ table, select });
          return (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: stand.rows[table] ?? null, error: null }).then(resolve);
        }
        if (prop === "select") return (columns: string) => chain(table, columns);
        return () => chain(table, select);
      },
    });
  return { supabase: { from: (table: string) => chain(table) } };
});

import { getProfileSummary } from "@/lib/profile/getProfileSummary";

const MAKER = "00000000-0000-4000-8000-00000000000a";
const VISITOR = "00000000-0000-4000-8000-00000000000b";

beforeEach(() => {
  stand.reads = [];
  stand.rows = {
    profiles: {
      id: MAKER,
      username: "maya.o",
      display_name: "Maya Okafor",
      follower_count: 212,
      following_count: 38,
      created_at: "2025-11-04T09:00:00.000Z",
      level: "builder",
    },
    follows: { id: "f-1" },
  };
});

describe("getProfileSummary", () => {
  it("counts people only: followers and following, and no legacy post counts", async () => {
    const summary = await getProfileSummary("maya.o", VISITOR);

    expect(summary.counts).toEqual({ followers: 212, following: 38 });
    expect(stand.reads.map((read) => read.table)).toEqual(["profiles", "follows"]);
  });

  it("never reads the legacy profile_stats view, nor profiles.level", async () => {
    await getProfileSummary("maya.o", VISITOR);
    await getProfileSummary(MAKER, MAKER);

    expect(stand.reads.some((read) => read.table === "profile_stats")).toBe(false);
    const profileColumns = stand.reads.filter((read) => read.table === "profiles").flatMap((read) => read.select.split(/,\s*/));
    expect(profileColumns).not.toContain("level");
    expect(Object.keys(await getProfileSummary(MAKER, MAKER))).not.toContain("level");
  });

  it("asks whether the visitor follows the maker, and asks nothing more of the maker's own view", async () => {
    await expect(getProfileSummary("maya.o", VISITOR)).resolves.toMatchObject({ isOwnProfile: false, isFollowing: true });
    stand.reads = [];
    await expect(getProfileSummary(MAKER, MAKER)).resolves.toMatchObject({ isOwnProfile: true, isFollowing: null });
    expect(stand.reads.map((read) => read.table)).toEqual(["profiles"]);
  });
});
