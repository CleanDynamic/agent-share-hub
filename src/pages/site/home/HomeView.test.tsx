// SV-10: Home as the vision board draws it, rendered with the board's sample data: the three columns, the feed's tabs
// and kind filter, the "n new" pill, each kind of item, and the states.

import { readOf } from "@/components/pagestate/pageStateModel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionHomeProps } from "@/dev/fixtures/vision/home";

import type { HomeViewProps } from "./HomeView";
import { HomeView } from "./HomeView";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));

const mount = (over: Partial<HomeViewProps> = {}, state: Parameters<typeof visionHomeProps>[0] = "populated") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeView {...visionHomeProps(state)} {...over} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** A window narrower than `px`: every `(min-width: n)` query at or above it is false. */
function narrow(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)/.exec(query);
    const max = /max-width:\s*(\d+)/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

// The board's window, unless a test narrows it.
beforeEach(() => narrow(1440));
afterEach(() => vi.unstubAllGlobals());

describe("HomeView · control heights", () => {
  it("draws Show more as the small secondary Button (32 / 14), and a session row's add button as a 32 round icon button", () => {
    mount({ feed: { ...visionHomeProps().feed, hasMore: true, onMore: vi.fn() } });
    const more = screen.getByRole("button", { name: "Show more" });
    expect(more.getAttribute("data-ui")).toBe("button");
    expect([more.style.height, more.style.padding]).toEqual(["32px", "0px 14px"]);
    const add = screen.getAllByRole("button", { name: "Add to a new build" })[0];
    expect(add.getAttribute("data-ui")).toBe("icon-button");
    expect([add.style.width, add.style.height]).toEqual(["32px", "32px"]);
    expect(screen.getByTestId("home-new-pill").style.height).toBe("32px");
  });

  it("draws the kind pills as 32 high filter chips, in a group named Kind: All, Builds, Rebuilds, Topics", () => {
    mount();
    const kind = screen.getByRole("group", { name: "Kind" });
    const pills = within(kind).getAllByRole("button");
    expect(pills.map((pill) => pill.textContent)).toEqual(["All", "Builds", "Rebuilds", "Topics"]);
    for (const pill of pills) {
      expect(pill.getAttribute("data-ui")).toBe("filter-chip");
      expect(pill.style.height).toBe("32px");
    }
    expect(kind.style.padding).toBe("12px 16px 4px");
  });

  it("draws the feed's tabs 53 high, sharing the panel's width", () => {
    mount();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Following", "Everyone"]);
    for (const tab of tabs) {
      expect(tab.style.height, tab.textContent ?? "").toBe("53px");
      expect(tab.style.flex).toBe("1 1 0px");
    }
  });

  it("draws the new pill centred, small, with an up arrow", () => {
    mount();
    const pill = screen.getByTestId("home-new-pill");
    // The Inverse fill is a var(), which jsdom drops from a style; it is checked in the screenshots.
    expect(pill.style.height).toBe("32px");
    expect(pill.querySelector("svg")).toBeTruthy();
    expect((pill.parentElement as HTMLElement).style.justifyContent).toBe("center");
  });

  it("spaces the posts 8 apart with 4 above and 16 below", () => {
    mount();
    const feed = screen.getByTestId("home-feed");
    expect([feed.style.gap, feed.style.padding]).toEqual(["8px", "4px 0px 16px"]);
  });
});

