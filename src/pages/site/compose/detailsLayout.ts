/* CA-18 P4: how wide each part of the composer is, from the window alone, and how Details fits its content.

   PURE. The inputs are the composer's inner width, the height Details may have, and `measure(width)`, which says how tall each
   piece of Details is at a column width (the page measures a hidden copy; this module never touches the DOM). The outputs are
   the widths, whether Details sits beside the build, and for Details its width, its columns, which section sits in which, and
   whether it scrolls.

   SYNTH 09: THE THREE PANELS. The editor is three panels on the page shade, 8 apart and 8 from the window's edges (Synth 03's
   frame). W is the window's width:
   1. From 1101: Sources 300, Build, Details 340. Build takes the rest, up to 760; once it is 760 the whole box is centred in
      the window. (At 1280 Build is 608, so it is at least 600 from there up.)
   2. 1024 to 1100: Sources narrows to 260 and Details is not beside the build: it opens as an overlay panel from the right
      (340 wide) when a tile is chosen. Build takes the rest.
   3. 761 to 1023: Sources is not a column either (`rail`): it is a "Sources" button in the title row that opens it as a left
      overlay. Build fills the width.
   4. (CA-18b P5) The composer is one box. Its left edge is Sources' (or Build's when Sources is behind its button); its right
      edge is Details' (or Build's when Details is not beside). The title row sits inside it.
   5. The Map view has the same `boxLeft`, and the same right edge when Details is beside; where it is not, the map runs to
      the window's margin (`mapRight`).
   F62 (decision D7): Details can be collapsed (`frameOf(inner, true)`). Sources and the box's right edge stay where they are;
      Build grows to the right, up to 760, and Details is not beside.
   6. A prose section taller than the height is cut to fit, with Read all. */

/** Synth 09: the panels' own frame has no inset: each panel pads itself. */
export const COMPOSER_INSET = 0;
/** The page container sits this far from the window (SiteFrame). */
export const SURFACE_MARGIN = 8;
/** The surface has no border of its own now (Synth 03: panels have none), so the content box begins at the margin. */
export const SURFACE_BORDER = 0;
/** Where the surface's content box begins, from the window's left edge: its margin and its border. */
export const ORIGIN = SURFACE_MARGIN + SURFACE_BORDER;
/** Sources from 1101. */
export const SOURCES_WIDTH = 300;
/** Sources from 1024 to 1100. */
export const SOURCES_NARROW = 260;
/** Between panels (Synth 03's `PANEL_GAP`). */
export const SOURCES_GAP = 8;
/** Sources is behind its button: no column, no gap. */
export const RAIL_WIDTH = 0;
export const RAIL_GAP = 0;
/** The least the centre is from 1280 up. */
export const BUILD_MIN = 600;
export const BUILD_MAX = 760;
/** Build's left edge sits at least this far from the window's edge. */
export const EDGE_MIN = SURFACE_MARGIN + COMPOSER_INSET;
/** Between Build and Details. */
export const DETAILS_GAP = 8;
/** Details' one width, beside the build or over it. */
export const DETAILS_MIN = 340;
export const DETAILS_MAX = 340;
/** The window widths the panels change at. */
export const THREE_PANELS_FROM = 1101;
export const SOURCES_COLUMN_FROM = 1024;
/** Details' panel pads its content this far in (its content is 340 less twice this). Every editor panel pads the same. */
export const DETAILS_PAD = 16;
/** The List's gutter inside the Build panel, at its left: with the panel's 16 it is the 40 a drag's rail and its place numbers
    need (`RAIL_ROOM_ITEMS` in sortLayout), so they stand inside the Build panel and never in the gap or over Sources. */
export const LIST_GUTTER = 40 - DETAILS_PAD;
/** F70: the space every section takes above its heading: 24, a 1px rule, 24. */
export const SEPARATION = 49;
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
  /** A `trailing` section sits after the foot line (CA-18b P3: colour and references). */
  sections: readonly { key: string; height: number; prose?: boolean; trailing?: boolean }[];
}

