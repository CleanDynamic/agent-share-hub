// UI-P35 — Activity's view model: the days, the filter, one notification as a row,
// and the words around the list.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { BUILD_NOTIFICATION_KINDS, type Notification } from "@/lib/notifications";

import {
  ACTIVITY_DAYS,
  ACTIVITY_KINDS,
  PHONE_CHIPS,
  activityRowOf,
  chartSubtitle,
  countKinds,
  dayOf,
  filterGroups,
  groupByDay,
  matchesKinds,
  runsLabel,
  scaleSeries,
  toggleKind,
  unreadHeading,
  unreadLine,
  type ActivityGroup,
  type ActivityKind,
  type ActivityRow,
} from "./activityModel";

/** Local-calendar instants, so the days do not depend on the machine's zone. */
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();
const justBefore = (y: number, m: number, d: number) => new Date(new Date(y, m, d).getTime() - 1).toISOString();

/** Friday 2 October 2026, 15:30. The week began on Monday the 28th. */
const NOW = new Date(2026, 9, 2, 15, 30);

function notification(over: Partial<Notification> = {}): Notification {
  return {
    id: "n-1",
    recipient_id: "viewer",
    actor_id: "actor-1",
    notification_type: "reproduced",
    kind: "reproduced",
    body: "ran your build and it worked",
    target_type: "build",
    target_id: "build-1",
    metadata: { build_id: "build-1" },
    is_read: false,
    read_at: null,
    created_at: "2026-10-02T10:00:00.000Z",
    actor: { id: "actor-1", username: "ada", display_name: "Ada Lovelace", avatar_url: null },
    target: null,
    build: { id: "build-1", slug: "invoice-triage-agent", title: "Invoice triage agent" },
    ...over,
  };
}

function row(id: string, at: string, over: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id,
    kind: "like",
    at,
    actor: { id: "a", name: "Ada" },
    who: "@ada liked",
    title: "Invoice triage agent",
    detail: null,
    cover: null,
    unread: false,
    href: null,
    ...over,
  };
}

