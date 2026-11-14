/* The shared drawing engine (Reference B): noise, the coarse field grid, batched dot drawing and the one animation
   loop. No React. The sign-in halftone layer and the fluid loading fields both draw through it.

   NOISE. A permutation table of 256 shuffled with a Park-Miller generator from seed 1337 (Fisher-Yates from the top:
   i = 255 down to 1, advance s = s * 16807 % 2147483647, j = s % (i + 1), swap), duplicated to 512. `pn` is 2D gradient
   noise with 16 directions at (k + 0.5) * 22.5 degrees, k = perm[perm[xi & 255] + (yi & 255)] & 15, the quintic fade,
   and 0.5 + 0.7 n. `fbm3` is three octaves at 0.6, 0.28 and 0.12.

   PERFORMANCE. The noise is worked out once a frame on a coarse grid of 20px nodes and every dot blends its four
   nearest nodes. Dots are drawn as one Path2D per palette colour and one fill per colour. The backing store is sized
   with devicePixelRatio. */

/* ── noise ── */

function buildPerm(): Uint8Array {
  const p = new Uint8Array(512);
  const base = new Array<number>(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  let s = 1337;
  for (let i = 255; i >= 1; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const swap = base[i];
    base[i] = base[j];
    base[j] = swap;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
}

export const PERM = buildPerm();

const GX = new Float64Array(16);
const GY = new Float64Array(16);
for (let k = 0; k < 16; k++) {
  const a = ((k + 0.5) * 22.5 * Math.PI) / 180;
  GX[k] = Math.cos(a);
  GY[k] = Math.sin(a);
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function corner(xi: number, yi: number, dx: number, dy: number): number {
  const k = PERM[PERM[xi & 255] + (yi & 255)] & 15;
  return GX[k] * dx + GY[k] * dy;
}

/** 2D gradient noise, about 0 to 1: 0.5 + 0.7 n. */
export function pn(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const n00 = corner(xi, yi, xf, yf);
  const n10 = corner(xi + 1, yi, xf - 1, yf);
  const n01 = corner(xi, yi + 1, xf, yf - 1);
  const n11 = corner(xi + 1, yi + 1, xf - 1, yf - 1);
  const u = fade(xf);
  const v = fade(yf);
  const top = n00 + (n10 - n00) * u;
  const bottom = n01 + (n11 - n01) * u;
  return 0.5 + 0.7 * (top + (bottom - top) * v);
}

/** Three octaves of `pn`. */
export function fbm3(x: number, y: number): number {
  return 0.6 * pn(x, y) + 0.28 * pn(2.03 * x + 17.1, 2.03 * y - 9.3) + 0.12 * pn(4.07 * x - 31.4, 4.07 * y + 5.7);
}

/* ── small helpers both layers use ── */

/** Clamped to 0..1. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** The 4 by 4 Bayer matrix, each cell's threshold as (B + 0.5) / 16. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (col: number, row: number) => (BAYER[(row & 3) * 4 + (col & 3)] + 0.5) / 16;

/** Ease `value` toward `target` at `rate` per second over `dt` seconds: x += (target − x)(1 − e^(−r·dt)). */
export const ease = (value: number, target: number, rate: number, dt: number) => value + (target - value) * (1 - Math.exp(-rate * dt));

/** A clockwise turn on screen (y down) of the pattern by `angle`: the sample coordinates turn the other way. */
export function unturn(dx: number, dy: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dx * c + dy * s, -dx * s + dy * c];
}

/* ── the coarse grid ── */

/** Nodes 20px apart across an area; each frame fills them, and each dot blends the four nearest. */
export const NODE = 20;

export class CoarseGrid {
  cols = 0;
  rows = 0;
  /** One Float32Array per channel, row-major. */
  channels: Float32Array[] = [];
  private originX = 0;
  private originY = 0;

  constructor(private readonly channelCount: number) {}

  /** Cover `width` by `height` (one node past each edge) starting at (x, y). */
  resize(x: number, y: number, width: number, height: number) {
    this.originX = x;
    this.originY = y;
    this.cols = Math.ceil(width / NODE) + 2;
    this.rows = Math.ceil(height / NODE) + 2;
    this.channels = Array.from({ length: this.channelCount }, () => new Float32Array(this.cols * this.rows));
  }

  /** Work every node out: `fill(x, y, out)` writes one value per channel into `out`. */
  fill(fill: (x: number, y: number, out: Float64Array) => void) {
    const out = new Float64Array(this.channelCount);
    for (let r = 0; r < this.rows; r++) {
      const y = this.originY + r * NODE;
      for (let c = 0; c < this.cols; c++) {
        fill(this.originX + c * NODE, y, out);
        const i = r * this.cols + c;
        for (let k = 0; k < this.channelCount; k++) this.channels[k][i] = out[k];
      }
    }
  }

  /** The node cell and the blend weights for a point: written into `at` as [index, fx, fy]. */
  locate(x: number, y: number, at: Float64Array) {
    let gx = (x - this.originX) / NODE;
    let gy = (y - this.originY) / NODE;
    if (gx < 0) gx = 0;
    if (gy < 0) gy = 0;
    if (gx > this.cols - 1.0001) gx = this.cols - 1.0001;
    if (gy > this.rows - 1.0001) gy = this.rows - 1.0001;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    at[0] = cy * this.cols + cx;
    at[1] = gx - cx;
    at[2] = gy - cy;
  }

  /** A channel's value at a located point: the bilinear blend of its four nodes. */
  sample(channel: number, at: Float64Array): number {
    const v = this.channels[channel];
    const i = at[0];
    const fx = at[1];
    const fy = at[2];
    const top = v[i] + (v[i + 1] - v[i]) * fx;
    const bottom = v[i + this.cols] + (v[i + this.cols + 1] - v[i + this.cols]) * fx;
    return top + (bottom - top) * fy;
  }
}

/* ── batched dots ── */

/** One Path2D per palette colour each frame, and one fill per colour. */
export class DotBatch {
  private paths: Path2D[] = [];

  begin(colours: number) {
    this.paths = Array.from({ length: colours }, () => new Path2D());
  }

  add(colour: number, x: number, y: number, radius: number) {
    if (radius <= 0) return;
    const path = this.paths[colour];
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, Math.PI * 2);
  }

  flush(ctx: CanvasRenderingContext2D, palette: readonly string[]) {
    for (let i = 0; i < this.paths.length; i++) {
      ctx.fillStyle = palette[i];
      ctx.fill(this.paths[i]);
    }
  }
}

/* ── the canvas and the loop ── */

/** Size a canvas's backing store for `width` by `height` CSS pixels at the device's pixel ratio; returns the ratio. */
export function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): number {
  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return ratio;
}

/**
 * One requestAnimationFrame loop. `frame(t, dt)` gets the time in seconds and the step since the last frame; returning
 * false stops the loop. It pauses while the tab is hidden and resumes on its return. Returns a stop function.
 */
export function startLoop(frame: (t: number, dt: number) => boolean | void): () => void {
  let id = 0;
  let last = -1;
  let running = true;
  const tick = (now: number) => {
    if (!running) return;
    const t = now / 1000;
    const dt = last < 0 ? 0 : Math.min(0.1, t - last);
    last = t;
    if (frame(t, dt) === false) {
      running = false;
      return;
    }
    id = requestAnimationFrame(tick);
  };
  const onVisibility = () => {
    if (!running) return;
    if (document.hidden) {
      cancelAnimationFrame(id);
      id = 0;
    } else if (!id) {
      last = -1;
      id = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  if (!document.hidden) id = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
