/* SV-10: Home's view model: the shapes `HomeView` takes, and the pure functions that turn what the data layer returns
   into them.

   NOTHING HERE FETCHES. `HomePage` loads, these map, `HomeView` draws; the dev page `vision-home` builds the same shapes
   from the board's sample data. */

import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { rewardWords, splitBody, topicHref } from "@/components/post/postCardModel";
import type { GalleryBuild } from "@/lib/build/gallery";
import type { Post } from "@/lib/openbuilds";
import type { Classification } from "@/lib/classify/types";
import type { ActivityEvent } from "@/lib/feed/activity";
import type { FeedItem, FeedItemKind } from "@/lib/feed/getBuildFeed";
import type { StreakDayRow } from "@/lib/progress";
import { weekStartUtc, type ChallengeProgress } from "@/lib/progress/weekly";

import type { HomePostItem } from "./homeTopics";

/* ── the feed's kind filter ── */

/** UX-01 P5: the first feed page's query key. Everyone does not depend on the reader (`get_build_feed` reads `auth.uid()` only for follows), so its key carries no viewer and its request need not wait for the session check. Following is the reader's own, so it does. */
export type HomeFeedScope = "everyone" | "following";
export const feedKey = (scope: HomeFeedScope, userId: string | null): readonly unknown[] => (scope === "everyone" ? ["feed", "getBuildFeed", "everyone"] : ["feed", "getBuildFeed", "following", userId]);
export const feedWaitsForSession = (scope: HomeFeedScope): boolean => scope === "following";

export type HomeFilter = "all" | "builds" | "rebuilds" | "asks";

export const HOME_FILTERS: readonly { value: HomeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "builds", label: "Builds" },
  { value: "rebuilds", label: "Rebuilds" },
  // UX-07 P1: the fifth filter is Topics: the topics and the reply groups. Its address stays
  // `?kind=asks`, so a link made before it still lands here.
  { value: "asks", label: "Topics" },
];

const KINDS_OF_FILTER: Record<Exclude<HomeFilter, "all">, readonly HomeFeedItem["kind"][]> = {
  builds: ["build"],
  rebuilds: ["rebuild"],
  asks: ["topic", "reply_group"],
};

/** The filters act on what is loaded, on `kind`, and on nothing else. */
export function matchesFilter(kind: FeedItemKind | HomePostItem["kind"], filter: HomeFilter): boolean {
  return filter === "all" || (KINDS_OF_FILTER[filter] as readonly string[]).includes(kind);
}

/** A filter from the address: anything else is All. */
export function filterOf(value: string | null): HomeFilter {
  return HOME_FILTERS.some((item) => item.value === value) ? (value as HomeFilter) : "all";
}

/* ── the feed's items ── */

export interface HomePerson {
  /** Stable: chooses the avatar hue. */
  id: string;
  /** Without the @; null when the profile has none. */
  handle: string | null;
  name: string;
  avatarUrl?: string | null;
  /** Force a hue (0–5). The dev fixtures pass it. */
  hue?: number;
}

export interface HomeBuildPost {
  kind: "build";
  key: string;
  at: string;
  /** The build as `FeedPost` reads it: with `post_doc` and its media once the batch read has it. */
  build: GalleryBuild;
  maker: HomePerson;
  modelsUsed: readonly string[];
  plaque: PlaqueBuild;
  classification: Classification | null;
  engagement?: RowEngagement;
}

/** Not drawn on Home any more; the profile still draws its own notes with it until its prompt. */
export interface HomeReproNote {
  kind: "repro_note";
  key: string;
  at: string;
  runner: HomePerson;
  buildTitle: string;
  href: string;
  /** Null when they did not say. */
  model: string | null;
  note: string;
  worked: boolean;
}

export interface HomeRebuildPost {
  kind: "rebuild";
  key: string;
  at: string;
  maker: HomePerson;
  /** The rebuilder's note, or null. */
  note: string | null;
  source: { title: string; handle: string | null };
  /** The rebuild itself, for its build line and its actions. */
  build: GalleryBuild;
  plaque: PlaqueBuild;
  engagement?: RowEngagement;
}

