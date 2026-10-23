/* CA-18 P4: how wide each part of the composer is, from the window alone, and how Details fits its content.

   PURE. The inputs are the composer's inner width, the height Details may have, and `measure(width)`, which says how tall each
   piece of Details is at a column width (the page measures a hidden copy; this module never touches the DOM). The outputs are
   the widths, whether Details sits beside the build, and for Details its width, its columns, which section sits in which, and
   whether it scrolls.

   THE RULES (the boards "Details: on a 1920 window" and "Details: across window widths"):
   1. The composer's content sits 34 in from the surface's edges. The surface sits 6 in from the window, so the inner width is
      the window less 80 (`innerWidthOf`).
   2. Sources is 216 wide, 40 from Build. `R`, the width left for Build and Details, is the inner width less 256.
   3. Sources folds to its 52 rail (24 from Build) when `R` would leave Build under 560.
   4. Build is `clamp(560, 0.6 R, 760)`: the window decides, never the selection.
   5. Details' room is `R - Build - 48`. Under 300 it is not beside the build.
   7. Details is as narrow as its content allows. One column from 300 up in steps of 20, to `min(room, 520)`: the narrowest width
      at which every section fits in the height. If none does, two columns of 360 to 440 with 48 between, then three, as far as
      the room allows: the fewest columns and then the narrowest width. Sections fill down the first column in order, then the
      next, and a section never splits. If the most columns the room holds cannot hold everything, Details uses them and scrolls.
      One prose section taller than the height is cut to fit, with Read all.
   8. What Details does not use stays empty to its right. */

export const COMPOSER_INSET = 34;
/** The surface sits this far from the window (SiteFrame). */
export const SURFACE_MARGIN = 6;
export const SOURCES_WIDTH = 216;
export const SOURCES_GAP = 40;
export const RAIL_WIDTH = 52;
export const RAIL_GAP = 24;
export const BUILD_MIN = 560;
export const BUILD_MAX = 760;
export const BUILD_SHARE = 0.6;
export const DETAILS_GAP = 48;
export const DETAILS_MIN = 300;
export const DETAILS_ONE_MAX = 520;
export const STEP = 20;
export const COLUMN_MIN = 360;
export const COLUMN_MAX = 440;
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
  /** The width left for Details, after Build and the 48 between. */
  room: number;
  /** Details sits beside the build. */
  beside: boolean;
  /** Details' own width: its columns and what is between them. 0 when it is not beside. */
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

/** Build's width and Details' room for an inner width: what depends on the window alone. */
export function frameOf(inner: number): Pick<DetailsLayout, "rail" | "sources" | "sourcesGap" | "build" | "room" | "beside"> {
  const full = inner - (SOURCES_WIDTH + SOURCES_GAP);
  const rail = full < BUILD_MIN;
  const left = rail ? inner - (RAIL_WIDTH + RAIL_GAP) : full;
  const build = Math.min(BUILD_MAX, Math.max(BUILD_MIN, Math.round(BUILD_SHARE * left)));
  const room = left - build - DETAILS_GAP;
  return { rail, sources: rail ? RAIL_WIDTH : SOURCES_WIDTH, sourcesGap: rail ? RAIL_GAP : SOURCES_GAP, build, room, beside: room >= DETAILS_MIN };
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

  // One column, from 300 up in steps of 20, to what the room allows (520 at most).
  const widest = Math.min(frame.room, DETAILS_ONE_MAX);
  let last: { width: number; measured: Measured } | null = null;
  for (let width = DETAILS_MIN; width <= widest; width += STEP) {
    const measured = at(width);
    last = { width, measured };
    const cut = cutsFor(measured, height);
    const fit = fill(measured, 1, height, cut);
    if (fit.fits && Object.keys(cut).length === 0) return { ...frame, width, columns: 1, columnWidth: width, assignment: fit.assignment, scrolls: false, cut };
  }

  // Two columns of 360 to 440, then three, as far as the room allows: the fewest columns, then the narrowest.
  const most = Math.max(1, Math.floor((frame.room + DETAILS_GAP) / (COLUMN_MIN + DETAILS_GAP)));
  for (let columns = 2; columns <= most; columns += 1) {
    for (let width = COLUMN_MIN; width <= COLUMN_MAX; width += STEP) {
      const total = columns * width + (columns - 1) * DETAILS_GAP;
      if (total > frame.room) break;
      const measured = at(width);
      const cut = cutsFor(measured, height);
      const fit = fill(measured, columns, height, cut);
      if (fit.fits) return { ...frame, width: total, columns, columnWidth: width, assignment: fit.assignment, scrolls: false, cut };
    }
  }

  // Nothing holds it all: use the most columns the room has, and scroll inside. A long prose section is cut to the height.
  if (most >= 2) {
    const width = COLUMN_MIN;
    const measured = at(width);
    const cut = cutsFor(measured, height);
    return { ...frame, width: most * width + (most - 1) * DETAILS_GAP, columns: most, columnWidth: width, assignment: fill(measured, most, height, cut).assignment, scrolls: true, cut };
  }
  const width = last?.width ?? DETAILS_MIN;
  const measured = at(width);
  const cut = cutsFor(measured, height);
  return { ...frame, width, columns: 1, columnWidth: width, assignment: fill(measured, 1, height, cut).assignment, scrolls: true, cut };
}
