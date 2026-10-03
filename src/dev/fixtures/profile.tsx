/* UI-P34 — Profile's sample data, as `ProfileView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where the sample's indices become objects: `design/fixtures/sample-data.json →
   profile` points at builds by their 1-based position in `builds`. The works are
   drawn with `BuildCard` directly, from the sample's own fields — the live page
   hands `GalleryCard` a real record instead. Nothing here reaches a production
   bundle. */

import { BuildCard, CardCredit } from "@/components/brand/BuildCard";
import { CoverFallback } from "@/components/brand/CoverFallback";
import type { ActivityDay } from "@/components/brand/ActivityGrid";
import type { DesignState } from "@/dev/useDesignTheme";
import type { ProfileViewProps } from "@/pages/site/profile/ProfileView";
import {
  ACTIVITY_DAYS,
  buildsCount,
  type LevelView,
  type MarkView,
  type WorkCard,
} from "@/pages/site/profile/profileModel";

import { FIXTURE_NOW, fixturePlaque, fixtures, type FixtureBuild } from "../designFixtures";

const noop = () => undefined;
const now = FIXTURE_NOW.getTime();
const build = (index: number): FixtureBuild => fixtures.builds[index - 1];

/** The banner's sky in the mockup: the violet one. */
const BANNER_SKY = 3;

function card(b: FixtureBuild): WorkCard {
  const ask = b.has_open_gap && b.open_gap_reward_gbp ? `1 part unsolved · £${b.open_gap_reward_gbp}` : null;
  return {
    key: b.id,
    render: (variant) => (
      <BuildCard
        to={`/b2/${b.slug}`}
        title={b.title}
        cover={<CoverFallback seed={b.id} radius={0} sky={b.cover_sky} />}
        coverHeight={variant === "phone" ? 90 : 86}
        titleSize={17}
        shape={b.shape}
        credit={<CardCredit rebuiltFrom={b.rebuilt_from} by={b.maker} />}
        delta={b.change_summary}
        build={fixturePlaque(b)}
        categories={b.part_categories}
        openAsk={ask}
        gap={b.has_open_gap}
        now={now}
      />
    ),
  };
}

/** The sample's level panel: 7, 1,840 of 2,400 xp, the Curator track, a 12-day streak (best 31). */
function level(): LevelView {
  const v = fixtures.viewer;
  return {
    level: v.level,
    percent: Math.round((v.xp / v.xp_next) * 100),
    xp: v.xp,
    xpNext: v.xp_next,
    remaining: v.xp_next - v.xp,
    track: v.track as LevelView["track"],
    streakDays: v.streak_days,
    streakBest: v.streak_best,
    streakKnown: true,
  };
}

/** 22 weeks of days: a fixed pattern of volume, with a handful of frozen days. */
function activity(): ActivityDay[] {
  return Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const wave = (i * 7 + (i % 5) * 3) % 11;
    return { count: wave < 3 ? 0 : wave - 1, frozen: i % 23 === 11 };
  });
}

const marks = (): MarkView[] =>
  fixtures.profile.marks.map(([name, tier]) => ({ key: name, name, tier: tier as MarkView["tier"] }));

/**
 * UI-P37 — the same page in its other three states, from the same sample. Loading has
 * the banner and every panel waiting (the figures hold their bars' places, as the
 * sample draws them); empty is a maker with nothing yet; error has every panel
 * failing, each in its own place.
 */
function inState(base: Omit<ProfileViewProps, "fit">, state: DesignState): Omit<ProfileViewProps, "fit"> {
  if (state === "loading") {
    return {
      ...base,
      maker: null,
      level: null,
      figures: null,
      figuresBarsExpected: true,
      works: { ...base.works, status: "loading", counts: {}, cards: [] },
      activity: null,
      marks: null,
    };
  }
  if (state === "empty") {
    return {
      ...base,
      level: base.level && { ...base.level, percent: 0, xp: 0, remaining: base.level.xpNext, streakDays: 0, streakBest: 0 },
      figures: { buildsHung: 0, reproducedByOthers: 0, rebuildsOfWork: 0, bountiesSolved: 0, bountyEarningsGbp: 0 },
      works: { ...base.works, counts: { builds: 0, rebuilds: 0, reproduced: 0, collections: 0 }, cards: [] },
      activity: Array.from({ length: ACTIVITY_DAYS }, () => ({ count: 0, frozen: false })),
      marks: [],
    };
  }
  if (state === "error") {
    const failure = { onRetry: noop };
    return {
      ...base,
      level: null,
      figures: null,
      works: { ...base.works, status: "error", counts: {}, cards: [], onRetry: noop },
      activity: null,
      marks: null,
      failed: { level: failure, figures: failure, activity: failure, marks: failure },
    };
  }
  return base;
}

/** Everything `ProfileView` needs except `fit`, from the sample data. */
export function profileFixture(state: DesignState = "populated"): Omit<ProfileViewProps, "fit"> {
  const p = fixtures.profile;
  const v = fixtures.viewer;
  return inState({
    maker: {
      id: "sample-maya",
      name: v.name,
      handle: v.handle.replace(/^@/, ""),
      bio: p.bio,
      place: p.place,
      since: p.since,
      avatarUrl: null,
      avatarHue: v.avatar_hue,
      cover: null,
      sky: BANNER_SKY,
    },
    isOwn: false,
    following: false,
    onFollow: noop,
    onUnfollow: noop,
    onMessage: noop,
    onEdit: noop,
    level: level(),
    onTrack: noop,
    figures: {
      buildsHung: p.builds_hung,
      reproducedByOthers: p.reproduced_by_others,
      rebuildsOfWork: p.rebuilds_of_work,
      bountiesSolved: p.bounties_solved,
      bountyEarningsGbp: p.bounty_earnings_gbp,
      // The sample draws a bar under three of the four; the product defines no creator-mark threshold, so the live page has none.
      bars: { reproduced: 70, rebuilds: 40, bounties: 50 },
    },
    works: {
      tab: "builds",
      onTab: noop,
      counts: p.tabs,
      status: "ready",
      cards: p.works.map((index) => card(build(index))),
      collections: [],
      hasMore: false,
      loadingMore: false,
      onMore: noop,
      onRetry: noop,
    },
    activity: activity(),
    marks: marks(),
  }, state);
}

/** What the Collections tab draws, from the sample's builds: four collections of builds. */
export function collectionTiles(): NonNullable<ProfileViewProps["works"]["collections"]>[number][] {
  return [
    ["Finance ops kit", [1, 2, 3, 4]],
    ["Support desk", [2, 5, 6, 7]],
    ["Reading list", [3, 4, 5]],
    ["Weekend builds", [6, 7]],
  ].map(([title, members]) => ({
    key: String(title),
    to: "/library",
    title: String(title),
    count: buildsCount((members as number[]).length),
    covers: (members as number[]).map((index) => <CoverFallback key={index} seed={build(index).id} radius={0} sky={build(index).cover_sky} />),
  }));
}
