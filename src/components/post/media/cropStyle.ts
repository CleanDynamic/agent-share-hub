// cropStyle: a picture's crop, shown without changing the file (CA-07).
//
// PURE. The stored crop is a rectangle of the original, in fractions; the cell a grid gives the picture has a shape of
// its own. This answers where the whole picture goes inside the cell (an absolutely placed img, in percent of the cell)
// so that the cell shows the crop, cut further from the middle (or the top) to fill the cell. Nothing is measured: the
// numbers come from the picture's pixel size and the cell's ratio, so the grid is drawn before any bytes load.

import type { CSSProperties } from "react";

import type { MediaCrop } from "@/lib/build/thread";

/** The shape assumed for a picture that carries no size anywhere: 3:2. */
export const ASSUMED_RATIO = 3 / 2;

export interface CropSource {
  /** The picture's pixel size, or null when it is not known. */
  w: number | null;
  h: number | null;
  crop: MediaCrop | null;
}

const WHOLE: MediaCrop = { x: 0, y: 0, w: 1, h: 1 };

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** The picture's own size, or a 3:2 stand-in. */
function sizeOf({ w, h }: Pick<CropSource, "w" | "h">): { w: number; h: number } {
  return w && h && w > 0 && h > 0 ? { w, h } : { w: ASSUMED_RATIO, h: 1 };
}

/** Width over height of what the crop shows: the picture's own shape when it is not cropped. */
export function croppedRatio(source: CropSource): number {
  const size = sizeOf(source);
  const crop = source.crop ?? WHOLE;
  return (crop.w * size.w) / (crop.h * size.h);
}

/**
 * The style of an img that shows the crop in a cell of `cellRatio` (width over height). `align` "top" keeps the top
 * of the crop when it has to be cut top to bottom (a tall single picture); otherwise it is cut from the middle.
 */
export function cropStyle(source: CropSource, cellRatio: number, align: "middle" | "top" = "middle"): CSSProperties {
  const size = sizeOf(source);
  const crop = source.crop ?? WHOLE;
  // The crop, in pixels of the original.
  const cx = crop.x * size.w;
  const cy = crop.y * size.h;
  const cw = crop.w * size.w;
  const ch = crop.h * size.h;
  // What the cell shows of it: all of one side, the cell's share of the other.
  let vx = cx;
  let vy = cy;
  let vw = cw;
  let vh = ch;
  if (cw / ch > cellRatio) {
    vw = ch * cellRatio;
    vx = cx + (cw - vw) / 2;
  } else {
    vh = cw / cellRatio;
    vy = align === "top" ? cy : cy + (ch - vh) / 2;
  }
  return {
    position: "absolute",
    width: `${round((size.w / vw) * 100)}%`,
    height: `${round((size.h / vh) * 100)}%`,
    left: `${round((-vx / vw) * 100)}%`,
    top: `${round((-vy / vh) * 100)}%`,
    maxWidth: "none",
    display: "block",
  };
}