describe("HomeView · the three columns", () => {
  it("hides the h1 from the eye and keeps it for screen readers", () => {
    mount();
    const h1 = screen.getByRole("heading", { level: 1, name: "Home" });
    expect(h1.className).toBe("sr-only");
  });

  it("heads each section by its fact", () => {
    mount();
    for (const name of ["2 rebuilds of your builds", "36 drafts", "8 sessions", "3 day streak", "2 published builds", "3 open in your spaces"]) {
      expect(screen.getByRole("heading", { level: 2, name }), name).toBeTruthy();
    }
    expect(within(screen.getByRole("complementary", { name: "Your studio" })).getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(screen.getByRole("complementary", { name: "Your studio" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Feed" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "The room" })).toBeTruthy();
  });

  it("draws a draft, a session and a published build as the rows the pack describes", () => {
    mount();
    const draft = screen.getAllByTestId("home-draft-row")[0];
    expect(draft.getAttribute("href")).toBe("/compose/vd1");
    expect(draft.textContent).toBe("Invoice chaser4 sessions · edited 1h ago");
    const session = screen.getAllByTestId("home-session-row")[0];
    expect(session.textContent).toBe("This session is being continued from a previous conversation10 Oct · In 3 drafts");
    const published = screen.getAllByTestId("home-published-row");
    expect(published.map((row) => row.textContent)).toEqual(["Call notes that write themselves12 Oct", "Inbox triage in one prompt3 Oct"]);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("names no tool or model on a session, and says nothing about runs or reproductions anywhere", () => {
    mount();
    const page = screen.getByTestId("home-view").textContent ?? "";
    for (const word of ["Haiku", "Claude Code", "Reproduced", "runs this week", "Most run", "Where next", "reproduction", "confirmed", "Notes"]) expect(page, word).not.toContain(word);
    expect(page).not.toContain(String.fromCharCode(8212));
  });

  it("draws the open topic's lead line, who and where, and the reward at the right in mono", () => {
    mount();
    const row = screen.getAllByTestId("home-request-row")[0];
    expect(row.textContent).toBe("Handle paywalled sourcesResearch brief · 5 days left£40");
    const reward = within(row).getByText("£40");
    expect([reward.style.fontSize, reward.style.fontWeight]).toEqual(["15px", "500"]);
  });

  it("leaves Since you were last here out when it has no data (the live page until SV-15)", () => {
    mount({ since: null });
    expect(screen.queryByRole("heading", { name: "Since you were last here" })).toBeNull();
  });

  it("links the section chevrons to their pages", () => {
    mount();
    expect(screen.getByRole("link", { name: "Open drafts" }).getAttribute("href")).toBe("/drafts");
    expect(screen.getByRole("link", { name: "Open OpenBuilds" }).getAttribute("href")).toBe("/openbuilds?open=1");
  });

  it("names the week's bars in words and hides them from screen readers", () => {
    mount();
    const days = screen.getByRole("img", { name: "Active 3 of 7 days" });
    expect(days.querySelectorAll('[aria-hidden="true"]')).toHaveLength(7);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.queryByText(/Run three builds/)).toBeNull();
  });

  it("adds a session to a new build", () => {
    const onAddSession = vi.fn();
    mount({ onAddSession });
    fireEvent.click(screen.getAllByRole("button", { name: "Add to a new build" })[0]);
    expect(onAddSession).toHaveBeenCalledWith("vs1");
  });

  it("asks a signed-out reader to sign in where the studio would be", () => {
    mount({ drafts: { status: "signed-out" }, sessions: { status: "signed-out" }, week: { status: "signed-out" }, published: { status: "signed-out" } });
    const studio = screen.getByRole("complementary", { name: "Your studio" });
    expect(within(studio).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?redirect=/");
    expect(within(studio).getByRole("link", { name: "Sign in" }).getAttribute("data-ui")).toBe("button");
  });
});

describe("HomeView · the feed", () => {
  it("binds the tabs and the kind filter, which change at once", () => {
    const onScopeChange = vi.fn();
    const onFilterChange = vi.fn();
    mount({ onScopeChange, onFilterChange });
    expect(screen.getByRole("tab", { name: "Everyone" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Following" }));
    expect(onScopeChange).toHaveBeenCalledWith("following");
    const kind = screen.getByRole("group", { name: "Kind" });
    expect(within(kind).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(kind).getByRole("button", { name: "Topics" }));
    expect(onFilterChange).toHaveBeenCalledWith("asks");
    expect(within(kind).queryByRole("button", { name: "Notes" })).toBeNull();
  });

  it("shows only the chosen kind", () => {
    mount({ filter: "rebuilds" });
    const kinds = screen.getAllByTestId("home-feed-item").map((item) => item.getAttribute("data-kind"));
    expect(kinds).toEqual(["rebuild"]);
  });

  it("draws every kind of item, in order, and no run note", () => {
    mount();
    const kinds = screen.getAllByTestId("home-feed-item").map((item) => item.getAttribute("data-kind"));
    expect(kinds).toEqual(["build", "rebuild", "build"]);
    expect(screen.getByText("Rebuilt from")).toBeTruthy();
    // The rebuild's author row does not say "rebuilt" over the box that does.
    expect(screen.queryByText(/rebuilt ·/)).toBeNull();
  });

  it("keeps an off-screen item out of the renderer's way with an intrinsic size", () => {
    mount();
    const first = screen.getAllByTestId("home-feed-item")[0] as HTMLElement;
    expect(first.style.getPropertyValue("content-visibility") || (first.style as unknown as Record<string, string>).contentVisibility).toBe("auto");
  });

  it("offers the new items in a pill only when there are some", () => {
    const onShowNew = vi.fn();
    const { unmount } = mount({ onShowNew });
    fireEvent.click(screen.getByRole("button", { name: "3 new since you looked" }));
    expect(onShowNew).toHaveBeenCalled();
    unmount();
    mount({ newCount: 0 });
    expect(screen.queryByTestId("home-new-pill")).toBeNull();
  });

  it("ends with You're up to date and two builds, or Show more while there is more", () => {
    const { unmount } = mount();
    const end = within(screen.getByTestId("home-feed-end"));
    expect(end.getByRole("link", { name: "More builds" }).getAttribute("href")).toBe("/builds");
    expect(end.getByRole("link", { name: /Inbox triage in one prompt/ }).textContent).toBe("Inbox triage in one promptWeb app · Made with AI · No coding");
    unmount();
    const onMore = vi.fn();
    mount({ feed: { ...visionHomeProps().feed, hasMore: true, onMore } });
    expect(screen.queryByTestId("home-feed-end")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalled();
  });
});

describe("HomeView · states", () => {
  it("draws the loading state while the feed loads", () => {
    mount({}, "loading");
    expect(screen.getByTestId("home-feed-loading")).toBeTruthy();
  });

  it("says a section failed in one sentence with Try again", () => {
    const onRetry = vi.fn();
    mount({ feed: { ...visionHomeProps("error").feed, onRetry } }, "error");
    const alert = screen.getByRole("alert", { name: "The feed" });
    expect(alert.textContent).toContain("Couldn't load the feed. Try again.");
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("G9: one region failing keeps the others; every region failing is one state for the page", () => {
    const failed = { status: "error" as const, onRetry: vi.fn(), error: { message: "boom" } };
    const { unmount } = mount({ requests: failed }, "populated");
    expect(screen.getByRole("alert", { name: "Still open" }).textContent).toContain("Couldn't load posts. Try again.");
    expect(screen.getByTestId("home-feed")).toBeTruthy();
    unmount();
    mount({ pageFailed: [readOf("error"), readOf("error")] }, "populated");
    expect(screen.getByText("Couldn't load this page. Try again.")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
  });

  it("says an empty feed in one line", () => {
    mount({}, "empty");
    expect(screen.getByTestId("home-feed-empty")).toBeTruthy();
  });
});

describe("HomeView · narrower windows", () => {
  it("hides the studio below 1100 and puts the Drafts line at the top of the feed", () => {
    narrow(1000);
    mount();
    expect(screen.queryByRole("complementary", { name: "Your studio" })).toBeNull();
    expect(screen.getByTestId("home-view").getAttribute("data-layout")).toBe("two");
    const line = screen.getByTestId("home-drafts-line");
    expect(line.textContent).toBe("36 drafts in progress · 8 sessions");
    expect(within(screen.getByRole("region", { name: "Feed" })).getByTestId("home-drafts-line")).toBe(line);
  });

  it("with the studio off the page and nothing open, the right panel holds the published builds", () => {
    narrow(1000);
    mount({ requests: { status: "ready", data: [] } });
    expect(within(screen.getByRole("complementary", { name: "The room" })).getByRole("heading", { level: 2, name: "2 published builds" })).toBeTruthy();
  });

  it("is the feed alone below 768 (prompt 20): no drafts line, no room, the tabs and the posts", () => {
    narrow(390);
    mount();
    const view = screen.getByTestId("home-view");
    expect(view.getAttribute("data-layout")).toBe("phone");
    expect(screen.queryByTestId("home-drafts-line")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "The room" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Your studio" })).toBeNull();
    expect(screen.getByRole("tablist", { name: "Feed scope" })).toBeTruthy();
    expect(screen.getAllByTestId("home-feed-item").length).toBeGreaterThan(0);
  });
});
