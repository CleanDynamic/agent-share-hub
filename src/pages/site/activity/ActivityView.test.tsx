// UI-P35 — Activity's view: both layouts, the callbacks, the filter and every state.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVITY_RUNS, activityFixture } from "@/dev/fixtures/activity";

import { ActivityView, type ActivityViewProps } from "./ActivityView";

function mount(over: Partial<ActivityViewProps> = {}) {
  const props: ActivityViewProps = { ...activityFixture(), ...over };
  return {
    props,
    ...render(
      <MemoryRouter>
        <ActivityView fit="content" {...props} />
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

const kinds = () => screen.getAllByTestId("activity-row").map((item) => item.getAttribute("data-kind"));

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("ActivityView on a desktop", () => {
  it("has one h1, the unread line with 'live', and Mark all read", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();
    expect(screen.getByText("3 unread · live")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeTruthy();
  });

  it("drops 'live' and says Reconnecting while the channel is down", () => {
    const { unmount } = mount();
    expect(screen.getByText("Listening")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
    unmount();

    mount({ live: false });
    expect(screen.getByText("3 unread")).toBeTruthy();
    expect(screen.queryByText("3 unread · live")).toBeNull();
    expect(screen.getByText("Reconnecting")).toBeTruthy();
    expect(screen.getByText("offline")).toBeTruthy();
  });

  it("says nothing about the count until it is known", () => {
    mount({ unread: null });
    expect(screen.queryByText(/unread/)).toBeNull();
    expect((screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("draws each row under its day, the unread ones marked, each with its kind's badge", () => {
    mount();
    const days = screen.getAllByTestId("activity-day");
    expect(days).toHaveLength(2);
    expect(within(days[0]).getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
    expect(within(days[1]).getByRole("heading", { level: 2, name: "Yesterday" })).toBeTruthy();

    const rows = screen.getAllByTestId("activity-row");
    expect(rows).toHaveLength(7);
    expect(rows.filter((item) => item.getAttribute("data-unread") === "true")).toHaveLength(3);
    expect(screen.getAllByTestId("activity-badge").map((badge) => badge.getAttribute("data-kind"))).toEqual([
      "reproduced",
      "rebuilt",
      "solution",
      "solved",
      "comment",
      "follow",
      "published",
    ]);
  });

  it("leads a row to its target and reads it when followed; a row that leads nowhere is still", () => {
    const onOpen = vi.fn();
    const base = activityFixture().list.groups[0].rows[0];
    mount({
      onOpen,
      list: {
        ...activityFixture().list,
        groups: [
          {
            day: "Today",
            rows: [
              { ...base, id: "go", href: "/b2/invoice-triage-agent" },
              { ...base, id: "still", href: null },
            ],
          },
        ],
      },
    });
    const [go, still] = screen.getAllByTestId("activity-row");
    expect(go.tagName).toBe("A");
    expect(go.getAttribute("href")).toBe("/b2/invoice-triage-agent");
    fireEvent.click(go);
    expect(onOpen).toHaveBeenCalledTimes(1);
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
    const button = screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it("counts each kind in Show me", () => {
    mount();
    const group = screen.getByRole("group", { name: "Show me" });
    expect(within(group).getAllByRole("button")).toHaveLength(9);
    expect(within(group).getByRole("button", { name: "reproduced 18" })).toBeTruthy();
    expect(within(group).getByRole("button", { name: "like 23" })).toBeTruthy();
  });

  it("filters the list by the kinds pressed, and shows everything again when none is", () => {
    mount();
    const group = screen.getByRole("group", { name: "Show me" });
    const rebuilt = within(group).getByRole("button", { name: /^rebuilt/ });
    const comment = within(group).getByRole("button", { name: /^comment/ });
    expect(rebuilt.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(rebuilt);
    expect(rebuilt.getAttribute("aria-pressed")).toBe("true");
    expect(kinds()).toEqual(["rebuilt"]);
    expect(screen.getAllByTestId("activity-day")).toHaveLength(1);

    fireEvent.click(comment);
    expect(kinds()).toEqual(["rebuilt", "comment"]);

    fireEvent.click(rebuilt);
    fireEvent.click(comment);
    expect(rebuilt.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
  });

  it("says so when none of the loaded rows is of the chosen kind, and points at Show more", () => {
    mount({ list: { ...activityFixture().list, hasMore: true } });
    fireEvent.click(within(screen.getByRole("group", { name: "Show me" })).getByRole("button", { name: /^like/ }));
    expect(screen.queryByTestId("activity-row")).toBeNull();
    expect(screen.getByText(/None of these among the latest\. Show more to look further back\./)).toBeTruthy();
  });

  it("reads the orb: the people this week, singular for one, empty until known", () => {
    const { unmount } = mount();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("41")).toBeTruthy();
    expect(screen.getByText("people ran your builds")).toBeTruthy();
    unmount();

    const one = mount({ peopleThisWeek: 1 });
    expect(screen.getByText("person ran your builds")).toBeTruthy();
    one.unmount();

    mount({ peopleThisWeek: null });
    expect(screen.queryByText("This week")).toBeNull();
    expect(screen.getByText("Listening")).toBeTruthy();
  });

  it("draws the runs chart with its words, and drops the dashed-line clause with no rebuild in the window", () => {
    const { unmount } = mount();
    expect(screen.getByRole("heading", { level: 2, name: "Runs of your builds" })).toBeTruthy();
    expect(screen.getByText("Last 90 days · dashed line: your rebuild went live")).toBeTruthy();
    expect(screen.getByRole("img", { name: ACTIVITY_RUNS.label })).toBeTruthy();
    unmount();

    mount({ runs: { status: "ready", data: { ...ACTIVITY_RUNS, markerIndex: null } } });
    expect(screen.getByText("Last 90 days")).toBeTruthy();
    expect(screen.queryByText(/dashed line/)).toBeNull();
  });

  it("gives the chart its own loading and error, and leaves the list alone", () => {
    const { unmount } = mount({ runs: { status: "loading" } });
    expect(screen.queryByRole("img", { name: ACTIVITY_RUNS.label })).toBeNull();
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    unmount();

    const onRetry = vi.fn();
    mount({ runs: { status: "error", onRetry } });
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("draws row-shaped bones while the list loads, as many as the board has, under two day headings", () => {
    mount({ list: { ...activityFixture().list, status: "loading", groups: [] } });
    const loading = screen.getByTestId("activity-loading");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toContain("Loading your activity");
    expect(screen.queryByTestId("activity-row")).toBeNull();
    // Three rows under the first day, four under the second, an avatar and a thumbnail in each.
    expect(loading.querySelectorAll('[data-ui="skeleton"][style*="border-radius: 9px"]')).toHaveLength(7);
  });

  it("holds the orb's place and the chart's box while they load, and shows bones for the filter's counts", () => {
    mount({ list: { ...activityFixture().list, status: "loading", groups: [] }, peopleThisWeek: null, runs: { status: "loading" } });
    expect(screen.getByTestId("activity-orbs").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("activity-runs-loading").textContent).toContain("Loading the runs chart");
    // One bone per kind in place of a count that would otherwise read as zero.
    const toggles = screen.getAllByTestId("activity-kind");
    expect(toggles).toHaveLength(9);
    for (const toggle of toggles) expect(toggle.querySelector('[data-ui="skeleton"]')).toBeTruthy();
  });

  it("says That didn't load. for the list, naming it, with a retry", () => {
    const onRetry = vi.fn();
    mount({ list: { ...activityFixture().list, status: "error", groups: [], onRetry } });
    expect(screen.getByTestId("activity-error").textContent).toContain("That didn't load.");
    expect(screen.getByTestId("activity-error").textContent).toContain("Your activity");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says why the orb is missing when its count could not be read, and leaves the live orb", () => {
    const onRetry = vi.fn();
    mount({ peopleThisWeek: null, peopleError: { onRetry } });
    const failed = screen.getByTestId("activity-orbs-error");
    expect(failed.textContent).toContain("People this week");
    fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Listening")).toBeTruthy();
  });

  it("says All caught up. for an empty list, with no action", () => {
    mount({ list: { ...activityFixture().list, groups: [] } });
    const empty = screen.getByTestId("activity-empty");
    expect(empty.textContent).toBe("All caught up.");
    expect(within(empty).queryAllByRole("button")).toHaveLength(0);
  });

  it("says a mark-read that did not save, in the list's own place, and asks again from there", () => {
    const onRetry = vi.fn();
    mount({ writeError: { onRetry } });
    const failed = screen.getByTestId("activity-write-error");
    expect(failed.textContent).toContain("That didn't save.");
    expect(failed.textContent).toContain("Activity");
    fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The rows are still there: the failure is a line in the panel, not a blank page.
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
  });

  it("offers Show more when there is more, and is disabled while it loads", () => {
    const onMore = vi.fn();
    const { unmount } = mount({ list: { ...activityFixture().list, hasMore: true, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
    unmount();

    mount({ list: { ...activityFixture().list, hasMore: true, loadingMore: true, onMore } });
    expect((screen.getByRole("button", { name: "Loading…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});

describe("ActivityView on a phone", () => {
  it("has the heading, the chips with their counts and one panel per day, and no orbs, chart or filter panel", () => {
    phone(true);
    const { container } = mount();
    expect(screen.getByTestId("activity-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "3 unread" })).toBeTruthy();

    const chips = screen.getAllByRole("button").filter((button) => button.getAttribute("data-ui") === "filter-chip");
    expect(chips.map((chip) => chip.textContent)).toEqual(["All", "Reproduced18", "Rebuilt6", "Solutions4", "Comments11", "Follows7"]);
    expect(chips[0].getAttribute("aria-pressed")).toBe("true");

    expect(screen.getAllByTestId("activity-day")).toHaveLength(2);
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
    expect(screen.queryByTestId("activity-orbs")).toBeNull();
    expect(screen.queryByText("Show me")).toBeNull();
    expect(container.querySelector('[data-ui="chart-line"]')).toBeNull();
  });

  it("filters by the chip pressed, and All clears it", () => {
    phone(true);
    mount();
    const chip = (name: RegExp) => screen.getByRole("button", { name });
    fireEvent.click(chip(/^Rebuilt/));
    expect(chip(/^Rebuilt/).getAttribute("aria-pressed")).toBe("true");
    expect(chip(/^All/).getAttribute("aria-pressed")).toBe("false");
    expect(kinds()).toEqual(["rebuilt"]);
    expect(screen.getAllByTestId("activity-day")).toHaveLength(1);

    fireEvent.click(chip(/^Follows/));
    expect(kinds()).toEqual(["rebuilt", "follow"]);

    fireEvent.click(chip(/^All/));
    expect(chip(/^All/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByTestId("activity-row")).toHaveLength(7);
  });

  it("says All caught up at zero and offers Mark all read only while something is unread", () => {
    phone(true);
    const onMarkAllRead = vi.fn();
    const { unmount } = mount({ onMarkAllRead });
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
    unmount();

    mount({ unread: 0 });
    expect(screen.getByRole("heading", { level: 1, name: "All caught up" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  it("follows a row, reads it, and draws the loading, error, empty and more states", () => {
    phone(true);
    const onOpen = vi.fn();
    const base = activityFixture().list;
    const first = base.groups[0].rows[0];
    const { unmount } = mount({ onOpen, list: { ...base, groups: [{ day: "Today", rows: [{ ...first, href: "/b2/invoice-triage-agent" }] }] } });
    fireEvent.click(screen.getByTestId("activity-row"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }));
    unmount();

    const loading = mount({ list: { ...base, status: "loading", groups: [] } });
    expect(screen.getByTestId("activity-loading").getAttribute("aria-busy")).toBe("true");
    loading.unmount();

    const onRetry = vi.fn();
    const failed = mount({ list: { ...base, status: "error", groups: [], onRetry } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    failed.unmount();

    const empty = mount({ list: { ...base, groups: [] } });
    expect(screen.getByTestId("activity-empty").textContent).toBe("All caught up.");
    empty.unmount();

    const onMore = vi.fn();
    mount({ list: { ...base, hasMore: true, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});