export type HomeFeedItem = HomeBuildPost | HomeRebuildPost | HomePostItem;

/** The feed rows Home draws: a run note is not one of them. */
export type HomeFeedRow = Exclude<FeedItem, { kind: "repro_note" }>;
export const isHomeFeedRow = (item: FeedItem): item is HomeFeedRow => item.kind !== "repro_note";

/* ── the columns' rows ── */

export interface HomeSinceRow {
  key: string;
  title: string;
  detail: string;
  at: string;
  /** The canonical page the event is about; absent on the dev page. */
  href?: string;
}

export interface HomeDraftRow {
  id: string;
  title: string;
  untitled: boolean;
  /** "3 sessions · edited 22h ago". */
  meta: string;
}

export interface HomeSessionRow {
  id: string;
  /** The first prompt. */
  title: string;
  /** "10 Oct · In 4 drafts". No tool, no model. */
  meta: string;
}

export type HomeDayState = "active" | "frozen" | "none";

export interface HomeWeek {
  /** Monday to Sunday of the current UTC week. */
  days: readonly HomeDayState[];
  /** 0 to 6: today, Monday first. */
  today: number;
  streak: number;
  challenges: readonly HomeChallengeRow[];
}

/** UX-03 P6: how many of the maker's published builds "Your published builds" lists. Home's own; not the composer's GROUP_ROWS. */
export const HOME_BUILD_ROWS = 5;

/** UX-08 P3: where Home's Still open section goes: OpenBuilds with the Still open filter on. */
export const STILL_OPEN_HREF = "/openbuilds?open=1";

/** UX-08 P3: the section shows this many topics. */
export const STILL_OPEN_SHOWN = 3;

/** UX-08 P3: the section's meta line: the reader's spaces, or all of OpenBuilds when nobody is signed in. */
export const STILL_OPEN_META = { spaces: "In your spaces", everyone: "Across OpenBuilds" } as const;
export type StillOpenScope = keyof typeof STILL_OPEN_META;

/** Synth 06: the heading is the fact: "3 open in your spaces", "3 open across OpenBuilds". */
export const STILL_OPEN_PHRASE = { spaces: "open in your spaces", everyone: "open across OpenBuilds" } as const;

/** UX-03 P6: the maker's published builds, for the room when nothing else in it has anything to show. */
export interface HomePublished {
  /** Every build the maker has published, counted in full. */
  total: number;
  /** The newest first, up to HOME_BUILD_ROWS. */
  rows: readonly { id: string; title: string; href: string; slug: string; published: string }[];
}

export interface HomeChallengeRow {
  slug: string;
  title: string;
  done: number;
  target: number;
}

export interface HomeRequestRow {
  id: string;
  title: string;
  /** UX-08 P3: "@maya · in Claude Code". */
  detail: string;
  reward: string | null;
  href: string;
}

/** UX-08 P3: the still-open topics as Home's rows: the topic's heading, `@maya · in Claude Code`, and the reward when there is one. */
export function stillOpenRows(posts: readonly Post[], limit: number = STILL_OPEN_SHOWN): HomeRequestRow[] {
  return posts.slice(0, limit).map((post) => {
    const by = post.author?.handle ? `@${post.author.handle}` : null;
    const space = post.spaces[0]?.name;
    return {
      id: post.id,
      title: splitBody(post.body).heading || "A topic",
      detail: [by, space ? `in ${space}` : null].filter(Boolean).join(" · "),
      reward: post.rewardGbp === null ? null : rewardWords(post.rewardGbp),
      href: topicHref(post.id),
    };
  });
}

export interface HomeEndCard {
  id: string;
  title: string;
  href: string;
  /** "Web app · Made with AI · No coding": plain text, empty when the build is not classified. */
  facts: string;
}

/* ── since you were last here (SV-15) ── */

