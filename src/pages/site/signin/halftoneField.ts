/* The halftone layer's drawing (Reference C), with no React: the field on the coarse grid, the dots, the reveal and the
   wind-down, the density terms, the signing-in ripple and cursor repulsion. HalftoneLayer.tsx mounts the canvas and runs
   it; Part D adds the code style beside the dots.

   Every number here is Reference C's, as written. Times are seconds; lengths are CSS pixels. */

import { bayer, clamp01, CoarseGrid, DotBatch, ease, fbm3, pn, smoothstep } from "@/lib/dots/engine";

/** The one speed the reveal, the wind-down and the ripple travel at. */
export const V = 280;
/** The wind-down is over, and the canvas goes, once `back` passes this. */
export const BACK_DONE = 520;
/** Dots sit on a 10px grid centred in the viewport. */
export const DOT_STEP = 10;
/** No dot more than 6px inside the dialog. */
export const INSIDE_LIMIT = 6;

export const DARK_PALETTE = ["#1B3D17", "#27591F", "#337A2C", "#4FA862", "#6BE2A0"] as const;
export const LIGHT_PALETTE = ["#C4F2B2", "#8FEA72", "#56C93A", "#3F9230", "#173014"] as const;

/** Cursor repulsion (Reference C). */
const REACH = 130;
const PUSH = 24;
const POINTER_RATE = 16;
const GAIN_RATE = 6;
const GROW_RATE = 14;
const RETURN_RATE = 3.2;
/** The signing-in ripple eases toward 1 (or back to 0) at 3/s. */
const BUSY_RATE = 3;

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Signed distance from a point to a rectangle: negative inside. */
export function signedDistance(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  return -Math.min(x - r.left, r.right - x, y - r.top, r.bottom - y);
}

/** The field's channels on the coarse grid. */
const F = 0;
const WX = 1;

export interface HalftoneInput {
  width: number;
  height: number;
  dialog: Rect;
  palette: readonly string[];
}

export class HalftoneField {
  readonly grid = new CoarseGrid(2);
  private readonly batch = new DotBatch();
  private input: HalftoneInput | null = null;
  /* The dots, worked out once per layout: position, signed distance to the dialog and its two falloffs, the cell's
     Bayer threshold, and the stored cursor offset. */
  private count = 0;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private dm = new Float32Array(0);
  private fall400 = new Float32Array(0);
  private fall300 = new Float32Array(0);
  private moat = new Float32Array(0);
  private threshold = new Float32Array(0);
  private ox = new Float32Array(0);
  private oy = new Float32Array(0);

  /* The pointer, smoothed, and the gain that eases in while it is over the page. */
  private pointerX = 0;
  private pointerY = 0;
  private targetX = 0;
  private targetY = 0;
  private hasPointer = false;
  private over = false;
  private gain = 0;
  private busy = 0;

