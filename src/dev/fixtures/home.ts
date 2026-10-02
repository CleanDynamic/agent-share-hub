/* UI-P27 — Home's sample data, as `HomeView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where the sample's indices become objects: `design/fixtures/sample-data.json →
   home` points at builds by their 1-based position in `builds`, and gives its
   times as "2m", "1h". Nothing here reaches a production bundle. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { HomeViewProps } from "@/pages/site/home/HomeView";
import {
  type HomeChallengeRow,
  type HomeFeedRow,
  type HomeWhereNextRow,
  sparkValues,
} from "@/pages/site/home/homeModel";

import { FIXTURE_NOW, fixturePlaque, fixtures, type FixtureBuild } from "../designFixtures";

const build = (index: number): FixtureBuild => fixtures.builds[index - 1];

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "2m" → the instant that long before the moment the mockups were drawn. */
function atOf(when: string): string {
  const match = /^(\d+)([mhd])$/.exec(when);
  const ms = match ? Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS] : 0;
  return new Date(FIXTURE_NOW.getTime() - ms).toISOString();
}

const cover = (b: FixtureBuild) => ({ src: null, seed: b.id, sky: b.cover_sky });

const feedRows = (): HomeFeedRow[] =>
  fixtures.home.feed.map((item, index) => {
    const b = build(item.build);
    const handle = item.actor.replace(/^@/, "");
    return {
      key: `${item.kind}:${b.id}:${index}`,
      kind: item.kind as HomeFeedRow["kind"],
      at: atOf(item.when),
      actor: { id: handle, name: handle, hue: item.hue },
      who: item.who,
      title: b.title,
      plaque: fixturePlaque(b),
      cover: cover(b),
      href: `/b2/${b.slug}`,
    };
  });

const MEANINGS: HomeChallengeRow["meaning"][] = ["run", "solve", "reconfirm"];

const challenges = (): HomeChallengeRow[] =>
  fixtures.home.challenges.map((challenge, index) => ({
    slug: `sample-${index}`,
    title: challenge.title,
    done: challenge.done,
    target: challenge.target,
    meaning: MEANINGS[index],
    xp: challenge.xp > 0 ? challenge.xp : undefined,
  }));

/** A calm, deterministic 14-day series per row: the sample has the pictures, not the numbers. */
const spark = (seed: number) =>
  sparkValues(Array.from({ length: 14 }, (_, day) => 3 + Math.round(2 * Math.sin((day + seed) / 2) + (day % 3))));

const whereNext = (): HomeWhereNextRow[] =>
  fixtures.home.where_next.map((item, index) => {
    const b = build(item.build);
    return { id: b.id, title: b.title, href: `/b2/${b.slug}`, reason: item.why, spark: spark(index * 3), cover: cover(b) };
  });

const noop = () => undefined;

/**
 * UI-P37 — the same page in its other three states, from the same sample. Loading
 * has every panel waiting; empty is a visitor with nothing yet (signed out, so the
 * personal panels ask them in); error has every panel failing, and each says so in
 * its own place.
 */
function inState(base: Omit<HomeViewProps, "fit">, state: DesignState): Omit<HomeViewProps, "fit"> {
  if (state === "loading") {
    return {
      ...base,
      litToday: null,
      reproducedToday: null,
      runsThisWeek: null,
      feed: { ...base.feed, status: "loading", rows: [] },
      challenges: { status: "loading" },
      streak: { status: "loading" },
      whereNext: { status: "loading" },
    };
  }
  if (state === "empty") {
    return {
      ...base,
      litToday: 0,
      reproducedToday: 0,
      runsThisWeek: 0,
      feed: { ...base.feed, rows: [] },
      challenges: { status: "signed-out" },
      streak: { status: "signed-out" },
      whereNext: { status: "ready", data: [] },
    };
  }
  if (state === "error") {
    const failure = { onRetry: noop };
    return {
      ...base,
      litToday: null,
      reproducedToday: null,
      runsThisWeek: null,
      orbsError: failure,
      feed: { ...base.feed, status: "error", rows: [] },
      challenges: { status: "error", ...failure },
      streak: { status: "error", ...failure },
      whereNext: { status: "error", ...failure },
    };
  }
  return base;
}

/** Everything `HomeView` needs except `fit`, from the sample data. */
export function homeFixture(state: DesignState = "populated"): Omit<HomeViewProps, "fit"> {
  const week = fixtures.home.week.map((day) => (day === "active" || day === "frozen" ? day : "none"));
  const rows = feedRows();

  return inState({
    now: FIXTURE_NOW.getTime(),
    scope: "everyone",
    onScopeChange: noop,
    litToday: fixtures.home.lit_today,
    reproducedToday: fixtures.home.reproduced_today,
    runsThisWeek: fixtures.home.runs_this_week,
    feed: { status: "ready", rows, hasMore: false, loadingMore: false, onMore: noop, onRetry: noop },
    // A visit an hour ago: the two-minute-old first row is newer than it.
    seenAt: FIXTURE_NOW.getTime() - UNIT_MS.h,
    challenges: { status: "ready", data: challenges() },
    thisWeekHref: "/analytics",
    streak: {
      status: "ready",
      data: {
        count: fixtures.viewer.streak_days,
        frozenUsed: week.filter((day) => day === "frozen").length,
        week,
      },
    },
    whereNext: { status: "ready", data: whereNext() },
    onNavigate: noop,
  }, state);
}
