// cropStyle: a picture's crop, shown without changing the file (CA-07).
//
// PURE. The stored crop is a rectangle of the original, in fractions; the cell a grid gives the picture has a shape of
// its own. This answers where the whole picture goes inside the cell (an absolutely placed img, in percent of the cell)
// so that the cell shows the crop, cut further from the middle (or the top) to fill the cell. Nothing is measured: the
// numbers come from the picture's pixel size and the cell's ratio, so the grid is drawn before any bytes load.

import type { CSSProperties } from "react";

import type { CropAspect, MediaCrop } from "@/lib/build/thread";

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

// --- Crop media's model (Part 5) ------------------------------------------------------

/** Crop media's zoom: 1 to 3, in steps of 0.25 from the buttons and 0.1 from + and -. */
export const ZOOM_STEP = 0.25;
export const ZOOM_KEY_STEP = 0.1;

/** The frame's width over height for a shape: the picture's own, 16:9 or 1:1. */
export function frameRatio(aspect: CropAspect, pictureRatio: number): number {
  return aspect === "wide" ? 16 / 9 : aspect === "square" ? 1 : pictureRatio;
}

export interface CropView {
  /** The picture's width over height. */
  ratio: number;
  /** The frame's width over height. */
  frame: number;
  /** 1 to 3. */
  zoom: number;
  /** The middle of what is shown, as fractions of the picture. */
  cx: number;
  cy: number;
}

const between = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * What the frame shows of the picture, as fractions: at zoom 1 the picture just covers the frame, and zooming takes a
 * smaller part. The part is held inside the picture, so the frame never shows a gap.
 */
export function cropFor({ ratio, frame, zoom, cx, cy }: CropView): MediaCrop {
  const z = between(zoom, 1, 3);
  let w = ratio > frame ? frame / ratio : 1;
  let h = ratio > frame ? 1 : ratio / frame;
  w /= z;
  h /= z;
  return { x: between(cx - w / 2, 0, 1 - w), y: between(cy - h / 2, 0, 1 - h), w, h };
}

/** The middle of a crop, or of the whole picture. */
export function centreOf(crop: MediaCrop | null): { cx: number; cy: number } {
  return crop ? { cx: crop.x + crop.w / 2, cy: crop.y + crop.h / 2 } : { cx: 0.5, cy: 0.5 };
}

/** The view moved by a drag of (dx, dy), as fractions of the frame: the picture follows the pointer. */
export function dragView(view: CropView, dx: number, dy: number): CropView {
  const crop = cropFor(view);
  const moved = cropFor({ ...view, cx: crop.x + crop.w / 2 - dx * crop.w, cy: crop.y + crop.h / 2 - dy * crop.h });
  return { ...view, cx: moved.x + moved.w / 2, cy: moved.y + moved.h / 2 };
}

/** What is stored: Original at zoom 1 is no crop at all. */
export function storedCrop(aspect: CropAspect, view: CropView): MediaCrop | null {
  if (aspect === "original" && view.zoom === 1) return null;
  const crop = cropFor(view);
  const round = (value: number) => Math.round(value * 1e5) / 1e5;
  return { x: round(crop.x), y: round(crop.y), w: round(crop.w), h: round(crop.h) };
}
