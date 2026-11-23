/* Synth 13 Part B: the water behind the sign-in dialog, with no React. A full-screen field of the dot water (prompt 04)
   at a 6px pitch that answers the pointer.

   REPULSION, AS IF A BEAVER HAS ENTERED THE WATER. Within 220px of the pointer each dot is pushed away by
   26 · e^(−r² / (2 · (0.55 · 220)²)) px. Tone drops inside the hollow (−0.35 · e^(−r² / (2 · 88²))) and rises along its
   edge (+0.32 · e^(−(r − 165)² / (2 · 40²))), so a dark hollow with a bright ridge follows the pointer. While the pointer
   moves faster than 40px a second it drops a wake ring every 90ms: amplitude clamp(speed / 1400, 0.25, 0.9), front
   210 · age^0.75, envelope 26 + 34 · age, wavelength 34 + 26 · age, fading with e^(−1.4 · age).

   A CLICK SPLASHES IN CODE. Two rings from the point, the second 0.35s after the first (amplitudes 1.4 and 0.9, front
   260 · age^0.75, fading with e^(−0.9 · age), gone after SPLASH_MS). Where a splash ring passes, the dots of a cell are
   replaced by a code glyph on the loading blocks' 8 by 12 grid (CELL_W, CELL_H): a character from `01/{}<>;=+-_:*#[]()`,
   Geist Mono 11/500, centred in the cell, every cell filled, changing every GLYPH_STEP_MS, coloured by the same Deep, Mid
   and Hi rule as the dots. As the ring fades the cells go back to dots.

   Lengths are CSS pixels and times are seconds. The colours are the dot tokens, read off the page. */

import { GLYPH_STEP_MS, SPLASH_MS } from "@/lib/theme/motion";
import { CELL_H, CELL_W } from "@/pages/site/compose/loadingBlocks";

import { clamp01, CoarseGrid, DotBatch, dotPalette, hash2, shadeOf, swell, valueNoise } from "./engine";

/** The lattice: a full-screen background keeps 6px whatever the screen, so a wider screen has more dots, not bigger ones. */
export const WATER_PITCH = 6;

/* ── the pointer's hollow ── */
export const REACH = 220;
export const PUSH = 26;
const PUSH_SIGMA = 0.55 * REACH;
const HOLLOW_DEPTH = 0.35;
const HOLLOW_SIGMA = 88;
const RIDGE_HEIGHT = 0.32;
const RIDGE_AT = 165;
const RIDGE_SIGMA = 40;
/** The tone's reach: past this the hollow and its ridge are under 1%. */
const TONE_REACH = RIDGE_AT + 3.1 * RIDGE_SIGMA;

/* ── the wake ── */
export const WAKE_MIN_SPEED = 40;
export const WAKE_EVERY_S = 0.09;
const WAKE_FADE = 1.4;
/** A wake ring is gone once its fade is under 2%. */
const WAKE_LIFE_S = Math.log(50) / WAKE_FADE;

/* ── the splash ── */
export const SPLASH_GAP_S = 0.35;
export const SPLASH_AMPLITUDES = [1.4, 0.9] as const;
const SPLASH_FADE = 0.9;
const SPLASH_LIFE_S = SPLASH_MS / 1000;
/** A cell is a glyph while the splash's swell over it is above this. */
export const GLYPH_AT = 0.3;
export const GLYPHS = "01/{}<>;=+-_:*#[]()";
const GLYPH_STEP_S = GLYPH_STEP_MS / 1000;
export const GLYPH_FONT = `500 11px "Geist Mono", ui-monospace, monospace`;

/** Drawn at most 30 times a second. */
export const FRAME_S = 1 / 30;
/** The still frame's time under reduced motion. */
export const STILL_T = 3;

/** How hard the pointer pushes a dot at a distance, in px. */
export const pushAt = (r: number): number => (r >= REACH ? 0 : PUSH * Math.exp(-(r * r) / (2 * PUSH_SIGMA * PUSH_SIGMA)));

/** What the hollow and its ridge add to a dot's tone at a distance. */
export const hollowToneAt = (r: number): number =>
  r >= TONE_REACH
    ? 0
    : -HOLLOW_DEPTH * Math.exp(-(r * r) / (2 * HOLLOW_SIGMA * HOLLOW_SIGMA)) + RIDGE_HEIGHT * Math.exp(-((r - RIDGE_AT) * (r - RIDGE_AT)) / (2 * RIDGE_SIGMA * RIDGE_SIGMA));

/** A wake ring's amplitude for a pointer speed. */
export const wakeAmplitude = (speed: number): number => Math.min(0.9, Math.max(0.25, speed / 1400));

/** One ring: where it started, when, how strong, and which law it spreads by. */
export interface WaterRing {
  x: number;
  y: number;
  at: number;
  amplitude: number;
  kind: "wake" | "splash";
}

