// UX-05 Part 2: the feed's view. Every state, both layouts, and the lists it draws.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostCardData } from "@/components/post/postCardModel";

import { OpenBuildsFeedView, type OpenBuildsFeedViewProps } from "./OpenBuildsFeedView";

/** matchMedia for a window this wide. */
export function atWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

const card = (id: string, extra: Partial<PostCardData> = {}): PostCardData => ({
  id,
  to: `/openbuilds/topics/${id}`,
  author: { id: "u1", name: "Sam Ellis", handle: "sam", avatarUrl: null },
  age: "2h",
  spaces: [{ slug: "claude-code", name: "Claude Code" }],
  reward: null,
  heading: `Heading ${id}`,
  text: "",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
  ...extra,
});

const props = (extra: Partial<OpenBuildsFeedViewProps> = {}): OpenBuildsFeedViewProps => ({
  signedIn: true,
  scope: "mine",
  onScope: vi.fn(),
  open: false,
  onOpen: vi.fn(),
  onPost: vi.fn(),
  onMakeSpace: vi.fn(),
  signInTo: "/login?redirect=%2Fopenbuilds",
  spaces: {
    status: "ready",
    onRetry: vi.fn(),
    rows: [
      { id: "s1", slug: "claude-code", name: "Claude Code", fresh: 3 },
      { id: "s2", slug: "hiring-tools", name: "Hiring tools", fresh: 0 },
    ],
  },
  posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1") }, { card: card("p2") }] },
  busy: [{ id: "b1", slug: "evals", name: "Evals", meta: "Made by @sam · 412 members", onJoin: vi.fn() }],
  ...extra,
});

const draw = (extra: Partial<OpenBuildsFeedViewProps> = {}) =>
  render(
    <MemoryRouter>
      <OpenBuildsFeedView {...props(extra)} />
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("OpenBuildsFeedView", () => {
  it("heads the page with OpenBuilds, its line and the one primary, Post", () => {
    atWidth(1440);
    const view = props();
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "OpenBuilds" })).toBeInTheDocument();
    expect(screen.getByText("Post anything, reply with anything. Spaces are made and run by the people in them.")).toBeInTheDocument();
    const primary = document.querySelectorAll('[data-visual-slot="btn-primary"]');
    expect(primary).toHaveLength(1);
    fireEvent.click(primary[0] as HTMLElement);
    expect(view.onPost).toHaveBeenCalled();
  });

  it("lists Your spaces: All your spaces first, each space with n new at the right, hidden at zero", () => {
    atWidth(1440);
    draw();
    const column = screen.getByRole("region", { name: "Your spaces" });
    const links = within(column).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["All your spaces", "Claude Code3 new", "Hiring tools"]);
    expect(within(column).getByRole("button", { name: "Make a space" })).toBeInTheDocument();
    expect(within(column).getByRole("link", { name: "Hiring tools" })).toHaveAttribute("href", "/openbuilds/spaces/hiring-tools");
  });

  it("signed out: Sign in to join spaces, a Sign in control, no tabs", () => {
    atWidth(1440);
    draw({ signedIn: false, scope: "everyone" });
    expect(screen.getByText("Sign in to join spaces.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirect=%2Fopenbuilds");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("has two tabs and a Segmented of All and Still open, and moves them through the callbacks", () => {
    atWidth(1440);
    const view = props();
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Your spaces", "Everyone"]);
    fireEvent.click(tabs[1]);
    expect(view.onScope).toHaveBeenCalledWith("everyone");
    const group = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(group).getByRole("button", { name: "Still open" }));
    expect(view.onOpen).toHaveBeenCalledWith(true);
    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("draws one card per post and Show more when there is another page", () => {
    atWidth(1440);
    const onMore = vi.fn();
    draw({ posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1") }, { card: card("p2") }], more: { loading: false, onMore } } });
    expect(screen.getAllByRole("article")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalled();
  });

  it("empty Your spaces: Nothing new in your spaces, and See everyone", () => {
    atWidth(1440);
    const view = props({ posts: { status: "ready", onRetry: vi.fn(), items: [] } });
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Nothing new in your spaces.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See everyone" }));
    expect(view.onScope).toHaveBeenCalledWith("everyone");
  });

  it("empty Everyone: No posts yet, and Post", () => {
    atWidth(1440);
    const view = props({ scope: "everyone", posts: { status: "ready", onRetry: vi.fn(), items: [] } });
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByText("No posts yet.").parentElement as HTMLElement).getByRole("button", { name: "Post" }));
    expect(view.onPost).toHaveBeenCalled();
  });

  it("error: the sentence and Retry", () => {
    atWidth(1440);
    const onRetry = vi.fn();
    draw({ posts: { status: "error", onRetry, items: [] } });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Posts didn't load.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("Busy this week: the meta, a Join control, hidden when empty", () => {
    atWidth(1440);
    const { unmount } = draw();
    const column = screen.getByRole("region", { name: "Busy this week" });
    expect(within(column).getByText("Spaces with the most new posts")).toBeInTheDocument();
    expect(within(column).getByText("Made by @sam · 412 members")).toBeInTheDocument();
    expect(within(column).getByRole("button", { name: "Join Evals" })).toBeInTheDocument();
    unmount();
    draw({ busy: [] });
    expect(screen.queryByRole("region", { name: "Busy this week" })).toBeNull();
  });

  it("on a phone: one column, All your spaces as a menu under the tabs, and no Busy this week", () => {
    atWidth(390);
    draw();
    expect(screen.queryByRole("region", { name: "Busy this week" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Your spaces" })).toBeNull();
    expect(screen.getByRole("button", { name: "All your spaces" })).toBeInTheDocument();
  });

  it("uses no em dash in any copy", () => {
    atWidth(1440);
    draw();
    expect(document.body.textContent).not.toContain(String.fromCharCode(8212));
  });
});
