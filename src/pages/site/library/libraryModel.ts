/* SV-09: what the Library view draws, worked out from the data, and where the reader is (the address).

   The address holds the kind, the tab, the selected item and the open collection (`?kind=builds&tab=…&item=…&collection=…`),
   so Back and a shared link land where the reader was. Every value is read from it during render; nothing is copied
   into state (`rerender-derived-state-no-effect`). */

import type { SavedBuild } from "@/lib/social";
import { isStale } from "@/lib/build/signals";

/* ── the kinds ── */

export type LibraryKind = "all" | "builds" | "parts" | "sessions" | "steps" | "requests" | "filter-sets";

/** The board's order: All saved first, then each kind a reader can keep. */
export const LIBRARY_KINDS: readonly { value: LibraryKind; label: string }[] = [
  { value: "all", label: "All saved" },
  { value: "builds", label: "Builds" },
  { value: "parts", label: "Parts" },
  { value: "sessions", label: "Sessions" },
  { value: "steps", label: "Steps" },
  { value: "requests", label: "Requests" },
  { value: "filter-sets", label: "Filter sets" },
];

/** The kinds with a source today: a save is a build (build_saves). Parts, Sessions, Steps, Requests and Filter sets arrive in SV-17. */
export const LIVE_KINDS: readonly LibraryKind[] = ["all", "builds"];

/** Each kind's own tabs (the board draws Steps: Steps, Changed, Removed). */
export function kindTabs(kind: LibraryKind): { value: string; label: string }[] {
  const label = kind === "all" ? "All saved" : (LIBRARY_KINDS.find((item) => item.value === kind)?.label ?? "Saved");
  return [
    { value: "all", label },
    { value: "changed", label: "Changed" },
    { value: "removed", label: "Removed" },
  ];
}

/* ── the rows ── */

export type ItemState = "same" | "edited" | "removed" | "stale";

export const STATE_WORD: Record<ItemState, string> = { same: "Same", edited: "Edited", removed: "Removed", stale: "Stale" };

export interface LibraryRow {
  id: string;
  title: string;
  /** The line under the title: "Step 7 · Call notes · @maya", or a build's outcome. */
  detail?: string | null;
  /** "Prompt", "Agent", a build's shape. */
  type: string;
  state: ItemState;
  /** Builds it is used in (SV-17). Absent: the column is not drawn. */
  usedIn?: number;
  /** "today", "yesterday", "3d ago", "1w ago", "1mo ago". */
  lastUsed: string;
}

export type ChangeTag = "EDITED" | "REMOVED" | "RUN" | "ANSWER";

export interface LibraryChange {
  id: string;
  tag: ChangeTag;
  item: string;
  detail: string;
  age: string;
}

export interface CollectionEntry {
  id: string;
  name: string;
  /** "Public", "Private", "Public · @kit", "Filter set". */
  meta: string;
  count: number;
}

const DAY = 86_400_000;

/** The board's ages: today, yesterday, 3d ago, 1w ago, 2w ago, 1mo ago, 1y ago. */
export function ageWords(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const days = Math.max(0, Math.floor((now - at) / DAY));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const capital = (word: string) => (word ? word[0].toUpperCase() + word.slice(1) : word);

/** A saved build as a table row: its shape as Type, Same or Stale, last used when it was saved. */
export function savedBuildRow({ savedAt, build }: SavedBuild, now: number): LibraryRow {
  return {
    id: build.id,
    title: build.title?.trim() || "Untitled build",
    detail: build.outcome?.trim() || null,
    type: capital(build.shape ?? "other"),
    state: isStale(build, now) ? "stale" : "same",
    lastUsed: ageWords(savedAt, now),
  };
}

/** "Public" or "Private": a reader's own collection. */
export const privacyWord = (isPrivate: boolean) => (isPrivate ? "Private" : "Public");

export const countWords = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── the address ── */

export interface LibraryAddress {
  kind: LibraryKind;
  tab: string;
  item: string | null;
  collection: string | null;
}

export function readAddress(params: URLSearchParams): LibraryAddress {
  const kind = params.get("kind");
  return {
    kind: LIBRARY_KINDS.some((item) => item.value === kind) ? (kind as LibraryKind) : "all",
    tab: params.get("tab") ?? "all",
    item: params.get("item"),
    collection: params.get("collection"),
  };
}

/** The search for a new place. A new kind or collection starts on its first tab with nothing chosen. */
export function addressSearch(params: URLSearchParams, next: Partial<LibraryAddress>): URLSearchParams {
  const search = new URLSearchParams(params);
  const set = (key: string, value: string | null | undefined, fallback?: string) => {
    if (value === undefined) return;
    if (value === null || value === fallback) search.delete(key);
    else search.set(key, value);
  };
  if (next.kind !== undefined || next.collection !== undefined) {
    search.delete("tab");
    search.delete("item");
  }
  if (next.kind !== undefined) search.delete("collection");
  set("kind", next.kind, "all");
  set("collection", next.collection);
  if (next.tab !== undefined) search.delete("item");
  set("tab", next.tab, "all");
  set("item", next.item);
  return search;
}
