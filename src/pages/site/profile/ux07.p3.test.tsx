// UX-07 P3: a profile's Topics tab: the person's topics and replies, newest first, as post cards.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { profileFixture } from "@/dev/fixtures/profile";
import type { Post } from "@/lib/openbuilds/types";

import { ProfileView, type ProfileViewProps } from "./ProfileView";
import { WORKS_TABS, emptyLine, profileTopicEntries, worksTabOf } from "./profileModel";

afterEach(cleanup);

const NOW = Date.parse("2026-11-04T12:00:00Z");
const ME = { id: "u-me", handle: "kit", name: "Kit Ward", avatarUrl: null };
const base = (over: Partial<Post>): Post => ({
  id: "t1",
  authorId: ME.id,
  parentId: null,
  rootId: "t1",
  body: "A topic of mine\nWith words",
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 0,
  createdAt: "2026-11-04T10:00:00Z",
  updatedAt: "2026-11-04T10:00:00Z",
  author: ME,
  attachments: [],
  spaces: [],
  replyCount: 0,
  ...over,
});
const PAGE = {
  posts: [base({ id: "r1", parentId: "t9", rootId: "t9", body: "Use the diff only.", createdAt: "2026-11-04T11:00:00Z" }), base({})],
  roots: new Map([["t9", { id: "t9", handle: "maya", body: "Which model for a code review step?\nMore" }]]),
  extras: { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() },
};

describe("UX-07 P3: the tabs", () => {
  it("adds Topics after the existing tabs, and a profile carries five at most", () => {
    expect(WORKS_TABS.map((tab) => tab.label)).toEqual(["Builds", "Rebuilds", "Reproduced", "Collections", "Topics"]);
    expect(WORKS_TABS.length).toBeLessThanOrEqual(5);
    expect(worksTabOf("topics")).toBe("topics");
    expect(emptyLine("topics", true)).toBe("You haven't started or replied to a topic yet.");
  });
});

describe("UX-07 P3: both kinds", () => {
  it("makes a topic a card of its own, and a reply a card with the topic it answers above it", () => {
    const [reply, topic] = profileTopicEntries(PAGE, NOW);
    expect(topic.card.heading).toBe("A topic of mine");
    expect(topic.card.to).toBe("/openbuilds/topics/t1");
    expect(topic.repliedTo).toBeNull();
    expect(reply.card.heading).toBe("Use the diff only.");
    expect(reply.repliedTo).toEqual({ text: "Replied to @maya · Which model for a code review step?", to: "/openbuilds/topics/t9#reply-r1" });
    expect(reply.card.to).toBe("/openbuilds/topics/t9#reply-r1");
  });

  it("draws the tab as post cards, newest first, the reply's line linking to the reply", () => {
    const fixture = profileFixture();
    const props: ProfileViewProps = { ...fixture, works: { ...fixture.works, tab: "topics", status: "ready", topics: profileTopicEntries(PAGE, NOW), hasMore: false } };
    render(
      <MemoryRouter>
        <ProfileView fit="content" {...props} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("tab", { name: /^Topics/ }).getAttribute("aria-selected")).toBe("true");
    const items = within(screen.getByTestId("profile-topics")).getAllByTestId("profile-topic");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("link", { name: "Replied to @maya · Which model for a code review step?" }).getAttribute("href")).toBe("/openbuilds/topics/t9#reply-r1");
    expect(within(items[0]).getByRole("article", { name: "Use the diff only." })).toBeTruthy();
    expect(within(items[1]).queryByTestId("profile-replied-to")).toBeNull();
    expect(within(items[1]).getByRole("article", { name: "A topic of mine" })).toBeTruthy();
  });
});
