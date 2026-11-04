// UX-07 P8: the choice budgets the additions must keep ⟦hicks-law › Enforcing It in the Code⟧, counted in the rendered pieces.
//
// Home's kind filters stay at five; a profile carries five tabs at most; and nothing UX-07 adds is a primary: Home's topics, reply
// groups, the build page's Discussed in OpenBuilds, a profile's Topics, the Library's saved topics and the reaction row draw
// controls and text buttons only, so a page keeps its one primary. Opened, Home's reply box carries the view's one primary, Reply.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" }, profile: null, loading: false, isLoggedIn: true }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { DiscussedSection } from "@/components/build/DiscussedSection";
import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { visionHomeProps } from "@/dev/fixtures/vision/home";
import { NO_REACTIONS } from "@/lib/openbuilds/postPage";
import { HomeView, type HomeViewProps } from "@/pages/site/home/HomeView";
import { HOME_FILTERS } from "@/pages/site/home/homeModel";
import { homePostItemOf } from "@/pages/site/home/homeTopics";
import { ReactionRow } from "@/pages/site/openbuilds/ReactionRow";
import { ReplyBox } from "@/pages/site/openbuilds/ReplyBox";
import { WORKS_TABS } from "@/pages/site/profile/profileModel";

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

const primaries = (root: ParentNode = document) => root.querySelectorAll('[data-visual-slot="btn-primary"]');
const wrap = (node: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

const NOW = Date.parse("2026-11-04T12:00:00Z");
const PERSON = { id: "u-maya", handle: "maya", name: "Maya Chen", avatarUrl: null };
const topicItems = [
  homePostItemOf({ kind: "post", key: "post:p1", at: "2026-11-04T10:00:00Z", postId: "p1", author: PERSON, body: "A topic", stillOpen: false, reward: null, replyCount: 2 }, undefined, NOW),
  homePostItemOf({ kind: "reply_group", key: "reply_group:p2", at: "2026-11-04T11:00:00Z", postId: "p2", root: { author: PERSON, body: "Another topic", createdAt: "2026-11-04T09:00:00Z", replyCount: 3 }, reply: { id: "r1", author: PERSON, body: "A reply", at: "2026-11-04T11:00:00Z" }, newReplyCount: 1 }, undefined, NOW),
];
const feed = (items: HomeViewProps["feed"]["items"]): HomeViewProps["feed"] => ({ status: "ready", items, hasMore: false, loadingMore: false, onMore: () => undefined, onRetry: () => undefined });
const CARD: PostCardData = { id: "t1", to: "/openbuilds/topics/t1", author: { id: "maya", name: "Maya Chen", handle: "maya", avatarUrl: null }, age: "2h", spaces: [], reward: null, heading: "A topic", text: "", attachments: [], stillOpen: false, tags: [], closes: null, replies: null, pinned: false, hidden: null, engagementBuild: null };

describe("UX-07 P8: the counts", () => {
  it("keeps Home's filters at five", () => {
    expect(HOME_FILTERS).toHaveLength(5);
    render(wrap(<HomeView {...visionHomeProps("populated")} feed={feed(topicItems)} />));
    expect(within(screen.getByRole("group", { name: "Kind" })).getAllByRole("button")).toHaveLength(5);
  });

  it("keeps a profile's tabs at five or fewer", () => {
    expect(WORKS_TABS.length).toBeLessThanOrEqual(5);
  });
});

describe("UX-07 P8: one primary", () => {
  it("adds no primary to Home's feed with its topics and reply groups", () => {
    render(wrap(<HomeView {...visionHomeProps("populated")} feed={feed(topicItems)} topics={{ onLike: vi.fn(), onReply: vi.fn(), save: { isSaved: () => false, onSave: vi.fn() }, box: null }} />));
    expect(primaries(screen.getByTestId("home-feed"))).toHaveLength(0);
  });

  it("gives Home's open reply box the view's one primary, Reply", () => {
    const box = <ReplyBox pageId="p1" rootId="p1" parentId="p1" about={null} onRemoveAbout={() => undefined} signInTo="/login" draftTitle="Reply: A topic" />;
    render(wrap(<HomeView {...visionHomeProps("populated")} feed={feed(topicItems)} topics={{ onLike: vi.fn(), onReply: vi.fn(), box: { at: "p1", node: box } }} />));
    const found = primaries(screen.getByTestId("home-feed"));
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe("Reply");
  });

  it("adds no primary with Discussed in OpenBuilds, a topic card, a compact card or the reaction row", () => {
    render(
      wrap(
        <>
          <DiscussedSection counts={{ topics: 1, replies: 0, started: 0 }} rows={[{ id: "t1", heading: "A topic", to: "/openbuilds/topics/t1", meta: "@maya" }]} isMaker onStart={() => undefined} />
          <PostCard card={CARD} topic={{ likes: 0, liked: false, onLike: () => undefined, replies: 0, onReply: () => undefined, save: { saved: false, onSave: () => undefined } }} />
          <PostCard card={CARD} compact />
          <ReactionRow kinds={["dislike", "rating"]} reactions={NO_REACTIONS} what="topic" onDislike={() => undefined} onRate={() => undefined} />
        </>,
      ),
    );
    expect(primaries()).toHaveLength(0);
  });
});
