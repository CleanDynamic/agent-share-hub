// The feed's one request, with and without the following scope (RC-P11).
//
// The RPC is stubbed and its arguments recorded: the claim is that the
// Following tab adds exactly one argument to the call the Builds tab already
// made, and that every other caller sends the request it always sent. The page
// shape is asserted against the same rows either way.

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (name: string, args: unknown) => rpc(name, args) },
}));

import { getBuildFeed, toFeedItem, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

function row(over: Partial<BuildFeedRow> = {}): BuildFeedRow {
  return {
    item_kind: "build",
    item_at: "2026-09-20T10:00:00.000Z",
    build_id: "b1",
    slug: "inbox-triage",
    title: "Inbox triage",
    outcome: "Triages an inbox.",
    shape: "agent",
    cover_media_id: null,
    creator_id: "c1",
    creator_username: "maya",
    creator_display: "Maya",
    creator_avatar: null,
    reproduction_count: 2,
    rebuild_count: 0,
    parent_build_id: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    rebuild_note: null,
    repro_note: null,
    repro_model: null,
    repro_user_username: null,
    status: "published",
    made_for: ["lawyer"],
    last_confirmed_at: null,
    last_confirmed_model: null,
    cover_bucket: null,
    cover_path: null,
    cover_kind: null,
    cover_poster_path: null,
    repro_worked: null,
    bounty_id: null,
    bounty_reward_gbp: null,
    bounty_gap_title: null,
    ...over,
  };
}

describe("getBuildFeed's following scope", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [row()], error: null });
  });

  it("sends no following argument unless asked", async () => {
    await getBuildFeed();
    await getBuildFeed({ onlyFollowing: false });

    for (const call of rpc.mock.calls) {
      expect(call[0]).toBe("get_build_feed");
      expect(call[1]).not.toHaveProperty("only_following");
    }
  });

  it("sends only_following: true when asked, beside the arguments it always sent", async () => {
    await getBuildFeed({ onlyFollowing: true, before: "2026-09-21T00:00:00.000Z", pageSize: 10 });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toEqual({
      page_size: 10,
      before: "2026-09-21T00:00:00.000Z",
      only_following: true,
    });
  });

  it("returns the same page shape either way", async () => {
    const everyone = await getBuildFeed({ pageSize: 1 });
    const following = await getBuildFeed({ pageSize: 1, onlyFollowing: true });

    expect(following).toEqual(everyone);
    expect(following.items).toHaveLength(1);
    expect(following.items[0]).toMatchObject({ kind: "build", key: "build:b1:2026-09-20T10:00:00.000Z" });
    expect(following.nextBefore).toBe("2026-09-20T10:00:00.000Z");
  });
});

describe("the maker on every kind of item (UI-P27)", () => {
  const maker = { id: "c1", handle: "maya", name: "Maya", avatarUrl: null };

  it("carries the build's maker on a build, a rebuild and a bounty", () => {
    expect(toFeedItem(row())).toMatchObject({ kind: "build", maker });
    expect(toFeedItem(row({ item_kind: "rebuild", parent_build_id: "b0" }))).toMatchObject({ kind: "rebuild", maker });
    expect(toFeedItem(row({ item_kind: "bounty", bounty_id: "x1", bounty_reward_gbp: 150 }))).toMatchObject({
      kind: "bounty",
      maker,
    });
  });

  it("gives a reproduction note the build it is about, beside the reproducer's handle", () => {
    const item = toFeedItem(
      row({
        item_kind: "repro_note",
        repro_note: "worked first try",
        repro_user_username: "ada",
        reproduction_count: 9,
        last_confirmed_at: "2026-09-18T10:00:00.000Z",
      }),
    );

    expect(item).toMatchObject({ kind: "repro_note", handle: "ada", maker });
    if (item.kind !== "repro_note") throw new Error("expected a note");
    expect(item.build).toMatchObject({ id: "b1", reproduction_count: 9, last_confirmed_at: "2026-09-18T10:00:00.000Z" });
  });
});

