/* UI-P27 — Home's view model: the shapes `HomeView` takes, and the pure
   functions that turn what the data layer returns into them.

   NOTHING HERE FETCHES. `HomePage` loads, these map, `HomeView` draws; the dev
   compare page builds the same shapes from the sample data. */

import type { PlaqueBuild } from "@/components/brand/Plaque";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import type { FeedItem, FeedItemKind } from "@/lib/feed/getBuildFeed";
import type { StreakDayRow } from "@/lib/progress";
import { weekStartUtc, type ChallengeEvent, type ChallengeProgress } from "@/lib/progress/weekly";
import type { WhereNextItem } from "@/lib/build/whereNext";

/* ── the visitors' book ── */

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

/** The kind's label, as the book prints it (DM Mono, caps). */
export const KIND_LABEL: Record<FeedItemKind, string> = {
  build: "BUILD",
  rebuild: "REBUILD",
  repro_note: "REPRO NOTE",
  bounty: "BOUNTY",
};

export interface HomeActor {
  /** Stable: chooses the avatar hue. */
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Force a hue (0–5). The dev fixtures pass it. */
  hue?: number;
}

export interface HomeCover {
  /** A signed URL, or null when there is none (or it has not arrived): the view draws `CoverFallback`. */
  src: string | null;
  /** The build id: chooses the fallback sky. */
  seed: string;
  /** Force a sky (0–5). The dev fixtures pass it. */
  sky?: number;
}

export interface HomeFeedRow {
  key: string;
  kind: FeedItemKind;
  /** The keyset cursor and the row's time: ISO. */
  at: string;
  actor: HomeActor;
  /** "@maya hung", "@kofi rebuilt Call notes →", … */
  who: string;
  title: string;
  plaque: PlaqueBuild;
  cover: HomeCover;
  href: string;
}

export interface HomeChallengeRow {
  slug: string;
  title: string;
  done: number;
  target: number;
  /** What the bar's colour means: running builds, solving a gap, re-confirming. */
  meaning: "run" | "solve" | "reconfirm";
  /** Shown as "+n xp" when given. The live page passes none: completing a challenge pays no XP. */
  xp?: number;
}

export type HomeDayState = "active" | "frozen" | "none";

export interface HomeStreak {
  count: number;
  frozenUsed: number;
  /** Monday to Sunday of the current UTC week. */
  week: readonly HomeDayState[];
}

export interface HomeWhereNextRow {
  id: string;
  title: string;
  href: string;
  /** "SAME TOOL · SONNET-4.5". */
  reason: string;
  /** 0 to 1, oldest first. */
  spark: readonly number[];
  cover: HomeCover;
}

/* ── words ── */

/** "2m", "18m", "1h", "3d", "2w", "5mo", "1y": the book's right-hand column. Empty for a bad date. */
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

const handleOf = (handle: string | null | undefined): string | null => {
  const clean = (handle ?? "").trim().replace(/^@/, "");
  return clean ? `@${clean}` : null;
};

/** The one line under the kind: who did what, and for a note, what they said. */
export function whoLine(item: FeedItem): string {
  const maker = handleOf(item.maker.handle) ?? item.maker.name ?? "Someone";

  if (item.kind === "build") return `${maker} hung`;

  if (item.kind === "rebuild") {
    const source = (item.build.source_title_at_fork ?? "").trim();
    return source ? `${maker} rebuilt ${source} →` : `${maker} rebuilt a build →`;
  }

  if (item.kind === "repro_note") {
    const who = handleOf(item.handle) ?? "Someone";
    const model = (item.model ?? "").trim();
    const note = item.note.trim();
    return `${who} ran ${item.title}${model ? ` on ${model}` : ""}${note ? ` — “${note}”` : ""}`;
  }

  const part = (item.gapTitle ?? "").trim();
  const reward = rewardLabel(item.reward);
  return [`${maker} opened an ask`, part, reward].filter(Boolean).join(" · ");
}

