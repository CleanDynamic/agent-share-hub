// UX-10 P1: a profile's settings, links, about and pins, as the page and Customise profile hold them.
//
// PURE. The database checks the same limits (20261109120000_ux10_profile_feed.sql: profile_settings_ok, profile_links_ok, the about
// and ALT lengths, the three pins); these say so first, in words, so a refused value costs no request. A stored value that does not
// parse falls back to its default rather than breaking the page.

import { ALT_MAX, cropOf, type MediaCrop } from "@/lib/build/thread";

export const FEED_FILTERS = ["all", "builds", "topics", "replies", "notes"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export const BUILD_DISPLAYS = ["first_post", "map"] as const;
export type BuildDisplay = (typeof BUILD_DISPLAYS)[number];

export const SIDE_KEYS = ["about", "spaces", "others", "collections", "marks"] as const;
export type SideKey = (typeof SIDE_KEYS)[number];

export const NOTES_VISIBLE = ["everyone", "followers", "only_me"] as const;
export type NotesVisible = (typeof NOTES_VISIBLE)[number];

export const LEVEL_VISIBLE = ["everyone", "only_me"] as const;
export type LevelVisible = (typeof LEVEL_VISIBLE)[number];

export interface SideSection {
  key: SideKey;
  hidden: boolean;
}

export interface ProfileSettings {
  feedFilter: FeedFilter;
  buildDisplay: BuildDisplay;
  sideSections: SideSection[];
  notesVisible: NotesVisible;
  levelVisible: LevelVisible;
}

/** The order and look a profile has before its owner changes anything. */
export const DEFAULT_SETTINGS: ProfileSettings = {
  feedFilter: "all",
  buildDisplay: "first_post",
  sideSections: SIDE_KEYS.map((key) => ({ key, hidden: false })),
  notesVisible: "everyone",
  levelVisible: "everyone",
};

export const ONE_LINE_MAX = 160;
export const ABOUT_MAX = 600;
/** Customise profile shows the about count only in its last 60 characters. */
export const ABOUT_COUNT_FROM = ABOUT_MAX - 60;
export const LINKS_MAX = 3;
export const LINK_MAX_CHARS = 200;
export const PINS_MAX = 3;
export { ALT_MAX };

const KNOWN_KEYS = ["feed_filter", "build_display", "side_sections", "notes_visible", "level_visible"] as const;

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** Every side section once, in the stored order, any section the store leaves out after it, shown. */
export function sideSectionsOf(value: unknown): SideSection[] {
  const out: SideSection[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = (entry as { key?: unknown } | null)?.key;
      if (typeof key !== "string" || !(SIDE_KEYS as readonly string[]).includes(key) || out.some((one) => one.key === key)) continue;
      out.push({ key: key as SideKey, hidden: (entry as { hidden?: unknown }).hidden === true });
    }
  }
  for (const key of SIDE_KEYS) if (!out.some((one) => one.key === key)) out.push({ key, hidden: false });
  return out;
}

/** The stored jsonb as settings, a default for anything missing or unknown. */
export function parseProfileSettings(raw: unknown): ProfileSettings {
  const s = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return {
    feedFilter: oneOf(FEED_FILTERS, s.feed_filter, DEFAULT_SETTINGS.feedFilter),
    buildDisplay: oneOf(BUILD_DISPLAYS, s.build_display, DEFAULT_SETTINGS.buildDisplay),
    sideSections: sideSectionsOf(s.side_sections),
    notesVisible: oneOf(NOTES_VISIBLE, s.notes_visible, DEFAULT_SETTINGS.notesVisible),
    levelVisible: oneOf(LEVEL_VISIBLE, s.level_visible, DEFAULT_SETTINGS.levelVisible),
  };
}

/** The settings as the database stores them. */
export function storedSettings(settings: ProfileSettings): Record<(typeof KNOWN_KEYS)[number], unknown> {
  return {
    feed_filter: settings.feedFilter,
    build_display: settings.buildDisplay,
    side_sections: settings.sideSections.map(({ key, hidden }) => ({ key, hidden })),
    notes_visible: settings.notesVisible,
    level_visible: settings.levelVisible,
  };
}

