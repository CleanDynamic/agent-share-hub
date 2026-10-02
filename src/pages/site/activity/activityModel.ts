/* UI-P35 — the Activity page's pure pieces: the kinds it draws a badge for, the
   days it groups by, the filter, and one notification as the row the view draws.

   THE KINDS ARE THE ONES THE DATABASE WRITES. The reference draws nine, and all
   nine are `BUILD_NOTIFICATION_KINDS` (RC-P19, 20261001200000): rc_notify writes
   them with the build in `metadata.build_id`. Older client-written kinds
   (`new_follower`, `engagement`, `bounty_interaction`, messages, mentions,
   system notices) still show, with their stored message and no badge: they have
   no drawn kind, so none is invented for them.

   WHAT A ROW SAYS. Who (the actor's handle), what (a short verb, so the build's
   title reads inline after it, as drawn), which build (its title, read live),
   and a detail only when the stored message says more than the verb: rc_notify's
   messages are fixed text, so a run's says whether it worked and the rest repeat
   the verb. A message that is not one of those fixed texts is shown whole. */

import {
  BUILD_NOTIFICATION_KINDS,
  isBuildNotificationKind,
  notificationHref,
  notificationMessage,
  type BuildNotificationKind,
  type Notification,
} from "@/lib/notifications";

/* ── the kinds ── */

export type ActivityKind = BuildNotificationKind;

/** The "Show me" panel's order, as the reference lists the kinds. */
export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  "reproduced",
  "rebuilt",
  "solution",
  "solved",
  "comment",
  "reply",
  "like",
  "follow",
  "published",
];

/** The phone's chips after "All": one kind each, as the mobile board draws them. */
export const PHONE_CHIPS: ReadonlyArray<{ kind: ActivityKind; label: string }> = [
  { kind: "reproduced", label: "Reproduced" },
  { kind: "rebuilt", label: "Rebuilt" },
  { kind: "solution", label: "Solutions" },
  { kind: "comment", label: "Comments" },
  { kind: "follow", label: "Follows" },
];

export type KindCounts = Readonly<Record<ActivityKind, number>>;

export const NO_KIND_COUNTS: KindCounts = Object.fromEntries(
  BUILD_NOTIFICATION_KINDS.map((kind) => [kind, 0]),
) as unknown as KindCounts;

/** How many of the loaded rows are of each kind. */
export function countKinds(rows: ReadonlyArray<{ kind: ActivityKind | null }>): KindCounts {
  const counts: Record<ActivityKind, number> = { ...NO_KIND_COUNTS };
  for (const row of rows) if (row.kind) counts[row.kind] += 1;
  return counts;
}

/** None chosen shows everything; otherwise a row shows when its kind is chosen. */
export function matchesKinds(kind: ActivityKind | null, chosen: ReadonlySet<ActivityKind>): boolean {
  return chosen.size === 0 || (kind !== null && chosen.has(kind));
}

/** The set with `kind` turned on or off. */
export function toggleKind(chosen: ReadonlySet<ActivityKind>, kind: ActivityKind): Set<ActivityKind> {
  const next = new Set(chosen);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  return next;
}

/* ── the rows ── */

export interface ActivityActor {
  /** Seeds the avatar's hue. */
  id: string;
  /** The avatar's initials and accessible name. */
  name: string;
  avatarUrl?: string | null;
  /** Force a hue, 0 to 5 (the dev fixtures). */
  hue?: number;
}

export interface ActivityCover {
  /** The signed thumbnail, or null for the fallback landscape. */
  src: string | null;
  /** The build id: the fallback's sky. */
  seed: string;
  sky?: number;
}

export interface ActivityRow {
  id: string;
  /** Null for a kind with no drawn badge. */
  kind: ActivityKind | null;
  /** ISO time it happened. */
  at: string;
  actor: ActivityActor;
  /** Who did what: the Figtree run before the title. */
  who: string;
  /** The build's title, inline after `who`. */
  title: string | null;
  /** The mono line under it. */
  detail: string | null;
  /** Null when the row is about no build: the track stays empty. */
  cover: ActivityCover | null;
  unread: boolean;
  /** Where the row leads, or null when it leads nowhere. */
  href: string | null;
}

/** The verb each kind is told with, before the build's title. */
const LEAD: Record<ActivityKind, string> = {
  reproduced: "ran",
  rebuilt: "rebuilt",
  solution: "posted a solution to your bounty on",
  solved: "accepted your solution on",
  comment: "commented on",
  reply: "replied to your comment on",
  like: "liked",
  follow: "started following you",
  published: "published",
};

/**
 * rc_notify's fixed messages, per kind (20261001200000_rc_build_notifications.sql).
 * A run's two say whether it worked, which the verb does not; the rest say no
 * more than the verb.
 */
const FIXED: Record<ActivityKind, Readonly<Record<string, string | null>>> = {
  reproduced: {
    "ran your build and it worked": "it worked",
    "ran your build and it did not work": "it did not work",
  },
  rebuilt: { "rebuilt your build": null },
  published: { "published a new build": null },
  comment: { "commented on your build": null },
  reply: { "replied to your comment": null },
  like: { "liked your build": null },
  solution: { "posted a solution to your bounty": null },
  solved: { "accepted your solution": null },
  follow: { "started following you": null },
};

