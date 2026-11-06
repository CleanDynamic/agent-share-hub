// UX-07 P1: a topic in Home's feed is the post card, every reply group is one item, and the fifth filter is Topics.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";
import type { PostFeedEntry } from "@/lib/feed/getBuildFeed";
import type { FeedTopics } from "@/lib/openbuilds/feedTopics";
import type { Post } from "@/lib/openbuilds/types";

import { HomeView, type HomeViewProps } from "./HomeView";
import { HOME_FILTERS, matchesFilter } from "./homeModel";
import { feedTopicIds, homePostItemOf, replyGroupCount, type HomeReplyGroup, type HomeTopicPost } from "./homeTopics";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

beforeEach(() =>
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    return { matches: min ? 1440 >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  }),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOW = Date.parse("2026-11-04T12:00:00Z");
const MAYA = { id: "u-maya", handle: "maya", name: "Maya Chen", avatarUrl: null };
const KIT = { id: "u-kit", handle: "kit", name: "Kit Ward", avatarUrl: null };

const TOPIC: PostFeedEntry = { kind: "post", key: "post:p1:2026-11-04T10:00:00Z", at: "2026-11-04T10:00:00Z", postId: "p1", author: MAYA, body: "How do you keep a long agent run on track?\nI lose it after an hour.", stillOpen: true, reward: null, replyCount: 4 };
const GROUP: PostFeedEntry = {
  kind: "reply_group",
  key: "reply_group:p2:2026-11-04T11:00:00Z",
  at: "2026-11-04T11:00:00Z",
  postId: "p2",
  root: { author: MAYA, body: "Which model for a code review step?", createdAt: "2026-11-03T09:00:00Z", replyCount: 6 },
  reply: { id: "r9", author: KIT, body: "Sonnet, with the diff only.", at: "2026-11-04T11:00:00Z" },
  newReplyCount: 3,
};

const reply: Post = {
  id: "r9",
  authorId: KIT.id,
  parentId: "p2",
  rootId: "p2",
  body: "Sonnet, with the diff only.",
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
  likeCount: 2,
  createdAt: GROUP.at,
  updatedAt: GROUP.at,
  author: KIT,
  attachments: [{ position: 0, kind: "step", buildId: null, nodeId: null, partKey: null, sessionKey: null, mediaPath: null, mediaKind: null, snapshot: { type: "prompt", title: null, payload: { text: "Review only the diff." } } }],
  spaces: [],
  replyCount: 0,
};
const READ: FeedTopics = { posts: new Map([["r9", reply]]), extras: { work: { builds: new Map(), nodes: new Map() }, digests: new Map(), signed: new Map() }, liked: new Set(["p1"]), newReplies: {} };

