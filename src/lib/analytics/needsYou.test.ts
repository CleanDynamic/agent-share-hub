// What the analytics page says about each build (RC-P23): the three reasons a
// build needs its maker, their order, the table's order, and the "Last
// confirmed" wording. Pure functions, a fixed clock.

import { describe, expect, it } from "vitest";
import type { BuildStatRow } from "./buildStats";
import {
  BUILD_TABLE_ORDER,
  lastConfirmedText,
  needsYou,
  needsYouReasons,
  orderForTable,
  reasonText,
} from "./needsYou";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function row(over: Partial<BuildStatRow>): BuildStatRow {
  return {
    id: "b",
    slug: "b",
    title: "B",
    reproduction_count: 1,
    last_confirmed_at: ago(3),
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: ago(40),
    rebuild_count: 0,
    like_count: 0,
    comment_count: 0,
    save_count: 0,
    runs: 1,
    worked: 1,
    failed_last_30_days: 0,
    open_bounties: 0,
    solutions_waiting: 0,
    ...over,
  };
}

describe("needsYouReasons", () => {
  it("finds nothing on a healthy build", () => {
    expect(needsYouReasons(row({}), NOW)).toEqual([]);
  });

  it("names solutions waiting on an open bounty", () => {
    expect(needsYouReasons(row({ solutions_waiting: 2 }), NOW)).toEqual([{ kind: "waiting", count: 2 }]);
  });

  it("names a recent run that did not work, when nothing confirmed it working since", () => {
    expect(needsYouReasons(row({ failed_last_30_days: 1, last_confirmed_at: ago(45) }), NOW)).toEqual([{ kind: "failing" }]);
    expect(needsYouReasons(row({ failed_last_30_days: 1, last_confirmed_at: null, reproduction_count: 0, published_at: ago(10) }), NOW)).toEqual([
      { kind: "failing" },
    ]);
  });

  it("does not name a failed run when a run in the same 30 days worked", () => {
    expect(needsYouReasons(row({ failed_last_30_days: 3, last_confirmed_at: ago(5) }), NOW)).toEqual([]);
  });

  it("names a stale build, from its last confirmation or, never confirmed, its publication", () => {
    expect(needsYouReasons(row({ last_confirmed_at: ago(200) }), NOW)).toEqual([{ kind: "stale", since: ago(200) }]);
    expect(needsYouReasons(row({ last_confirmed_at: null, published_at: ago(130) }), NOW)).toEqual([{ kind: "stale", since: ago(130) }]);
  });
});

describe("needsYou", () => {
  it("puts the most pressing first: waiting, then failing, then stale; one line per build", () => {
    const builds = [
      row({ id: "stale", title: "Stale", worked: 9, last_confirmed_at: ago(300) }),
      row({ id: "fine", title: "Fine", worked: 8 }),
      row({ id: "failing", title: "Failing", worked: 7, failed_last_30_days: 2, last_confirmed_at: ago(60) }),
      row({ id: "waiting", title: "Waiting", worked: 1, solutions_waiting: 1, last_confirmed_at: ago(300) }),
    ];
    const lines = needsYou(builds, NOW);
    expect(lines.map((line) => line.build.id)).toEqual(["waiting", "failing", "stale"]);
    expect(lines[0].reasons.map((reason) => reason.kind)).toEqual(["waiting", "stale"]);
  });

  it("is empty when nothing needs the maker", () => {
    expect(needsYou([row({}), row({ id: "c" })], NOW)).toEqual([]);
  });
});

describe("reasonText", () => {
  it("says each reason in the page's words", () => {
    expect(reasonText({ kind: "waiting", count: 3 })).toBe("3 solutions waiting");
    expect(reasonText({ kind: "waiting", count: 1 })).toBe("1 solution waiting");
    expect(reasonText({ kind: "failing" })).toBe("a recent run did not work");
    expect(reasonText({ kind: "stale", since: "2026-03-13T10:00:00.000Z" })).toBe("not confirmed since 13 March 2026");
  });
});

describe("orderForTable", () => {
  it("orders by Got working, then the most recently confirmed, never-confirmed last", () => {
    const builds = [
      row({ id: "a", worked: 2, last_confirmed_at: ago(40) }),
      row({ id: "b", worked: 5, last_confirmed_at: ago(90) }),
      row({ id: "c", worked: 2, last_confirmed_at: ago(4) }),
      row({ id: "d", worked: 2, last_confirmed_at: null }),
    ];
    expect(orderForTable(builds).map((build) => build.id)).toEqual(["b", "c", "a", "d"]);
    expect(BUILD_TABLE_ORDER).toBe("Most got working first, then the most recently confirmed.");
  });
});

describe("lastConfirmedText", () => {
  it("is the Plaque's freshness wording under the column's own header", () => {
    expect(lastConfirmedText(row({ last_confirmed_at: ago(3) }), NOW)).toEqual({ text: "3 days ago, on Sonnet 4.5", stale: false });
  });

  it("says stale when the claim has gone stale", () => {
    const cell = lastConfirmedText(row({ last_confirmed_at: ago(200) }), NOW);
    expect(cell.stale).toBe(true);
    expect(cell.text).toContain("months ago");
  });

  it("has no wording of its own for a build nobody confirmed", () => {
    expect(lastConfirmedText(row({ last_confirmed_at: null, published_at: ago(3) }), NOW)).toEqual({ text: null, stale: false });
  });
});
