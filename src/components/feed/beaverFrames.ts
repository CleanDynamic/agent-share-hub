/* Prompt 29a Part C: the beaver dunk from 16 drawn frames, the pull to refresh on the phone Home. A TypeScript port of the
   prompt's reference engine, every number kept.

   makeBeaver(canvas, logoImg, atlasImg, geo, hooks) -> { pull(dragPx), release() -> armed, done(), busy(), destroy() }

   The atlas is 4 x 4 frames, each CELL_W x CELL_H, all aligned to one waterline (WL_Y) and one content box (CONTENT_X,
   CONTENT_W). `geo` is { cx, cy, w, barBottom, width, height } in CSS px relative to the canvas: the logo's centre and width, the
   top bar's bottom edge, the canvas's size. `hooks.offset(px)` moves the feed; `hooks.frame(index)` hears the frame shown.

   One requestAnimationFrame loop, running only while pulling or animating; at most two drawImage calls a frame. Between frames the
   two neighbours are drawn with "lighter" at 1 - fraction and fraction, a linear blend on the dark background. */

export const ARM = 80;
export const MAX = 125;
export const HOLD = 112;
export const KMAX = 2.35;
export const LOGO_WL = 0.62;
export const CELL_W = 384;
export const CELL_H = 345;
export const WL_Y = 196.5;
export const CONTENT_X = 20.25;
export const CONTENT_W = 339;
export const T_DIVE = 0.38;
export const T_LOOP = 0.8;
export const T_MIN_UNDER = 0.35;
export const T_RISE = 0.65;
export const T_BACK = 0.2;

export interface BeaverGeo {
  cx: number;
  cy: number;
  w: number;
  barBottom: number;
  width: number;
  height: number;
}

export interface BeaverHooks {
  offset: (px: number) => void;
  /** The frame index shown this tick (0 to 15, fractional between frames). */
  frame?: (index: number) => void;
  /** The engine is back at rest: the feed closed, the logo shown, the canvas empty. */
  rest?: () => void;
}

export type BeaverMode = "idle" | "pull" | "back" | "dive" | "under" | "rise";

export interface Beaver {
  pull: (drag: number) => void;
  release: () => boolean;
  done: () => void;
  busy: () => boolean;
  destroy: () => void;
  /** For tests and the gesture: where the engine is now. */
  state: () => { mode: BeaverMode; offset: number; frame: number };
}

