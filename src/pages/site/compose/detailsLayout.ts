/* CA-18 P4: how wide each part of the composer is, from the window alone, and how Details fits its content.

   PURE. The inputs are the composer's inner width, the height Details may have, and `measure(width)`, which says how tall each
   piece of Details is at a column width (the page measures a hidden copy; this module never touches the DOM). The outputs are
   the widths, whether Details sits beside the build, and for Details its width, its columns, which section sits in which, and
   whether it scrolls.

   THE RULES (CA-18b; the boards "Details: on a 1920 window" and "Details: across window widths"). W is the window's width:
   1. The composer's content sits 34 in from the surface's edges. The surface sits 6 in from the window, so the inner width is
      the window less 80 (`innerWidthOf`).
   2. Build is `clamp(560, inner - 720, 760)` and sits in the dead centre of the window: its left edge is `(W - Build) / 2`. The
      post shares its column. The window decides, never the selection.
   3. Sources is 216 wide with its right edge 40 left of Build, while its left edge stays 40 or more from the window's edge
      (windows of 1152 and up). Below that it folds to its 52 rail, 24 left of Build, and between 768 and 792 Build narrows below
      560 as far as it needs to keep the rail 40 from the edge.
   4. Details starts 40 right of Build and may use everything up to 40 from the window's right edge: `(inner - Build) / 2 - 40`.
      Under 280 it is not beside the build.
   5. (CA-18b P5) The composer is one box. Its left edge is Sources' (or the rail's); its right edge is Details' (or Build's when
      Details is hidden). The title area sits inside it: the breadcrumb and the title start at `boxLeft`, Publish ends at
      `boxRight`. So Details' right edge never moves with the selection: it is one fixed width per window, `min(room, 520)`,
      at least 280. The content fills that column from the left; taller than the window, it scrolls inside. This replaces
      CA-18's narrowest-column and multi-column fill.
   6. The Map view has the same `boxLeft`, and the same right edge when Details is beside; under 1280, where Details is hidden,
      its right edge is 40 from the window's edge so the map has room (`mapRight`).
   7. A prose section taller than the height is cut to fit, with Read all. */

export const COMPOSER_INSET = 34;
/** The surface sits this far from the window (SiteFrame). */
export const SURFACE_MARGIN = 6;
/** The surface's own 1px border. */
export const SURFACE_BORDER = 1;
/** Where the surface's content box begins, from the window's left edge: its margin and its border. */
export const ORIGIN = SURFACE_MARGIN + SURFACE_BORDER;
export const SOURCES_WIDTH = 216;
export const SOURCES_GAP = 40;
export const RAIL_WIDTH = 52;
export const RAIL_GAP = 24;
export const BUILD_MIN = 560;
export const BUILD_MAX = 760;
/** Build is the inner width less this, between BUILD_MIN and BUILD_MAX: what the two side columns and their gaps leave. */
export const BUILD_SIDES = 720;
/** Build's left edge sits at least this far from the window's edge when Sources is folded to its rail. */
export const EDGE_MIN = SURFACE_MARGIN + COMPOSER_INSET;
/** Between Build and Details, and between Details and the window's right edge. */
export const DETAILS_GAP = 40;
export const DETAILS_MIN = 280;
/** Details' width when the room allows. */
export const DETAILS_MAX = 520;
/** The space a section takes above itself when it is not first in its column: 22, a 1px rule, 22. */
export const SEPARATION = 45;
/** A section's label, its count and the 10 under them. */
export const LABEL_BLOCK = 48;
/** Read all: the button and the 10 above it. */
export const READ_ALL = 38;

/** The composer's inner width for a window this wide. */
export const innerWidthOf = (windowWidth: number): number => windowWidth - 2 * (SURFACE_MARGIN + COMPOSER_INSET);

/** What `measure` says at a column width: the head, the foot and each section, as tall as they are with no separator above. */
export interface Measured {
  head: number;
  /** The line naming what is empty, with the 22 above it; 0 when there is none. */
  foot: number;
  sections: readonly { key: string; height: number; prose?: boolean }[];
}

export interface DetailsLayoutInput {
  /** The composer's inner width. */
  inner: number;
  /** The most height Details may have. */
  height: number;
  measure: (width: number) => Measured;
}

export interface DetailsLayout {
  /** Sources is folded to its 52 rail. */
  rail: boolean;
  /** Sources' width, 216 or 52. */
  sources: number;
  /** The gap between Sources (or its rail) and Build: 40 or 24. */
  sourcesGap: number;
  build: number;
  /** Where each column starts, from the window's left edge. Build is centred on the window. */
  buildLeft: number;
  sourcesLeft: number;
  detailsLeft: number;
  /** The width left for Details, after Build and the 40 between, up to 40 from the window's right edge. */
  room: number;
  /** Details sits beside the build. */
  beside: boolean;
  /** Details' fixed width for this window: `min(room, 520)`; 0 when it is not beside. */
  detailsWidth: number;
  /** The box the composer is: Sources' (or the rail's) left edge, and Details' right edge (Build's when Details is hidden). */
  boxLeft: number;
  boxRight: number;
  /** The Map view's right edge: `boxRight` when Details is beside, else 40 from the window's edge. */
  mapRight: number;
  /** Details' own width, fixed by the window. 0 when it is not beside. */
  width: number;
  columns: number;
  columnWidth: number;
  /** What sits in each column, in order: "head", the section keys, "foot". */
  assignment: string[][];
  /** Details has more than it can show in its room and scrolls inside. */
  scrolls: boolean;
  /** A prose section cut to this height, with Read all, by key. */
  cut: Record<string, number>;
}

