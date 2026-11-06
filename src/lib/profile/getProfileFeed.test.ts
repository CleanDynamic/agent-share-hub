// UX-10 P4: a profile's feed: the database's order kept, pins on the first page, each filter asked of the function, one read per
// kind, and what the function never returns (drafts, hidden replies, notes the owner keeps to themselves, saves).

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({
  rows: [] as unknown[],
  rpcs: [] as { fn: string; params: Record<string, unknown> }[],
  reads: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (fn: string, params: Record<string, unknown>) => {
      stand.rpcs.push({ fn, params });
      return { data: stand.rows, error: null };
    },
  },
}));

vi.mock("@/lib/social/types", () => {
  const chain = (table: string) => {
    const query = {
      select: () => query,
      in: () => query,
      limit: async () => {
        stand.reads.push(table);
        if (table === "build_profile_display") return { data: [{ build_id: "b1", display: "map" }], error: null };
        if (table === "build_reproductions")
          return { data: [{ id: "n1", build_id: "kb", model_used: "Opus 5.5", worked: true, note: " Ran clean ", build: { id: "kb", slug: "podcast-clipper", title: "Podcast clipper", maker: { username: "kit" } } }], error: null };
        return { data: [], error: null };
      },
    };
    return query;
  };
  return { db: { from: chain } };
});

vi.mock("@/lib/build/gallery", () => ({
  getGalleryBuildsByIds: vi.fn(async (ids: string[]) => {
    stand.reads.push("builds");
    return ids.filter((id) => id !== "gone").map((id) => ({ id, slug: id, title: `Build ${id}`, models_used: [] }));
  }),
}));

const post = (id: string, parentId: string | null = null, rootId = id) => ({ id, parentId, rootId, body: id, attachments: [], spaces: [], replyCount: 0 });
vi.mock("@/lib/openbuilds/feedTopics", () => ({
  readPostsByIds: vi.fn(async (ids: string[]) => {
    stand.reads.push(`posts:${ids.join(",")}`);
    return ids.map((id) => (id === "r1" ? post("r1", "t9", "t9") : post(id)));
  }),
}));
vi.mock("@/lib/openbuilds/cardWork", () => ({
  NO_CARD_WORK: { builds: new Map(), nodes: new Map() },
  readCardExtras: vi.fn(async () => {
    stand.reads.push("extras");
    return { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() };
  }),
}));

import { getProfileFeed, nextCursor, type ProfileFeedRow } from "./getProfileFeed";

const row = (kind: ProfileFeedRow["kind"], id: string, at: string, pinned: number | null = null): ProfileFeedRow => ({ kind, id, created_at: at, pinned_position: pinned });

beforeEach(() => {
  stand.rows = [];
  stand.rpcs = [];
  stand.reads = [];
});

