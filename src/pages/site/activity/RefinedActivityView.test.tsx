// UI-P92 — Activity in the refined look, rendered with the dev fixture: the same parts, names, copy and handlers as
// `ActivityView`, drawn as the refined board draws them.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values); roles and names on the rendered tree.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVITY_RUNS, activityFixture } from "@/dev/fixtures/activity";

import type { ActivityViewProps } from "./ActivityView";
import { RefinedActivityView } from "./RefinedActivityView";

const REFINED = "/dev/kit/pages/activity?look=refined";

const view = (over: Partial<ActivityViewProps> = {}) => (
  <MemoryRouter initialEntries={[REFINED]}>
    <RefinedActivityView fit="content" {...activityFixture()} {...over} />
  </MemoryRouter>
);
const mount = (over: Partial<ActivityViewProps> = {}) => render(view(over));
const markup = (over: Partial<ActivityViewProps> = {}) => renderToStaticMarkup(view(over));

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

const kinds = () => screen.getAllByTestId("activity-row").map((item) => item.getAttribute("data-kind"));

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("RefinedActivityView on a desktop", () => {
  it("has one h1, the unread line with its lamp, and Mark all read as a secondary 28 with no icon", () => {
    mount();
    expect(screen.getByTestId("activity-view").getAttribute("data-look")).toBe("refined");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();
    const line = screen.getByText("3 unread · live");
    expect(line.querySelector('[data-ui="lamp-dot"]')).toBeTruthy();
    const mark = screen.getByRole("button", { name: "Mark all read" });
    expect(mark.getAttribute("data-variant")).toBe("secondary");
    expect(mark.querySelector("svg")).toBeNull();
    expect(markup()).toContain("height:28px");
  });

  it("drops 'live' and its lamp, and says Reconnecting, while the channel is down", () => {
    mount({ live: false });
    expect(screen.getByText("3 unread").querySelector('[data-ui="lamp-dot"]')).toBeNull();
    expect(screen.getByText("Reconnecting")).toBeTruthy();
    expect(screen.getByText("offline")).toBeTruthy();
  });

  it("draws each row under its day in the board's grid, the unread ones lit, each with its kind's square", () => {
    mount();
    const days = screen.getAllByTestId("activity-day");
    expect(days).toHaveLength(2);
    expect(within(days[0]).getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
    expect(within(days[1]).getByRole("heading", { level: 2, name: "Yesterday" })).toBeTruthy();

    const rows = screen.getAllByTestId("activity-row");
    expect(rows).toHaveLength(7);
    const unread = rows.filter((item) => item.getAttribute("data-unread") === "true");
    expect(unread).toHaveLength(3);
    for (const row of unread) expect(row.querySelector('[data-ui="lamp-dot"]')).toBeTruthy();
    expect(screen.getAllByTestId("activity-badge").map((badge) => badge.getAttribute("data-kind"))).toEqual([
      "reproduced",
      "rebuilt",
      "solution",
      "solved",
      "comment",
      "follow",
      "published",
    ]);
    // Six of the seven name a build, and hang its thumbnail in a frame.
    expect(screen.getByTestId("activity-list").querySelectorAll('[data-ui="framed-work"]')).toHaveLength(6);

    const html = markup();
    expect(html).toContain("grid-template-columns:8px 28px minmax(0, 1fr) 48px 32px");
    expect(html).toContain("min-height:56px");
    expect(html).toContain("width:8px;height:8px;border-radius:2px");
    expect(html).not.toContain("row-highlight");
  });

  it("leads a row to its target and reads it when followed; a row that leads nowhere is still", () => {
    const onOpen = vi.fn();
    const base = activityFixture().list.groups[0].rows[0];
    mount({
      onOpen,
      list: {
        ...activityFixture().list,
        groups: [{ day: "Today", rows: [{ ...base, id: "go", href: "/b2/invoice-triage-agent" }, { ...base, id: "still", href: null }] }],
      },
    });
    const [go, still] = screen.getAllByTestId("activity-row");
    expect(go.tagName).toBe("A");
    expect(go.getAttribute("href")).toBe("/b2/invoice-triage-agent");
    expect(go.querySelectorAll("a")).toHaveLength(0);
    fireEvent.click(go);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "go" }));
    expect(still.tagName).toBe("DIV");
    fireEvent.click(still);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("marks everything read through the callback, and is disabled when nothing is unread", () => {
    const onMarkAllRead = vi.fn();
    const { unmount } = mount({ onMarkAllRead });
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    unmount();

    mount({ unread: 0, onMarkAllRead });
    expect((screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the aside in today's order: people and Listening, the runs chart, Show me", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Today",
      "Yesterday",
      "Runs of your builds",
      "Show me",
    ]);
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("41")).toBeTruthy();
    expect(screen.getByText("people ran your builds")).toBeTruthy();
    expect(screen.getByText("Listening")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
  });

  it("draws the runs chart with its words, the dashed lit-ink marker and its ringed dot", () => {
    const { unmount } = mount();
    expect(screen.getByText("Last 90 days · dashed line: your rebuild went live")).toBeTruthy();
    const chart = screen.getByRole("img", { name: ACTIVITY_RUNS.label });
    expect(chart.querySelectorAll('line[stroke-dasharray="2 3"]')).toHaveLength(3);
    expect(screen.getByTestId("activity-runs-marker").getAttribute("stroke")).toBe("var(--lit-ink)");
    expect(chart.querySelector("defs")).toBeNull();
    unmount();

    mount({ runs: { status: "ready", data: { ...ACTIVITY_RUNS, markerIndex: null } } });
    expect(screen.getByText("Last 90 days")).toBeTruthy();
    expect(screen.queryByTestId("activity-runs-marker")).toBeNull();
  });

  it("counts and filters by kind in Show me, the pressed rows selected", () => {
    mount();
    const group = screen.getByRole("group", { name: "Show me" });
    expect(within(group).getAllByRole("button")).toHaveLength(9);
    expect(within(group).getByRole("button", { name: "reproduced 18" })).toBeTruthy();
    const rebuilt = within(group).getByRole("button", { name: /^rebuilt/ });
    fireEvent.click(rebuilt);
    expect(rebuilt.getAttribute("aria-pressed")).toBe("true");
    expect(kinds()).toEqual(["rebuilt"]);
    fireEvent.click(rebuilt);
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
  });

  it("draws the loading, error, empty, write-failed and more states in their own places", () => {
    const base = activityFixture().list;
    const loading = mount({ list: { ...base, status: "loading", groups: [] }, peopleThisWeek: null, runs: { status: "loading" } });
    expect(screen.getByTestId("activity-loading").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("activity-orbs").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("activity-runs-loading").textContent).toContain("Loading the runs chart");
    for (const toggle of screen.getAllByTestId("activity-kind")) expect(toggle.querySelector('[data-ui="skeleton"]')).toBeTruthy();
    loading.unmount();

    const onRetry = vi.fn();
    const failed = mount({ list: { ...base, status: "error", groups: [], onRetry } });
    expect(screen.getByTestId("activity-error").getAttribute("aria-label")).toContain("Your activity");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    failed.unmount();

    const empty = mount({ list: { ...base, groups: [] } });
    expect(screen.getByTestId("activity-empty").textContent).toBe("All caught up.");
    empty.unmount();

    const write = mount({ writeError: { onRetry } });
    expect(screen.getByTestId("activity-write-error").textContent).toContain("That didn't save.");
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    write.unmount();

    const people = mount({ peopleThisWeek: null, peopleError: { onRetry } });
    expect(screen.getByTestId("activity-orbs-error").getAttribute("aria-label")).toContain("People this week");
    expect(screen.getByText("Listening")).toBeTruthy();
    people.unmount();

    const onMore = vi.fn();
    mount({ list: { ...base, hasMore: true, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});

describe("RefinedActivityView on a phone", () => {
  it("keeps today's order: the heading, the chips, the days; no people, chart or Show me", () => {
    phone(true);
    const { container } = mount();
    expect(screen.getByTestId("activity-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getByRole("heading", { level: 1, name: "3 unread" })).toBeTruthy();
    const chips = screen.getAllByRole("button").filter((button) => button.getAttribute("data-ui") === "filter-chip");
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "Reproduced18", "Rebuilt6", "Solutions4", "Comments11", "Follows7"]);
    expect(screen.getAllByTestId("activity-day")).toHaveLength(2);
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    expect(screen.queryByTestId("activity-orbs")).toBeNull();
    expect(screen.queryByText("Show me")).toBeNull();
    expect(container.querySelector('[data-ui="chart-line"]')).toBeNull();
  });

  it("filters by chip, and offers Mark all read only while something is unread", () => {
    phone(true);
    const { unmount } = mount();
    fireEvent.click(screen.getByRole("button", { name: /^Rebuilt/ }));
    expect(kinds()).toEqual(["rebuilt"]);
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    unmount();

    mount({ unread: 0 });
    expect(screen.getByRole("heading", { level: 1, name: "All caught up" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });
});
