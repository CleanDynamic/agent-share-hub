// UI-P27, SV-10: Home's view model: the words, the feed's items, the week and the filters.

import { beforeEach, describe, expect, it } from "vitest";

import { toFeedItem, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

import {
  HOME_SEEN_KEY,
  closesIn,
  feedKey,
  feedWaitsForSession,
  filterOf,
  homeItemOf,
  isHomeFeedRow,
  type HomeFeedRow,
  homeWeek,
  matchesFilter,
  newerThan,
  readHomeSeen,
  shortAgo,
  streakLength,
  timeLeft,
  weekDays,
  weekHeading,
  weekSummary,
  writeHomeSeen,
  type HomeItemContext,
} from "./homeModel";

const NOW = Date.parse("2026-09-30T12:00:00Z"); // a Wednesday

function row(over: Partial<BuildFeedRow> = {}): BuildFeedRow {
  return {
    item_kind: "build",
    item_at: "2026-09-30T11:58:00.000Z",
    build_id: "b1",
    slug: "invoice-triage",
    title: "Invoice triage agent",
    outcome: null,
    shape: "agent",
    cover_media_id: null,
    creator_id: "c1",
    creator_username: "maya",
    creator_display: "Maya Okafor",
    creator_avatar: null,
    reproduction_count: 41,
    rebuild_count: 0,
    parent_build_id: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    rebuild_note: null,
    repro_note: null,
    repro_model: null,
    repro_user_username: null,
    status: "published",
    made_for: null,
    last_confirmed_at: null,
    last_confirmed_model: null,
    cover_bucket: null,
    cover_path: null,
    cover_kind: null,
    cover_poster_path: null,
    repro_worked: null,
    ...over,
  };
}

describe("shortAgo", () => {
  it("counts minutes, hours, days, weeks, months and years", () => {
    const ago = (ms: number) => shortAgo(new Date(NOW - ms).toISOString(), NOW);
    expect(ago(20_000)).toBe("now");
    expect(ago(2 * 60_000)).toBe("2m");
    expect(ago(18 * 60_000)).toBe("18m");
    expect(ago(2 * 3_600_000)).toBe("2h");
    expect(ago(3 * 86_400_000)).toBe("3d");
    expect(ago(14 * 86_400_000)).toBe("2w");
    expect(ago(150 * 86_400_000)).toBe("5mo");
    expect(ago(800 * 86_400_000)).toBe("2y");
  });

  it("is empty for a date that is not one, and never negative for the future", () => {
    expect(shortAgo("nope", NOW)).toBe("");
    expect(shortAgo(new Date(NOW + 60_000).toISOString(), NOW)).toBe("now");
  });
});

describe("matchesFilter", () => {
  it("filters on kind and nothing else", () => {
    expect(matchesFilter("rebuild", "all")).toBe(true);
    expect(matchesFilter("rebuild", "rebuilds")).toBe(true);
    expect(matchesFilter("rebuild", "builds")).toBe(false);
    expect(matchesFilter("repro_note", "all")).toBe(true);
    expect(matchesFilter("repro_note", "builds")).toBe(false);
    expect(matchesFilter("topic", "asks")).toBe(true);
    expect(matchesFilter("topic", "builds")).toBe(false);
  });
});

const DAY = 86_400_000;
const none: HomeItemContext = { details: new Map(), engagement: () => undefined };
/** A feed row Home draws: a run note is not one. */
const feedRow = (over: Partial<BuildFeedRow> = {}): HomeFeedRow => {
  const item = toFeedItem(row(over));
  if (!isHomeFeedRow(item)) throw new Error("a run note");
  return item;
};

describe("the feed's items", () => {
  it("leaves a run note out of the rows Home draws", () => {
    expect(isHomeFeedRow(toFeedItem(row({ item_kind: "repro_note", repro_user_username: "kit", repro_note: "Worked first time.", repro_worked: true })))).toBe(false);
    expect(isHomeFeedRow(toFeedItem(row()))).toBe(true);
    expect(isHomeFeedRow(toFeedItem(row({ item_kind: "rebuild" })))).toBe(true);
  });

  it("gives a build post its read post when the batch has it, and the feed row's build until then", () => {
    const feed = feedRow();
    const before = homeItemOf(feed, none);
    expect(before.kind === "build" && before.build.post_doc).toBeFalsy();
    const doc = { type: "doc" as const, content: [] };
    const detail = { build: { ...feed.build, post_doc: doc }, modelsUsed: ["claude"], classification: null };
    const after = homeItemOf(feed, { ...none, details: new Map([["b1", detail]]) });
    expect(after).toMatchObject({ kind: "build", modelsUsed: ["claude"], maker: { handle: "maya", name: "Maya Okafor" } });
    expect(after.kind === "build" && after.build.post_doc).toBe(doc);
  });

  it("names a rebuild's source from the frozen fork columns", () => {
    const item = homeItemOf(feedRow({ item_kind: "rebuild", source_title_at_fork: "Call notes", source_handle_at_fork: "maya", rebuild_note: "Local model.\nMore." }), none);
    expect(item).toMatchObject({ kind: "rebuild", note: "Local model.", source: { title: "Call notes", handle: "maya" } });
  });

  it("counts the loaded items newer than the last visit, and none on a first visit", () => {
    const items = [{ at: "2026-09-30T11:58:00Z" }, { at: "2026-09-30T10:00:00Z" }, { at: "junk" }];
    expect(newerThan(items, Date.parse("2026-09-30T11:00:00Z"))).toBe(1);
    expect(newerThan(items, null)).toBe(0);
  });
});

describe("the filter from the address", () => {
  it("reads a known kind and treats anything else as All", () => {
    expect(filterOf("asks")).toBe("asks");
    expect(filterOf("notes")).toBe("all");
    expect(filterOf("junk")).toBe("all");
    expect(filterOf(null)).toBe("all");
  });
});

describe("deadlines", () => {
  it("says how long an ask stays open, and nothing for one past or unknown", () => {
    expect(closesIn(new Date(NOW + 5.5 * DAY).toISOString(), NOW)).toBe("closes in 5 days");
    expect(closesIn(new Date(NOW + 1.2 * DAY).toISOString(), NOW)).toBe("closes tomorrow");
    expect(closesIn(new Date(NOW - DAY).toISOString(), NOW)).toBe("");
    expect(closesIn(null, NOW)).toBe("");
    expect(timeLeft(new Date(NOW + 9.5 * DAY).toISOString(), NOW)).toBe("9 days left");
    expect(timeLeft(new Date(NOW + 15 * DAY).toISOString(), NOW)).toBe("2 weeks left");
    expect(timeLeft(new Date(NOW + 1.5 * DAY).toISOString(), NOW)).toBe("1 day left");
  });
});

describe("your week", () => {
  it("leaves out the challenges that count runs and confirmations", () => {
    const progress = [
      { challenge: { slug: "run-three-new", title: "Run three", event: "run_reported" as const, count: 3 }, done: 1, target: 3 },
      { challenge: { slug: "solve-a-gap", title: "Solve a gap", event: "solution_accepted" as const, count: 1 }, done: 0, target: 1 },
      { challenge: { slug: "reconfirm-stale", title: "Re-confirm", event: "build_reconfirmed" as const, count: 1 }, done: 0, target: 1 },
    ];
    expect(homeWeek([], progress, new Date(NOW)).challenges.map((row) => row.slug)).toEqual(["solve-a-gap"]);
  });

  const days = (entries: Record<string, "active" | "frozen">) =>
    Object.entries(entries).map(([date, kind]) => ({ date, kind }));
  const now = new Date(NOW);

  it("lays out Monday to Sunday of the UTC week, with days to come empty", () => {
    const rows = days({ "2026-09-28": "active", "2026-09-29": "frozen", "2026-09-30": "active", "2026-09-20": "active" });
    expect(weekDays(rows, now)).toEqual(["active", "frozen", "active", "none", "none", "none", "none"]);
  });

  it("counts active days back from today, bridging a frozen one", () => {
    const rows = days({
      "2026-09-30": "active",
      "2026-09-29": "frozen",
      "2026-09-28": "active",
      "2026-09-27": "active",
      "2026-09-25": "active", // a gap on the 26th ends it
    });
    expect(streakLength(rows, now)).toBe(3);
  });

  it("keeps yesterday's streak alive while today is still open, and is zero after a gap", () => {
    expect(streakLength(days({ "2026-09-29": "active", "2026-09-28": "active" }), now)).toBe(2);
    expect(streakLength(days({ "2026-09-20": "active" }), now)).toBe(0);
  });

  it("knows today, and says the week in words", () => {
    const week = homeWeek(days({ "2026-09-28": "active", "2026-09-29": "active" }), [], now);
    expect(week.today).toBe(2);
    expect(week.streak).toBe(2);
    expect(weekHeading(week)).toBe("2 day streak");
    expect(weekHeading({ streak: 0, days: week.days })).toBe("2 days active this week");
    expect(weekSummary(week.days)).toBe("Active 2 of 7 days");
  });
});

describe("new since you looked", () => {
  beforeEach(() => window.localStorage.clear());

  it("reads and writes the timestamp under bg-home-seen", () => {
    expect(readHomeSeen()).toBeNull();
    writeHomeSeen(1234);
    expect(window.localStorage.getItem(HOME_SEEN_KEY)).toBe("1234");
    expect(readHomeSeen()).toBe(1234);
  });

  it("treats junk as no previous visit", () => {
    window.localStorage.setItem(HOME_SEEN_KEY, "yesterday");
    expect(readHomeSeen()).toBeNull();
  });
});

/* ── SV-15: since you were last here ── */

describe("sinceSection", () => {
  const person = { id: "u2", handle: "kit", name: "Kit" };
  const base = { buildId: "b1", buildSlug: "call-notes", buildTitle: "Call notes", role: "maker" as const, at: "2026-10-28T11:00:00.000Z" };
  const now = Date.parse("2026-10-28T12:00:00.000Z");

  it("is left out when there are no events", async () => {
    const { sinceSection } = await import("./homeModel");
    expect(sinceSection([], now - 2 * 86_400_000, now)).toBeNull();
  });

  it("keeps the rebuilds of the reader's builds and drops runs and out-of-date notes", async () => {
    const { sinceSection, sinceHeading } = await import("./homeModel");
    const section = sinceSection(
      [
        { ...base, id: "run:1", kind: "run", runner: person, worked: false, model: "gpt-5", note: null },
        { ...base, id: "rebuild:2", kind: "rebuild", rebuildId: "b2", rebuildSlug: "call-notes-2", rebuildTitle: "On a local model", rebuilder: person },
        { ...base, id: "stale:b1", kind: "stale" },
      ],
      now - 2 * 86_400_000,
      now,
    );
    expect(section?.rows.map((row) => [row.title, row.detail, row.href])).toEqual([["@kit rebuilt Call notes", '"On a local model"', "/b2/call-notes-2"]]);
    expect(sinceHeading(1)).toBe("1 rebuild of your builds");
    expect(sinceHeading(2)).toBe("2 rebuilds of your builds");
  });

  it("is left out when there are only runs", async () => {
    const { sinceSection } = await import("./homeModel");
    expect(sinceSection([{ ...base, id: "run:1", kind: "run", runner: person, worked: true, model: null, note: null }], now - 86_400_000, now)).toBeNull();
  });
});

describe("UX-01 P5: the feed's key and when it may start", () => {
  it("Everyone's key has no viewer in it, and does not wait for the session check", () => {
    expect(feedKey("everyone", "u1")).toEqual(["feed", "getBuildFeed", "everyone"]);
    expect(feedKey("everyone", null)).toEqual(["feed", "getBuildFeed", "everyone"]);
    expect(feedWaitsForSession("everyone")).toBe(false);
  });
  it("Following's key still includes the viewer, and waits for the session check", () => {
    expect(feedKey("following", "u1")).toEqual(["feed", "getBuildFeed", "following", "u1"]);
    expect(feedKey("following", "u2")).not.toEqual(feedKey("following", "u1"));
    expect(feedWaitsForSession("following")).toBe(true);
  });
});
