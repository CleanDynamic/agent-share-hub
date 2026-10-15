// UI-P88 — Home in the refined look, rendered with the dev fixture: the same parts, names, copy and handlers as
// `HomeView`, drawn as the refined board draws them.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values); roles and names on the rendered tree.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { homeFixture } from "@/dev/fixtures/home";

import type { HomeViewProps } from "./HomeView";
import { HomeView } from "./HomeView";

const REFINED = "/dev/kit/pages/home";

const view = (over: Partial<HomeViewProps> = {}) => (
  <MemoryRouter initialEntries={[REFINED]}>
    <HomeView fit="content" {...homeFixture()} {...over} />
  </MemoryRouter>
);
const mount = (over: Partial<HomeViewProps> = {}) => render(view(over));
const markup = (over: Partial<HomeViewProps> = {}) => renderToStaticMarkup(view(over));

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("HomeView on a desktop", () => {
  it("keeps one h1 with the tagline's sentence, the lit line and both hero actions", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeTruthy();
    expect(screen.getByText("702 builds lit today")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter the gallery" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "How proof works" })).toBeTruthy();
  });

  it("sends the hero's buttons where they say and binds the scope control", () => {
    const onNavigate = vi.fn();
    const onScopeChange = vi.fn();
    mount({ onNavigate, onScopeChange });
    fireEvent.click(screen.getByRole("button", { name: "Enter the gallery" }));
    fireEvent.click(screen.getByRole("button", { name: "How proof works" }));
    expect(onNavigate.mock.calls).toEqual([["/gallery"], ["/about"]]);
    const scope = screen.getByRole("group", { name: "Whose builds" });
    expect(within(scope).getByRole("button", { name: "Everyone" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(scope).getByRole("button", { name: "Following" }));
    expect(onScopeChange).toHaveBeenCalledWith("following");
  });

  it("draws the parts in today's order: hero, book, then counts, challenges, streak, where next", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "The visitors’ book",
      "This week’s challenges",
      "12-day streak",
      "Where next",
    ]);
  });

  it("hangs six works on the wall, and lights the centre one while builds were lit today", () => {
    mount();
    const wall = screen.getByTestId("home-wall");
    expect(wall.querySelectorAll('[data-ui="framed-work"]')).toHaveLength(6);
    expect(wall.querySelectorAll('[data-ui="framed-work"][data-lit]')).toHaveLength(1);
    expect(wall.hasAttribute("data-lit")).toBe(true);
  });

  it("leaves the wall unlit when nothing was lit today", () => {
    mount({ litToday: 0 });
    const wall = screen.getByTestId("home-wall");
    expect(wall.hasAttribute("data-lit")).toBe(false);
    expect(wall.querySelectorAll('[data-ui="framed-work"][data-lit]')).toHaveLength(0);
  });

  it("draws a book row per item on the board's grid, kind as a pill, a framed thumbnail and the time", () => {
    mount();
    const rows = screen.getAllByTestId("home-row");
    expect(rows).toHaveLength(5);
    expect(rows[0].getAttribute("href")).toBe("/b2/invoice-triage-agent");
    expect(within(rows[0]).getByText("BUILD").getAttribute("data-ui")).toBe("pill");
    expect(within(rows[0]).getByText("2m")).toBeTruthy();
    expect(within(rows[3]).getByText("BOUNTY")).toBeTruthy();
    for (const row of rows) expect(row.querySelector('[data-ui="framed-work"]')).not.toBeNull();

    const html = markup();
    expect(html).toContain("grid-template-columns:96px 24px minmax(0, 1fr) 56px 32px");
    expect(html).toContain("min-height:60px");
  });

  it("gives the newest row since the last visit the tile fill and a lit thumbnail, and no other row", () => {
    mount();
    const rows = screen.getAllByTestId("home-row");
    expect(rows.map((row) => row.getAttribute("data-highlight"))).toEqual(["true", null, null, null, null]);
    expect(rows.map((row) => row.querySelector('[data-ui="framed-work"]')?.hasAttribute("data-lit"))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    const html = markup();
    expect(html).toContain("background:var(--tile);border-radius:6px;margin:0 -12px;padding:0 12px");
  });

  it("filters the loaded rows on kind", () => {
    mount();
    const filters = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(filters).getByRole("button", { name: "Rebuilds" }));
    expect(screen.getAllByTestId("home-row").map((row) => row.getAttribute("data-kind"))).toEqual(["rebuild"]);
    fireEvent.click(within(filters).getByRole("button", { name: "All" }));
    expect(screen.getAllByTestId("home-row")).toHaveLength(5);
  });

  it("draws the run counts as two figures, not orbs", () => {
    mount();
    const counts = screen.getByTestId("home-run-counts");
    expect(counts.querySelectorAll('[data-ui="figure"]')).toHaveLength(2);
    expect(within(counts).getByText("48")).toBeTruthy();
    expect(within(counts).getByText("312")).toBeTruthy();
    expect(within(counts).getByText("runs reported")).toBeTruthy();
    expect(markup()).not.toContain('data-ui="orb');
  });

  it("draws the challenges, the streak week and where next from props", () => {
    mount();
    expect(screen.getAllByTestId("weekly-challenge")).toHaveLength(3);
    expect(screen.getByText("1 / 3 · +90 xp")).toBeTruthy();
    expect(screen.getByText("1 / 1 · done")).toBeTruthy();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.getByText("one frozen day used")).toBeTruthy();
    const week = within(screen.getByTestId("home-streak-week")).getAllByRole("listitem");
    expect(week).toHaveLength(7);
    expect(week[0].getAttribute("data-ui")).toBe("streak-day");
    expect(screen.getAllByTestId("home-where-next-row")).toHaveLength(3);
    expect(screen.getByText("SAME TOOL · SONNET-4.5")).toBeTruthy();
  });

  it("opens this week from the boxed button, and omits it when there is no page for it", () => {
    const onNavigate = vi.fn();
    const { unmount } = mount({ onNavigate });
    fireEvent.click(screen.getByRole("button", { name: "Open this week" }));
    expect(onNavigate).toHaveBeenCalledWith("/analytics");
    unmount();
    mount({ thisWeekHref: undefined });
    expect(screen.queryByRole("button", { name: "Open this week" })).toBeNull();
  });

  it("says what to do in each personal part when signed out", () => {
    mount({ challenges: { status: "signed-out" }, streak: { status: "signed-out" }, whereNext: { status: "signed-out" } });
    expect(screen.getByTestId("home-challenges-signed-out")).toBeTruthy();
    expect(screen.getByTestId("home-streak-empty")).toBeTruthy();
    expect(screen.getByTestId("home-where-next-empty")).toBeTruthy();
  });

  it("holds each part in place while it loads, and says which failed", () => {
    const { unmount } = mount({
      reproducedToday: null,
      runsThisWeek: null,
      feed: { ...homeFixture().feed, status: "loading", rows: [] },
      challenges: { status: "loading" },
      streak: { status: "loading" },
      whereNext: { status: "loading" },
    });
    expect(screen.getByTestId("home-feed-loading")).toBeTruthy();
    expect(screen.getByTestId("home-challenges-loading")).toBeTruthy();
    expect(screen.getByTestId("home-streak-loading")).toBeTruthy();
    expect(screen.getByTestId("home-where-next-loading")).toBeTruthy();
    unmount();

    const failure = { onRetry: vi.fn() };
    mount({
      orbsError: failure,
      feed: { ...homeFixture().feed, status: "error", rows: [] },
      challenges: { status: "error", ...failure },
      streak: { status: "error", ...failure },
      whereNext: { status: "error", ...failure },
    });
    for (const id of ["home-orbs-error", "home-feed-error", "home-challenges-error", "home-streak-error", "home-where-next-error"]) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it("draws no serif, no glass and no blur", () => {
    const html = markup();
    expect(html).not.toContain("Sentient");
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("var(--glass");
  });
});

describe("HomeView on a phone", () => {
  it("keeps today's order: scope and lit line, hero, counts, challenges, the book, the streak, and no where next", () => {
    phone(true);
    mount();
    expect(screen.getByTestId("home-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getByText("702 lit today")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.queryByText("Where next")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "This week’s challenges",
      "The visitors’ book",
      "12-day streak",
    ]);

    const chips = screen.getByRole("group", { name: "Show" });
    fireEvent.click(within(chips).getByRole("button", { name: "Notes" }));
    expect(screen.getAllByTestId("home-row").map((row) => row.getAttribute("data-kind"))).toEqual(["repro_note"]);
  });
});