/** A ring's shape at an age: its front, envelope, wavelength and the strength left; null when it is gone or not begun. */
export function ringShape(ring: WaterRing, t: number): { front: number; envelope: number; wavelength: number; strength: number } | null {
  const age = t - ring.at;
  if (age < 0) return null;
  if (ring.kind === "wake") {
    if (age > WAKE_LIFE_S) return null;
    return { front: 210 * Math.pow(age, 0.75), envelope: 26 + 34 * age, wavelength: 34 + 26 * age, strength: ring.amplitude * Math.exp(-WAKE_FADE * age) };
  }
  if (age > SPLASH_LIFE_S) return null;
  return { front: 260 * Math.pow(age, 0.75), envelope: 26 + 34 * age, wavelength: 34 + 26 * age, strength: ring.amplitude * Math.exp(-SPLASH_FADE * age) };
}

/** The two rings a click sends from a point. */
export function splashRings(x: number, y: number, t: number): WaterRing[] {
  return SPLASH_AMPLITUDES.map((amplitude, i) => ({ x, y, at: t + i * SPLASH_GAP_S, amplitude, kind: "splash" as const }));
}

interface LiveRing {
  x: number;
  y: number;
  front: number;
  envelope: number;
  wavelength: number;
  strength: number;
  lo2: number;
  hi2: number;
}

function live(rings: readonly WaterRing[], t: number, kind: WaterRing["kind"]): LiveRing[] {
  const out: LiveRing[] = [];
  for (const ring of rings) {
    if (ring.kind !== kind) continue;
    const shape = ringShape(ring, t);
    if (!shape) continue;
    const lo = Math.max(0, shape.front - 2.5 * shape.envelope);
    const hi = shape.front + 2.5 * shape.envelope;
    out.push({ x: ring.x, y: ring.y, ...shape, lo2: lo * lo, hi2: hi * hi });
  }
  return out;
}

/** The rings' height at a point (the wave), and into `out[1]`, `out[2]` the push along x and y. */
function ringsAt(rings: readonly LiveRing[], x: number, y: number, out: Float64Array) {
  let h = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const dx = x - ring.x;
    const dy = y - ring.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < ring.lo2 || d2 > ring.hi2) continue;
    const r = Math.sqrt(d2) || 1;
    const off = r - ring.front;
    const e = off / ring.envelope;
    const wave = ring.strength * Math.exp(-e * e) * Math.cos((2 * Math.PI * off) / ring.wavelength);
    h += wave;
    px += (dx / r) * wave * 3;
    py += (dy / r) * wave * 3;
  }
  out[0] = h;
  out[1] = px;
  out[2] = py;
}

/** How much splash is over a point: the envelope alone, unsigned, so a whole band of cells turns to code. */
export function splashSwell(rings: readonly WaterRing[], x: number, y: number, t: number): number {
  let sum = 0;
  for (const ring of rings) {
    if (ring.kind !== "splash") continue;
    const shape = ringShape(ring, t);
    if (!shape) continue;
    const r = Math.hypot(x - ring.x, y - ring.y);
    const e = (r - shape.front) / shape.envelope;
    sum += shape.strength * Math.exp(-e * e);
  }
  return sum;
}

/** The glyph a cell shows at a time: stable within a step, a new one each GLYPH_STEP_MS. */
export function glyphOf(col: number, row: number, t: number): string {
  const step = Math.floor(t / GLYPH_STEP_S);
  return GLYPHS[Math.floor(hash2(col * 31 + step * 7919, row * 17 - step * 104729) * GLYPHS.length) % GLYPHS.length];
}

/**
 * The field: give it a canvas, its size, the pointer and the clicks; call `draw(t)` from one loop. Nothing here reads
 * the DOM but the canvas and the dot tokens.
 */