/** A rebuild of the reader's build as Home's row. The person is "@handle", or their name when they have no handle. */
export function sinceRowOf(event: Extract<ActivityEvent, { kind: "rebuild" }>): HomeSinceRow {
  const who = atHandle(event.rebuilder.handle) ?? event.rebuilder.name;
  return { key: event.id, at: event.at, href: `/b2/${event.rebuildSlug}`, title: `${who} rebuilt ${event.buildTitle}`, detail: `"${event.rebuildTitle}"` };
}

/** Rebuilds of the reader's builds since the last visit. Null when there are none: the section is left out. Runs and out-of-date notes are not shown. */
export function sinceSection(events: readonly ActivityEvent[], _seenAt?: number, _now?: number): { rows: HomeSinceRow[] } | null {
  const rows = events.filter((event): event is Extract<ActivityEvent, { kind: "rebuild" }> => event.kind === "rebuild").map(sinceRowOf);
  return rows.length === 0 ? null : { rows };
}

/** "2 rebuilds of your builds". */
export const sinceHeading = (count: number): string => `${count} ${count === 1 ? "rebuild" : "rebuilds"} of your builds`;

/* ── words ── */

/** "2m", "18m", "1h", "3d", "2w", "5mo", "1y". Empty for a bad date. */
export function shortAgo(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** "@maya", or null. */
export function atHandle(handle: string | null | undefined): string | null {
  const clean = (handle ?? "").trim().replace(/^@/, "");
  return clean ? `@${clean}` : null;
}

const DAY_MS = 86_400_000;

/** "closes in 5 days", "closes tomorrow", "closes today"; empty when past or unknown. */
export function closesIn(iso: string | null, now: number): string {
  const days = daysLeft(iso, now);
  if (days === null) return "";
  if (days === 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  return `closes in ${days} days`;
}

/** "5 days left", "2 weeks left", "1 day left"; empty when past or unknown. */
export function timeLeft(iso: string | null, now: number): string {
  const days = daysLeft(iso, now);
  if (days === null) return "";
  if (days === 0) return "Last day";
  if (days >= 14) return `${Math.floor(days / 7)} weeks left`;
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

function daysLeft(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || at < now) return null;
  return Math.floor((at - now) / DAY_MS);
}

/** "1 solution", "3 solutions". */
export const solutionsLabel = (n: number) => `${n} ${n === 1 ? "solution" : "solutions"}`;

/* ── the feed ── */

const personOf = (maker: FeedItem["maker"]): HomePerson => ({
  id: maker.id,
  handle: maker.handle,
  name: (maker.name ?? "").trim() || maker.handle || "Someone",
  avatarUrl: maker.avatarUrl,
});

/** What the batch read brings for a build post: the build with its post, and what the feed row does not carry. */
export interface HomePostDetail {
  build: GalleryBuild;
  modelsUsed: readonly string[];
  classification: Classification | null;
}

export interface HomeItemContext {
  details: ReadonlyMap<string, HomePostDetail>;
  engagement: (buildId: string) => RowEngagement | undefined;
}

/** One feed row as the item Home draws. */
export function homeItemOf(item: HomeFeedRow, context: HomeItemContext): HomeFeedItem {
  const build = item.build;
  const href = `/b2/${build.slug}`;

  const detail = context.details.get(build.id);
  if (item.kind === "rebuild") {
    return {
      kind: "rebuild",
      key: item.key,
      at: item.at,
      maker: personOf(item.maker),
      note: item.note,
      source: { title: (build.source_title_at_fork ?? "").trim() || "a build", handle: build.source_handle_at_fork },
      build: detail?.build ?? build,
      plaque: build,
      engagement: context.engagement(build.id),
    };
  }

  return {
    kind: "build",
    key: item.key,
    at: item.at,
    build: detail?.build ?? build,
    maker: personOf(item.maker),
    modelsUsed: detail?.modelsUsed ?? [],
    plaque: build,
    classification: detail?.classification ?? null,
    engagement: context.engagement(build.id),
  };
}

/** How many loaded items are newer than the last visit. A first visit has none. */
export function newerThan(items: readonly Pick<FeedItem, "at">[], seen: number | null): number {
  if (seen === null) return 0;
  return items.filter((item) => {
    const at = Date.parse(item.at);
    return Number.isFinite(at) && at > seen;
  }).length;
}

/** The items shown: all of them, or, while the pill holds the new ones back, those no newer than the last visit. */
export function shownItems<T extends Pick<FeedItem, "at">>(items: readonly T[], seen: number | null, revealed: boolean): T[] {
  if (revealed || newerThan(items, seen) === 0) return [...items];
  return items.filter((item) => Date.parse(item.at) <= (seen ?? 0));
}

/** The build posts read with the first screen: at 1440 × 900 two or three posts fill it. */
export const FIRST_SCREEN_POSTS = 3;

/** The ids of the first screen's build posts, in order. */
export function firstScreenPosts(items: readonly FeedItem[]): string[] {
  return items.filter((item) => item.kind === "build").slice(0, FIRST_SCREEN_POSTS).map((item) => item.build.id);
}

/* ── your week ── */

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Monday to Sunday of the UTC week that holds `now`: active, frozen, or neither (including days still to come). */
export function weekDays(rows: readonly StreakDayRow[], now: Date): HomeDayState[] {
  const kinds = new Map(rows.map((row) => [row.date, row.kind]));
  const monday = weekStartUtc(now).getTime();
  return Array.from({ length: 7 }, (_, index) => kinds.get(isoDay(monday + index * DAY_MS)) ?? "none");
}

/**
 * The streak's length: consecutive UTC days back from today, or from yesterday while today is still open, each an active
 * day or a frozen one. Only active days count toward the length; a frozen day keeps the run unbroken.
 */
export function streakLength(rows: readonly StreakDayRow[], now: Date): number {
  const kinds = new Map(rows.map((row) => [row.date, row.kind]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let cursor = kinds.has(isoDay(today)) ? today : today - DAY_MS;
  let count = 0;
  for (let kind = kinds.get(isoDay(cursor)); kind; kind = kinds.get(isoDay(cursor))) {
    if (kind === "active") count += 1;
    cursor -= DAY_MS;
  }
  return count;
}

const RUN_CHALLENGES: ReadonlySet<string> = new Set(["run-three-new", "reconfirm-stale"]);

export function homeWeek(rows: readonly StreakDayRow[], progress: readonly ChallengeProgress[], now: Date): HomeWeek {
  return {
    days: weekDays(rows, now),
    today: (now.getUTCDay() + 6) % 7,
    streak: streakLength(rows, now),
    // The challenges that count runs and confirmations are not on Home.
    challenges: progress.filter(({ challenge }) => !RUN_CHALLENGES.has(challenge.slug)).map(({ challenge, done, target }) => ({ slug: challenge.slug, title: challenge.title, done, target })),
  };
}

/** The week's heading is its fact: "4 day streak", or the days done when there is no streak. */
export function weekHeading(week: Pick<HomeWeek, "streak" | "days">): string {
  if (week.streak > 0) return `${week.streak} day streak`;
  const active = week.days.filter((day) => day === "active").length;
  return `${active} ${active === 1 ? "day" : "days"} active this week`;
}

/** The bars' words: "Active 5 of 7 days". */
export function weekSummary(days: readonly HomeDayState[]): string {
  return `Active ${days.filter((day) => day === "active").length} of 7 days`;
}

/* ── "since you looked" ── */

/** localStorage key: when this browser last loaded Home, in epoch milliseconds. */
export const HOME_SEEN_KEY = "bg-home-seen";

export function readHomeSeen(): number | null {
  try {
    const raw = window.localStorage.getItem(HOME_SEEN_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeHomeSeen(at: number): void {
  try {
    window.localStorage.setItem(HOME_SEEN_KEY, String(at));
  } catch {
    /* private window: the count is a nicety */
  }
}
