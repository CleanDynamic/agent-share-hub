// SV-10 — Home as the vision board draws it, rendered with the board's sample data: the three columns, the feed's tabs
// and kind filter, the "n new" pill, each kind of item, and the states.

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

describe("HomeView · the three columns", () => {
  it("draws the studio, the feed and the room, each section under its own heading", () => {
    mount();
    for (const name of ["Since you were last here", "Continue editing", "Your sessions", "Your week", "Open requests", "Most run this week", "Where next"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    expect(screen.getByRole("complementary", { name: "Your studio" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Feed" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "The room" })).toBeTruthy();
  });

  it("leaves Since you were last here out when it has no data (the live page until SV-15)", () => {
    mount({ since: null });
    expect(screen.queryByRole("heading", { name: "Since you were last here" })).toBeNull();
  });

  it("links the section chevrons to their pages", () => {
    mount();
    expect(screen.getByRole("link", { name: "Open drafts" }).getAttribute("href")).toBe("/drafts");
    expect(screen.getByRole("link", { name: "Open OpenBuilds" }).getAttribute("href")).toBe("/openbuilds");
    expect(screen.getByRole("link", { name: "Open activity" }).getAttribute("href")).toBe("/notifications");
  });

  it("names the week's bars in words and hides them from screen readers", () => {
    mount();
    const days = screen.getByRole("img", { name: "Active 3 of 7 days" });
    expect(days.querySelectorAll('[aria-hidden="true"]')).toHaveLength(7);
    expect(screen.getByText("3 day streak · resets Monday 00:00 UTC")).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
  });

  it("adds a session to a new build", () => {
    const onAddSession = vi.fn();
    mount({ onAddSession });
    fireEvent.click(screen.getAllByRole("button", { name: "Add to a new build" })[0]);
    expect(onAddSession).toHaveBeenCalledWith("vs1");
  });

  it("asks a signed-out reader to sign in where the studio would be", () => {
    mount({ drafts: { status: "signed-out" }, sessions: { status: "signed-out" }, week: { status: "signed-out" }, whereNext: { status: "signed-out" } });
    const studio = screen.getByRole("complementary", { name: "Your studio" });
    expect(within(studio).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login?redirect=/");
    expect(screen.queryByRole("heading", { name: "Where next" })).toBeNull();
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
    fireEvent.click(within(kind).getByRole("button", { name: "Notes" }));
    expect(onFilterChange).toHaveBeenCalledWith("notes");
  });

  it("shows only the chosen kind", () => {
    mount({ filter: "notes" });
    const kinds = screen.getAllByTestId("home-feed-item").map((item) => item.getAttribute("data-kind"));
    expect(kinds).toEqual(["repro_note", "repro_note"]);
  });

  it("draws every kind of item the board draws, in order", () => {
    mount();
    const kinds = screen.getAllByTestId("home-feed-item").map((item) => item.getAttribute("data-kind"));
    expect(kinds).toEqual(["build", "repro_note", "rebuild", "repro_note", "bounty", "build"]);
    expect(screen.getByText(", and it worked on opus-5.5")).toBeTruthy();
    expect(screen.getByText(", and it didn’t work")).toBeTruthy();
    expect(screen.getByText("Rebuilt from")).toBeTruthy();
    expect(screen.getByText(/1 solution · closes in 5 days/)).toBeTruthy();
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

  it("solves an ask by its own page and marks Me too", () => {
    const onMeToo = vi.fn();
    mount({ onMeToo });
    expect(screen.getByRole("link", { name: "Solve it" }).getAttribute("href")).toBe("/bounties/b-paywalled/solve");
    const meToo = screen.getByRole("button", { name: "Me too · 4" });
    expect(meToo.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(meToo);
    expect(onMeToo).toHaveBeenCalledWith("b-paywalled");
  });

  it("ends with You're up to date and two builds, or Show more while there is more", () => {
    const { unmount } = mount();
    expect(within(screen.getByTestId("home-feed-end")).getByRole("link", { name: "More builds" }).getAttribute("href")).toBe("/builds");
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
    fireEvent.click(within(screen.getByTestId("home-feed-error")).getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("says an empty feed in one line", () => {
    mount({}, "empty");
    expect(screen.getByTestId("home-feed-empty")).toBeTruthy();
  });
});

describe("HomeView · narrower windows", () => {
  it("hides the studio below 1100", () => {
    narrow(1000);
    mount();
    expect(screen.queryByRole("complementary", { name: "Your studio" })).toBeNull();
    expect(screen.getByTestId("home-view").getAttribute("data-layout")).toBe("two");
  });

  it("is one column below 760: the Drafts line, the feed, then the room", () => {
    narrow(390);
    mount();
    const view = screen.getByTestId("home-view");
    expect(view.getAttribute("data-layout")).toBe("one");
    const line = screen.getByTestId("home-drafts-line");
    expect(line.textContent).toContain("28 drafts in progress · 8 sessions");
    expect(line.getAttribute("href")).toBe("/drafts");
    const order = [line, screen.getByRole("region", { name: "Feed" }), screen.getByRole("complementary", { name: "The room" })];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
