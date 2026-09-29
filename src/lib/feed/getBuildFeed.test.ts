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

import { getBuildFeed, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

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