export class SignInWater {
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private cols = 0;
  private rows = 0;
  /** Each dot's still tone (value noise and a hash), worked out once a size. */
  private base = new Float32Array(0);
  private jitter = new Float32Array(0);
  private grid = new CoarseGrid(1);
  private batch = new DotBatch();
  private rings: WaterRing[] = [];
  private pointer: { x: number; y: number } | null = null;
  private lastWake = -Infinity;
  private lastMove: { x: number; y: number; t: number } | null = null;
  private cellCols = 0;
  private cellRows = 0;
  private code = new Uint8Array(0);

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext?.("2d") ?? null;
  }

  /** Cover `width` by `height` CSS pixels at the device's pixel ratio. */
  resize(width: number, height: number, ratio: number) {
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    const w = Math.max(1, Math.round(width * ratio));
    const h = Math.max(1, Math.round(height * ratio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.cols = Math.ceil(width / WATER_PITCH) + 1;
    this.rows = Math.ceil(height / WATER_PITCH) + 1;
    this.base = new Float32Array(this.cols * this.rows);
    this.jitter = new Float32Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        this.base[i] = 0.42 + 0.34 * (valueNoise(c * 0.09, r * 0.09) - 0.5) + 0.12 * (hash2(c, r) - 0.5);
        this.jitter[i] = (hash2(c + 7177, r - 3313) - 0.5) * 0.22;
      }
    }
    this.grid.resize(0, 0, width, height);
    this.cellCols = Math.ceil(width / CELL_W);
    this.cellRows = Math.ceil(height / CELL_H);
    this.code = new Uint8Array(this.cellCols * this.cellRows);
  }

  /** The pointer moved to (x, y) at `t`: the hollow follows it, and a fast move drops a wake ring every 90ms. */
  move(x: number, y: number, t: number) {
    const last = this.lastMove;
    this.pointer = { x, y };
    this.lastMove = { x, y, t };
    if (!last || t <= last.t) return;
    const speed = Math.hypot(x - last.x, y - last.y) / (t - last.t);
    if (speed > WAKE_MIN_SPEED && t - this.lastWake >= WAKE_EVERY_S) {
      this.lastWake = t;
      this.rings.push({ x, y, at: t, amplitude: wakeAmplitude(speed), kind: "wake" });
    }
  }

  /** The pointer left the water. */
  leave() {
    this.pointer = null;
    this.lastMove = null;
  }

  /** A click at (x, y) at `t`: two rings, 0.35s apart. */
  splash(x: number, y: number, t: number) {
    this.rings.push(...splashRings(x, y, t));
  }

  /** How many rings are alive: for tests and for the loop to rest. */
  ringCount(t: number): number {
    this.rings = this.rings.filter((ring) => ringShape(ring, t) !== null || ring.at > t);
    return this.rings.length;
  }

  /** Draw the field at `t`. */
  draw(t: number) {
    const ctx = this.ctx;
    if (!ctx || this.cols === 0) return;
    const palette = dotPalette();
    this.ringCount(t);
    const wakes = live(this.rings, t, "wake");
    const splashes = live(this.rings, t, "splash");

    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.grid.fill((x, y, out) => {
      out[0] = swell(x, y, t);
    });

    /* Which cells are code this frame. */
    const code = this.code;
    code.fill(0);
    let anyCode = false;
    if (splashes.length) {
      const splashRingsNow = this.rings.filter((ring) => ring.kind === "splash");
      for (let r = 0; r < this.cellRows; r++) {
        for (let c = 0; c < this.cellCols; c++) {
          if (splashSwell(splashRingsNow, (c + 0.5) * CELL_W, (r + 0.5) * CELL_H, t) > GLYPH_AT) {
            code[r * this.cellCols + c] = 1;
            anyCode = true;
          }
        }
      }
    }

    const at = new Float64Array(3);
    const wave = new Float64Array(3);
    const pointer = this.pointer;
    const allRings = wakes.concat(splashes);
    this.batch.begin(3);
    for (let r = 0; r < this.rows; r++) {
      const y0 = r * WATER_PITCH;
      for (let c = 0; c < this.cols; c++) {
        const x0 = c * WATER_PITCH;
        const i = r * this.cols + c;
        let x = x0;
        let y = y0;
        this.grid.locate(x0, y0, at);
        let tone = this.base[i] + this.grid.sample(0, at);
        if (allRings.length) {
          ringsAt(allRings, x0, y0, wave);
          tone += 0.45 * wave[0];
          x += wave[1];
          y += wave[2];
        }
        if (pointer) {
          const dx = x0 - pointer.x;
          const dy = y0 - pointer.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < TONE_REACH) {
            tone += hollowToneAt(d);
            const push = pushAt(d);
            if (push > 0 && d > 0) {
              x += (dx / d) * push;
              y += (dy / d) * push;
            }
          }
        }
        if (anyCode) {
          const cc = Math.floor(x0 / CELL_W);
          const cr = Math.floor(y0 / CELL_H);
          if (cc < this.cellCols && cr < this.cellRows && code[cr * this.cellCols + cc]) continue;
        }
        const v = clamp01(tone);
        this.batch.add(shadeOf(v + this.jitter[i]), x, y, WATER_PITCH * 0.46 * (0.58 + 0.42 * v));
      }
    }
    this.batch.flush(ctx, palette);

    if (anyCode) {
      ctx.font = GLYPH_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const byShade: [number, number, string][][] = [[], [], []];
      for (let r = 0; r < this.cellRows; r++) {
        for (let c = 0; c < this.cellCols; c++) {
          if (!code[r * this.cellCols + c]) continue;
          const cx = (c + 0.5) * CELL_W;
          const cy = (r + 0.5) * CELL_H;
          this.grid.locate(cx, cy, at);
          ringsAt(splashes, cx, cy, wave);
          const v = clamp01(0.55 + this.grid.sample(0, at) + 0.3 * wave[0]);
          byShade[shadeOf(v + (hash2(c, r) - 0.5) * 0.22)].push([cx, cy, glyphOf(c, r, t)]);
        }
      }
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = palette[s];
        for (const [cx, cy, glyph] of byShade[s]) ctx.fillText(glyph, cx, cy);
      }
    }
  }
}
