// The gallery's address, read and written in one place (RC-P10).
//
// THE URL IS THE GALLERY'S ONLY STATE. A lens, a facet and a query are all in
// the address, so a filtered gallery can be linked, reloaded, opened in a new
// tab from a middle-click on a lens chip, and walked back through with the
// browser's own Back button. Nothing about what the reader is looking at lives
// only in component state.
//
// CA-16 P6 ADDS f (repeatable): a classification facet key such as field:ai-ml, between pattern and sort. Only keys the
// taxonomy knows are kept.
//
// EIGHT PARAMETERS, ALWAYS IN THIS ORDER: view (UI-P49), lens, for
// (repeatable), with (repeatable), shape (repeatable, UI-P28), model (UI-P49),
// sort (UI-P49), q. One order means one address per view: two links to the same
// filtered gallery are the same string, which is what makes a written URL
// comparable with the one in the address bar.
//
// UI-P49 — THE FEED READS view, for, model, sort AND q. view is feed (the
// default, never written) or dashboard; model is a ModelVersion id from the
// registry (anything else is dropped); sort is newest (the default) or one of
// the feed's three others. lens, with and shape are still read and written here
// so existing links keep parsing; the feed page itself ignores them.
//
// SV-11: BUILDS. view is table (the resting view, never written), maps or classification; the feed and the dashboard
// are retired, and the dashboard's parameters (tab, lab, report, active, dsort, build) and the board's tab (by) with
// them. open=1 is the Open requests filter, after f. sort rests on reproduced, the Table's order.
//
// TF-14 — THE FEED ADDS tool (a tool id from the registry, /gallery?tool=lovable). It sits after model and before
// sort. An id the registry does not name is dropped. `with` keeps its meaning and is still ignored by the feed.
//
// ONLY WHAT DIFFERS FROM THE DEFAULT IS WRITTEN. The All lens, an empty facet
// and an empty query are the gallery's resting state, and /gallery is how that
// state is spelled. Anything the gallery does not recognise — a lens it has no
// name for, an unknown parameter, a query shorter than SEARCH_MIN — is dropped
// on the way through, so parse followed by write is also a tidy.

import { MODEL_VERSIONS } from "@/lib/models/registry";

import { GALLERY_LENSES, GALLERY_SHAPES, type GalleryFeedSort, type GalleryLens } from "./gallery";
import { toolFor } from "@/lib/tools/registry";
import { isPattern, type Pattern } from "./patterns";
import { isKnown, type Facet } from "@/lib/classify/taxonomy";

import { RANGE_KEYS, formatRange, parseRange, type NumberRange, type RangeKey } from "./galleryRanges";
import { normaliseQuery } from "./search";

/** SV-11: the three views of the same builds; the Table is the resting one. */
export type GalleryViewMode = "table" | "maps" | "classification";
export const GALLERY_VIEWS: readonly GalleryViewMode[] = ["table", "maps", "classification"];

export const GALLERY_FEED_SORTS: readonly GalleryFeedSort[] = ["newest", "reproduced", "confirmed", "rebuilt"];

/** SV-11: the Table's resting order, the board's "Sort Reproductions". */
export const DEFAULT_GALLERY_SORT: GalleryFeedSort = "reproduced";

const GALLERY_PATH = "/builds";

/** What the gallery's address says. */
export interface GalleryParams {
  lens: GalleryLens;
  /** made_for values; several are an OR (see listGallery). */
  madeFor: string[];
  /** made_with values; several are an OR. */
  madeWith: string[];
  /**
   * Shapes (UI-P28); several are an OR. Present only when at least one is set,
   * so the resting address reads exactly as it did before shapes existed.
   */
  shapes?: string[];
  /** The tidied query, or null for none. */
  query: string | null;
  /** SV-11. Present only when it is not the Table, the resting view. */
  view?: Exclude<GalleryViewMode, "table">;
  /** UI-P49. A ModelVersion id; absent is "Any model". */
  model?: string;
  /** TF-14. A tool id from the registry; absent is "Any tool". */
  tool?: string;
  /** CA-13 P12. One of the three patterns; absent is "Any pattern". */
  pattern?: Pattern;
  /** CA-16 P6. Classification facet keys (`field:ai-ml`); present only when at least one is set. An OR within a facet, an AND across facets. */
  facets?: string[];
  /** SV-11. Only builds with an open request. */
  open?: true;
  /** SV-23. Number filters (`steps=5-30`); present only when at least one is set. */
  ranges?: Partial<Record<RangeKey, NumberRange>>;
  /** UI-P49. Present only when it is not the resting sort (SV-11: reproduced). */
  sort?: GalleryFeedSort;
}

