/* UX-10: the profile as a feed. The pure rules the head, the feed and the side column follow: what each line says, what drops
   out, which filter options show, how a build is drawn. NOTHING HERE FETCHES. */

import type { BuildDisplay, FeedFilter } from "@/lib/profile/settings";

/** 1,284: `en-GB` grouping everywhere a count is printed. */
const count = (n: number): string => n.toLocaleString("en-GB");
const plural = (n: number, one: string, many: string = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

/** "Feb 2026" from a timestamp; null for one that is not a date. */
export function joinedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/* ── the head ── */

export interface MetaPart {
  key: "handle" | "place" | "joined" | "followers" | "following";
  text: string;
  /** The followers and following parts link to their lists. */
  to?: string;
}

/** `@maya · Leeds · joined Feb 2026 · 412 followers · 180 following`: the parts that exist; a zero count drops out. */
export function metaParts(input: { handle: string; place: string | null; joined: string | null; followers: number; following: number }): MetaPart[] {
  const parts: MetaPart[] = [];
  if (input.handle) parts.push({ key: "handle", text: `@${input.handle}` });
  if (input.place?.trim()) parts.push({ key: "place", text: input.place.trim() });
  if (input.joined) parts.push({ key: "joined", text: `joined ${input.joined}` });
  if (input.followers > 0) parts.push({ key: "followers", text: plural(input.followers, "follower"), to: `/profile/${input.handle}/followers` });
  if (input.following > 0) parts.push({ key: "following", text: `${count(input.following)} following`, to: `/profile/${input.handle}/following` });
  return parts;
}

export interface RecordFigures {
  builds: number;
  reproducedByOthers: number;
  rebuiltFrom: number;
  firstRebuildSlug: string | null;
  topicsAndReplies: number;
}

export interface RecordPart {
  key: "builds" | "reproduced" | "rebuilt" | "topics";
  text: string;
  to: string;
  /** Only "reproduced by others" is in the evidence colour. */
  evidence: boolean;
}

/** `14 builds · 9 reproduced by others · rebuilt from 6 times · 31 topics and replies`; a zero part drops out. */
export function recordParts(handle: string, figures: RecordFigures): RecordPart[] {
  const feed = (show: FeedFilter) => `/profile/${handle}?show=${show}`;
  const parts: RecordPart[] = [];
  if (figures.builds > 0) parts.push({ key: "builds", text: plural(figures.builds, "build"), to: feed("builds"), evidence: false });
  if (figures.reproducedByOthers > 0) parts.push({ key: "reproduced", text: `${count(figures.reproducedByOthers)} reproduced by others`, to: feed("builds"), evidence: true });
  if (figures.rebuiltFrom > 0) {
    parts.push({
      key: "rebuilt",
      text: `rebuilt from ${plural(figures.rebuiltFrom, "time")}`,
      to: figures.firstRebuildSlug ? `/b2/${figures.firstRebuildSlug}` : feed("builds"),
      evidence: false,
    });
  }
  if (figures.topicsAndReplies > 0) {
    parts.push({ key: "topics", text: `${count(figures.topicsAndReplies)} ${figures.topicsAndReplies === 1 ? "topic or reply" : "topics and replies"}`, to: feed("topics"), evidence: false });
  }
  return parts;
}

/** One line about them: up to 160 characters, on one line. */
export const ONE_LINE_SHOWN = 160;
export function oneLineOf(bio: string | null | undefined): string | null {
  const line = (bio ?? "").replace(/\s+/g, " ").trim();
  if (!line) return null;
  const chars = [...line];
  return chars.length > ONE_LINE_SHOWN ? `${chars.slice(0, ONE_LINE_SHOWN - 1).join("")}…` : line;
}

/** A link as the head shows it: the host alone, without www. */
export function linkHostOf(link: string): string {
  try {
    return new URL(link).host.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/** `@maya's profile is private.` */
export const privateLine = (handle: string): string => `@${handle}'s profile is private.`;

/* ── the feed ── */

export const FEED_OPTIONS: readonly { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "builds", label: "Builds" },
  { value: "topics", label: "Topics" },
  { value: "replies", label: "Replies" },
  { value: "notes", label: "Notes" },
];

export interface KindCounts {
  builds: number;
  topics: number;
  replies: number;
  notes: number;
}

/** The filter's options: an option with no items is hidden, All never is. Unknown counts hide nothing. */
export function feedOptions(counts: KindCounts | null): { value: FeedFilter; label: string }[] {
  return FEED_OPTIONS.filter((option) => option.value === "all" || !counts || counts[option.value] > 0);
}

/** The filter the feed opens on: `?show=` wins, then the owner's, then All; an option that is hidden falls back to All. */
export function shownFilter(param: string | null, ownerDefault: FeedFilter, counts: KindCounts | null): FeedFilter {
  const options = feedOptions(counts).map((option) => option.value);
  const asked = FEED_OPTIONS.some((option) => option.value === param) ? (param as FeedFilter) : ownerDefault;
  return options.includes(asked) ? asked : "all";
}

/** How a build shows: its own choice, else the owner's, else its first post when it has one; with no first post, its Map card. */
export function buildDisplayOf(own: BuildDisplay | null, ownerDefault: BuildDisplay | null, hasFirstPost: boolean): BuildDisplay {
  const chosen = own ?? ownerDefault ?? "first_post";
  return chosen === "first_post" && !hasFirstPost ? "map" : chosen;
}

export interface EmptyFeed {
  line: string;
  /** On your own profile, one action. */
  action: { label: string; to: string } | null;
}

/** An empty filter: one sentence and, on your own profile, one action. */
export function emptyFeed(filter: FeedFilter, own: boolean): EmptyFeed {
  switch (filter) {
    case "builds":
      return { line: "No builds yet.", action: own ? { label: "New build", to: "/compose/new" } : null };
    case "topics":
      return { line: "No topics yet.", action: own ? { label: "New topic", to: "/openbuilds?new=1" } : null };
    case "replies":
      return { line: "No replies yet.", action: null };
    case "notes":
      return { line: "No notes yet.", action: null };
    default:
      return { line: "Nothing here yet.", action: own ? { label: "New build", to: "/compose/new" } : null };
  }
}

/** `Replied to @kit in <space>`, or `Replied to @kit's topic` when the topic is in no space. */
export function repliedToLine(rootHandle: string | null, spaceName: string | null): string {
  const who = rootHandle ? `@${rootHandle}` : "someone";
  return spaceName ? `Replied to ${who} in ${spaceName}` : `Replied to ${who}'s topic`;
}

/** `Reproduced @kit's Podcast clipper on Opus 5.5: ` then `it worked` or `it didn't work`. */
export function noteHeading(makerHandle: string | null, title: string, model: string | null): string {
  const whose = makerHandle ? `@${makerHandle}'s ` : "";
  return `Reproduced ${whose}${title}${model ? ` on ${model}` : ""}: `;
}

/** `Rebuilt from @maya`, or the source's title when the handle is not known. */
export function rebuiltFromLine(handle: string | null, title: string | null): string | null {
  if (handle) return `Rebuilt from @${handle}`;
  return title?.trim() ? `Rebuilt from ${title.trim()}` : null;
}

/* ── the side column ── */

export const STANDING_LABEL = { created: "Created", moderator: "Moderator", member: "Member" } as const;

export interface OthersLine {
  key: "rebuilt" | "steps" | "topics";
  text: string;
  to: string;
}

/** What others did with it: up to three lines, each dropping out at zero. */
export function othersLines(handle: string, figures: { rebuiltFrom: number; firstRebuildSlug: string | null; stepsAdded: number; topicsStarted: number }): OthersLine[] {
  const lines: OthersLine[] = [];
  if (figures.rebuiltFrom > 0) lines.push({ key: "rebuilt", text: `Rebuilt from here ${plural(figures.rebuiltFrom, "time")}`, to: figures.firstRebuildSlug ? `/b2/${figures.firstRebuildSlug}` : `/profile/${handle}?show=builds` });
  if (figures.stepsAdded > 0) lines.push({ key: "steps", text: `Steps added to ${plural(figures.stepsAdded, "other draft")}`, to: `/profile/${handle}?show=builds` });
  if (figures.topicsStarted > 0) lines.push({ key: "topics", text: `Started ${plural(figures.topicsStarted, "topic")}`, to: "/openbuilds" });
  return lines;
}

/** At most this many spaces before Show all. */
export const SPACES_SHOWN = 5;
