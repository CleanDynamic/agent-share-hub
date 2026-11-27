// UI-P92 — Activity in the refined look, rendered with the dev fixture: the same parts, names, copy and handlers as
// `ActivityView`, drawn as the refined board draws them.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values); roles and names on the rendered tree.

import { readOf } from "@/components/pagestate/pageStateModel";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activityFixture } from "@/dev/fixtures/activity";

import type { ActivityViewProps } from "./ActivityView";
import { ActivityView } from "./ActivityView";

const REFINED = "/dev/kit/pages/activity";

const view = (over: Partial<ActivityViewProps> = {}) => (
  <MemoryRouter initialEntries={[REFINED]}>
    <ActivityView fit="content" {...activityFixture()} {...over} />
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

describe("ActivityView on a desktop (Synth 12)", () => {
  it("has one h1, the live state beside it in mono Mint, and Mark all read as a small secondary with no icon", () => {
    mount();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();
    expect(screen.getByTestId("activity-live").textContent).toBe("● live");
    const mark = screen.getByRole("button", { name: "Mark all read" });
    expect(mark.getAttribute("data-variant")).toBe("secondary");
    expect(mark.querySelector("svg")).toBeNull();
    const html = markup();
    expect(html).toContain("color:var(--brand-accent)");
    expect(html).not.toContain("What happened to your builds.");
  });

  it("says Reconnecting in Warn while the channel is down", () => {
    mount({ live: false });
    expect(screen.getByTestId("activity-live").textContent).toBe("Reconnecting");
    expect(markup({ live: false })).toContain("color:var(--warn)");
  });

  it("draws each row under its day, no run among them, the unread ones barred in Mint, each with its kind's square", () => {
    mount();
    const days = screen.getAllByTestId("activity-day");
    expect(within(days[0]).getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
    const rows = screen.getAllByTestId("activity-row");
    expect(rows.some((row) => row.getAttribute("data-kind") === "reproduced")).toBe(false);
    expect(screen.queryByText(/ran your build|\bran\b/)).toBeNull();
    const unread = rows.filter((item) => item.getAttribute("data-unread") === "true");
    for (const row of unread) expect(within(row).getByTestId("activity-unread-bar")).toBeTruthy();
    for (const row of rows.filter((item) => item.getAttribute("data-unread") !== "true")) expect(within(row).queryByTestId("activity-unread-bar")).toBeNull();
    expect(screen.getAllByTestId("activity-badge").map((badge) => badge.getAttribute("data-kind"))).toEqual(["rebuilt", "comment", "follow", "published"]);
    expect(screen.getByTestId("activity-list").querySelectorAll('[data-ui="framed-work"]')).toHaveLength(0);

    const html = markup();
    expect(html).toContain("width:10px;height:10px;border-radius:2px;background:var(--kind-rebuilt)");
    expect(html).toContain("width:3px");
    expect(html).toContain("background:var(--brand-accent)");
  });

  it("leads a row to its target and reads it when followed; a row that leads nowhere is still", () => {
    const onOpen = vi.fn();
    const base = activityFixture().list.groups[0].rows.find((row) => row.kind !== "reproduced")!;
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

  it("sets the actor's handle and the build's name in 600", () => {
    const base = activityFixture().list.groups[0].rows[0];
    mount({ list: { ...activityFixture().list, groups: [{ day: "Today", rows: [{ ...base, kind: "rebuilt", square: "rebuilt", actorLabel: "@kit", who: "@kit rebuilt your build", title: "Bakery homepage" }] }] } });
    const row = screen.getByTestId("activity-row");
    expect(row.textContent).toContain("@kit rebuilt your build Bakery homepage");
    expect(within(row).getByText("@kit").style.fontWeight).toBe("600");
    expect(within(row).getByText("Bakery homepage").style.fontWeight).toBe("600");
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

  it("the side is the people this week and Show me; no runs chart and no run count", () => {
    const { container } = mount();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
    expect(headings.at(-1)).toBe("Show me");
    expect(headings.some((h) => /^\d+ (people|person) this week$/.test(h))).toBe(true);
    expect(screen.queryByText("Runs of your builds")).toBeNull();
    expect(screen.queryByText("people ran your builds")).toBeNull();
    expect(container.querySelector('[data-ui="chart-line"]')).toBeNull();
  });

  it("Show me is a switch per kind with its square, every one on at first; turning one off hides its rows", () => {
    mount();
    const group = screen.getByRole("group", { name: "Show me" });
    const switches = within(group).getAllByRole("switch");
    expect(switches).toHaveLength(6);
    for (const control of switches) expect(control.getAttribute("aria-checked")).toBe("true");
    expect(within(group).queryByRole("switch", { name: /Runs/ })).toBeNull();
    const rebuilt = within(group).getByRole("switch", { name: "Rebuilt" });
    fireEvent.click(rebuilt);
    expect(rebuilt.getAttribute("aria-checked")).toBe("false");
    expect(kinds()).not.toContain("rebuilt");
    fireEvent.click(rebuilt);
    expect(kinds()).toContain("rebuilt");
  });

  it("draws the loading, error, empty, write-failed and more states in their own places", () => {
    const base = activityFixture().list;
    const loading = mount({ list: { ...base, status: "loading", groups: [] } });
    expect(screen.getByTestId("activity-loading").getAttribute("aria-busy")).toBe("true");
    for (const toggle of screen.getAllByTestId("activity-kind")) expect(toggle.querySelector('[data-ui="skeleton"]')).toBeTruthy();
    loading.unmount();

    const onRetry = vi.fn();
    const failed = mount({ list: { ...base, status: "error", groups: [], onRetry } });
    expect(screen.getByRole("alert", { name: "Your activity" }).textContent).toContain("Couldn't load your activity. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    failed.unmount();

    const empty = mount({ list: { ...base, groups: [] } });
    expect(screen.getByTestId("activity-empty").textContent).toBe("All caught up.");
    empty.unmount();

    const write = mount({ writeError: { onRetry } });
    expect(screen.getByTestId("activity-write-error").textContent).toContain("Couldn't save that. Try again.");
    write.unmount();

    const onMore = vi.fn();
    mount({ list: { ...base, hasMore: true, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});

describe("ActivityView on a phone (Synth 12)", () => {
  it("no panel: the live state, then pills that filter by kind; the switches stay on the desktop", () => {
    phone(true);
    mount();
    expect(screen.getByTestId("activity-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show me" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    const group = screen.getByRole("group", { name: "Show" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Rebuilds", "Comments and replies", "Likes", "Follows"]);
    fireEvent.click(within(group).getByRole("button", { name: "Rebuilds" }));
    expect(kinds().every((kind) => kind === "rebuilt")).toBe(true);
    fireEvent.click(within(group).getByRole("button", { name: "All" }));
    expect(new Set(kinds()).size).toBeGreaterThan(1);
  });

  /* Prompt 19: on a phone "Mark all read" is the top bar's right slot (the page registers it with `useRegisterPageBar`), so the
     list's head draws no second button and its heading is for screen readers only. */
  it("leaves Mark all read to the top bar and hides its heading from the eye", () => {
    phone(true);
    mount({ unread: 0 });
    expect(screen.queryByRole("button", { name: "Mark all read" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Activity" }).className).toBe("sr-only");
  });
});

/* 29f, `08-activity-filter.jpg`: rows on a phone are an avatar at 40 (radius 9), 12 across, the line with the person's name at 700 and the
   age 13/16 Text 3 under it; an unread row is a 6 round Mint dot 5 from the left edge, centred on the avatar. No kind squares, no
   day heads drawn, no "live" label with its dot; and nothing yet is the ripple and the line, centred. */
describe("ActivityView on a phone (29f)", () => {
  it("marks an unread row with a 6 round Mint dot 5 from the left, centred on the avatar, and draws no bar or kind square", () => {
    phone(true);
    mount();
    const unread = screen.getAllByTestId("activity-row").filter((row) => row.getAttribute("data-unread") === "true");
    expect(unread.length).toBeGreaterThan(0);
    const dot = within(unread[0]).getByTestId("activity-unread-bar");
    expect(dot.style.width).toBe("6px");
    expect(dot.style.height).toBe("6px");
    expect(dot.style.left).toBe("5px");
    expect(dot.style.top).toBe("29px");
    expect(dot.style.borderRadius).toBe("50%");
    expect(screen.queryAllByTestId("activity-badge")).toHaveLength(0);
  });

  it("sets the person's name at 700 and the age at 13/16 Text 3, with 12 and 16 round the row", () => {
    phone(true);
    const list = activityFixture().list;
    mount({ list: { ...list, groups: list.groups.map((group) => ({ ...group, rows: group.rows.map((r) => ({ ...r, actorLabel: r.who.split(" ")[0] })) })) } });
    const row = screen.getAllByTestId("activity-row")[0];
    expect((row.querySelector('span[style*="font-weight: 700"]') as HTMLElement | null)?.textContent).toBeTruthy();
    const age = row.querySelector("time") as HTMLElement;
    expect([age.style.fontSize, age.style.lineHeight]).toEqual(["13px", "16px"]);
    expect([row.style.gap, row.style.padding, row.style.minHeight]).toEqual(["12px", "12px 16px", "64px"]);
    const avatar = row.querySelector('[data-ui="avatar"]') as HTMLElement;
    expect([avatar.style.width, avatar.style.borderRadius]).toEqual(["40px", "9px"]);
  });

  it("draws no live label or dot (it is said to screen readers only), and the day heads are for screen readers only", () => {
    phone(true);
    mount();
    const live = screen.getByTestId("activity-live");
    expect(live.className).toBe("sr-only");
    expect(live.textContent).not.toContain("●");
    for (const day of screen.getAllByTestId("activity-day")) expect(within(day).getByRole("heading", { level: 2 }).className).toBe("sr-only");
  });

  it("is the ripple and the line, centred in the space under the pills, when there is nothing yet", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    phone(true);
    mount({ live: true, list: { ...activityFixture().list, groups: [] } });
    const empty = screen.getByTestId("activity-empty");
    expect(empty.textContent).toContain("All caught up.");
    expect(within(empty).getByTestId("water-field")).toBeTruthy();
    expect(empty.style.justifyContent).toBe("center");
  });
});

describe("G9 · every region failed", () => {
  it("is one failed state for the page, under its title", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mount({ pageFailed: [readOf("error"), readOf("error"), readOf("error")] });
    expect(screen.getByText("Couldn't load this page. Try again.")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeTruthy();
  });
});

describe("G26 · All caught up.", () => {
  const empty = (over: Partial<ActivityViewProps>) => mount({ list: { ...activityFixture().list, groups: [] }, ...over });
  it("is said only when the list answered with nothing and the live connection is up", () => {
    empty({ live: true });
    expect(screen.getByText("All caught up.")).toBeTruthy();
  });

  it("is never said beside the connection line: with the connection down, the empty list says nothing", () => {
    empty({ live: false });
    expect(screen.getByText("Reconnecting")).toBeTruthy();
    expect(screen.queryByText("All caught up.")).toBeNull();
  });

  it("is never said while the list loads or after it failed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loading = empty({ live: true, list: { ...activityFixture().list, status: "loading", groups: [], read: readOf("loading") } });
    expect(screen.queryByText("All caught up.")).toBeNull();
    loading.unmount();
    empty({ live: true, list: { ...activityFixture().list, status: "error", groups: [], read: readOf("error") } });
    expect(screen.queryByText("All caught up.")).toBeNull();
  });
});
