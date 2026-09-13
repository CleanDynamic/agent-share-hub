// Acceptance cover for the feed's fourth kind of item (NS-P52).
//
// TWO CLAIMS, and both are about the seam between the migration and the
// browser: a row whose item_kind is 'bounty' becomes a bounty item carrying
// the reward and the gap's title, and that item renders as the red strip above
// the card the gallery already draws — with the card's own pill on it, because
// a bounty row knows about exactly one ask and it is this one.
//
// The row shapes here are the migration's RETURNS TABLE, column for column.
// If the two ever disagree, the migration is right.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BuildFeedItemView } from "@/components/feed/BuildFeedItems";
import {
  toFeedItem,
  type BuildFeedRow,
  type FeedItem,
} from "@/lib/feed/getBuildFeed";
import type { GalleryMedia } from "@/lib/build";

function row(overrides: Partial<BuildFeedRow> = {}): BuildFeedRow {
  return {
    item_kind: "build",
    item_at: "2026-08-20T10:00:00Z",
    build_id: "b1",
    slug: "inbox-triage",
    title: "Inbox triage agent",
    outcome: "Triages an inbox in under a minute.",
    shape: "app",
    cover_media_id: null,
    creator_id: "c1",
    creator_username: "amara",
    creator_display: "Amara",
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
    made_for: ["founder"],
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
    ...overrides,
  };
}

/**
 * One media row that IS part of a post, which is what `post_position` means.
 *
 * The feed's own rows never carry one — see the test that says so — so this is
 * written here rather than derived from `row()`: the point is to hand the card
 * the material the gallery's query already gives it and check that the feed asks
 * for the right layout over it. Dimensions are real, because the card reserves
 * its picture's height from them and a null pair takes a different branch.
 */
function postRow(position: number, text: string): GalleryMedia {
  return {
    id: `m${position}`,
    node_id: null,
    bucket: "build-media",
    path: `p/${position}.png`,
    kind: "image",
    width: 1200,
    height: 800,
    poster_path: null,
    duration: null,
    post_position: position,
    post_text: text,
  };
}

const BOUNTY_ROW = row({
  item_kind: "bounty",
  item_at: "2026-08-22T09:00:00Z",
  bounty_id: "bo1",
  bounty_reward_gbp: 120,
  bounty_gap_title: "The retry prompt",
});

function renderItem(feedRow: BuildFeedRow) {
  return render(
    <MemoryRouter>
      <BuildFeedItemView item={toFeedItem(feedRow)} srcByPath={new Map()} />
    </MemoryRouter>
  );
}

