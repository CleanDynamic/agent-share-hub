// UX-08 P3: Home's Open requests becomes Still open: the still-open topics of the reader's spaces (everyone's when signed out),
// three at most, each with its heading, `@maya · in Claude Code` and the reward; not drawn when there are none.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";
import type { Post } from "@/lib/openbuilds";

import { HomeView, type HomeViewProps } from "./HomeView";
import { STILL_OPEN_HREF, stillOpenRows } from "./homeModel";

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

const post = (over: Partial<Post> & Pick<Post, "id" | "body">): Post => ({
  authorId: "u1", parentId: null, rootId: over.id, aboutBuildId: null, aboutNodeId: null, rewardGbp: null, stillOpen: true, tags: [], closesAt: null, pinnedBy: null, pinnedAt: null,
  hiddenBy: null, hiddenReason: null, likeCount: 0, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
  author: { id: "u1", handle: "maya", name: "Maya", avatarUrl: null }, attachments: [], spaces: [{ id: "s1", slug: "claude-code", name: "Claude Code" }], replyCount: 0, ...over,
});

const POSTS = [
  post({ id: "p1", body: "Session 3 is missing\nThe prompt that fixed the retries.", rewardGbp: 40 }),
  post({ id: "p2", body: "A step for the sitemap", spaces: [] }),
  post({ id: "p3", body: "Third", author: null }),
  post({ id: "p4", body: "Fourth is not shown" }),
];

const mount = (over: Partial<HomeViewProps>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeView {...visionHomeProps("populated")} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UX-08 P3 · stillOpenRows", () => {
  it("is the heading, `@maya · in Claude Code`, the reward and the topic's address, three at most", () => {
    const rows = stillOpenRows(POSTS);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ id: "p1", title: "Session 3 is missing", detail: "@maya · in Claude Code", reward: "£40", href: "/openbuilds/topics/p1" });
    expect(rows[1]).toMatchObject({ detail: "@maya", reward: null });
    expect(rows[2]).toMatchObject({ detail: "in Claude Code" });
  });
});

describe("UX-08 P3 · Home's Still open section", () => {
  it("populated: titled Still open, meta In your spaces, the chevron to /openbuilds?open=1, a row per topic", () => {
    mount({ requests: { status: "ready", data: stillOpenRows(POSTS) }, stillOpenScope: "spaces" });
    const section = screen.getByRole("region", { name: "Still open" });
    expect(within(section).getByRole("heading", { level: 2, name: "Still open" })).toBeTruthy();
    expect(within(section).getByText("In your spaces")).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Open OpenBuilds" }).getAttribute("href")).toBe(STILL_OPEN_HREF);
    expect(STILL_OPEN_HREF).toBe("/openbuilds?open=1");
    const rows = within(section).getAllByTestId("home-request-row");
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute("href")).toBe("/openbuilds/topics/p1");
    expect(rows[0].textContent).toContain("Session 3 is missing");
    expect(rows[0].textContent).toContain("@maya · in Claude Code");
    expect(rows[0].textContent).toContain("£40");
    expect(screen.queryByText(/Open requests/)).toBeNull();
  });

  it("signed out: the meta reads Across OpenBuilds", () => {
    mount({ requests: { status: "ready", data: stillOpenRows(POSTS) }, stillOpenScope: "everyone" });
    const section = screen.getByRole("region", { name: "Still open" });
    expect(within(section).getByText("Across OpenBuilds")).toBeTruthy();
    expect(within(section).queryByText("In your spaces")).toBeNull();
  });

  it("empty: the section is not drawn", () => {
    mount({ requests: { status: "ready", data: [] } });
    expect(screen.queryByRole("region", { name: "Still open" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Still open" })).toBeNull();
  });
});