/** The window's width for an inner width. */
export const windowOf = (inner: number): number => inner + 2 * (SURFACE_MARGIN + COMPOSER_INSET);

/** Where the columns stand for an inner width: what depends on the window alone. */
export function frameOf(inner: number): Pick<DetailsLayout, "rail" | "sources" | "sourcesGap" | "build" | "buildLeft" | "sourcesLeft" | "detailsLeft" | "room" | "beside" | "detailsWidth" | "boxLeft" | "boxRight" | "mapRight"> {
  const W = windowOf(inner);
  const wanted = Math.min(BUILD_MAX, Math.max(BUILD_MIN, inner - BUILD_SIDES));
  const rail = (W - wanted) / 2 - (SOURCES_WIDTH + SOURCES_GAP) < EDGE_MIN;
  // With the rail, Build gives up width only as far as it needs to keep the rail EDGE_MIN from the window's edge.
  const build = rail ? Math.min(wanted, W - 2 * (EDGE_MIN + RAIL_WIDTH + RAIL_GAP)) : wanted;
  const buildLeft = (W - build) / 2;
  const sources = rail ? RAIL_WIDTH : SOURCES_WIDTH;
  const sourcesGap = rail ? RAIL_GAP : SOURCES_GAP;
  const room = (W - build) / 2 - SURFACE_MARGIN - COMPOSER_INSET - DETAILS_GAP;
  const beside = room >= DETAILS_MIN;
  const detailsWidth = beside ? Math.min(room, DETAILS_MAX) : 0;
  const sourcesLeft = buildLeft - sourcesGap - sources;
  const detailsLeft = buildLeft + build + DETAILS_GAP;
  const boxRight = beside ? detailsLeft + detailsWidth : buildLeft + build;
  return { rail, sources, sourcesGap, build, buildLeft, sourcesLeft, detailsLeft, room, beside, detailsWidth, boxLeft: sourcesLeft, boxRight, mapRight: beside ? boxRight : W - EDGE_MIN };
}

interface Fit {
  fits: boolean;
  assignment: string[][];
}

/** Fill columns down in order, a section never split. `fits` is false when something does not go in the last column's height. */
function fill(measured: Measured, columns: number, height: number, cut: Record<string, number>): Fit {
  const out: string[][] = Array.from({ length: columns }, () => []);
  let at = 0;
  let used = 0;
  let sectionsHere = 0;
  let fits = true;
  const place = (key: string, size: number, section: boolean) => {
    // A section after another in its column has 22, a rule and 22 above it.
    const needed = () => size + (section && sectionsHere > 0 ? SEPARATION : 0);
    if (used + needed() > height && out[at].length > 0) {
      if (at + 1 < columns) {
        at += 1;
        used = 0;
        sectionsHere = 0;
      } else {
        fits = false;
      }
    }
    used += needed();
    if (used > height) fits = false;
    if (section) sectionsHere += 1;
    out[at].push(key);
  };
  place("head", measured.head, false);
  for (const section of measured.sections) place(section.key, cut[section.key] !== undefined ? cut[section.key] + LABEL_BLOCK + READ_ALL : section.height, true);
  if (measured.foot > 0) place("foot", measured.foot, false);
  return { fits, assignment: out };
}

/** A prose section that cannot fit in a column alone is cut: the text gets what is left once its label and Read all are drawn. */
function cutsFor(measured: Measured, height: number): Record<string, number> {
  const cut: Record<string, number> = {};
  for (const section of measured.sections) {
    if (section.prose && section.height > height - measured.head) cut[section.key] = Math.max(120, height - measured.head - LABEL_BLOCK - READ_ALL);
  }
  return cut;
}

export function layoutDetails({ inner, height, measure }: DetailsLayoutInput): DetailsLayout {
  const frame = frameOf(inner);
  const none: DetailsLayout = { ...frame, width: 0, columns: 0, columnWidth: 0, assignment: [], scrolls: false, cut: {} };
  if (!frame.beside) return none;
  const cache = new Map<number, Measured>();
  const at = (width: number): Measured => {
    const held = cache.get(width);
    if (held) return held;
    const made = measure(width);
    cache.set(width, made);
    return made;
  };

  // One fixed column: the window decides its width, so its right edge (and Publish with it) never moves with the selection.
  const width = frame.detailsWidth;
  const measured = at(width);
  const cut = cutsFor(measured, height);
  const fit = fill(measured, 1, height, cut);
  return { ...frame, width, columns: 1, columnWidth: width, assignment: fit.assignment, scrolls: !fit.fits, cut };
}
