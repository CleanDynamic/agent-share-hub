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
    space: { name: "Claude Code", to: "/openbuilds/spaces/claude-code", members: "412 members", madeBy: "Made by @sam", description: "Work made with Claude Code", joined: false, onJoin: vi.fn(), onLeave: vi.fn() },
    builds: [
      { key: "r1", name: "Kit's screener", meta: "@kit · Rebuilt from @maya", to: "/b2/kits" },
      { key: "r2", name: "Ana's screener", meta: "@ana · In progress · 2 sessions", to: null },
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

  it("draws a link to the space above the post and the post's lead line as the page's h1 at 20/600, with the full body", () => {
    draw();
    const up = screen.getByRole("navigation", { name: "Where this post is" });
    expect(within(up).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/openbuilds/spaces/claude-code"]);
    expect(up.style.fontSize).toBe("13px");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Can anyone make the scorer faster?");
    expect(h1).toHaveStyle({ fontSize: "20px", fontWeight: "600" });
    // Not a link on its own page, and the body is not clamped.
    expect(screen.queryByTestId("post-card-heading-link")).toBeNull();
    expect(screen.getByText(/And a fourth\./).getAttribute("style") ?? "").not.toContain("line-clamp");
  });

  it("links to OpenBuilds above the post when the topic is in no space", () => {
    draw({ crumbs: [{ label: "OpenBuilds", to: "/openbuilds" }] });
    expect(within(screen.getByRole("navigation", { name: "Where this post is" })).getByRole("link", { name: "OpenBuilds" })).toHaveAttribute("href", "/openbuilds");
  });

  it("offers only the Thread pill until a reply holds a build, and says the order", () => {
    draw();
    const show = screen.getByRole("group", { name: "Show" });
    expect(within(show).getAllByRole("button").map((button) => button.textContent)).toEqual(["Thread 6"]);
    expect(within(show).getByRole("button", { name: "Thread 6" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Oldest first")).toBeInTheDocument();
  });

  it("offers the Wall once a reply holds a build, and switches by the address's handler", () => {
    const onTab = vi.fn();
    draw({ builds: 3, onTab });
    fireEvent.click(screen.getByRole("button", { name: "Wall 3 builds" }));
    expect(onTab).toHaveBeenCalledWith("wall");
  });

  it("draws a pinned reply first inside a Card, with who pinned it after the age", () => {
    draw();
    const [maya] = screen.getAllByTestId("reply");
    const box = within(maya).getByTestId("reply-pinned");
    expect(box).toHaveStyle({ borderRadius: "12px", padding: "16px" });
    expect(box.style.border).toBe("");
    expect(within(maya).getByText(/· Pinned by @sam$/)).toBeInTheDocument();
  });

  it("draws a reply's name 15/600, its age and text at 15", () => {
    draw();
    const [maya] = screen.getAllByTestId("reply");
    expect(within(maya).getByText("MAYA")).toHaveStyle({ fontSize: "15px", fontWeight: "600" });
    expect(within(maya).getByText(/· Pinned by @sam$/)).toHaveStyle({ fontSize: "15px" });
  });

  it("draws two levels, the second 34 in, and counts a deeper branch", () => {
    draw();
    const nested = screen.getByRole("list", { name: "Replies to KIT" });
    expect(nested).toHaveStyle({ marginLeft: "34px" });
    expect(within(nested).getAllByTestId("reply").map((entry) => entry.getAttribute("data-depth"))).toEqual(["1", "1"]);
    expect(within(nested).getByRole("link", { name: "View 3 more replies" })).toHaveAttribute("href", "/?reply=ola");
  });

  it("draws Reply, Like and View more as 13 text buttons 24 high with 4 side padding (the control-heights pass)", () => {
    draw();
    const first = screen.getAllByTestId("reply")[0];
    const controls = [
      within(first).getByRole("button", { name: "Reply" }),
      within(first).getByRole("button", { name: "Like" }),
      screen.getByRole("link", { name: "View 3 more replies" }),
    ];
    for (const control of controls) expect([control.style.height, control.style.padding, control.style.fontSize], control.textContent ?? "").toEqual(["24px", "0px 4px", "13px"]);
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

  it("heads the space's section in the side panel by its fact, then the builds in the post by their count", () => {
    draw();
    const side = screen.getByRole("complementary", { name: "About this post" });
    const space = within(side).getByRole("region", { name: "Space" });
    expect(within(space).getByRole("heading", { level: 2, name: "412 members" })).toBeInTheDocument();
    expect(within(space).getByText("Work made with Claude Code")).toBeInTheDocument();
    expect(within(space).getByText("Made by @sam")).toBeInTheDocument();
    expect(within(space).getByRole("button", { name: "Join Claude Code" })).toHaveTextContent("Join space");
    const builds = within(side).getByRole("region", { name: "Builds in this post" });
    expect(within(builds).getByRole("heading", { level: 2, name: "2 builds in this post" })).toBeInTheDocument();
    expect(within(builds).getByRole("link", { name: "Kit's screener" })).toHaveAttribute("href", "/b2/kits");
    expect(within(builds).getByText("Ana's screener").tagName).toBe("SPAN");
    expect(within(builds).getByText("@kit · Rebuilt from @maya")).toBeInTheDocument();
  });

  it("has no builds section while no reply holds a build", () => {
    draw({ side: { space: null, builds: [] } });
    expect(screen.queryByRole("region", { name: "Builds in this post" })).toBeNull();
  });
});