// UX-04 P6: the two kinds that carry posts, and the function that predates them.
describe("posts and reply groups in the feed (UX-04)", () => {
  const postRow = (over: Partial<BuildFeedRow> = {}): BuildFeedRow =>
    row({
      item_kind: "post",
      item_at: "2026-11-01T10:00:00.000Z",
      build_id: null as unknown as string,
      slug: null as unknown as string,
      title: null as unknown as string,
      creator_id: null as unknown as string,
      post_id: "p1",
      post_created_at: "2026-11-01T10:00:00.000Z",
      post_author_id: "u1",
      post_author_username: "maya",
      post_author_display: "Maya",
      post_author_avatar: null,
      post_body: "How do I route support mail?",
      post_still_open: true,
      post_reward_gbp: 25,
      post_reply_count: 3,
      ...over,
    });

  const groupRow = (over: Partial<BuildFeedRow> = {}): BuildFeedRow =>
    postRow({
      item_kind: "reply_group",
      item_at: "2026-11-02T09:00:00.000Z",
      reply_id: "r9",
      reply_at: "2026-11-02T09:00:00.000Z",
      reply_author_id: "u2",
      reply_author_username: "kit",
      reply_author_display: "Kit",
      reply_author_avatar: null,
      reply_body: "Try a label per sender.",
      reply_new_count: 4,
      ...over,
    });

  beforeEach(() => {
    rpc.mockReset();
  });

  it("maps a post to a typed item", async () => {
    rpc.mockResolvedValue({ data: [postRow()], error: null });
    const page = await getBuildFeed({ pageSize: 1 });

    expect(page.items).toEqual([]);
    expect(page.postItems).toEqual([
      {
        kind: "post",
        key: "post:p1:2026-11-01T10:00:00.000Z",
        at: "2026-11-01T10:00:00.000Z",
        postId: "p1",
        author: { id: "u1", handle: "maya", name: "Maya", avatarUrl: null },
        body: "How do I route support mail?",
        stillOpen: true,
        reward: 25,
        replyCount: 3,
      },
    ]);
    expect(page.nextBefore).toBe("2026-11-01T10:00:00.000Z");
  });

  it("maps a reply group to the newest reply and the count of new ones", async () => {
    rpc.mockResolvedValue({ data: [groupRow()], error: null });
    const page = await getBuildFeed({ pageSize: 20, onlyFollowing: true });

    expect(page.postItems).toEqual([
      {
        kind: "reply_group",
        key: "reply_group:p1:2026-11-02T09:00:00.000Z",
        at: "2026-11-02T09:00:00.000Z",
        postId: "p1",
        root: {
          author: { id: "u1", handle: "maya", name: "Maya", avatarUrl: null },
          body: "How do I route support mail?",
          createdAt: "2026-11-01T10:00:00.000Z",
          replyCount: 3,
        },
        reply: {
          id: "r9",
          author: { id: "u2", handle: "kit", name: "Kit", avatarUrl: null },
          body: "Try a label per sender.",
          at: "2026-11-02T09:00:00.000Z",
        },
        newReplyCount: 4,
      },
    ]);
  });

  it("keeps the old kinds and the new ones apart, in the order the function sent them", async () => {
    rpc.mockResolvedValue({
      data: [groupRow(), row({ item_at: "2026-11-01T12:00:00.000Z" }), postRow()],
      error: null,
    });
    const page = await getBuildFeed({ pageSize: 20 });

    expect(page.items.map((item) => item.kind)).toEqual(["build"]);
    expect(page.postItems.map((item) => item.kind)).toEqual(["reply_group", "post"]);
  });

  it("still loads the old kinds when the function predates the new columns", async () => {
    // The function before 20261107170000 returns rows without any post_* or reply_* key at all.
    rpc.mockResolvedValue({
      data: [row(), row({ item_kind: "bounty", bounty_id: "x1", bounty_reward_gbp: 150, item_at: "2026-09-19T10:00:00.000Z" })],
      error: null,
    });
    const page = await getBuildFeed({ pageSize: 20 });

    expect(page.items.map((item) => item.kind)).toEqual(["build", "bounty"]);
    expect(page.postItems).toEqual([]);
  });

  it("drops a row of a kind it does not know, and a post row missing what the kind needs", async () => {
    rpc.mockResolvedValue({
      data: [
        { ...row(), item_kind: "something_new" } as unknown as BuildFeedRow,
        postRow({ post_id: null }),
        groupRow({ reply_id: null }),
        row(),
      ],
      error: null,
    });
    const page = await getBuildFeed({ pageSize: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.postItems).toEqual([]);
  });

  it("still throws the layer's error when the call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getBuildFeed()).rejects.toThrow(/getBuildFeed failed: boom/);
  });
});