describe("the days", () => {
  it("bounds each day by the viewer's local calendar", () => {
    expect(dayOf(local(2026, 9, 2, 0, 0), NOW)).toBe("Today");
    expect(dayOf(local(2026, 9, 2, 15, 29), NOW)).toBe("Today");
    expect(dayOf(justBefore(2026, 9, 2), NOW)).toBe("Yesterday");
    expect(dayOf(local(2026, 9, 1, 0, 0), NOW)).toBe("Yesterday");
    expect(dayOf(justBefore(2026, 9, 1), NOW)).toBe("Earlier this week");
    expect(dayOf(local(2026, 8, 28, 0, 0), NOW)).toBe("Earlier this week");
    expect(dayOf(justBefore(2026, 8, 28), NOW)).toBe("Earlier");
  });

  it("counts a time a moment ahead of the clock as today", () => {
    expect(dayOf(local(2026, 9, 2, 16, 0), NOW)).toBe("Today");
  });

  it("starts the week on Monday", () => {
    const monday = new Date(2026, 9, 5, 9, 0);
    expect(dayOf(local(2026, 9, 4, 12, 0), monday)).toBe("Yesterday");
    expect(dayOf(local(2026, 9, 3, 12, 0), monday)).toBe("Earlier");

    const sunday = new Date(2026, 9, 4, 9, 0);
    expect(dayOf(local(2026, 9, 3, 12, 0), sunday)).toBe("Yesterday");
    expect(dayOf(local(2026, 8, 28, 12, 0), sunday)).toBe("Earlier this week");
  });

  it("puts a time it cannot read in earlier", () => {
    expect(dayOf("not a date", NOW)).toBe("Earlier");
  });

  it("groups under the days in day order, each day keeping its own order, and leaves empty days out", () => {
    const groups = groupByDay(
      [
        row("old", local(2026, 8, 1)),
        row("t1", local(2026, 9, 2, 14)),
        row("y", local(2026, 9, 1, 9)),
        row("t2", local(2026, 9, 2, 9)),
      ],
      NOW,
    );
    expect(ACTIVITY_DAYS).toEqual(["Today", "Yesterday", "Earlier this week", "Earlier"]);
    expect(groups.map((group) => group.day)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0].rows.map((item) => item.id)).toEqual(["t1", "t2"]);
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe("the kinds and the filter", () => {
  it("draws the nine kinds the database writes, once each", () => {
    expect([...ACTIVITY_KINDS].sort()).toEqual([...BUILD_NOTIFICATION_KINDS].sort());
    expect(new Set(ACTIVITY_KINDS).size).toBe(9);
  });

  it("gives the phone one chip for each kind it names, all of them drawn", () => {
    for (const chip of PHONE_CHIPS) expect(ACTIVITY_KINDS).toContain(chip.kind);
  });

  it("counts the loaded rows by kind, a count for every kind, and leaves undrawn rows out", () => {
    const counts = countKinds([{ kind: "reproduced" }, { kind: "reproduced" }, { kind: "follow" }, { kind: null }]);
    expect(counts.reproduced).toBe(2);
    expect(counts.follow).toBe(1);
    expect(counts.rebuilt).toBe(0);
    expect(Object.keys(counts).sort()).toEqual([...ACTIVITY_KINDS].sort());
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(3);
  });

  it("shows everything when none is chosen, and only the chosen kinds otherwise", () => {
    expect(matchesKinds("like", new Set())).toBe(true);
    expect(matchesKinds(null, new Set())).toBe(true);
    const chosen = new Set<ActivityKind>(["like"]);
    expect(matchesKinds("like", chosen)).toBe(true);
    expect(matchesKinds("follow", chosen)).toBe(false);
    expect(matchesKinds(null, chosen)).toBe(false);
  });

  it("turns a kind on and off without touching the set it was given", () => {
    const start = new Set<ActivityKind>(["like"]);
    const on = toggleKind(start, "follow");
    expect([...on].sort()).toEqual(["follow", "like"]);
    expect([...start]).toEqual(["like"]);
    expect([...toggleKind(on, "like")]).toEqual(["follow"]);
  });

  it("filters the groups and drops a day it leaves empty", () => {
    const groups: ActivityGroup[] = [
      { day: "Today", rows: [row("a", local(2026, 9, 2), { kind: "like" }), row("b", local(2026, 9, 2), { kind: "follow" })] },
      { day: "Yesterday", rows: [row("c", local(2026, 9, 1), { kind: "follow" })] },
    ];
    expect(filterGroups(groups, new Set())).toEqual(groups);
    expect(filterGroups(groups, new Set<ActivityKind>(["like"])).map((group) => [group.day, group.rows.map((item) => item.id)])).toEqual([
      ["Today", ["a"]],
    ]);
  });
});

describe("one notification as a row", () => {
  it("says who did what, names the build inline, and reads whether a run worked", () => {
    const made = activityRowOf(notification(), null);
    expect(made).toMatchObject({
      id: "n-1",
      kind: "reproduced",
      at: "2026-10-02T10:00:00.000Z",
      who: "@ada ran",
      title: "Invoice triage agent",
      detail: "it worked",
      unread: true,
      href: "/b2/invoice-triage-agent",
      actor: { id: "actor-1", name: "Ada Lovelace", avatarUrl: null },
      cover: { src: null, seed: "build-1" },
    });
    expect(activityRowOf(notification({ body: "ran your build and it did not work" }), null).detail).toBe("it did not work");
  });

  it("leaves the detail empty when the stored message only repeats the verb", () => {
    expect(activityRowOf(notification({ kind: "rebuilt", body: "rebuilt your build" }), null)).toMatchObject({ who: "@ada rebuilt", detail: null });
    expect(activityRowOf(notification({ kind: "like", body: "liked your build" }), null).detail).toBeNull();
    expect(activityRowOf(notification({ body: null }), null).detail).toBeNull();
  });

  it("shows a stored message that is not one of the fixed texts whole", () => {
    const made = activityRowOf(notification({ kind: "comment", body: "“does it handle attachments?”" }), null);
    expect(made).toMatchObject({ who: "@ada commented on", detail: "“does it handle attachments?”" });
  });

  it("hangs the signed thumbnail on the build's cover", () => {
    expect(activityRowOf(notification(), "https://signed.example/cover.jpg").cover).toEqual({
      src: "https://signed.example/cover.jpg",
      seed: "build-1",
    });
  });

  it("marks a read notification as read", () => {
    expect(activityRowOf(notification({ is_read: true }), null).unread).toBe(false);
  });

  it("names the actor by handle, then by name, then as someone", () => {
    const byName = notification({ actor: { id: "actor-1", username: null, display_name: "Ada Lovelace", avatar_url: null } });
    expect(activityRowOf(byName, null).who).toBe("Ada Lovelace ran");
    const nobody = notification({ actor: null });
    expect(activityRowOf(nobody, null)).toMatchObject({ who: "Someone ran", actor: { id: "actor-1", name: "Someone" } });
  });

  it("draws a follow with no title and no cover, and leads to the follower's profile", () => {
    const made = activityRowOf(
      notification({
        kind: "follow",
        body: "started following you",
        target_type: "profile",
        target_id: "actor-1",
        build: null,
        actor: { id: "actor-1", username: "sam", display_name: "Sam", avatar_url: null },
      }),
      null,
    );
    expect(made).toMatchObject({ kind: "follow", who: "@sam started following you", title: null, detail: null, cover: null, href: "/profile/sam" });
  });

  it("says the message whole, with nothing to link, when the build has gone", () => {
    expect(activityRowOf(notification({ kind: "like", body: "liked your build", build: null }), null)).toMatchObject({
      kind: "like",
      who: "@ada liked your build",
      title: null,
      detail: null,
      cover: null,
      href: null,
    });
    expect(activityRowOf(notification({ kind: "comment", body: "commented on your build", build: null, actor: null }), null).who).toBe(
      "Commented on your build",
    );
  });

  it("shows a kind it draws no badge for, with its stored message and no kind", () => {
    const message = activityRowOf(
      notification({
        kind: "message_received",
        notification_type: "message_received",
        body: null,
        target_type: "thread",
        target_id: "thread-1",
        build: null,
        actor: { id: "actor-1", username: "sam", display_name: "Sam", avatar_url: null },
      }),
      null,
    );
    expect(message).toMatchObject({ kind: null, who: "@sam sent you a message", title: null, detail: null, cover: null, href: "/messages/thread-1" });

    const engagement = activityRowOf(
      notification({ kind: "engagement", notification_type: "engagement", body: "Maya liked your post", target_type: "blueprint", build: null }),
      null,
    );
    expect(engagement).toMatchObject({ kind: null, who: "Maya liked your post", href: null });
    expect(activityRowOf(notification({ kind: "something_new", body: null, build: null }), null).who).toBe("New notification");
  });
});

describe("the words around the list", () => {
  it("writes the list's subtitle, with 'live' only while the channel is", () => {
    expect(unreadLine(3, true)).toBe("3 unread · live");
    expect(unreadLine(3, false)).toBe("3 unread");
    expect(unreadLine(1204, false)).toBe("1,204 unread");
  });

  it("writes the phone's heading, and says so when nothing is unread", () => {
    expect(unreadHeading(3)).toBe("3 unread");
    expect(unreadHeading(0)).toBe("All caught up");
  });

  it("adds the dashed-line clause only when a rebuild went live inside the window", () => {
    expect(chartSubtitle(null)).toBe("Last 90 days");
    expect(chartSubtitle(23)).toBe("Last 90 days · dashed line: your rebuild went live");
    expect(chartSubtitle(0)).toBe("Last 90 days · dashed line: your rebuild went live");
  });

  it("scales a series against its largest day, and keeps zeros zero", () => {
    expect(scaleSeries([0, 5, 10])).toEqual([0, 0.5, 1]);
    expect(scaleSeries([0, 0, 0])).toEqual([0, 0, 0]);
    expect(scaleSeries([])).toEqual([]);
    expect(scaleSeries([2, Number.NaN, -4, 4])).toEqual([0.5, 0, 0, 1]);
  });

  it("says the chart in words", () => {
    expect(runsLabel([1, 2, 3], null)).toBe("6 runs of your builds in the last 3 days");
    expect(runsLabel([0, 1, 0], null)).toBe("1 run of your builds in the last 3 days");
    expect(runsLabel([1, 2, 3], 2)).toBe("6 runs of your builds in the last 3 days; a rebuild of your work went live today");
    expect(runsLabel([1, 2, 3], 1)).toContain("went live yesterday");
    expect(runsLabel([1, 2, 3], 0)).toContain("went live 2 days ago");
  });
});
