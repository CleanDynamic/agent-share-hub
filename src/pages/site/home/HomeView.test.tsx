// UI-P27 — Home's view: both layouts, the book's filters and highlight, and every empty state.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { homeFixture } from "@/dev/fixtures/home";

import { HomeView, type HomeViewProps } from "./HomeView";

function mount(over: Partial<HomeViewProps> = {}) {
  const props: HomeViewProps = { ...homeFixture(), ...over };
  return {
    props,
    ...render(
      <MemoryRouter>
        <HomeView fit="content" {...props} />
      </MemoryRouter>,
    ),
  };
}

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  // jsdom has no matchMedia; put it back to that.
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("HomeView on a desktop", () => {
  it("has one h1, the tagline's sentence, and the headline copy", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeTruthy();
    expect(screen.getByText("702 builds lit today")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter the gallery" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "How proof works" })).toBeTruthy();
  });

  it("sends the hero's buttons where they say", () => {
    const onNavigate = vi.fn();
    mount({ onNavigate });
    fireEvent.click(screen.getByRole("button", { name: "Enter the gallery" }));
    fireEvent.click(screen.getByRole("button", { name: "How proof works" }));
    expect(onNavigate.mock.calls).toEqual([["/gallery"], ["/about"]]);
  });

  it("draws a row per item, each linking to its build, with the time in the last column", () => {
    mount();
    const rows = screen.getAllByTestId("home-row");
    expect(rows).toHaveLength(5);
    expect(rows[0].getAttribute("href")).toBe("/b2/invoice-triage-agent");
    expect(within(rows[0]).getByText("BUILD")).toBeTruthy();
    expect(within(rows[0]).getByText("2m")).toBeTruthy();
    expect(within(rows[3]).getByText("BOUNTY")).toBeTruthy();
  });

  it("highlights the first row when it is newer than the previous visit, and not otherwise", () => {
    const { unmount } = mount();
    expect(screen.getAllByTestId("home-row").map((row) => row.getAttribute("data-highlight"))).toEqual([
      "true",
      null,
      null,
      null,
      null,
    ]);
    unmount();

    mount({ seenAt: null });
    expect(screen.getAllByTestId("home-row").some((row) => row.hasAttribute("data-highlight"))).toBe(false);
  });

  it("filters the loaded rows on kind", () => {
    mount();
    const filters = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(filters).getByRole("button", { name: "Rebuilds" }));
    expect(screen.getAllByTestId("home-row").map((row) => row.getAttribute("data-kind"))).toEqual(["rebuild"]);
    fireEvent.click(within(filters).getByRole("button", { name: "All" }));
    expect(screen.getAllByTestId("home-row")).toHaveLength(5);
  });

  it("offers Show more only while there is more, and says so while it loads", () => {
    const onMore = vi.fn();
    const base = homeFixture();
    const { rerender } = mount();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();

    rerender(
      <MemoryRouter>
        <HomeView fit="content" {...base} feed={{ ...base.feed, hasMore: true, onMore }} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("binds the scope control to the page", () => {
    const onScopeChange = vi.fn();
    mount({ onScopeChange });
    const scope = screen.getByRole("group", { name: "Whose builds" });
    expect(within(scope).getByRole("button", { name: "Everyone" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(scope).getByRole("button", { name: "Following" }));
    expect(onScopeChange).toHaveBeenCalledWith("following");
  });

  it("draws the orbs, the challenges, the streak and where next from props", () => {
    mount();
    expect(screen.getByText("48 runs")).toBeTruthy();
    expect(screen.getByText("312")).toBeTruthy();
    expect(screen.getAllByTestId("weekly-challenge")).toHaveLength(3);
    expect(screen.getByText("1 / 3 · +90 xp")).toBeTruthy();
    expect(screen.getByText("1 / 1 · done")).toBeTruthy();
    expect(screen.getByText("12-day streak")).toBeTruthy();
    expect(screen.getByText("one frozen day used")).toBeTruthy();
    expect(within(screen.getByTestId("home-streak-week")).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getAllByTestId("home-where-next-row")).toHaveLength(3);
    expect(screen.getByText("SAME TOOL · SONNET-4.5")).toBeTruthy();
  });

  it("omits '+xp' when no xp is given, and the expand button when there is no page for it", () => {
    const base = homeFixture();
    mount({
      thisWeekHref: undefined,
      challenges: {
        status: "ready",
        data: [{ slug: "a", title: "Solve a gap", done: 0, target: 1, meaning: "solve" }],
      },
      streak: base.streak,
    });
    expect(screen.getByText("0 / 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open this week" })).toBeNull();
  });

  it("links the expand button to the full view when there is one", () => {
    const onNavigate = vi.fn();
    mount({ onNavigate });
    fireEvent.click(screen.getByRole("button", { name: "Open this week" }));
    expect(onNavigate).toHaveBeenCalledWith("/analytics");
  });
});

describe("HomeView's empty and failed states", () => {
  it("says nothing has been hung, with one way on", () => {
    const base = homeFixture();
    const onNavigate = vi.fn();
    mount({ onNavigate, feed: { ...base.feed, rows: [] } });
    expect(screen.getByText("Nothing hung yet.")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Enter the gallery" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onNavigate).toHaveBeenCalledWith("/gallery");
  });

  it("offers a retry when the feed failed", () => {
    const base = homeFixture();
    const onRetry = vi.fn();
    mount({ feed: { ...base.feed, status: "error", rows: [], onRetry } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("signed out: no challenges, no streak, no suggestions — each says what to do", () => {
    const onNavigate = vi.fn();
    mount({
      onNavigate,
      thisWeekHref: undefined,
      challenges: { status: "signed-out" },
      streak: { status: "signed-out" },
      whereNext: { status: "signed-out" },
    });
    expect(screen.getByText("Sign in to take this week's challenges.")).toBeTruthy();
    expect(screen.getByText("Run a build today to start a streak.")).toBeTruthy();
    expect(screen.getByText("Run a build this week and suggestions appear here.")).toBeTruthy();
    expect(screen.queryByTestId("weekly-challenge")).toBeNull();

    /* One Sign in in each personal panel — never a disabled control with no reason. */
    const signIns = screen.getAllByRole("button", { name: "Sign in" });
    expect(signIns).toHaveLength(3);
    for (const signIn of signIns) {
      onNavigate.mockClear();
      fireEvent.click(signIn);
      expect(onNavigate).toHaveBeenCalledWith("/login?redirect=/");
    }
  });

  it("an empty streak and an empty where-next say so", () => {
    mount({
      streak: { status: "ready", data: { count: 0, frozenUsed: 0, week: Array(7).fill("none") } },
      whereNext: { status: "ready", data: [] },
    });
    expect(screen.getByText("Run a build today to start a streak.")).toBeTruthy();
    expect(screen.getByText("Run a build this week and suggestions appear here.")).toBeTruthy();
  });

  it("hides the lit badge and holds the orbs' place until the counts are known", () => {
    mount({ litToday: null, reproducedToday: null, runsThisWeek: null });
    expect(screen.queryByTestId("home-lit-badge")).toBeNull();
    expect(screen.queryByText(/runs$/)).toBeNull();
  });
});

describe("HomeView while it loads (UI-P37)", () => {
  const loading = () => homeFixture("loading");

  it("holds every panel in place with bones, each region busy and named for assistive technology", () => {
    mount(loading());
    for (const [id, what] of [
      ["home-feed-loading", "Loading the visitors’ book"],
      ["home-challenges-loading", "Loading this week’s challenges"],
      ["home-streak-loading", "Loading your streak"],
      ["home-where-next-loading", "Loading suggestions"],
    ] as const) {
      const region = screen.getByTestId(id);
      expect(region.getAttribute("aria-busy")).toBe("true");
      expect(region.textContent).toContain(what);
    }
    expect(screen.getByText("Loading the run counts").closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
  });

  it("draws the book's rows and nothing that looks like content", () => {
    mount(loading());
    expect(screen.queryAllByTestId("home-row")).toHaveLength(0);
    expect(screen.queryAllByTestId("weekly-challenge")).toHaveLength(0);
    expect(screen.queryByText("Nothing hung yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByTestId("home-feed-loading").querySelectorAll('[data-ui="skeleton"]').length).toBeGreaterThan(10);
  });

  it("keeps the panels' heads while their content loads", () => {
    mount(loading());
    for (const name of ["The visitors’ book", "This week’s challenges", "Streak", "Where next"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
  });

  it("is as tall a row as a loaded one: a row is its padding, its content and its hairline", () => {
    mount(loading());
    const rows = screen.getByTestId("home-feed-loading").children;
    // The region's first child is the hidden "Loading …" text; the rows follow it.
    const heights = [...rows].slice(1).map((row) => (row as HTMLElement).style.height);
    expect(heights).toEqual(["74px", "74px", "74px", "74px", "74px"]);
  });
});

describe("HomeView when its panels fail (UI-P37)", () => {
  it("says That didn't load. in each panel that failed, naming it, and leaves the rest as they were", () => {
    const base = homeFixture();
    mount({ feed: { ...base.feed, status: "error", rows: [] }, streak: { status: "error", onRetry: vi.fn() } });
    const feed = screen.getByTestId("home-feed-error");
    expect(feed.textContent).toContain("That didn't load.");
    expect(feed.textContent).toContain("The visitors’ book");
    expect(screen.getByTestId("home-streak-error").textContent).toContain("Streak");
    // The panels that loaded are still there.
    expect(screen.getAllByTestId("weekly-challenge")).toHaveLength(3);
    expect(screen.getAllByTestId("home-where-next-row")).toHaveLength(3);
  });

  it("asks again from the panel that failed, and only that one", () => {
    const base = homeFixture();
    const feedRetry = vi.fn();
    const streakRetry = vi.fn();
    mount({
      feed: { ...base.feed, status: "error", rows: [], onRetry: feedRetry },
      streak: { status: "error", onRetry: streakRetry },
    });
    fireEvent.click(within(screen.getByTestId("home-streak-error")).getByRole("button", { name: "Try again" }));
    expect(streakRetry).toHaveBeenCalledTimes(1);
    expect(feedRetry).not.toHaveBeenCalled();
  });

  it("puts the orbs' failure in their panel, in place of the orbs", () => {
    const onRetry = vi.fn();
    mount({ reproducedToday: null, runsThisWeek: null, orbsError: { onRetry } });
    const failure = screen.getByTestId("home-orbs-error");
    expect(failure.textContent).toContain("Run counts");
    expect(screen.queryByText(/runs reported/)).toBeNull();
    fireEvent.click(within(failure).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never shows the exception behind a failure, but logs it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const base = homeFixture();
    const error = new Error("PGRST301: JWT expired");
    mount({ feed: { ...base.feed, status: "error", rows: [], error } });
    expect(document.body.textContent).not.toContain("PGRST301");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("HomeView's empty panels (UI-P37)", () => {
  it("says each in one sentence, with at most one action", () => {
    mount(homeFixture("empty"));
    for (const id of ["home-feed-empty", "home-challenges-signed-out", "home-streak-empty", "home-where-next-empty"]) {
      const empty = screen.getByTestId(id);
      expect(empty.querySelectorAll("p")).toHaveLength(1);
      expect(within(empty).queryAllByRole("button").length).toBeLessThanOrEqual(1);
    }
  });

  it("asks a signed-out visitor in with Sign in, in each personal panel, and a signed-in one on to the gallery", () => {
    mount(homeFixture("empty"));
    expect(within(screen.getByTestId("home-challenges-signed-out")).getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(within(screen.getByTestId("home-streak-empty")).getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(within(screen.getByTestId("home-where-next-empty")).getByRole("button", { name: "Enter the gallery" })).toBeTruthy();
  });

  it("says Run a build today to start a streak. to a signed-in reader with no streak, with no action", () => {
    mount({ streak: { status: "ready", data: { count: 0, frozenUsed: 0, week: Array(7).fill("none") } } });
    const empty = screen.getByTestId("home-streak-empty");
    expect(empty.textContent).toContain("Run a build today to start a streak.");
    expect(within(empty).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("HomeView on a phone", () => {
  it("draws the mobile order: scope and badge, hero, orbs, challenges, the book, the streak — and no where next", () => {
    phone(true);
    mount();
    const view = screen.getByTestId("home-view");
    expect(view.getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getByText("702 lit today")).toBeTruthy();
    expect(screen.getByText("Newest first")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.queryByText("Where next")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const chips = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(chips).getByRole("button", { name: "Notes" }));
    expect(screen.getAllByTestId("home-row").map((row) => row.getAttribute("data-kind"))).toEqual(["repro_note"]);
  });
});
