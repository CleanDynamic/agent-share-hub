// UI-P27 — Home's view model: the words, the week, the streak and the filters.

import { beforeEach, describe, expect, it } from "vitest";

import { toFeedItem, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

import {
  HOME_SEEN_KEY,
  frozenLabel,
  homeRowOf,
  isNewerThanSeen,
  matchesFilter,
  readHomeSeen,
  reasonLabel,
  shortAgo,
  sparkValues,
  streakOf,
  weekDays,
  whoLine,
  writeHomeSeen,
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
    bounty_id: null,
    bounty_reward_gbp: null,
    bounty_gap_title: null,
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

describe("whoLine", () => {
  it("says who hung a build", () => {
    expect(whoLine(toFeedItem(row()))).toBe("@maya hung");
  });

  it("names the build a rebuild came from", () => {
    const item = toFeedItem(row({ item_kind: "rebuild", parent_build_id: "b0", source_title_at_fork: "Call notes" }));
    expect(whoLine(item)).toBe("@maya rebuilt Call notes →");
  });

  it("gives a note its reproducer, model and words — and leaves out what was not said", () => {
    const base = { item_kind: "repro_note" as const, repro_user_username: "ada", title: "Research digest" };
    expect(whoLine(toFeedItem(row({ ...base, repro_model: "haiku-4.5", repro_note: "worked first try" })))).toBe(
      "@ada ran Research digest on haiku-4.5 — “worked first try”",
    );
    expect(whoLine(toFeedItem(row({ ...base, repro_model: null, repro_note: "fine" })))).toBe(
      "@ada ran Research digest — “fine”",
    );
  });

  it("states an ask with its part and reward, and drops what it does not have", () => {
    const base = { item_kind: "bounty" as const, bounty_id: "x" };
    expect(whoLine(toFeedItem(row({ ...base, bounty_gap_title: "currency tolerance", bounty_reward_gbp: 150 })))).toBe(
      "@maya opened an ask · currency tolerance · £150",
    );
    expect(whoLine(toFeedItem(row({ ...base })))).toBe("@maya opened an ask");
  });

  it("falls back to the display name when the maker has no handle", () => {
    expect(whoLine(toFeedItem(row({ creator_username: null })))).toBe("Maya Okafor hung");
  });
});

describe("homeRowOf", () => {
  it("links every kind to its build, and gives a note the reproducer as its actor", () => {
    const note = homeRowOf(toFeedItem(row({ item_kind: "repro_note", repro_user_username: "ada", repro_note: "ok" })), null);
    expect(note).toMatchObject({ kind: "repro_note", href: "/b2/invoice-triage", actor: { id: "ada", name: "ada" } });

    const ask = homeRowOf(toFeedItem(row({ item_kind: "bounty", bounty_id: "x" })), "https://img/1");
    expect(ask).toMatchObject({ kind: "bounty", href: "/b2/invoice-triage", cover: { src: "https://img/1", seed: "b1" } });
    expect(ask.plaque.reproduction_count).toBe(41);
  });
});

describe("matchesFilter", () => {
  it("filters on kind and nothing else", () => {
    expect(matchesFilter("rebuild", "all")).toBe(true);
    expect(matchesFilter("rebuild", "rebuilds")).toBe(true);
    expect(matchesFilter("rebuild", "builds")).toBe(false);
    expect(matchesFilter("repro_note", "notes")).toBe(true);
    expect(matchesFilter("bounty", "asks")).toBe(true);
    expect(matchesFilter("bounty", "notes")).toBe(false);
  });
});

describe("the streak", () => {
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
    expect(streakOf(rows, now)).toMatchObject({ count: 3, frozenUsed: 1 });
  });

  it("keeps yesterday's streak alive while today is still open", () => {
    const rows = days({ "2026-09-29": "active", "2026-09-28": "active" });
    expect(streakOf(rows, now).count).toBe(2);
  });

  it("is zero when yesterday and today are both empty", () => {
    expect(streakOf(days({ "2026-09-20": "active" }), now).count).toBe(0);
    expect(streakOf([], now).count).toBe(0);
  });

  it("says how many frozen days were used", () => {
    expect(frozenLabel(0)).toBe("no frozen days used");
    expect(frozenLabel(1)).toBe("one frozen day used");
    expect(frozenLabel(3)).toBe("3 frozen days used");
  });
});

describe("where next", () => {
  it("prints each reason in caps, naming only what the reason names", () => {
    expect(reasonLabel({ reason: "same_tool", reasonDetail: "Sonnet-4.5" })).toBe("SAME TOOL · SONNET-4.5");
    expect(reasonLabel({ reason: "rebuilt_from_one_you_ran", reasonDetail: "Call notes" })).toBe("REBUILT FROM ONE YOU RAN");
    expect(reasonLabel({ reason: "more_from_maker", reasonDetail: "@ines" })).toBe("MORE FROM @INES");
  });

  it("scales a sparkline to its own peak, and a quiet week to a flat line", () => {
    expect(sparkValues([0, 2, 4])).toEqual([0, 0.5, 1]);
    expect(sparkValues([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("since you were last here", () => {
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

  it("highlights only a row newer than the previous visit — never on a first visit", () => {
    expect(isNewerThanSeen("2026-09-30T11:58:00Z", Date.parse("2026-09-30T11:00:00Z"))).toBe(true);
    expect(isNewerThanSeen("2026-09-30T10:00:00Z", Date.parse("2026-09-30T11:00:00Z"))).toBe(false);
    expect(isNewerThanSeen("2026-09-30T11:58:00Z", null)).toBe(false);
    expect(isNewerThanSeen(undefined, 5)).toBe(false);
  });
});
