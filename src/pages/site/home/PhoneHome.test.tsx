// Prompt 20 Part A: Home below 768px is the feed alone: the tabs, the kind sheet on the current tab, posts, one module.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";

import type { HomeViewProps } from "./HomeView";
import { HomeView } from "./HomeView";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

const mount = (over: Partial<HomeViewProps> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeView {...visionHomeProps("populated")} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    const max = /max-width:\s*(\d+)/.exec(query);
    const matches = min ? 390 >= Number(min[1]) : max ? 390 <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("PhoneHome", () => {
  it("ends the feed with You're up to date in Text 2 and More builds as a Text link, and nothing after (29g)", () => {
    mount({ feed: { ...visionHomeProps("populated").feed, hasMore: false } });
    const end = screen.getByTestId("home-feed-end");
    expect(end).toHaveStyle({ paddingTop: "24px", textAlign: "center" });
    expect(within(end).getByText("You’re up to date")).toHaveStyle({ fontSize: "15px", lineHeight: "20px", color: "var(--text2)" });
    const more = within(end).getByRole("link", { name: "More builds" });
    expect(more).toHaveAttribute("href", "/builds");
    expect(more).toHaveStyle({ fontSize: "15px", lineHeight: "20px", color: "var(--text)" });
    // The two small build cards are gone: More builds is the last thing in the end, and the only link.
    expect(within(end).getAllByRole("link")).toHaveLength(1);
    expect(end.lastElementChild).toBe(more);
  });

  it("shows the tabs and the posts only: no drafts, sessions, published builds, week or kind pills", () => {
    mount();
    expect(screen.getByRole("heading", { level: 1, name: "Home" }).className).toContain("sr-only");
    expect(screen.queryByRole("group", { name: "Kind" })).toBeNull();
    expect(screen.queryByTestId("home-drafts-line")).toBeNull();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    const tabs = within(screen.getByRole("tablist", { name: "Feed scope" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Following", "Everyone"]);
  });

  it("opens the kinds from the current tab, and choosing one closes the sheet and asks for it", async () => {
    const onFilterChange = vi.fn();
    mount({ onFilterChange });
    fireEvent.click(screen.getByRole("tab", { name: "Everyone" }));
    const group = await screen.findByRole("radiogroup", { name: "Kind" });
    expect(within(group).getAllByRole("radio").map((row) => row.textContent)).toEqual(["All", "Builds", "Rebuilds", "Topics"]);
    expect(within(group).getByRole("radio", { name: "All" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: "Builds" }));
    expect(onFilterChange).toHaveBeenCalledWith("builds");
  });

  it("reads 'Everyone · Builds' once a kind other than All is chosen", () => {
    mount({ filter: "builds" });
    expect(screen.getByRole("tab", { name: /Everyone/ }).textContent).toContain("· Builds");
  });

  it("puts the one 'open in your spaces' row inside the feed, linking to the open topics", () => {
    mount({ requests: { status: "ready", data: [{ id: "a", title: "A", detail: "", reward: null, href: "/x" }, { id: "b", title: "B", detail: "", reward: null, href: "/y" }] } });
    const rows = screen.getAllByTestId("home-open-row");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("2 open in your spaces");
    expect(rows[0].getAttribute("href")).toBe("/openbuilds?open=1");
  });

  /* Prompt 29a. */
  it("has no new-posts pill in either form: new posts arrive with the pull to refresh", () => {
    mount({ newCount: 3, newAuthors: [{ id: "p1", handle: "maya", name: "Maya" }] });
    expect(screen.queryByTestId("home-new-pill")).toBeNull();
    expect(screen.queryByTestId("home-new-pill-floating")).toBeNull();
    expect(screen.queryByText(/new since you looked/)).toBeNull();
  });

  it("pads each post 12 16 12 12 with no line, and draws its posts at the phone's X proportions", () => {
    mount();
    for (const item of screen.getAllByTestId("home-feed-item")) {
      expect(item.style.padding).toBe("12px 16px 12px 12px");
      expect(item.style.borderBottom).toBe("");
    }
    const posts = document.querySelectorAll<HTMLElement>("[data-feed-post]");
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) expect(post.dataset.x).toBe("phone");
  });

  it("draws a rebuild with 'Rebuilt from' as a Card: padding 14, radius 14, the source's name in the post text size", () => {
    mount();
    const card = screen.getAllByTestId("rebuilt-from")[0];
    expect(card).toHaveStyle({ padding: "14px", borderRadius: "14px" });
    expect(card.textContent).toContain("Rebuilt from");
  });

  it("puts the pull to refresh round the tabs and the feed, with a Refresh button first", () => {
    mount({ onRefresh: () => Promise.resolve(0) });
    const content = screen.getByTestId("ptr-content");
    expect(content.firstElementChild).toBe(screen.getByRole("button", { name: "Refresh" }));
    expect(content.contains(screen.getByTestId("home-phone-tabs"))).toBe(true);
    expect(content.contains(screen.getByTestId("home-feed"))).toBe(true);
  });
});
