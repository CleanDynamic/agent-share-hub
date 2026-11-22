/* The halftone layer's drawing (Reference C), with no React: the field on the coarse grid, the dots, the reveal and the
   wind-down, the density terms, the signing-in ripple and cursor repulsion. HalftoneLayer.tsx mounts the canvas and runs
   it; Part D adds the code style beside the dots.

   Every number here is Reference C's, as written. Times are seconds; lengths are CSS pixels. */

import { bayer, clamp01, CoarseGrid, DotBatch, dropRings, ease, fbm3, hash2, pn, ringsOf, shadeOf, smoothstep, swell, valueNoise, waveAt, type Rings } from "@/lib/dots/engine";
import { GLYPH_STEP_MS, SPLASH_MS, WATER_PHRASE_MS } from "@/lib/theme/motion";

import { CODE_COLUMN, CODE_LINE, type CodeSprites } from "./codeSprites";

/** Code style (Reference D): no character within the dialog grown by 10 sideways and 14 up and down. */
export const CODE_CLEAR_X = 10;
export const CODE_CLEAR_Y = 14;
/** The cursor clears a round hole this wide instead of pushing. */
const CODE_HOLE = 46;

/** The one speed the reveal, the wind-down and the ripple travel at. */
export const V = 280;
/** The wind-down is over, and the canvas goes, once `back` passes this. */
export const BACK_DONE = 520;
/** A full-screen background's dots sit on a 6px lattice centred in the viewport. */
export const DOT_STEP = 6;
/** No dot more than 6px inside the dialog. */
export const INSIDE_LIMIT = 6;

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
  /* The water's base tone and colour jitter per dot, fixed per layout. */
  private base = new Float32Array(0);
  private jitter = new Float32Array(0);
  private splashes: { x: number; y: number; at: number }[] = [];
  private ox = new Float32Array(0);
  private oy = new Float32Array(0);
  /* The code style's cells, worked out once per layout: centre, signed distance to the dialog, Bayer threshold. */
  private cells = 0;
  private cx = new Float32Array(0);
  private cy = new Float32Array(0);
  private cdm = new Float32Array(0);
  private cthreshold = new Float32Array(0);

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
    const base = new Float32Array(max);
    const jitter = new Float32Array(max);
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
        // Base tone: 0.42 + 0.22 * valueNoise(x * 0.07, y * 0.18) + 0.06 * (hash - 0.5); jitter of 0.11 either way.
        base[n] = 0.42 + 0.22 * valueNoise(px * 0.07, py * 0.18) + 0.06 * (hash2(col, row) - 0.5);
        jitter[n] = 0.22 * (hash2(col + 7919, row - 104729) - 0.5);
        n++;
      }
    }
    this.base = base;
    this.jitter = jitter;
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
    this.layoutCode(width, height, dialog);
  }

  /** The code style's grid: columns 12 apart, lines 23.5 apart, centred in the viewport, none whose box meets the dialog
      grown by 10 sideways and 14 up and down. */
  private layoutCode(width: number, height: number, dialog: Rect) {
    const centreX = width / 2;
    const centreY = height / 2;
    const clear = { left: dialog.left - CODE_CLEAR_X, right: dialog.right + CODE_CLEAR_X, top: dialog.top - CODE_CLEAR_Y, bottom: dialog.bottom + CODE_CLEAR_Y };
    const firstCol = -Math.ceil(centreX / CODE_COLUMN);
    const lastCol = Math.ceil((width - centreX) / CODE_COLUMN);
    const firstRow = -Math.ceil(centreY / CODE_LINE);
    const lastRow = Math.ceil((height - centreY) / CODE_LINE);
    const max = (lastCol - firstCol + 1) * (lastRow - firstRow + 1);
    const cx = new Float32Array(max);
    const cy = new Float32Array(max);
    const cdm = new Float32Array(max);
    const cthreshold = new Float32Array(max);
    let n = 0;
    for (let row = firstRow; row <= lastRow; row++) {
      for (let col = firstCol; col <= lastCol; col++) {
        const x = centreX + col * CODE_COLUMN;
        const y = centreY + row * CODE_LINE;
        const meets = x + CODE_COLUMN / 2 > clear.left && x - CODE_COLUMN / 2 < clear.right && y + CODE_LINE / 2 > clear.top && y - CODE_LINE / 2 < clear.bottom;
        if (meets) continue;
        cx[n] = x;
        cy[n] = y;
        cdm[n] = signedDistance(x, y, dialog);
        cthreshold[n] = bayer(col, row);
        n++;
      }
    }
    this.cells = n;
    this.cx = cx;
    this.cy = cy;
    this.cdm = cdm;
    this.cthreshold = cthreshold;
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

  /** A press at (x, y), in viewport pixels, at time `t`: its rings live for SPLASH_MS. */
  splash(x: number, y: number, t: number) {
    this.splashes.push({ x, y, at: t });
    if (this.splashes.length > 8) this.splashes.shift();
  }

  /** Every ring alive at `t`: the six drops over the viewport, and the splashes. */
  rings(t: number, still: boolean): Rings[] {
    if (!this.input) return [];
    const out = dropRings(t, this.input.width, this.input.height, WATER_PHRASE_MS / 1000);
    if (still) return out;
    this.splashes = this.splashes.filter((splash) => t - splash.at <= SPLASH_MS / 1000);
    for (const splash of this.splashes) {
      const own = ringsOf(splash.x, splash.y, t - splash.at, SPLASH_MS / 1000);
      if (own) out.push(own);
    }
    return out;
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
    const rings = this.rings(t, !reveal);
    batch.begin(3);
    for (let i = 0; i < this.count; i++) {
      grid.locate(this.x[i], this.y[i], at);
      const wx = grid.sample(WX, at);
      const dm = this.dm[i];
      const dw = dm + 60 * (wx - 0.5);
      const lead = reveal ? clamp01((front + 40 - dw) / 80) : 1;
      const trail = reveal && closedAt !== null ? clamp01((dw - back + 40) / 80) : 1;
      if (lead <= 0 || trail <= 0) continue;
      const x = this.x[i];
      const y = this.y[i];
      const base = this.base[i];
      // The water: the base, the swell, and the rings, which lift the tone and move the dot.
      const wave = rings.length ? waveAt(rings, x, y) : 0;
      let v = base + swell(x, y, t) + 0.42 * wave * (0.6 + base);
      if (reveal) {
        const c = (front - dw) / 55;
        if (c < 3) v += 0.5 * Math.exp(-c * c) * (1 - clamp01(v));
      }
      if (ripple > 0) {
        const rg = 0.5 + 0.5 * Math.cos((2 * Math.PI * (dw - V * t)) / 210);
        v += 0.42 * ripple * rg ** 4 * this.fall300[i] * (1 - clamp01(v));
      }
      v = clamp01(v);
      const dx = rings.length ? 3 * (waveAt(rings, x + 3, y) - wave) : 0;
      const dy = 1.3 * wave;
      const ox = this.ox[i];
      const oy = this.oy[i];
      const push = ox === 0 && oy === 0 ? 0 : Math.sqrt(ox * ox + oy * oy);
      const radius = DOT_STEP * 0.46 * (0.58 + 0.42 * v) * (0.3 + 0.7 * this.moat[i]) * lead * trail * (1 - Math.min(0.75, 0.034 * push));
      batch.add(shadeOf(v + this.jitter[i]), x + ox + dx, y + oy + dy, radius);
    }
    batch.flush(ctx, this.input.palette);
  }

  /**
   * Draw the code style at time `t` (Reference D): the same field, wx, dw, lead, trail, crest and signing-in ripple as the
   * dots, its own density and characters, from the sprite sheet at whole device pixels. Characters never move; the cursor
   * clears a round hole of radius 46.
   */
  drawCode(ctx: CanvasRenderingContext2D, t: number, openedAt: number, closedAt: number | null, sprites: CodeSprites, ratio: number) {
    if (!this.input) return;
    const { grid } = this;
    const at = new Float64Array(3);
    const front = V * (t - openedAt);
    const back = closedAt === null ? 0 : V * (t - closedAt);
    const ripple = this.busy;
    const hole = this.over && this.hasPointer;
    const rings = this.rings(t, false);
    const glyphStep = Math.floor((t * 1000) / GLYPH_STEP_MS);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < this.cells; i++) {
      const x = this.cx[i];
      const y = this.cy[i];
      if (hole) {
        const dx = x - this.pointerX;
        const dy = y - this.pointerY;
        if (dx * dx + dy * dy < CODE_HOLE * CODE_HOLE) continue;
      }
      grid.locate(x, y, at);
      const f = grid.sample(F, at);
      const wx = grid.sample(WX, at);
      const dm = this.cdm[i];
      const dw = dm + 60 * (wx - 0.5);
      const lead = clamp01((front + 40 - dw) / 80);
      const trail = closedAt === null ? 1 : clamp01((dw - back + 40) / 80);
      if (lead * trail < 0.5) continue;
      let v = clamp01((f - 0.44) / 0.3);
      const c = (front - dw) / 55;
      if (c < 3) v += 0.5 * Math.exp(-c * c) * (1 - v);
      if (ripple > 0) {
        const rg = 0.5 + 0.5 * Math.cos((2 * Math.PI * (dw - V * t)) / 210);
        v += 0.42 * ripple * rg ** 4 * Math.exp(-dm / 300) * (1 - v);
      }
      let char: number;
      if (v > 0.8) char = 4;
      else if (v > 0.62) char = 3;
      else if (v > 0.34) char = 2;
      else if (v > 0.2) char = 1;
      else if (v > 0.1) char = 0;
      else if (v >= 0.03 && this.cthreshold[i] <= 0.06) char = 0;
      else continue;
      // Where a ring is passing, the cell's character changes every GLYPH_STEP_MS.
      if (rings.length && Math.abs(waveAt(rings, x, y)) > 0.12) char = (char + 1 + glyphStep + Math.floor(hash2(i, 31) * 4)) % 5;
      // The sheet is in CODE_CHARS order: ".", "o", "0", "1", "8".
      const dx = Math.round((x - CODE_COLUMN / 2) * ratio);
      const dy = Math.round((y - CODE_LINE / 2) * ratio);
      ctx.drawImage(sprites.sheet, char * sprites.width, 0, sprites.width, sprites.height, dx, dy, sprites.width, sprites.height);
    }
  }

  /** The wind-down is over. */
  done(t: number, closedAt: number | null): boolean {
    return closedAt !== null && V * (t - closedAt) > BACK_DONE;
  }
}