/** "@handle", else their name, else null. */
function actorLabel(n: Pick<Notification, "actor">): string | null {
  const handle = n.actor?.username?.trim();
  if (handle) return `@${handle.replace(/^@/, "")}`;
  return n.actor?.display_name?.trim() || null;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The mono line: what the stored message adds to the verb, or the message itself when it is not a fixed one. */
function detailOf(kind: ActivityKind, stored: string): string | null {
  if (!stored) return null;
  const fixed = FIXED[kind];
  return Object.prototype.hasOwnProperty.call(fixed, stored) ? fixed[stored] : stored;
}

/** One notification as the row the view draws. `coverSrc` is the signed thumbnail, when there is one. */
export function activityRowOf(n: Notification, coverSrc: string | null): ActivityRow {
  const kind = isBuildNotificationKind(n.kind) ? n.kind : null;
  const name = actorLabel(n);
  const message = notificationMessage(n);
  const stored = n.body?.trim() ?? "";
  const title = kind !== null && kind !== "follow" ? n.build?.title?.trim() || null : null;

  let who: string;
  let detail: string | null = null;
  if (kind === null) {
    // No drawn kind: its stored message, which names its own actor — except a
    // direct message's, which is only the verb.
    who = n.kind === "message_received" && name ? `${name} ${message}` : message;
  } else if (kind !== "follow" && title === null) {
    // The build has gone, or this reader cannot read it: the message says what
    // happened, with nothing to hang a title on.
    who = name ? `${name} ${message}` : capitalise(message);
  } else {
    who = `${name ?? "Someone"} ${LEAD[kind]}`;
    detail = detailOf(kind, stored);
  }

  return {
    id: n.id,
    kind,
    at: n.created_at,
    actor: {
      id: n.actor?.id ?? n.actor_id ?? n.id,
      name: n.actor?.display_name?.trim() || n.actor?.username?.trim() || "Someone",
      avatarUrl: n.actor?.avatar_url ?? null,
    },
    who,
    title,
    detail,
    cover: n.build ? { src: coverSrc, seed: n.build.id } : null,
    unread: !n.is_read,
    href: notificationHref(n),
  };
}

/* ── the days ── */

export const ACTIVITY_DAYS = ["Today", "Yesterday", "Earlier this week", "Earlier"] as const;
export type ActivityDay = (typeof ACTIVITY_DAYS)[number];

export interface ActivityGroup {
  day: ActivityDay;
  rows: ActivityRow[];
}

/**
 * The viewer's local day a row falls in. The week starts on Monday, as the
 * week's challenges do; on a Monday, "Earlier this week" is empty. Midnights
 * are built from the calendar, never by subtracting 24 hours, so a change of
 * clocks moves nothing into the wrong day.
 */
export function dayOf(at: string, now: Date): ActivityDay {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return "Earlier";
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (time >= new Date(y, m, d).getTime()) return "Today";
  if (time >= new Date(y, m, d - 1).getTime()) return "Yesterday";
  if (time >= new Date(y, m, d - ((now.getDay() + 6) % 7)).getTime()) return "Earlier this week";
  return "Earlier";
}

/** The rows under their days, in day order, keeping each day's own order. Empty days are left out. */
export function groupByDay(rows: readonly ActivityRow[], now: Date): ActivityGroup[] {
  const byDay = new Map<ActivityDay, ActivityRow[]>();
  for (const row of rows) {
    const day = dayOf(row.at, now);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  return ACTIVITY_DAYS.filter((day) => byDay.has(day)).map((day) => ({ day, rows: byDay.get(day)! }));
}

/** The groups with only the chosen kinds' rows; a day left empty goes. */
export function filterGroups(groups: readonly ActivityGroup[], chosen: ReadonlySet<ActivityKind>): ActivityGroup[] {
  if (chosen.size === 0) return [...groups];
  return groups
    .map((group) => ({ day: group.day, rows: group.rows.filter((row) => matchesKinds(row.kind, chosen)) }))
    .filter((group) => group.rows.length > 0);
}

/* ── the words around the list ── */

const count = (n: number) => n.toLocaleString("en-GB");

/** The list's subtitle: "3 unread · live", the second half only while the channel is live. */
export function unreadLine(unread: number, live: boolean): string {
  return `${count(unread)} unread${live ? " · live" : ""}`;
}

/** The phone's heading. */
export function unreadHeading(unread: number): string {
  return unread === 0 ? "All caught up" : `${count(unread)} unread`;
}

/** The chart's subtitle; the second clause only when a rebuild went live inside the window. */
export function chartSubtitle(rebuildLiveIndex: number | null): string {
  return rebuildLiveIndex === null ? "Last 90 days" : "Last 90 days · dashed line: your rebuild went live";
}

/** A series of counts scaled to 0–1 against its largest day, as the charts take it. All zeros stay zeros. */
export function scaleSeries(series: readonly number[]): number[] {
  const top = series.reduce((max, value) => (Number.isFinite(value) && value > max ? value : max), 0);
  return series.map((value) => (top > 0 && Number.isFinite(value) ? Math.max(0, value) / top : 0));
}

/** The chart's accessible name: what it shows, in words. */
export function runsLabel(series: readonly number[], rebuildLiveIndex: number | null): string {
  const total = series.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const runs = `${count(total)} ${total === 1 ? "run" : "runs"} of your builds in the last ${series.length} days`;
  if (rebuildLiveIndex === null) return runs;
  const daysAgo = series.length - 1 - rebuildLiveIndex;
  const when = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
  return `${runs}; a rebuild of your work went live ${when}`;
}
