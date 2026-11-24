// UX-05 Part 2: the feed's view. Every state, both layouts, and the lists it draws.

import { readOf } from "@/components/pagestate/pageStateModel";
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
    read: readOf("ready"),
    rows: [
      { id: "s1", slug: "claude-code", name: "Claude Code", fresh: 3 },
      { id: "s2", slug: "hiring-tools", name: "Hiring tools", fresh: 0 },
    ],
  },
  posts: { read: readOf("ready"), items: [{ card: card("p1") }, { card: card("p2") }] },
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
  it("names the page with an h1 for screen readers only: the header's current item already names it", () => {
    const { container } = draw();
    const h1 = screen.getByRole("heading", { level: 1, name: "OpenBuilds" });
    expect(h1).toHaveClass("sr-only");
    expect(container.querySelector('[data-slot="page-breadcrumb"]')).toBeNull();
  });

  it("opens the centre panel with its one line at 15 in Text 2 and the one primary, Post", () => {
    atWidth(1440);
    const view = props();
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "OpenBuilds" })).toBeInTheDocument();
    const line = screen.getByText("Post anything, reply with anything. Spaces are made and run by the people in them.");
    expect(line.style.fontSize).toBe("15px");
    expect(line.closest("section")).toHaveAttribute("aria-label", "Feed");
    expect(within(screen.getByRole("region", { name: "Feed" })).getByText("Post")).toBeInTheDocument();
    const primary = document.querySelectorAll('[data-visual-slot="btn-primary"]');
    expect(primary).toHaveLength(1);
    fireEvent.click(primary[0] as HTMLElement);
    expect(view.onPost).toHaveBeenCalled();
  });

  it("heads the reader's spaces by their count, each space with n new at the right, hidden at zero", () => {
    atWidth(1440);
    draw();
    const column = screen.getByRole("region", { name: "Your spaces" });
    expect(within(column).getByRole("heading", { level: 2, name: "2 spaces" })).toBeInTheDocument();
    const links = within(column).getAllByRole("link");
    // Synth 11: the "All your spaces" row is gone; the Your spaces tab does that job.
    expect(links.map((link) => link.textContent)).toEqual(["Claude Code3 new", "Hiring tools"]);
    expect(within(column).getByText("Claude Code").style.fontSize).toBe("15px");
    expect(within(column).getByText("Claude Code").style.fontWeight).toBe("600");
    expect(within(column).getByText("3 new").style.fontSize).toBe("13px");
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

  it("has two tabs and the pills All and Still open, and moves them through the callbacks", () => {
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
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Still open" }));
    expect(view.onOpen).toHaveBeenCalledWith(true);
    expect(screen.getByText("Newest first")).toBeInTheDocument();
  });

  it("draws one card per post, 8 apart, and Show more when there is another page", () => {
    atWidth(1440);
    const onMore = vi.fn();
    draw({ posts: { read: readOf("ready"), items: [{ card: card("p1") }, { card: card("p2") }], more: { loading: false, onMore } } });
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    const list = articles[0].parentElement?.parentElement as HTMLElement;
    expect(list.style.gap).toBe("8px");
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalled();
  });

  it("empty Your spaces: Nothing new in your spaces, and See everyone", () => {
    atWidth(1440);
    const view = props({ posts: { read: readOf("ready"), items: [] } });
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
    const view = props({ scope: "everyone", posts: { read: readOf("ready"), items: [] } });
    render(
      <MemoryRouter>
        <OpenBuildsFeedView {...view} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No posts yet.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByText("No posts yet.").parentElement as HTMLElement).getByRole("button", { name: "Post" }));
    expect(view.onPost).toHaveBeenCalled();
  });

  it("error: the sentence and Try again", () => {
    atWidth(1440);
    const onRetry = vi.fn();
    draw({ posts: { read: readOf("error", undefined, onRetry), items: [] } });
    const alert = screen.getByRole("alert", { name: "Posts" });
    expect(alert).toHaveTextContent("Couldn't load posts. Try again.");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("G9: every region failed is one failed state for the page, under its title", () => {
    atWidth(1440);
    draw({ pageFailed: [readOf("error"), readOf("error")] });
    expect(screen.getByText("Couldn't load this page. Try again.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("Most new posts this week: the heading states it, the meta in Text 3, a small Join, hidden when empty", () => {
    atWidth(1440);
    const { unmount } = draw();
    const column = screen.getByRole("region", { name: "Most new posts this week" });
    expect(within(column).getByRole("heading", { level: 2, name: "Most new posts this week" })).toBeInTheDocument();
    expect(within(column).getByText("Made by @sam · 412 members")).toBeInTheDocument();
    const join = within(column).getByRole("button", { name: "Join Evals" });
    expect(join).toHaveTextContent("Join");
    unmount();
    draw({ busy: [] });
    expect(screen.queryByRole("region", { name: "Most new posts this week" })).toBeNull();
  });

  it("from 761 to 1100: the left panel goes, All your spaces is a menu above the feed", () => {
    atWidth(1024);
    draw();
    expect(screen.queryByRole("region", { name: "Your spaces" })).toBeNull();
    expect(screen.getByRole("button", { name: "All your spaces" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Most new posts this week" })).toBeInTheDocument();
  });

  it("on a phone: one column, All your spaces as a menu, and Most new posts this week after the feed", () => {
    atWidth(390);
    draw();
    expect(screen.queryByRole("region", { name: "Your spaces" })).toBeNull();
    expect(screen.getByRole("button", { name: "All your spaces" })).toBeInTheDocument();
    const busy = screen.getByRole("region", { name: "Most new posts this week" });
    expect(screen.getByRole("region", { name: "Feed" }).compareDocumentPosition(busy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws the Make a space control with a plus and its label as its name", () => {
    atWidth(1440);
    draw();
    const make = within(screen.getByRole("region", { name: "Your spaces" })).getByRole("button", { name: "Make a space" });
    expect(make.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses no em dash in any copy", () => {
    atWidth(1440);
    draw();
    expect(document.body.textContent).not.toContain(String.fromCharCode(8212));
  });
});
