/* SV-10: Home's view model: the shapes `HomeView` takes, and the pure functions that turn what the data layer returns
   into them.

   NOTHING HERE FETCHES. `HomePage` loads, these map, `HomeView` draws; the dev page `vision-home` builds the same shapes
   from the board's sample data. */

import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import type { GalleryBuild } from "@/lib/build/gallery";
import type { WhereNextItem } from "@/lib/build/whereNext";
import type { Classification } from "@/lib/classify/types";
import type { FeedItem, FeedItemKind } from "@/lib/feed/getBuildFeed";
import type { StreakDayRow } from "@/lib/progress";
import { weekStartUtc, type ChallengeProgress } from "@/lib/progress/weekly";

/* ── the feed's kind filter ── */

export type HomeFilter = "all" | "builds" | "rebuilds" | "notes" | "asks";

export const HOME_FILTERS: readonly { value: HomeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "builds", label: "Builds" },
  { value: "rebuilds", label: "Rebuilds" },
  { value: "notes", label: "Notes" },
  { value: "asks", label: "Asks" },
];

const KIND_OF_FILTER: Record<Exclude<HomeFilter, "all">, FeedItemKind> = {
  builds: "build",
  rebuilds: "rebuild",
  notes: "repro_note",
  asks: "bounty",
};

