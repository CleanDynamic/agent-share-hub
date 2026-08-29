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
import { toFeedItem, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

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
      "bounty · £120"
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
    expect(within(item).getByTestId("gallery-card-bounty")).toHaveTextContent("bounty");
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
