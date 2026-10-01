// The gallery's address, read and written in one place (RC-P10).
//
// THE URL IS THE GALLERY'S ONLY STATE. A lens, a facet and a query are all in
// the address, so a filtered gallery can be linked, reloaded, opened in a new
// tab from a middle-click on a lens chip, and walked back through with the
// browser's own Back button. Nothing about what the reader is looking at lives
// only in component state.
//
// FIVE PARAMETERS, ALWAYS IN THIS ORDER: lens, for (repeatable), with
// (repeatable), shape (repeatable, UI-P28), q. One order means one address per view: two links to the same
// filtered gallery are the same string, which is what makes a written URL
// comparable with the one in the address bar.
//
// ONLY WHAT DIFFERS FROM THE DEFAULT IS WRITTEN. The All lens, an empty facet
// and an empty query are the gallery's resting state, and /gallery is how that
// state is spelled. Anything the gallery does not recognise — a lens it has no
// name for, an unknown parameter, a query shorter than SEARCH_MIN — is dropped
// on the way through, so parse followed by write is also a tidy.

import { GALLERY_LENSES, GALLERY_SHAPES, type GalleryLens } from "./gallery";
import { normaliseQuery } from "./search";

/** Where the gallery lives. */
const GALLERY_PATH = "/gallery";

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

/** Only shapes the gallery knows. */
function cleanShapes(values: readonly string[] | undefined): string[] {
  return cleanValues(values).filter((value) => (GALLERY_SHAPES as readonly string[]).includes(value));
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
  return {
    lens: isLens(lens) ? lens : "all",
    madeFor: cleanValues(search.getAll("for")),
    madeWith: cleanValues(search.getAll("with")),
    ...(shapes.length > 0 ? { shapes } : {}),
    query: normaliseQuery(search.get("q")),
  };
}

/**
 * The address of a gallery view: only the values that differ from the
 * default, keys in the order lens, for, with, shape, q.
 */
export function galleryHref(params: Partial<GalleryParams> = {}): string {
  const out = new URLSearchParams();

  if (params.lens && isLens(params.lens) && params.lens !== "all") out.set("lens", params.lens);
  for (const value of cleanValues(params.madeFor)) out.append("for", value);
  for (const value of cleanValues(params.madeWith)) out.append("with", value);
  for (const value of cleanShapes(params.shapes)) out.append("shape", value);

  const query = normaliseQuery(params.query ?? null);
  if (query !== null) out.set("q", query);

  const written = out.toString();
  return written ? `${GALLERY_PATH}?${written}` : GALLERY_PATH;
}