/** The pull's offset for a drag of `drag` px: 125 × (1 − e^(−drag / 170)). */
export const pullOffset = (drag: number): number => MAX * (1 - Math.exp(-Math.max(0, drag) / 170));

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const smooth = (x: number): number => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
const eOut = (x: number): number => 1 - Math.pow(1 - x, 3);
export const eIO = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function makeBeaver(cv: HTMLCanvasElement, img: HTMLImageElement, atlas: CanvasImageSource | null, geo: BeaverGeo, hooks: BeaverHooks): Beaver {
  const ctx = cv.getContext("2d");
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  cv.width = Math.round(geo.width * dpr);
  cv.height = Math.round(geo.height * dpr);
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
  }
  const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : geo.w > 0 ? 1 : 0;
  let mode: BeaverMode = "idle";
  let t = 0;
  let mt = 0;
  let last = 0;
  let raf = 0;
  let offset = 0;
  let off0 = 0;
  let f = 0;
  let f0 = 0;
  let doneAt = -1;
  let underFrom = 0;

  function geom() {
    const pp = clamp(offset / ARM, 0, 1);
    const e = smooth(pp);
    const k = 1 + (KMAX - 1) * e;
    const cy = geo.cy + (geo.barBottom + offset * 0.56 - geo.cy) * e;
    const w = geo.w * k;
    const h = w * aspect;
    return { pp, k, w, left: geo.cx - w / 2, yW: cy - h / 2 + LOGO_WL * h, kf: (k - 1) / (KMAX - 1) };
  }

  /** Draw frame n (0 to 15) at alpha a, fitted to the logo. */
  function cell(n: number, a: number, g: ReturnType<typeof geom>) {
    if (a <= 0.003 || !ctx || !atlas) return;
    const s = g.w / CONTENT_W;
    const sx = (n % 4) * CELL_W;
    const sy = Math.floor(n / 4) * CELL_H;
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(atlas, sx, sy, CELL_W, CELL_H, g.left - CONTENT_X * s, g.yW - WL_Y * s, CELL_W * s, CELL_H * s);
  }

  function frame(now: number) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    t += dt;
    mt += dt;
    if (mode === "pull") {
      f = 3 * smooth(clamp(offset / ARM, 0, 1)); // frames 1 to 4 follow the finger
    } else if (mode === "back") {
      const xb = clamp(mt / T_BACK, 0, 1);
      offset = off0 * (1 - eOut(xb));
      f = 3 * smooth(clamp(offset / ARM, 0, 1));
      if (xb >= 1) return end();
    } else if (mode === "dive") {
      // frames 4 to 9: the dunk
      const xd = clamp(mt / T_DIVE, 0, 1);
      offset = off0 + (HOLD - off0) * eOut(clamp(mt / 0.2, 0, 1));
      f = f0 + (8 - f0) * Math.pow(xd, 1.25);
      if (xd >= 1) {
        mode = "under";
        mt = 0;
        underFrom = t;
      }
    } else if (mode === "under") {
      // frames 9 to 11 loop while loading
      offset = HOLD;
      f = 8 + (1 - Math.cos((mt / T_LOOP) * 6.2832)) * 1.0;
      if (doneAt >= 0 && t - underFrom > T_MIN_UNDER && f > 9.6) {
        mode = "rise";
        mt = 0;
        f0 = f;
      }
    } else if (mode === "rise") {
      // frames 11 to 16: back up, while the feed closes and the logo shrinks home
      const xr = clamp(mt / T_RISE, 0, 1);
      const er = eIO(xr);
      offset = HOLD * (1 - er); // the feed closes as the beaver rises, in step with it
      f = f0 + (15 - f0) * er;
      if (xr >= 1) return end();
    }
    hooks.offset(offset);
    hooks.frame?.(f);
    const g = geom();
    const fade = clamp(g.kf / 0.15, 0, 1);
    img.style.opacity = String(1 - fade); // the logo hands over to the frames as it grows
    if (ctx) {
      ctx.clearRect(0, 0, geo.width, geo.height);
      const lo = Math.floor(f);
      const fr = f - lo;
      const hi = Math.min(15, lo + 1);
      ctx.globalCompositeOperation = "lighter"; // linear blend between neighbouring frames
      cell(lo, (1 - fr) * fade, g);
      if (fr > 0.003) cell(hi, fr * fade, g);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  }

  function run() {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function end() {
    mode = "idle";
    offset = 0;
    f = 0;
    doneAt = -1;
    hooks.offset(0);
    img.style.opacity = "1";
    ctx?.clearRect(0, 0, geo.width, geo.height);
    cancelAnimationFrame(raf);
    raf = 0;
    hooks.rest?.();
  }

  return {
    busy: () => mode !== "idle" && mode !== "pull",
    pull: (drag: number) => {
      if (mode !== "idle" && mode !== "pull") return;
      mode = "pull";
      offset = pullOffset(drag);
      run();
    },
    release: () => {
      if (mode !== "pull") return false;
      off0 = offset;
      f0 = f;
      mt = 0;
      if (offset >= ARM) {
        mode = "dive";
        doneAt = -1;
        return true;
      }
      mode = "back";
      return false;
    },
    done: () => {
      doneAt = t;
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      raf = 0;
      img.style.opacity = "1";
    },
    state: () => ({ mode, offset, frame: f }),
  };
}