/** Trimmed, empty entries dropped, first occurrence kept. */
function cleanValues(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = (value ?? "").trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/** CA-16 P6: keys of the form `<facet>:<id>` the lists know, first occurrence kept. */
export function cleanFacetKeys(values: readonly string[] | undefined): string[] {
  return cleanValues(values).filter((key) => {
    const at = key.indexOf(":");
    return at > 0 && isKnown(key.slice(0, at) as Facet, key.slice(at + 1));
  });
}

/** Only shapes the gallery knows. */
function cleanShapes(values: readonly string[] | undefined): string[] {
  return cleanValues(values).filter((value) => (GALLERY_SHAPES as readonly string[]).includes(value));
}

function isModel(value: string | null | undefined): value is string {
  return typeof value === "string" && MODEL_VERSIONS.some((version) => version.id === value);
}

function isSort(value: string | null | undefined): value is GalleryFeedSort {
  return typeof value === "string" && (GALLERY_FEED_SORTS as readonly string[]).includes(value);
}

function isLens(value: string | null): value is GalleryLens {
  return value !== null && (GALLERY_LENSES as readonly string[]).includes(value);
}

/**
 * The gallery's view, read from its address. An unknown lens reads as "all";
 * `for` and `with` may repeat; `q` goes through normaliseQuery.
 */
export function parseGalleryParams(search: URLSearchParams): GalleryParams {
  const lens = search.get("lens");
  const shapes = cleanShapes(search.getAll("shape"));
  const model = search.get("model");
  const tool = toolFor(search.get("tool"))?.id;
  const pattern = search.get("pattern");
  const facets = cleanFacetKeys(search.getAll("f"));
  const view = search.get("view");
  const sort = search.get("sort");
  const ranges: Partial<Record<RangeKey, NumberRange>> = {};
  for (const key of RANGE_KEYS) {
    const range = parseRange(search.get(key));
    if (range) ranges[key] = range;
  }
  return {
    lens: isLens(lens) ? lens : "all",
    madeFor: cleanValues(search.getAll("for")),
    madeWith: cleanValues(search.getAll("with")),
    ...(shapes.length > 0 ? { shapes } : {}),
    query: normaliseQuery(search.get("q")),
    ...(view === "maps" || view === "classification" ? { view } : {}),
    ...(isModel(model) ? { model } : {}),
    ...(tool ? { tool } : {}),
    ...(isPattern(pattern) ? { pattern } : {}),
    ...(facets.length > 0 ? { facets } : {}),
    ...(search.get("open") === "1" ? { open: true as const } : {}),
    ...(Object.keys(ranges).length > 0 ? { ranges } : {}),
    ...(isSort(sort) && sort !== DEFAULT_GALLERY_SORT ? { sort } : {}),
  };
}

/**
 * The address of a gallery view: only the values that differ from the
 * default, keys in the order view, lens, for, with, shape, model, tool, pattern, f (CA-16, repeatable), open, the number filters (SV-23: steps, sessions), sort, q.
 */
export function galleryHref(params: Partial<GalleryParams> = {}): string {
  const out = new URLSearchParams();

  if (params.view === "maps" || params.view === "classification") out.set("view", params.view);
  if (params.lens && isLens(params.lens) && params.lens !== "all") out.set("lens", params.lens);
  for (const value of cleanValues(params.madeFor)) out.append("for", value);
  for (const value of cleanValues(params.madeWith)) out.append("with", value);
  for (const value of cleanShapes(params.shapes)) out.append("shape", value);
  if (isModel(params.model)) out.set("model", params.model);
  const tool = toolFor(params.tool)?.id;
  if (tool) out.set("tool", tool);
  if (isPattern(params.pattern)) out.set("pattern", params.pattern);
  for (const key of cleanFacetKeys(params.facets)) out.append("f", key);
  if (params.open === true) out.set("open", "1");
  for (const key of RANGE_KEYS) {
    const range = formatRange(params.ranges?.[key]);
    if (range) out.set(key, range);
  }
  if (isSort(params.sort) && params.sort !== DEFAULT_GALLERY_SORT) out.set("sort", params.sort);

  const query = normaliseQuery(params.query ?? null);
  if (query !== null) out.set("q", query);

  const written = out.toString();
  return written ? `${GALLERY_PATH}?${written}` : GALLERY_PATH;
}
