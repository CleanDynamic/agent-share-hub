// UX-06 Part 1: the post page's anatomy, drawn from its props: the crumbs, the post at page size with its heading as the h1, the
// switch (the Wall only once a reply holds a build), Oldest first, replies two levels deep with a deeper branch counted, a pinned
// reply in the module box, a reply about a step, and the side column.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: false, user: null }) }));

import type { PostCardData } from "@/components/post/postCardModel";

import type { ReplyActions } from "./PostReplies";
import { PostView, type PostViewProps } from "./PostView";
import type { ReplyItem } from "./postModel";

const card: PostCardData = {
  id: "p1",
  to: "/openbuilds/topics/p1",
  author: { id: "sam", name: "Sam Ellis", handle: "sam", avatarUrl: null },
  age: "2h",
  spaces: [{ slug: "claude-code", name: "Claude Code" }],
  reward: null,
  heading: "Can anyone make the scorer faster?",
  text: "It takes four seconds a CV.\nA second line that a list would clamp.\nA third.\nAnd a fourth.",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
};

const reply = (id: string, extra: Partial<ReplyItem> = {}): ReplyItem => ({
  id,
  depth: 0,
  author: { id: `u-${id}`, name: id.toUpperCase(), handle: id, avatarUrl: null },
  age: "20m",
  body: `Words of ${id}`,
  about: null,
  attachments: [],
  likes: 0,
  liked: false,
  pinnedBy: null,
  build: null,
  step: null,
  children: [],
  more: 0,
  canPin: false,
  canHide: false,
  canReport: false,
  ...extra,
});

const actions: ReplyActions = { onReply: vi.fn(), onLike: vi.fn(), onPin: vi.fn(), onUnpin: vi.fn(), onHide: vi.fn(), branchHref: (id) => `?reply=${id}` };

const props = (extra: Partial<PostViewProps> = {}): PostViewProps => ({
  crumbs: [
    { label: "OpenBuilds", to: "/openbuilds" },
    { label: "Claude Code", to: "/openbuilds/spaces/claude-code" },
  ],
  card,
  tab: "thread",
  onTab: vi.fn(),
  replies: 6,
  builds: 0,
  thread: {
    items: [
      reply("maya", { pinnedBy: "@sam" }),
      reply("kit", { about: "Step 4 · Prompt", likes: 3, children: [reply("ola", { depth: 1, more: 3 }), reply("jo", { depth: 1 })] }),
    ],
    filter: null,
  },
  actions,
  side: {
    space: { name: "Claude Code", to: "/openbuilds/spaces/claude-code", meta: "Made by @sam · 412 members", description: "Work made with Claude Code", joined: false, onJoin: vi.fn(), onLeave: vi.fn() },
    rows: [
      { label: "People replying", value: 4 },
      { label: "Replies on Step 4", value: 1 },
    ],
  },
  ...extra,
});

const draw = (extra: Partial<PostViewProps> = {}) =>
  render(
    <MemoryRouter>
      <PostView {...props(extra)} />
    </MemoryRouter>,
  );

describe("the post page's anatomy", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  });

  it("draws the crumbs as links and the post's heading as the page's h1, with the full body", () => {
    draw();
    const crumbs = screen.getByRole("navigation", { name: "Where this post is" });
    expect(within(crumbs).getByRole("link", { name: "OpenBuilds" })).toHaveAttribute("href", "/openbuilds");
    expect(within(crumbs).getByRole("link", { name: "Claude Code" })).toHaveAttribute("href", "/openbuilds/spaces/claude-code");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Can anyone make the scorer faster?");
    expect(h1).toHaveStyle({ fontSize: "20px", fontWeight: "500" });
    // Not a link on its own page, and the body is not clamped.
    expect(screen.queryByTestId("post-card-heading-link")).toBeNull();
    expect(screen.getByText(/And a fourth\./).getAttribute("style") ?? "").not.toContain("line-clamp");
  });

  it("offers only the Thread until a reply holds a build, and says the order", () => {
    draw();
    const show = screen.getByRole("group", { name: "Show" });
    expect(within(show).getAllByRole("button").map((button) => button.textContent)).toEqual(["Thread · 6"]);
    expect(screen.getByText("Oldest first")).toBeInTheDocument();
  });

  it("offers the Wall once a reply holds a build, and switches by the address's handler", () => {
    const onTab = vi.fn();
    draw({ builds: 3, onTab });
    fireEvent.click(screen.getByRole("button", { name: "Wall · 3 builds" }));
    expect(onTab).toHaveBeenCalledWith("wall");
  });

  it("draws a pinned reply in the module box with who pinned it", () => {
    draw();
    const [maya] = screen.getAllByTestId("reply");
    expect(within(maya).getByText("Pinned by @sam")).toBeInTheDocument();
  });

  it("draws two levels, the second 38 in over a hairline rule, and counts a deeper branch", () => {
    draw();
    const nested = screen.getByRole("list", { name: "Replies to KIT" });
    expect(nested).toHaveStyle({ marginLeft: "38px", borderLeft: "1px solid var(--hairline)" });
    expect(within(nested).getAllByTestId("reply").map((entry) => entry.getAttribute("data-depth"))).toEqual(["1", "1"]);
    expect(within(nested).getByRole("link", { name: "View 3 more replies" })).toHaveAttribute("href", "/?reply=ola");
  });

  it("marks a reply about a step, and shows a like count only above zero", () => {
    draw();
    const kit = screen.getAllByTestId("reply")[1];
    expect(within(kit).getByTestId("reply-about")).toHaveTextContent("Step 4 · Prompt");
    expect(within(kit).getByRole("button", { name: "Like 3" })).toBeInTheDocument();
    const maya = screen.getAllByTestId("reply")[0];
    expect(within(maya).getByRole("button", { name: "Like" })).toBeInTheDocument();
  });

  it("draws the step filter's line and a way back to every reply", () => {
    const onShowAll = vi.fn();
    draw({ thread: { items: [reply("kit")], filter: { label: "Replies on Step 4 · Prompt", onShowAll } } });
    expect(screen.getByText("Replies on Step 4 · Prompt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all replies" }));
    expect(onShowAll).toHaveBeenCalled();
  });

  it("draws the space and In this post in the side column", () => {
    draw();
    const side = screen.getByRole("complementary", { name: "About this post" });
    expect(within(side).getByRole("link", { name: "Claude Code" })).toHaveAttribute("href", "/openbuilds/spaces/claude-code");
    expect(within(side).getByText("Made by @sam · 412 members")).toBeInTheDocument();
    expect(within(side).getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(within(side).getByText("People replying")).toBeInTheDocument();
    expect(within(side).getByText("Replies on Step 4")).toBeInTheDocument();
  });
});
