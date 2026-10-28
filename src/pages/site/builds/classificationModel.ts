/* SV-13: what a Classification card says, and which facets it shows. PURE, but for the choice's two storage functions.

   WHERE A VALUE COMES FROM. A derived facet reads "from n tiles" (the tiles `derive.ts` read it from), a value the maker
   chose reads "stated", and a facet the maker corrected reads "corrected". `shownValues` folds a correction into
   "stated"; the board tells the two apart, so a correction is read from `disputes` here. A derived facet whose tile ids
   were not kept reads "derived" and never "from 0 tiles". A facet with nothing in it has no source.

   WHAT LINKS. A value from a list links to the Table filtered by it (`field:<id>`); the maker's own words have no id to
   filter by and are plain text. Where a link goes is the page's to say (`hrefOf`), so this knows no address.

   WHICH FACETS. The 15 facets in the taxonomy's order, the board's eight by default. The choice is the viewer's, kept in
   `localStorage` under a versioned key holding only the facet ids (`client-localstorage-schema`); every read and write
   is in try/catch, and a choice that cannot be read is the default eight. */

import type { BuildsTableBuild } from "@/lib/build/gallery";
import { isStale } from "@/lib/build/signals";
import { regulatedArea, shownValues } from "@/lib/classify/facets";
import { REGULATED_TAG, labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, FACETS, isKnown, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Classification, type Entry } from "@/lib/classify/types";

import { shapeWord } from "./buildsModel";

/** The board's eight, in the taxonomy's order. */
export const DEFAULT_FACETS: readonly Facet[] = ["field", "task", "built", "technique", "autonomy", "stack", "data", "cost"];

export const ALL_FACETS: readonly Facet[] = FACETS;

export interface ClassValueView {
  label: string;
  /** The Table filtered by it; null for the maker's own words. */
  href: string | null;
}

export interface ClassRowView {
  facet: Facet;
  /** "What was built". */
  name: string;
  /** "from 3 tiles", "stated", "corrected", "derived", or "" when the facet holds nothing. */
  source: string;
  values: ClassValueView[];
}

export interface ClassCardView {
  id: string;
  href: string;
  title: string;
  /** "@maya · Workflow · Regulated area". */
  subtitle: string;
  reproductions: number;
  lit: boolean;
  rows: ClassRowView[];
}

const tiles = (n: number): string => `from ${n} ${n === 1 ? "tile" : "tiles"}`;

const entryValue = (facet: Facet, entry: Entry, hrefOf: (key: string) => string): ClassValueView =>
  isCustomEntry(entry) ? { label: entry.custom, href: null } : { label: labelFor(facet, entry.id), href: isKnown(facet, entry.id) ? hrefOf(`${facet}:${entry.id}`) : null };

const idValue = (facet: Facet, id: string, hrefOf: (key: string) => string): ClassValueView =>
  id.startsWith("custom:") || !isKnown(facet, id) ? { label: labelFor(facet, id), href: null } : { label: labelFor(facet, id), href: hrefOf(`${facet}:${id}`) };

/** One facet of one classification: its values and where they came from. */
export function rowOf(c: Classification | undefined, facet: Facet, hrefOf: (key: string) => string): ClassRowView {
  const name = FACET_LABEL[facet];
  if (!c) return { facet, name, source: "", values: [] };

  if (facet === "field" || facet === "task" || facet === "setting" || facet === "data") {
    const values = c.declared[facet].map((entry) => entryValue(facet, entry, hrefOf));
    return { facet, name, source: values.length > 0 ? "stated" : "", values };
  }
  if (facet === "age") {
    const age = c.declared.age;
    return { facet, name, source: age ? "stated" : "", values: age ? [idValue(facet, age, hrefOf)] : [] };
  }

  // A derived facet: the maker's correction first, then what was read from the tiles.
  const dispute = c.disputes[facet];
  const shown = shownValues(c, facet);
  let source = "";
  if (dispute && dispute.values.length > 0) source = "corrected";
  else if (shown.values.length > 0) {
    const from = c.derived[facet]?.from.length ?? 0;
    source = from > 0 ? tiles(from) : "derived";
  }
  const values = shown.values.map((id) => idValue(facet, id, hrefOf));

  if (facet === "stack") {
    // The maker's own tools follow, without repeating a name already there.
    const seen = new Set(values.map((value) => value.label.toLowerCase()));
    for (const entry of c.declared.stack) {
      const value = entryValue(facet, entry, hrefOf);
      if (seen.has(value.label.toLowerCase())) continue;
      seen.add(value.label.toLowerCase());
      values.push(value);
    }
    if (values.length > 0 && source === "") source = "stated";
  }
  return { facet, name, source, values };
}

/** A build as a card: only the facets chosen, in the taxonomy's order. */
export function cardOf(build: BuildsTableBuild, facets: readonly Facet[], hrefOf: (key: string) => string, now: number): ClassCardView {
  const c = build.classifiedAs;
  const shape = build.shape ? shapeWord(build.shape) : "";
  const parts = [build.maker?.handle ? `@${build.maker.handle}` : "", shape, c && regulatedArea(c) ? REGULATED_TAG : ""].filter(Boolean);
  return {
    id: build.id,
    href: `/b2/${build.slug}`,
    title: build.title || "Untitled",
    subtitle: parts.join(" · "),
    reproductions: build.reproductionCount,
    lit: build.reproductionCount > 0 && !isStale({ last_confirmed_at: build.lastConfirmedAt, published_at: build.publishedAt }, now),
    rows: ALL_FACETS.filter((facet) => facets.includes(facet)).map((facet) => rowOf(c, facet, hrefOf)),
  };
}

/* ── which facets are shown ── */

export const FACET_CHOICE_KEY = "builds:facets:v1";

/** The viewer's facets, or the board's eight when none were kept, the key is unreadable or storage is blocked. */
export function readFacetChoice(): Facet[] {
  try {
    const raw = localStorage.getItem(FACET_CHOICE_KEY);
    if (raw === null) return [...DEFAULT_FACETS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_FACETS];
    const chosen = ALL_FACETS.filter((facet) => parsed.includes(facet));
    return chosen.length > 0 ? chosen : [...DEFAULT_FACETS];
  } catch {
    return [...DEFAULT_FACETS];
  }
}

export function writeFacetChoice(facets: readonly Facet[]): void {
  try {
    localStorage.setItem(FACET_CHOICE_KEY, JSON.stringify(ALL_FACETS.filter((facet) => facets.includes(facet))));
  } catch {
    // Blocked storage: the choice lasts for the visit only.
  }
}