describe("a bounty in the feed", () => {
  it("maps the row to a bounty item at the bounty's own timestamp", () => {
    const item = toFeedItem(BOUNTY_ROW);

    expect(item.kind).toBe("bounty");
    // The cursor is bounties.created_at, which is what the function paged on.
    expect(item.at).toBe("2026-08-22T09:00:00Z");
    expect(item).toMatchObject({
      bountyId: "bo1",
      reward: 120,
      gapTitle: "The retry prompt",
    });
    // The key carries the kind: one build can appear twice on one page — as
    // itself and as the ask on it — and two React children keyed the same is a
    // rendering bug that looks like a data bug.
    expect(item.key).toContain("bounty:");
  });

  it("renders the red strip, naming the part, above the build's own card", () => {
    renderItem(BOUNTY_ROW);

    const item = screen.getByTestId("feed-item-bounty");
    expect(item).toHaveTextContent("Open bounty");
    expect(item).toHaveTextContent("The retry prompt");
    expect(within(item).getByTestId("feed-bounty-reward")).toHaveTextContent("£120");
    // The card the gallery draws, not a second design for the same build.
    expect(item).toHaveTextContent("Inbox triage agent");
    expect(within(item).getByTestId("gallery-card-bounty")).toHaveTextContent(
      "1 part unsolved · £120"
    );
  });

  it("says the plain thing for an unpriced, build-level ask", () => {
    renderItem(
      row({
        item_kind: "bounty",
        bounty_id: "bo2",
        bounty_reward_gbp: null,
        bounty_gap_title: null,
      })
    );

    const item = screen.getByTestId("feed-item-bounty");
    // No part is invented for a bounty that names no gap node, and no price
    // for one that has none — an unpriced ask is still a real bounty.
    expect(item).toHaveTextContent("part of this build is unsolved");
    expect(within(item).queryByTestId("feed-bounty-reward")).toBeNull();
    expect(within(item).getByTestId("gallery-card-bounty")).toHaveTextContent(
      "1 part unsolved"
    );
  });

  it("leaves an ordinary build card saying nothing about bounties", () => {
    renderItem(row());

    const item = screen.getByTestId("feed-item-build");
    // Absent, not empty: a build row was never asked the question, so its card
    // must not assert that the build has no open ask.
    expect(within(item).queryByTestId("gallery-card-bounty")).toBeNull();
    expect(screen.queryByTestId("feed-item-bounty")).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   BG-P09 — one change, two surfaces
   ──────────────────────────────────────────────────────────────────────────── */

describe("the rebuilt card in the feed", () => {
  it("renders the frame and the thread box, the same two layers the gallery draws", () => {
    // THE POINT OF THE SHARED COMPONENT. This file imports GalleryCard; BG-P09
    // rebuilt that component; so the Builds tab got the rebuild without a line
    // of feed code changing. A feed that had drawn its own card would have to be
    // remembered here every time, and would drift the first time it was not.
    renderItem(row());
    const item = screen.getByTestId("feed-item-build");
    expect(item.querySelector('[data-visual-slot="gallery-card"]')).not.toBeNull();
    expect(item.querySelector('[data-visual-slot="card-thread"]')).not.toBeNull();
  });

  it("asks the card for FEED layout, on all three kinds that render one", () => {
    // BG-P18. The switch BG-P09 left for this prompt. It is asserted on all
    // three kinds because the literal lives in one constant for exactly this
    // reason: a build in the gallery's layout beside a rebuild in the feed's
    // would be one word wrong in one branch, and nothing else would say so.
    for (const [testid, feedRow] of [
      ["feed-item-build", row()],
      ["feed-item-rebuild", row({ item_kind: "rebuild", parent_build_id: "b0", rebuild_note: "Swapped it." })],
      ["feed-item-bounty", BOUNTY_ROW],
    ] as const) {
      const { unmount } = renderItem(feedRow);
      const item = screen.getByTestId(testid);
      expect(item.querySelector('[data-card-layout="feed"]')).not.toBeNull();
      expect(item.querySelector('[data-card-layout="grid"]')).toBeNull();
      unmount();
    }
  });

  it("still draws the fixed slot for a row the feed query gives no post rows", () => {
    // NOT A CONTRADICTION OF THE TEST ABOVE, and the distinction is the whole
    // state of play after BG-P18. The card is ASKED for feed layout; it falls
    // back to the gallery's fixed slot for a build with no post entries, because
    // the guarantee that no card is ever empty outranks the layout it was asked
    // for. get_build_feed returns one cover row with post_position null, so
    // every row the feed has today takes that fallback — see coverRows in
    // src/lib/feed/getBuildFeed.ts. This test is what will fail, loudly and in
    // the right file, on the day that function starts returning the post's rows.
    renderItem(row());
    const item = screen.getByTestId("feed-item-build");
    expect(item.querySelector('[data-thread-layout="grid"]')).not.toBeNull();
    expect(item.querySelector("[data-thread-control]")).toBeNull();
  });

  it("draws the thread, with its unfold control, once a build carries a post", () => {
    // The other side of the same seam, proven without the data layer: a build
    // whose media rows ARE a post gets the thread box, the entries' text and the
    // `Show thread` control — so the feed's `layout="feed"` is demonstrably
    // wired to the card rather than merely written down.
    const item = toFeedItem(row()) as Extract<FeedItem, { kind: "build" }>;
    const posted: FeedItem = {
      ...item,
      build: { ...item.build, media: [postRow(0, "First, the inbox."), postRow(1, "Then the labels.")] },
    };

    render(
      <MemoryRouter>
        <BuildFeedItemView item={posted} srcByPath={new Map()} />
      </MemoryRouter>
    );

    const rendered = screen.getByTestId("feed-item-build");
    expect(rendered.querySelector('[data-thread-layout="feed"]')).not.toBeNull();
    expect(rendered).toHaveTextContent("First, the inbox.");
    expect(rendered.querySelector("[data-thread-control]")).not.toBeNull();
    expect(within(rendered).getByRole("button")).toHaveTextContent("Show thread · 1 more");
  });

  it("puts the title, plaque and chips on the frame under the box, in order", () => {
    renderItem(row());
    const item = screen.getByTestId("feed-item-build");
    const parts = [...item.querySelectorAll("[data-card-part]")].map((el) =>
      el.getAttribute("data-card-part")
    );
    // Chips are absent on a feed row carrying no roles; the order of what is
    // present is what is fixed.
    expect(parts.slice(0, 2)).toEqual(["title", "plaque"]);
  });
});