export interface DetailsLayoutInput {
  /** The composer's inner width. */
  inner: number;
  /** The most height Details may have. */
  height: number;
  measure: (width: number) => Measured;
}

export interface DetailsLayout {
  /** Sources is behind its button in the title row (761 to 1023). */
  rail: boolean;
  /** Sources' width: 300, 260, or 0 behind its button. */
  sources: number;
  /** The gap between Sources and Build: 8, or 0 behind its button. */
  sourcesGap: number;
  build: number;
  /** Where each column starts, from the window's left edge. */
  buildLeft: number;
  sourcesLeft: number;
  detailsLeft: number;
  /** The width Build has before its 760 cap: the inner width less Sources, Details and their gaps. */
  room: number;
  /** Details sits beside the build. */
  beside: boolean;
  /** Details' width: 340 beside the build; 0 when it is not beside. */
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

/** Where the columns stand for an inner width: what depends on the window alone. `collapsed` (F62): Details is hidden by the
    maker; Build grows to the right into its room, and the box's edges stay where they were. */
export function frameOf(inner: number, collapsed = false): Pick<DetailsLayout, "rail" | "sources" | "sourcesGap" | "build" | "buildLeft" | "sourcesLeft" | "detailsLeft" | "room" | "beside" | "detailsWidth" | "boxLeft" | "boxRight" | "mapRight"> {
  const W = windowOf(inner);
  const rail = W < SOURCES_COLUMN_FROM;
  const fits = W >= THREE_PANELS_FROM;
  const sources = rail ? RAIL_WIDTH : fits ? SOURCES_WIDTH : SOURCES_NARROW;
  const sourcesGap = rail ? RAIL_GAP : SOURCES_GAP;
  const left = sources + sourcesGap;
  const detailsWidth = fits ? DETAILS_MAX : 0;
  const right = fits ? DETAILS_GAP + detailsWidth : 0;
  const room = inner - left - right;
  const filled = Math.max(0, Math.min(BUILD_MAX, room));
  // What Build does not take is shared either side of the box.
  const boxLeft = EDGE_MIN + (inner - left - filled - right) / 2;
  const sourcesLeft = boxLeft;
  const buildLeft = sourcesLeft + left;
  const detailsLeft = buildLeft + filled + DETAILS_GAP;
  const boxRight = buildLeft + filled + right;
  const beside = fits && !collapsed;
  const build = fits && collapsed ? Math.min(BUILD_MAX, boxRight - buildLeft) : filled;
  return { rail, sources, sourcesGap, build, buildLeft, sourcesLeft, detailsLeft, room, beside, detailsWidth: beside ? detailsWidth : 0, boxLeft, boxRight, mapRight: beside ? boxRight : W - EDGE_MIN };
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
  let fits = true;
  const place = (key: string, size: number, section: boolean) => {
    // F70: every section, the first too, has 24, a rule and 24 above it.
    const needed = () => size + (section ? SEPARATION : 0);
    if (used + needed() > height && out[at].length > 0) {
      if (at + 1 < columns) {
        at += 1;
        used = 0;
      } else {
        fits = false;
      }
    }
    used += needed();
    if (used > height) fits = false;
    out[at].push(key);
  };
  place("head", measured.head, false);
  const sized = (section: Measured["sections"][number]) => (cut[section.key] !== undefined ? cut[section.key] + LABEL_BLOCK + READ_ALL : section.height);
  for (const section of measured.sections) if (!section.trailing) place(section.key, sized(section), true);
  if (measured.foot > 0) {
    place("foot", measured.foot, false);
  }
  for (const section of measured.sections) if (section.trailing) place(section.key, sized(section), true);
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
  const width = frame.detailsWidth - 2 * DETAILS_PAD;
  const measured = at(width);
  const cut = cutsFor(measured, height);
  const fit = fill(measured, 1, height, cut);
  return { ...frame, width, columns: 1, columnWidth: width, assignment: fit.assignment, scrolls: !fit.fits, cut };
}
