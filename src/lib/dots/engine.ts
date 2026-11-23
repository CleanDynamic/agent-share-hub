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

/* ── value noise and the per-dot hash (the water's base tone) ── */

/** A stable hash of two integers, 0 to 1 (Math.imul keeps it in 32 bits). */
export function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 2D value noise, 0 to 1: the hash at the four lattice corners, blended with a smoothstep. */
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = hash2(xi, yi) + (hash2(xi + 1, yi) - hash2(xi, yi)) * u;
  const bottom = hash2(xi, yi + 1) + (hash2(xi + 1, yi + 1) - hash2(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

/* ── the water: swell and drops ──
   Lengths are CSS pixels, times are seconds. `WATER_PHRASE_MS` and `WATER_DROPS` are decided in lib/theme/motion. */

/** The six drop points: fractions of the field's width and height, and when in the phrase each falls. */
export const DROP_POINTS: readonly (readonly [number, number, number])[] = [
  [0.18, 0.2, 0],
  [0.72, 0.46, 1.2],
  [0.32, 0.78, 1.8],
  [0.88, 0.1, 3.0],
  [0.55, 0.95, 3.6],
  [0.05, 0.55, 4.2],
];

/** A drop's rings are gone this long after it falls. */
export const RING_LIFE_S = 5.6;

/** The slow swell that lifts and lowers every dot's tone. */
export function swell(x: number, y: number, t: number): number {
  return 0.22 * Math.sin(x * 0.011 + y * 0.007 - t * 0.8) + 0.1 * Math.sin(x * 0.023 - y * 0.017 + t * 1.3);
}

/** One drop's train of rings at an age, worked out once a frame. `lo2` and `hi2` bound the squared distance the rings touch. */
export interface Rings {
  x: number;
  y: number;
  front: number;
  width: number;
  wavelength: number;
  amplitude: number;
  lo2: number;
  hi2: number;
}

/** The rings of a drop at `x`, `y` that fell `age` seconds ago, or null when they are gone (or not yet fallen). */
export function ringsOf(x: number, y: number, age: number, life = RING_LIFE_S): Rings | null {
  if (age < 0 || age > life) return null;
  const front = 150 * Math.pow(age, 0.8);
  const width = 40 + 30 * age;
  const lo = Math.max(0, front - 2.5 * width);
  const hi = front + 2.5 * width;
  return {
    x,
    y,
    front,
    width,
    wavelength: 38 + 20 * age,
    amplitude: ((1 - Math.exp(-5 * age)) * Math.exp(-0.5 * age)) * 1.25,
    lo2: lo * lo,
    hi2: hi * hi,
  };
}

/** The height of every drop's rings at a point, summed. */
export function waveAt(rings: readonly Rings[], x: number, y: number): number {
  let sum = 0;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const dx = x - ring.x;
    const dy = y - ring.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < ring.lo2 || d2 > ring.hi2) continue;
    const r = Math.sqrt(d2);
    const off = r - ring.front;
    const e = off / ring.width;
    sum += (ring.amplitude / Math.sqrt(1 + r / 320)) * Math.exp(-e * e) * Math.cos((2 * Math.PI * off) / ring.wavelength);
  }
  return sum;
}

/**
 * Every drop that is alive at `t` for a field `width` by `height`: this phrase's, and the two before it (a drop's rings
 * outlive the phrase, so they keep fading while the next arrive).
 */
export function dropRings(t: number, width: number, height: number, phraseS: number): Rings[] {
  const out: Rings[] = [];
  const phrase = Math.floor(t / phraseS);
  for (let k = phrase; k >= phrase - 2; k--) {
    for (const [fx, fy, at] of DROP_POINTS) {
      const rings = ringsOf(fx * width, fy * height, t - (k * phraseS + at));
      if (rings) out.push(rings);
    }
  }
  return out;
}

/* ── the three dot colours ── */

const FALLBACK = ["transparent", "transparent", "transparent"] as const;
let palette: string[] = [...FALLBACK];
let paletteTheme: string | null = null;

/**
 * The three dot tokens, deepest first (`--dot-deep`, `--dot-mid`, `--dot-hi`), read off the page: a canvas cannot read a
 * var(). Read again when the theme changes.
 */
export function dotPalette(): readonly string[] {
  if (typeof document === "undefined") return palette;
  const theme = document.documentElement.dataset.theme ?? "";
  if (theme === paletteTheme) return palette;
  paletteTheme = theme;
  const style = getComputedStyle(document.documentElement);
  palette = ["--dot-deep", "--dot-mid", "--dot-hi"].map((name, i) => style.getPropertyValue(name).trim() || FALLBACK[i]);
  return palette;
}

/** A tone and its jitter as a palette index: over 0.74 Hi (2), over 0.44 Mid (1), else Deep (0). */
export const shadeOf = (tone: number): 0 | 1 | 2 => (tone > 0.74 ? 2 : tone > 0.44 ? 1 : 0);

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