/** One feed item as the row the book draws. `coverSrc` is the signed URL, when there is one. */
export function homeRowOf(item: FeedItem, coverSrc: string | null): HomeFeedRow {
  const build = item.build;
  // A note's actor is the reproducer, whose id the row does not carry: their handle seeds the hue.
  const actor: HomeActor =
    item.kind === "repro_note"
      ? { id: item.handle ?? item.maker.id, name: item.handle ?? "Someone" }
      : {
          id: item.maker.id,
          name: item.maker.name ?? item.maker.handle ?? "Someone",
          avatarUrl: item.maker.avatarUrl,
        };

  return {
    key: item.key,
    kind: item.kind,
    at: item.at,
    actor,
    who: whoLine(item),
    title: build.title,
    plaque: build,
    cover: { src: coverSrc, seed: build.id },
    // A bounty has no page of its own: the open ask hangs on its build.
    href: `/b2/${build.slug}`,
  };
}

/* ── challenges ── */

const MEANING: Record<ChallengeEvent, HomeChallengeRow["meaning"]> = {
  run_reported: "run",
  solution_accepted: "solve",
  build_reconfirmed: "reconfirm",
};

export function challengeRows(progress: readonly ChallengeProgress[]): HomeChallengeRow[] {
  return progress.map(({ challenge, done, target }) => ({
    slug: challenge.slug,
    title: challenge.title,
    done,
    target,
    meaning: MEANING[challenge.event],
  }));
}

/* ── the streak ── */

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Monday to Sunday of the UTC week that holds `now`: lit, frozen, or neither (including days still to come). */
export function weekDays(rows: readonly StreakDayRow[], now: Date): HomeDayState[] {
  const kinds = new Map(rows.map((row) => [row.date, row.kind]));
  const monday = weekStartUtc(now).getTime();
  return Array.from({ length: 7 }, (_, index) => kinds.get(isoDay(monday + index * DAY_MS)) ?? "none");
}

/**
 * The streak as the ledger shows it: consecutive UTC days back from today —
 * or from yesterday while today is still open — each an active day or a frozen
 * one. Only active days count toward the length (the database adds one per
 * active day); a frozen day keeps the run unbroken and is counted as used.
 */
export function streakOf(rows: readonly StreakDayRow[], now: Date): HomeStreak {
  const kinds = new Map(rows.map((row) => [row.date, row.kind]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  let cursor = kinds.has(isoDay(today)) ? today : today - DAY_MS;
  let count = 0;
  let frozenUsed = 0;
  for (let kind = kinds.get(isoDay(cursor)); kind; kind = kinds.get(isoDay(cursor))) {
    if (kind === "active") count += 1;
    else frozenUsed += 1;
    cursor -= DAY_MS;
  }

  return { count, frozenUsed, week: weekDays(rows, now) };
}

/** "no frozen days used", "one frozen day used", "3 frozen days used". */
export function frozenLabel(used: number): string {
  if (used <= 0) return "no frozen days used";
  if (used === 1) return "one frozen day used";
  return `${used} frozen days used`;
}

/* ── where next ── */

/** The caps line under a suggestion. */
export function reasonLabel(item: Pick<WhereNextItem, "reason" | "reasonDetail">): string {
  const detail = item.reasonDetail.trim().toUpperCase();
  if (item.reason === "same_tool") return `SAME TOOL · ${detail}`;
  if (item.reason === "more_from_maker") return `MORE FROM ${detail}`;
  return "REBUILT FROM ONE YOU RAN";
}

/** Daily counts scaled to 0–1 for the sparkline; an all-zero week is a flat line along the bottom. */
export function sparkValues(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((count) => (max > 0 ? count / max : 0));
}

export function whereNextRows(items: readonly WhereNextItem[], coverSrc: (item: WhereNextItem) => string | null): HomeWhereNextRow[] {
  return items.map((item) => ({
    id: item.build.id,
    title: item.build.title,
    href: `/b2/${item.build.slug}`,
    reason: reasonLabel(item),
    spark: sparkValues(item.spark),
    cover: { src: coverSrc(item), seed: item.build.id },
  }));
}

/* ── "since you were last here" ── */

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
    /* private window: the highlight is a nicety */
  }
}

/** The first row is highlighted when it is newer than the previous visit. A first visit highlights nothing. */
export function isNewerThanSeen(firstAt: string | undefined, seen: number | null): boolean {
  if (!firstAt || seen === null) return false;
  const at = Date.parse(firstAt);
  return Number.isFinite(at) && at > seen;
}