/** The filters act on what is loaded, on `kind`, and on nothing else. */
export function matchesFilter(kind: FeedItemKind, filter: HomeFilter): boolean {
  return filter === "all" || KIND_OF_FILTER[filter] === kind;
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

export interface HomeAskPost {
  kind: "bounty";
  key: string;
  at: string;
  maker: HomePerson;
  bountyId: string;
  /** The gap's title, or the build's when the ask names no gap. */
  title: string;
  /** "£40", or null for an unpriced ask. */
  reward: string | null;
  buildTitle: string;
  buildHref: string;
  /** Known only when the ask is among the open requests read. */
  solutions: number | null;
  closesAt: string | null;
  meToo: { count: number | null; pressed: boolean } | null;
}

export type HomeFeedItem = HomeBuildPost | HomeReproNote | HomeRebuildPost | HomeAskPost;

/* ── the columns' rows ── */

export type HomeSinceTone = "worked" | "failed" | "rebuild" | "answer";

export interface HomeSinceRow {
  key: string;
  tone: HomeSinceTone;
  title: string;
  detail: string;
  at: string;
}

export interface HomeDraftRow {
  id: string;
  title: string;
  untitled: boolean;
  /** "4 sessions · edited 1h ago". */
  meta: string;
}

export interface HomeSessionRow {
  id: string;
  /** The first prompt. */
  title: string;
  /** "Claude Code · 8 Oct · In 4 drafts". */
  meta: string;
  client: string | null;
  model: string | null;
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

export interface HomeChallengeRow {
  slug: string;
  title: string;
  done: number;
  target: number;
}

export interface HomeRunRow {
  key: string;
  worked: boolean;
  buildTitle: string;
  handle: string | null;
  href: string;
  at: string;
}

export interface HomeRequestRow {
  id: string;
  title: string;
  /** "Research brief · 5 days left". */
  detail: string;
  reward: string | null;
  href: string;
}

export interface HomeMostRunRow {
  buildId: string;
  title: string;
  href: string;
  maker: HomePerson;
  count: number;
}

export interface HomeCover {
  /** A signed URL, or null: the view draws the dot-grid well. */
  src: string | null;
}

export interface HomeWhereNextRow {
  id: string;
  title: string;
  href: string;
  /** "SAME TOOL · OPUS-5.5". */
  reason: string;
  cover: HomeCover;
}

export interface HomeEndCard {
  id: string;
  title: string;
  href: string;
  plaque: PlaqueBuild;
  cover: HomeCover;
}

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

/** "14 runs", "1 run". */
export const runsLabel = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "run" : "runs"}`;

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

/** What the open requests read knows about an ask. */
export interface HomeAskDetail {
  solutions: number;
  closesAt: string | null;
  meTooCount: number;
}

export interface HomeItemContext {
  details: ReadonlyMap<string, HomePostDetail>;
  asks: ReadonlyMap<string, HomeAskDetail>;
  engagement: (buildId: string) => RowEngagement | undefined;
  meTooPressed: ReadonlySet<string>;
}

/** One feed row as the item Home draws. */
export function homeItemOf(item: FeedItem, context: HomeItemContext): HomeFeedItem {
  const build = item.build;
  const href = `/b2/${build.slug}`;

  if (item.kind === "repro_note") {
    return {
      kind: "repro_note",
      key: item.key,
      at: item.at,
      // A note's runner is the reproducer, whose id the row does not carry: their handle seeds the hue.
      runner: { id: item.handle ?? item.key, handle: item.handle, name: item.handle ?? "Someone" },
      buildTitle: item.title,
      href,
      model: (item.model ?? "").trim() || null,
      note: item.note,
      worked: item.worked,
    };
  }

  if (item.kind === "bounty") {
    const ask = context.asks.get(item.bountyId);
    return {
      kind: "bounty",
      key: item.key,
      at: item.at,
      maker: personOf(item.maker),
      bountyId: item.bountyId,
      title: (item.gapTitle ?? "").trim() || build.title,
      reward: item.reward === null || item.reward === undefined ? null : rewardLabel(item.reward),
      buildTitle: build.title,
      buildHref: href,
      solutions: ask ? ask.solutions : null,
      closesAt: ask ? ask.closesAt : null,
      meToo: item.bountyId ? { count: ask ? ask.meTooCount : null, pressed: context.meTooPressed.has(item.bountyId) } : null,
    };
  }

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

/** The latest runs: the feed's own notes, newest first. */
export function runRows(items: readonly FeedItem[], limit = 3): HomeRunRow[] {
  const out: HomeRunRow[] = [];
  for (const item of items) {
    if (item.kind !== "repro_note") continue;
    out.push({ key: item.key, worked: item.worked, buildTitle: item.title, handle: item.handle, href: `/b2/${item.slug}`, at: item.at });
    if (out.length === limit) break;
  }
  return out;
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

export function homeWeek(rows: readonly StreakDayRow[], progress: readonly ChallengeProgress[], now: Date): HomeWeek {
  return {
    days: weekDays(rows, now),
    today: (now.getUTCDay() + 6) % 7,
    streak: streakLength(rows, now),
    challenges: progress.map(({ challenge, done, target }) => ({ slug: challenge.slug, title: challenge.title, done, target })),
  };
}

/** "3 day streak · resets Monday 00:00 UTC". */
export function weekMeta(streak: number): string {
  return streak > 0 ? `${streak} day streak · resets Monday 00:00 UTC` : "Resets Monday 00:00 UTC";
}

/** The bars' words: "Active 5 of 7 days". */
export function weekSummary(days: readonly HomeDayState[]): string {
  return `Active ${days.filter((day) => day === "active").length} of 7 days`;
}

/* ── where next ── */

/** The caps line under a suggestion. */
export function reasonLabel(item: Pick<WhereNextItem, "reason" | "reasonDetail">): string {
  const detail = item.reasonDetail.trim().toUpperCase();
  if (item.reason === "same_tool") return `SAME TOOL · ${detail}`;
  if (item.reason === "more_from_maker") return `MORE FROM ${detail}`;
  return "REBUILT FROM ONE YOU RAN";
}

export function whereNextRows(items: readonly WhereNextItem[], coverSrc: (item: WhereNextItem) => string | null): HomeWhereNextRow[] {
  return items.map((item) => ({
    id: item.build.id,
    title: item.build.title,
    href: `/b2/${item.build.slug}`,
    reason: reasonLabel(item),
    cover: { src: coverSrc(item) },
  }));
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