const mount = (over: Partial<HomeViewProps>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeView {...visionHomeProps("populated")} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const feedOf = (items: HomeViewProps["feed"]["items"]): HomeViewProps["feed"] => ({ status: "ready", items, hasMore: false, loadingMore: false, onMore: () => undefined, onRetry: () => undefined });

describe("UX-07 P1: the Topics filter", () => {
  it("keeps five filters and relabels Asks to Topics, leaving Notes as it was", () => {
    expect(HOME_FILTERS.map((item) => item.label)).toEqual(["All", "Builds", "Rebuilds", "Notes", "Topics"]);
    expect(HOME_FILTERS.find((item) => item.value === "notes")?.label).toBe("Notes");
  });

  it("matches topics and reply groups, and nothing else", () => {
    expect(matchesFilter("topic", "asks")).toBe(true);
    expect(matchesFilter("reply_group", "asks")).toBe(true);
    expect(matchesFilter("build", "asks")).toBe(false);
    expect(matchesFilter("repro_note", "asks")).toBe(false);
    expect(matchesFilter("topic", "builds")).toBe(false);
    expect(matchesFilter("topic", "all")).toBe(true);
  });
});

describe("UX-07 P1: the two kinds of item", () => {
  it("draws a topic from its feed row, then from the post read", () => {
    const fromRow = homePostItemOf(TOPIC, undefined, NOW) as HomeTopicPost;
    expect(fromRow.kind).toBe("topic");
    expect(fromRow.card.heading).toBe("How do you keep a long agent run on track?");
    expect(fromRow.card.to).toBe("/openbuilds/topics/p1");
    expect(fromRow.replies).toBe(4);
    expect(fromRow.liked).toBe(false);
    expect((homePostItemOf(TOPIC, READ, NOW) as HomeTopicPost).liked).toBe(true);
  });

  it("draws a reply group as the topic's head and heading, the new count, and the newest reply with its attachment", () => {
    const group = homePostItemOf(GROUP, READ, NOW) as HomeReplyGroup;
    expect(group.kind).toBe("reply_group");
    expect(group.topic.heading).toBe("Which model for a code review step?");
    expect(group.count).toBe("3 new replies");
    expect(group.to).toBe("/openbuilds/topics/p2#reply-r9");
    expect(group.reply.body).toBe("Sonnet, with the diff only.");
    expect(group.reply.attachments.map((attachment) => attachment.kind)).toEqual(["step"]);
  });

  it("says every reply when none is new to the reader", () => {
    expect(replyGroupCount({ ...(GROUP as Extract<PostFeedEntry, { kind: "reply_group" }>), newReplyCount: null }, {})).toBe("6 replies");
    expect(replyGroupCount({ ...(GROUP as Extract<PostFeedEntry, { kind: "reply_group" }>), newReplyCount: null }, { p2: 1 })).toBe("1 new reply");
  });

  it("asks the second read for the topics and each group's newest reply", () => {
    expect(feedTopicIds([TOPIC, GROUP])).toEqual({ topics: ["p1", "p2"], replies: ["r9"] });
  });

  it("renders a topic as the post card with Reply in the comment slot, and the reply box under it", () => {
    const onReply = vi.fn();
    const items = [homePostItemOf(TOPIC, READ, NOW), homePostItemOf(GROUP, READ, NOW)];
    const { rerender } = mount({ feed: feedOf(items), topics: { onLike: vi.fn(), onReply, box: null } });
    const topic = screen.getByRole("article", { name: "How do you keep a long agent run on track?" });
    const replyButton = within(topic).getByRole("button", { name: "Reply, 4 replies" });
    expect(replyButton.getAttribute("data-engagement-action")).toBe("comment");
    fireEvent.click(replyButton);
    expect(onReply).toHaveBeenCalledWith("p1");
    expect(within(topic).getByRole("button", { name: "Unlike" }).getAttribute("aria-pressed")).toBe("true");

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HomeView {...visionHomeProps("populated")} feed={feedOf(items)} topics={{ onLike: vi.fn(), onReply, box: { at: "p1", node: <textarea aria-label="Your reply" /> } }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(within(screen.getByTestId("home-reply-box")).getByRole("textbox", { name: "Your reply" })).toBeTruthy();
  });

  it("renders a reply group linking to the topic at that reply", () => {
    mount({ feed: feedOf([homePostItemOf(GROUP, READ, NOW)]) });
    const group = screen.getByRole("article", { name: "3 new replies in Which model for a code review step?" });
    expect(within(group).getByTestId("home-reply-group-count").textContent).toBe("3 new replies");
    expect(within(group).getByTestId("home-reply-group-link").getAttribute("href")).toBe("/openbuilds/topics/p2#reply-r9");
    expect(within(group).getByText("Sonnet, with the diff only.")).toBeTruthy();
    expect(within(group).getByText("Review only the diff.")).toBeTruthy();
  });

  it("keeps the Topics filter to its kinds when chosen", () => {
    mount({ filter: "asks", feed: feedOf([homePostItemOf(TOPIC, READ, NOW), ...visionHomeProps("populated").feed.items]) });
    const kinds = screen.getAllByTestId("home-feed-item").map((node) => node.getAttribute("data-kind"));
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every((kind) => kind === "topic" || kind === "reply_group")).toBe(true);
  });
});