  /** Lay the dots out for a viewport and a dialog rectangle. */
  layout(input: HalftoneInput) {
    this.input = input;
    const { width, height, dialog } = input;
    this.grid.resize(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const firstCol = -Math.floor(cx / DOT_STEP);
    const lastCol = Math.floor((width - cx) / DOT_STEP);
    const firstRow = -Math.floor(cy / DOT_STEP);
    const lastRow = Math.floor((height - cy) / DOT_STEP);
    const max = (lastCol - firstCol + 1) * (lastRow - firstRow + 1);
    const x = new Float32Array(max);
    const y = new Float32Array(max);
    const dm = new Float32Array(max);
    const fall400 = new Float32Array(max);
    const fall300 = new Float32Array(max);
    const moat = new Float32Array(max);
    const threshold = new Float32Array(max);
    let n = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const px = cx + col * DOT_STEP;
        const py = cy + row * DOT_STEP;
        const d = signedDistance(px, py, dialog);
        if (d < -INSIDE_LIMIT) continue;
        x[n] = px;
        y[n] = py;
        dm[n] = d;
        fall400[n] = Math.exp(-d / 400);
        fall300[n] = Math.exp(-d / 300);
        moat[n] = smoothstep(clamp01((d - 2) / 40));
        threshold[n] = bayer(col, row);
        n++;
      }
    }
    this.count = n;
    this.x = x;
    this.y = y;
    this.dm = dm;
    this.fall400 = fall400;
    this.fall300 = fall300;
    this.moat = moat;
    this.threshold = threshold;
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
  }

  /** Where the pointer is, in viewport pixels, or null when it has left the page. */
  pointer(x: number | null, y: number | null) {
    if (x === null || y === null) {
      this.over = false;
      return;
    }
    this.targetX = x;
    this.targetY = y;
    if (!this.hasPointer) {
      this.pointerX = x;
      this.pointerY = y;
      this.hasPointer = true;
    }
    this.over = true;
  }

  /** The field on the coarse grid at time `t`. */
  fillField(t: number) {
    if (!this.input) return;
    const cx = this.input.width / 2;
    const cy = this.input.height / 2;
    const angle = 0.16 * t;
    const drift = 0.05 * t;
    // unturn(), written out so no array is made per node: the pattern turns clockwise, the samples the other way.
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.grid.fill((x, y, out) => {
      const ex = x - cx;
      const ey = y - cy;
      const qx = (ex * cos + ey * sin) / 250;
      const qy = (-ex * sin + ey * cos) / 250;
      const wx = pn(0.7 * qx + 3.1 + drift, 0.7 * qy - 1.7);
      const wy = pn(0.7 * qx - 6.3, 0.7 * qy + 2.9 - drift);
      out[F] = fbm3(qx + 1.7 * (wx - 0.5) + 11.7, qy + 1.7 * (wy - 0.5) - 4.2);
      out[WX] = wx;
    });
  }

  /** Move the pointer, the gain, the busy ripple and every dot's offset on by `dt`. `still` freezes them (reduced motion). */
  step(dt: number, signingIn: boolean, still: boolean) {
    if (still) return;
    this.busy = ease(this.busy, signingIn ? 1 : 0, BUSY_RATE, dt);
    this.pointerX = ease(this.pointerX, this.targetX, POINTER_RATE, dt);
    this.pointerY = ease(this.pointerY, this.targetY, POINTER_RATE, dt);
    this.gain = ease(this.gain, this.over ? 1 : 0, GAIN_RATE, dt);
    const { x, y, ox, oy } = this;
    // ease() for every dot at the two rates, its factor worked out once a frame.
    const grow = 1 - Math.exp(-GROW_RATE * dt);
    const back = 1 - Math.exp(-RETURN_RATE * dt);
    for (let i = 0; i < this.count; i++) {
      let tx = 0;
      let ty = 0;
      if (this.hasPointer) {
        const ddx = x[i] - this.pointerX;
        const ddy = y[i] - this.pointerY;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= REACH * REACH || d2 === 0) {
          tx = 0;
          ty = 0;
        } else {
          const d = Math.sqrt(d2);
          const k = (1 - d / REACH) ** 2 * PUSH * this.gain;
          tx = (ddx / d) * k;
          ty = (ddy / d) * k;
        }
      }
      if (tx === 0 && ty === 0 && ox[i] === 0 && oy[i] === 0) continue;
      const growing = tx * tx + ty * ty > ox[i] * ox[i] + oy[i] * oy[i];
      const k = growing ? grow : back;
      ox[i] += (tx - ox[i]) * k;
      oy[i] += (ty - oy[i]) * k;
    }
  }

  /**
   * Draw the dots at time `t`. `openedAt` starts the reveal; `closedAt`, once set, the wind-down. `reveal` false draws
   * every dot fully (reduced motion: no reveal and no wind-down).
   */
  drawDots(ctx: CanvasRenderingContext2D, t: number, openedAt: number, closedAt: number | null, reveal: boolean) {
    if (!this.input) return;
    const { grid, batch } = this;
    const at = new Float64Array(3);
    const front = V * (t - openedAt);
    const back = closedAt === null ? 0 : V * (t - closedAt);
    const ripple = this.busy;
    batch.begin(5);
    for (let i = 0; i < this.count; i++) {
      grid.locate(this.x[i], this.y[i], at);
      const f = grid.sample(F, at);
      const wx = grid.sample(WX, at);
      const dm = this.dm[i];
      const dw = dm + 60 * (wx - 0.5);
      const lead = reveal ? clamp01((front + 40 - dw) / 80) : 1;
      const trail = reveal && closedAt !== null ? clamp01((dw - back + 40) / 80) : 1;
      if (lead <= 0 || trail <= 0) continue;
      let v = clamp01((f - 0.37) / 0.27) * (0.8 + 0.2 * this.fall400[i]);
      if (reveal) {
        const c = (front - dw) / 55;
        if (c < 3) v += 0.5 * Math.exp(-c * c) * (1 - v);
      }
      if (ripple > 0) {
        const rg = 0.5 + 0.5 * Math.cos((2 * Math.PI * (dw - V * t)) / 210);
        v += 0.42 * ripple * rg ** 4 * this.fall300[i] * (1 - v);
      }
      if (v < 0.2 && !(v / 0.2 >= 1.15 * this.threshold[i])) continue;
      const ox = this.ox[i];
      const oy = this.oy[i];
      const push = ox === 0 && oy === 0 ? 0 : Math.sqrt(ox * ox + oy * oy);
      const radius = (0.55 + 2.85 * v ** 1.25) * (0.3 + 0.7 * this.moat[i]) * lead * trail * (1 - Math.min(0.75, 0.034 * push));
      const colour = v > 0.84 ? 4 : v > 0.64 ? 3 : v > 0.44 ? 2 : v > 0.24 ? 1 : 0;
      batch.add(colour, this.x[i] + ox + 4.4 * (wx - 0.5), this.y[i] + oy + 7 * (f - 0.5), radius);
    }
    batch.flush(ctx, this.input.palette);
  }

  /** The wind-down is over. */
  done(t: number, closedAt: number | null): boolean {
    return closedAt !== null && V * (t - closedAt) > BACK_DONE;
  }
}