/** Why the database would refuse this jsonb as profile_settings, or null. Mirrors profile_settings_ok. */
export function settingsProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Settings must be an object.";
  const s = raw as Record<string, unknown>;
  const unknown = Object.keys(s).find((key) => !(KNOWN_KEYS as readonly string[]).includes(key));
  if (unknown) return `Unknown setting: ${unknown}.`;
  const bad = (list: readonly string[], key: string) => key in s && !(typeof s[key] === "string" && list.includes(s[key] as string));
  if (bad(FEED_FILTERS, "feed_filter")) return "Unknown feed filter.";
  if (bad(BUILD_DISPLAYS, "build_display")) return "Unknown build display.";
  if (bad(NOTES_VISIBLE, "notes_visible")) return "Unknown setting for notes.";
  if (bad(LEVEL_VISIBLE, "level_visible")) return "Unknown setting for your level.";
  if ("side_sections" in s) {
    const list = s.side_sections;
    if (!Array.isArray(list) || list.length > SIDE_KEYS.length) return "Unknown side sections.";
    const seen = new Set<string>();
    for (const entry of list) {
      const one = entry as Record<string, unknown> | null;
      if (!one || typeof one !== "object" || Object.keys(one).some((key) => key !== "key" && key !== "hidden")) return "Unknown side sections.";
      if (typeof one.key !== "string" || !(SIDE_KEYS as readonly string[]).includes(one.key) || seen.has(one.key)) return "Unknown side sections.";
      if (typeof one.hidden !== "boolean") return "Unknown side sections.";
      seen.add(one.key);
    }
  }
  return null;
}

const characters = (text: string) => [...text].length;

/** Why these links would be refused, or null: up to 3, each https:// and at most 200 characters. */
export function linksProblem(links: readonly string[]): string | null {
  if (links.length > LINKS_MAX) return `A profile holds ${LINKS_MAX} links.`;
  for (const link of links) {
    if (!/^https:\/\/\S+$/.test(link)) return "A link starts with https://.";
    if (characters(link) > LINK_MAX_CHARS) return `A link is at most ${LINK_MAX_CHARS} characters.`;
  }
  return null;
}

/** Why this about would be refused, or null. */
export function aboutProblem(about: string): string | null {
  return characters(about) > ABOUT_MAX ? `About is at most ${ABOUT_MAX} characters.` : null;
}

/** Why this one line would be refused, or null. */
export function oneLineProblem(line: string): string | null {
  return characters(line) > ONE_LINE_MAX ? `One line is at most ${ONE_LINE_MAX} characters.` : null;
}

/** Why this ALT would be refused, or null. */
export function altProblem(alt: string): string | null {
  return characters(alt) > ALT_MAX ? `A description is at most ${ALT_MAX.toLocaleString("en-US")} characters.` : null;
}

/** A link as the head shows it: the host alone, without www. */
export function linkHost(link: string): string {
  try {
    return new URL(link).host.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/** A stored {x,y,w,h} crop, or null for anything else. */
export function parseCrop(value: unknown): MediaCrop | null {
  return cropOf(value);
}

/* ── pins ── */

export type PinKind = "build" | "topic" | "reply" | "repro_note";

export interface Pin {
  kind: PinKind;
  id: string;
}

/** Why these pins would be refused, or null. */
export function pinsProblem(pins: readonly Pin[]): string | null {
  if (pins.length > PINS_MAX) return `A profile holds ${PINS_MAX} pins. Unpin one first.`;
  const keys = new Set(pins.map((pin) => `${pin.kind}:${pin.id}`));
  return keys.size === pins.length ? null : "That is pinned already.";
}

/** The pins with one moved up (-1) or down (+1); unchanged at either end. */
export function movePin<T>(pins: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (index < 0 || index >= pins.length || to < 0 || to >= pins.length) return [...pins];
  const next = [...pins];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