describe("getProfileFeed", () => {
  it("keeps the database's order, pins first, each kind as its card", async () => {
    stand.rows = [
      row("topic", "t1", "2026-11-01T00:00:00Z", 1),
      row("build", "b1", "2026-11-05T00:00:00Z"),
      row("repro_note", "n1", "2026-11-04T00:00:00Z"),
      row("reply", "r1", "2026-11-03T00:00:00Z"),
      row("build", "b2", "2026-11-02T00:00:00Z"),
    ];
    const page = await getProfileFeed("maya");
    expect(page.items.map((item) => item.key)).toEqual(["topic:t1", "build:b1", "repro_note:n1", "reply:r1", "build:b2"]);
    expect(page.items[0].pinned).toBe(1);
    expect(page.items[1]).toMatchObject({ kind: "build", display: "map" });
    expect(page.items[4]).toMatchObject({ kind: "build", display: null });
    expect(page.items[2]).toMatchObject({ kind: "repro_note", note: { title: "Podcast clipper", makerHandle: "kit", model: "Opus 5.5", worked: true, note: "Ran clean" } });
    expect(page.items[3]).toMatchObject({ kind: "reply", root: { id: "t9" } });
  });

  it("asks the function for the filter and the cursor", async () => {
    for (const filter of ["all", "builds", "topics", "replies", "notes"] as const) {
      await getProfileFeed("maya", { filter, cursor: "2026-11-01T00:00:00Z" });
    }
    expect(stand.rpcs.map((call) => call.fn)).toEqual(Array(5).fill("get_profile_feed"));
    expect(stand.rpcs.map((call) => call.params.p_filter)).toEqual(["all", "builds", "topics", "replies", "notes"]);
    expect(stand.rpcs[0].params).toMatchObject({ p_username: "maya", p_cursor: "2026-11-01T00:00:00Z", p_limit: 20 });
  });

  it("reads each kind once for the page, and nothing for a kind it does not hold", async () => {
    stand.rows = [row("build", "b1", "2026-11-05T00:00:00Z"), row("build", "b2", "2026-11-04T00:00:00Z")];
    await getProfileFeed("maya", { filter: "builds" });
    expect(stand.reads.sort()).toEqual(["build_profile_display", "builds"]);
  });

  it("leaves out a row whose card did not come back", async () => {
    stand.rows = [row("build", "gone", "2026-11-05T00:00:00Z"), row("build", "b1", "2026-11-04T00:00:00Z")];
    const page = await getProfileFeed("maya");
    expect(page.items.map((item) => item.id)).toEqual(["b1"]);
  });
});

describe("the next page", () => {
  it("starts after the last row that is not a pin, and only after a full page", () => {
    const rows = [row("topic", "t1", "2026-01-09T00:00:00Z", 1), row("build", "b1", "2026-01-05T00:00:00Z"), row("build", "b2", "2026-01-04T00:00:00Z")];
    expect(nextCursor(rows, 2)).toBe("2026-01-04T00:00:00Z");
    expect(nextCursor(rows, 3)).toBeNull();
  });
});

describe("what get_profile_feed never returns", () => {
  const sql = readFileSync("supabase/migrations/20261109120000_ux10_profile_feed.sql", "utf8").replace(/--[^\n]*/g, "");
  const feed = sql.slice(sql.indexOf("FUNCTION public.get_profile_feed"), sql.indexOf("FUNCTION public.profile_level_of"));
  const reader = sql.slice(sql.indexOf("FUNCTION public.profile_reader_view"), sql.indexOf("FUNCTION public.get_profile_feed"));

  it("pins lead the first page only", () => {
    expect(feed).toMatch(/WHERE p_cursor IS NULL/);
    expect(feed).toMatch(/ORDER BY pinned_position NULLS LAST, created_at DESC/);
  });

  it("drafts never appear: published builds only, pinned or not", () => {
    expect(feed.match(/status IN \('published', 'gallery'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(feed).not.toMatch(/'draft'/);
  });

  it("a hidden reply, or a reply in a hidden topic, is absent", () => {
    expect(feed).toMatch(/p\.parent_id IS NOT NULL AND p\.hidden_by IS NULL/);
    expect(feed).toMatch(/root\.id = p\.root_id AND root\.hidden_by IS NULL/);
  });

  it("notes follow notes_visible: everyone, a follower when Followers, the owner always", () => {
    expect(sql).toMatch(/SELECT own OR notes_visible = 'everyone' OR \(notes_visible = 'followers' AND follows\)/);
    expect(feed.match(/profile_notes_shown\(who\.own, who\.follows, who\.notes_visible\)/g)).toHaveLength(2);
    expect(reader).toMatch(/f\.follower_id = \(select auth\.uid\(\)\) AND f\.following_id = p\.id/);
  });

  it("a private profile the reader does not follow returns nothing", () => {
    expect(reader).toMatch(/NOT coalesce\(p\.is_private, false\)\s+OR p\.id = \(select auth\.uid\(\)\)\s+OR EXISTS/);
  });

  it("never reads saves", () => {
    expect(feed).not.toMatch(/saved/);
  });
});
