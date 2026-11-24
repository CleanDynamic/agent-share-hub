/* Mobile prompt 27 Part B: the dot water behind the sign-in dialog, with no React. One implementation for every screen size
   (it replaces Synth 13's `signinWater.ts`): a lattice of dots at a 6px pitch, laid out from 42px OUTSIDE every edge so a
   pushed dot slides in from off screen instead of leaving a bare strip.

   WHAT IS DRAWN. Only the water above the card: the field reads the `data-occlude` element's top, plus three rows, and nothing
   under it is worked out. Without one (the desktop dialog) it is the whole screen.

   THE WATER. Six drops on a 6.4s phrase (two in view, four just off the screen so their rings roll in from the sides and the
   top). Each ring: front 120 · age^0.8, width 34 + 26 · age, wavelength 36 + 20 · age, amplitude
   0.9 · (1 − e^(−5 age)) · e^(−0.55 age), falling off with 1 / √(1 + r / 260), gone after 5.6s. A low swell sits under them.

   THE FINGER IS THE BEAVER. While a finger is down (or a mouse is over the water) a hollow follows it: R = 140; dots within
   1.6 R are pushed out by 22 · e^(−r² / (2 (0.55 R)²)); tone drops in the middle and rises along the rim. The hollow eases in
   and out (its strength moves 18% of the way each frame) and trails the finger (its centre moves 35% each frame). Moving faster
   than 40px/s leaves wake rings, one every 0.15s.

   A QUICK TAP SPLASHES IN CODE. A touch under 250ms that moves under 12px sends two rings. Where a splash ring passes, the dots
   on even rows become real lines of this file's own source (`String(fn)`), character by character on the 6px columns, scrolling
   up six rows a second.

   LEFT ALONE, four seconds after the last touch (and after the page opens, never at once) a beaver swims across the upper water
   every nine seconds and ends with a splash in the middle.

   ROUND THE LOGO the water fades to the page: a distance field from the logo's own pixels (half resolution, a 3-cell box blur,
   alpha over 14, a two-pass chamfer, a 4px margin) and, over the last 54px, the dots shrink, thin and darken.

   SPEED. The waves are worked out on a 16px grid each frame and blended for each dot; each dot's steady values live in typed
   arrays made at setup; dots are stamped from pre-drawn sprites and characters from an atlas, at whole device pixels.

   Lengths are CSS pixels and times are seconds. */

import { clamp01, hash2, shadeOf, valueNoise } from "./engine";

/* ── the lattice ── */

export const PITCH = 6;
/** The lattice starts this far outside the left, right and top edges. */
export const OUTSET = 42;
/** Rows drawn under the card's top edge, so its rounded corners show water. */
export const ROWS_UNDER = 3;
/** The wave grid. */
export const GRID = 16;
/** The device pixel ratio never goes past this. */
export const MAX_RATIO = 2;
/** Sprite radii by size step, and the three dot colours. */
export const RADII = [0.9, 1.25, 1.6, 1.95] as const;

/* ── the drops ── */

export const PHRASE_S = 6.4;
export const DROP_LIFE_S = 5.6;

/** Where a drop falls, as `fx · W + ox` and `fy · Hv + oy`, and when in the phrase. Two are in view; four are just off the screen. */
export const DROPS: readonly { fx: number; ox: number; fy: number; oy: number; at: number }[] = [
  { fx: 0.18, ox: 0, fy: 0.2, oy: 0, at: 0 },
  { fx: 0, ox: -70, fy: 0.42, oy: 0, at: 0.8 },
  { fx: 0.8, ox: 0, fy: 0.62, oy: 0, at: 1.6 },
  { fx: 1, ox: 80, fy: 0.18, oy: 0, at: 3.2 },
  { fx: 0.45, ox: 0, fy: 0, oy: -90, at: 4.6 },
  { fx: 1, ox: 60, fy: 0.9, oy: 0, at: 5.6 },
];

/** A ring's shape at an age: the front, the width of its band, its wavelength and (for the amplitude) what is left. */
export interface RingShape {
  front: number;
  width: number;
  wavelength: number;
  amplitude: number;
}

const bandOf = (age: number) => ({ width: 34 + 26 * age, wavelength: 36 + 20 * age });

/** A drop's ring; null before it falls and after DROP_LIFE_S. */
export function dropShape(age: number): RingShape | null {
  if (age < 0 || age > DROP_LIFE_S) return null;
  return { front: 120 * Math.pow(age, 0.8), ...bandOf(age), amplitude: 0.9 * (1 - Math.exp(-5 * age)) * Math.exp(-0.55 * age) };
}

/** The fall-off with distance every ring shares. */
export const fallOff = (r: number): number => 1 / Math.sqrt(1 + r / 260);

/* ── the finger's hollow ── */

export const R = 140;
export const REACH_K = 1.6;
export const PUSH = 22;
const PUSH_SIGMA = 0.55 * R;
const DEPTH = 0.35;
const DEPTH_SIGMA = 0.4 * R;
const RIM = 0.32;
const RIM_AT = 0.75 * R;
/** How much of the way the hollow's strength and centre move each 60th of a second. */
export const STRENGTH_EASE = 0.18;
export const CENTRE_EASE = 0.35;

export const pushAt = (r: number): number => (r >= REACH_K * R ? 0 : PUSH * Math.exp(-(r * r) / (2 * PUSH_SIGMA * PUSH_SIGMA)));

export const hollowToneAt = (r: number): number =>
  r >= REACH_K * R ? 0 : -DEPTH * Math.exp(-(r * r) / (2 * DEPTH_SIGMA * DEPTH_SIGMA)) + RIM * Math.exp(-((r - RIM_AT) * (r - RIM_AT)) / 1800);

/* ── the wake ── */

export const WAKE_MIN_SPEED = 40;
export const WAKE_EVERY_S = 0.15;
export const WAKE_LIFE_S = 2.2;
const WAKE_FADE = 1.4;

export const wakeAmplitude = (speed: number): number => Math.min(0.9, Math.max(0.3, speed / 1200));

export function wakeShape(age: number, amplitude: number): RingShape | null {
  if (age < 0 || age > WAKE_LIFE_S) return null;
  return { front: 160 * Math.pow(age, 0.75), ...bandOf(age), amplitude: amplitude * Math.exp(-WAKE_FADE * age) };
}

/* ── the tap's splash ── */

export const TAP_MAX_MS = 250;
export const TAP_MAX_MOVE = 12;
export const SPLASH_AMPLITUDES = [1.4, 0.9] as const;
export const SPLASH_GAP_S = 0.35;
export const SPLASH_LIFE_S = 3.2;
const SPLASH_FADE = 0.9;
/** A dot on an even row is a character while the splash's strength over it is above this. */
export const CODE_AT = 0.3;

export function splashShape(age: number, amplitude: number): RingShape | null {
  if (age < 0 || age > SPLASH_LIFE_S) return null;
  return { front: 200 * Math.pow(age, 0.75), ...bandOf(age), amplitude: amplitude * Math.exp(-SPLASH_FADE * age) };
}

/** A touch is a tap when it was short and barely moved. */
export const isTap = (downMs: number, upMs: number, moved: number): boolean => upMs - downMs < TAP_MAX_MS && moved < TAP_MAX_MOVE;

/* ── the swimmer ── */

export const IDLE_S = 4;
export const SWIM_EVERY_S = 9;
export const SWIM_S = 3.6;

/** Where the swimming beaver is at `u` (0 to 1): smoothstep in time from −60 to W + 60, at Hv · (0.30 + 0.22 sin(πu)). */
export function swimAt(u: number, width: number, visible: number): { x: number; y: number } {
  const e = u * u * (3 - 2 * u);
  return { x: -60 + (width + 120) * e, y: visible * (0.3 + 0.22 * Math.sin(Math.PI * u)) };
}

/* ── the logo's fade ── */

export const FADE_PX = 54;
export const MARGIN_PX = 4;
export const LOGO_ALPHA = 14;
/** Over this much strength the dots are fully there; under 12% a character drops out. */
export const CODE_DROP = 0.12;

const smooth = (u: number) => u * u * (3 - 2 * u);

/** The water's strength at `d` pixels from the logo's margin: 0 at the margin, 1 from 54px out. */
export const logoStrength = (d: number): number => (d <= 0 ? 0 : d >= FADE_PX ? 1 : smooth(d / FADE_PX));

/**
 * Cells' distance (in cells) to the logo, from an alpha channel: a 3-cell box blur (so the faint water lines in the logo join into
 * one shape), cells with alpha over 14 are the logo, then a two-pass chamfer with steps of 1 and √2.
 */
export function distanceFromAlpha(alpha: ArrayLike<number>, w: number, h: number): Float32Array {
  const blurX = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + Math.max(0, x - 1)] + alpha[y * w + x] + alpha[y * w + Math.min(w - 1, x + 1)];
      blurX[y * w + x] = a / 3;
    }
  }
  const d = new Float32Array(w * h);
  const INF = 1e9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (blurX[Math.max(0, y - 1) * w + x] + blurX[y * w + x] + blurX[Math.min(h - 1, y + 1) * w + x]) / 3;
      d[y * w + x] = a > LOGO_ALPHA ? 0 : INF;
    }
  }
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}

/** The distance from a point to a rounded box, negative inside. The fallback when the logo's pixels cannot be read. */
export function boxDistance(x: number, y: number, box: { x: number; y: number; w: number; h: number }, radius = 12): number {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const qx = Math.abs(x - cx) - (box.w / 2 - radius);
  const qy = Math.abs(y - cy) - (box.h / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

export interface LogoBox {
  img: CanvasImageSource | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far a distance field reaches round the logo: past FADE_PX and its margin. */
const PAD = 64;
/** The field is worked at half resolution. */
const HALF = 2;

/** Pixels from the logo (the margin already taken off), for any point; large far away. */
export class LogoMap {
  private cells: Float32Array | null = null;
  private ox = 0;
  private oy = 0;
  private cw = 0;
  private ch = 0;

  constructor(private readonly box: LogoBox) {
    if (box.img && typeof document !== "undefined") this.read(box.img);
  }

  private read(img: CanvasImageSource) {
    try {
      const { x, y, w, h } = this.box;
      this.ox = x - PAD;
      this.oy = y - PAD;
      this.cw = Math.ceil((w + 2 * PAD) / HALF);
      this.ch = Math.ceil((h + 2 * PAD) / HALF);
      const canvas = document.createElement("canvas");
      canvas.width = this.cw;
      canvas.height = this.ch;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, PAD / HALF, PAD / HALF, w / HALF, h / HALF);
      const data = ctx.getImageData(0, 0, this.cw, this.ch).data;
      const alpha = new Uint8Array(this.cw * this.ch);
      let any = false;
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = data[i * 4 + 3];
        if (alpha[i] > LOGO_ALPHA) any = true;
      }
      if (any) this.cells = distanceFromAlpha(alpha, this.cw, this.ch);
    } catch {
      this.cells = null;
    }
  }

  /** The distance in px from the logo's margin. */
  distance(x: number, y: number): number {
    if (!this.cells) return boxDistance(x, y, this.box) - MARGIN_PX;
    const cx = Math.floor((x - this.ox) / HALF);
    const cy = Math.floor((y - this.oy) / HALF);
    if (cx < 0 || cy < 0 || cx >= this.cw || cy >= this.ch) return 1e3;
    return this.cells[cy * this.cw + cx] * HALF - MARGIN_PX;
  }

  strength(x: number, y: number): number {
    return logoStrength(this.distance(x, y));
  }
}

/* ── the code ── */

/** The lines of a function's source: spaces collapsed, lines over 8 characters kept; a minified one-liner is cut at its `;`, `{` and `}`. */
export function codeLinesOf(fn: (...args: never[]) => unknown): string[] {
  const source = String(fn);
  let lines = source.split("\n");
  if (lines.length < 12) lines = source.split(/(?<=[;{},])/);
  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 8);
}

export const CODE_FONT = `500 10px "Geist Mono", ui-monospace, monospace`;
/** Lines scroll up six lattice rows a second: three lines of two rows. */
export const SCROLL_ROWS_S = 6;

/* ── the field ── */

/** What the page tells the field about its surroundings. */
export interface FieldLayout {
  /** The top of the `data-occlude` element, in the canvas's own pixels; null with nothing in front. */
  occludeTop: number | null;
  /** The `data-clear` image and where it sits; null with none. */
  logo: LogoBox | null;
}

interface Ring {
  x: number;
  y: number;
  front: number;
  width: number;
  wavelength: number;
  amplitude: number;
  lo2: number;
  hi2: number;
  splash: boolean;
}

interface Timed {
  x: number;
  y: number;
  at: number;
  amplitude: number;
}

/** The still frame's time under reduced motion. */
export const STILL_T = 3;

/** Height, the splash's strength over a point, and the push along x and y. */
const CHANNELS = 4;

export class SignInField {
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private cols = 0;
  private rows = 0;
  /* Each dot's steady values, made at setup. */
  private base = new Float32Array(0);
  private jitter = new Float32Array(0);
  private gridIndex = new Int32Array(0);
  private gridFx = new Float32Array(0);
  private gridFy = new Float32Array(0);
  private strength = new Float32Array(0);
  /* The wave grid: one Float32Array per channel. */
  private gCols = 0;
  private gRows = 0;
  private grid: Float32Array[] = [];
  private layoutState: FieldLayout = { occludeTop: null, logo: null };
  private logo: LogoMap | null = null;
  private logoKey = "";
  private limitRows = 0;
  private visible = 0;
  /* Sprites, atlas. */
  private palette: readonly string[] | null = null;
  private spriteRatio = 0;
  private sprites: HTMLCanvasElement[][] = [];
  private atlas: HTMLCanvasElement | null = null;
  private atlasIndex = new Map<string, number>();
  private atlasCell = { w: 0, h: 0 };
  private lines: string[] = [];
  /* Time and touch. */
  t = 0;
  private wakes: Timed[] = [];
  private splashes: Timed[] = [];
  private hollow = { x: 0, y: 0, strength: 0 };
  private target = { x: 0, y: 0, on: false };
  private finger: { x: number; y: number; downMs: number; startX: number; startY: number } | null = null;
  private hovering = false;
  private lastTarget: { x: number; y: number } | null = null;
  private speed = 0;
  private lastWakeT = -Infinity;
  private nextSwimAt = IDLE_S;
  private swimStart = -1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext?.("2d") ?? null;
    this.lines = codeLinesOf(SignInField.prototype.draw as never);
  }

  /* ── setup ── */

  /** Cover `width` by `height` CSS pixels at the device's pixel ratio (never over 2). */
  resize(width: number, height: number, ratio: number) {
    this.width = width;
    this.height = height;
    this.ratio = Math.min(MAX_RATIO, Math.max(1, ratio));
    const w = Math.max(1, Math.round(width * this.ratio));
    const h = Math.max(1, Math.round(height * this.ratio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.cols = Math.ceil((width + 2 * OUTSET) / PITCH) + 1;
    this.rows = Math.ceil((height + 2 * OUTSET) / PITCH) + 1;
    const n = this.cols * this.rows;
    this.base = new Float32Array(n);
    this.jitter = new Float32Array(n);
    this.gridIndex = new Int32Array(n);
    this.gridFx = new Float32Array(n);
    this.gridFy = new Float32Array(n);
    this.strength = new Float32Array(n).fill(1);
    this.gCols = Math.ceil((width + 2 * OUTSET) / GRID) + 2;
    this.gRows = Math.ceil((height + 2 * OUTSET) / GRID) + 2;
    this.grid = Array.from({ length: CHANNELS }, () => new Float32Array(this.gCols * this.gRows));
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const x = c * PITCH - OUTSET;
        const y = r * PITCH - OUTSET;
        this.base[i] = 0.3 + 0.22 * valueNoise(0.012 * x, 0.03 * y) + 0.07 * (hash2(c, r) - 0.5);
        this.jitter[i] = hash2(c + 7177, r - 3313) - 0.5;
        const gx = (c * PITCH) / GRID;
        const gy = (r * PITCH) / GRID;
        const cx = Math.min(this.gCols - 2, Math.floor(gx));
        const cy = Math.min(this.gRows - 2, Math.floor(gy));
        this.gridIndex[i] = cy * this.gCols + cx;
        this.gridFx[i] = gx - cx;
        this.gridFy[i] = gy - cy;
      }
    }
    this.logoKey = "";
    this.applyLayout();
  }

  /** Tell the field where the card's top edge and the logo are. Cheap when nothing moved. */
  layout(next: FieldLayout) {
    this.layoutState = next;
    this.applyLayout();
  }

  private applyLayout() {
    if (this.cols === 0) return;
    const { occludeTop, logo } = this.layoutState;
    const limit = occludeTop === null ? this.height + OUTSET : Math.min(this.height + OUTSET, occludeTop + ROWS_UNDER * PITCH);
    this.limitRows = Math.max(0, Math.min(this.rows, Math.floor((limit + OUTSET) / PITCH) + 1));
    this.visible = occludeTop === null ? this.height : Math.max(1, occludeTop);
    const key = logo ? `${logo.x.toFixed(1)},${logo.y.toFixed(1)},${logo.w.toFixed(1)},${logo.h.toFixed(1)},${logo.img ? 1 : 0}` : "";
    if (key === this.logoKey) return;
    this.logoKey = key;
    this.logo = logo ? new LogoMap(logo) : null;
    this.strength.fill(1);
    if (!this.logo) return;
    for (let r = 0; r < this.rows; r++) {
      const y = r * PITCH - OUTSET;
      if (y < logo!.y - PAD || y > logo!.y + logo!.h + PAD) continue;
      for (let c = 0; c < this.cols; c++) {
        const x = c * PITCH - OUTSET;
        if (x < logo!.x - PAD || x > logo!.x + logo!.w + PAD) continue;
        this.strength[r * this.cols + c] = this.logo.strength(x, y);
      }
    }
  }

  /* ── touch ── */

  private touch() {
    this.nextSwimAt = this.t + IDLE_S;
    this.swimStart = -1;
  }

  /** A finger (or a pressed button) at (x, y). `ms` is the event's time. */
  pointerDown(x: number, y: number, ms: number) {
    this.touch();
    this.finger = { x, y, downMs: ms, startX: x, startY: y };
    this.aim(x, y);
  }

  pointerMove(x: number, y: number) {
    if (!this.finger && !this.hovering) return;
    this.touch();
    this.aim(x, y);
  }

  /** The finger lifted: a short touch that barely moved splashes where it was. */
  pointerUp(x: number, y: number, ms: number, keepHover = false) {
    const finger = this.finger;
    this.finger = null;
    this.touch();
    if (finger && isTap(finger.downMs, ms, Math.hypot(x - finger.startX, y - finger.startY))) this.splash(x, y);
    this.target.on = keepHover && this.hovering;
  }

  pointerCancel() {
    this.finger = null;
    this.hovering = false;
    this.target.on = false;
  }

  /** A mouse over the water follows it as a finger does, without a button. */
  hover(x: number, y: number) {
    this.hovering = true;
    this.touch();
    this.aim(x, y);
  }

  leave() {
    this.hovering = false;
    if (!this.finger) this.target.on = false;
  }

  private aim(x: number, y: number) {
    if (!this.target.on && this.hollow.strength < 0.02) {
      this.hollow.x = x;
      this.hollow.y = y;
    }
    this.target.x = x;
    this.target.y = y;
    this.target.on = true;
  }

  /** Two rings from a point, the second 0.35s later. */
  splash(x: number, y: number) {
    SPLASH_AMPLITUDES.forEach((amplitude, i) => this.splashes.push({ x, y, at: this.t + i * SPLASH_GAP_S, amplitude }));
  }

  /** Rings alive now (for tests and for the loop to know the water is busy). */
  ringCount(): number {
    return this.wakes.length + this.splashes.length;
  }

  /* ── time ── */

  /** Advance `dt` seconds (the caller caps it at 50ms): the swimmer, the hollow, the wake. */
  step(dt: number) {
    this.t += dt;
    const t = this.t;
    this.wakes = this.wakes.filter((ring) => t - ring.at <= WAKE_LIFE_S);
    this.splashes = this.splashes.filter((ring) => t - ring.at <= SPLASH_LIFE_S);

    /* Left alone: a beaver crosses the upper water. */
    if (!this.finger && !this.hovering && this.swimStart < 0 && t >= this.nextSwimAt) {
      this.swimStart = t;
      this.nextSwimAt = t + SWIM_EVERY_S;
    }
    if (this.swimStart >= 0) {
      const u = (t - this.swimStart) / SWIM_S;
      if (u >= 1) {
        this.swimStart = -1;
        this.target.on = false;
        this.splash(this.width / 2, this.visible / 2);
      } else {
        const at = swimAt(u, this.width, this.visible);
        this.aim(at.x, at.y);
      }
    }

    /* The hollow trails the finger and eases in and out; both per 60th of a second, so a faster screen is no quicker. */
    const frames = dt * 60;
    const strength = 1 - Math.pow(1 - STRENGTH_EASE, frames);
    const centre = 1 - Math.pow(1 - CENTRE_EASE, frames);
    this.hollow.strength += ((this.target.on ? 1 : 0) - this.hollow.strength) * strength;
    if (this.target.on) {
      this.hollow.x += (this.target.x - this.hollow.x) * centre;
      this.hollow.y += (this.target.y - this.hollow.y) * centre;
    }
    if (this.hollow.strength < 0.002 && !this.target.on) this.hollow.strength = 0;

    /* Wake rings while the target moves quickly. */
    if (this.target.on && this.lastTarget && dt > 0) {
      const now = Math.hypot(this.target.x - this.lastTarget.x, this.target.y - this.lastTarget.y) / dt;
      this.speed += (now - this.speed) * 0.5;
      if (this.speed > WAKE_MIN_SPEED && t - this.lastWakeT >= WAKE_EVERY_S) {
        this.lastWakeT = t;
        this.wakes.push({ x: this.target.x, y: this.target.y, at: t, amplitude: wakeAmplitude(this.speed) });
      }
    } else {
      this.speed = 0;
    }
    this.lastTarget = this.target.on ? { x: this.target.x, y: this.target.y } : null;
  }

  /* ── drawing ── */

  private ringsAt(t: number, still: boolean): Ring[] {
    const out: Ring[] = [];
    const add = (x: number, y: number, shape: RingShape | null, splash: boolean) => {
      if (!shape) return;
      const lo = Math.max(0, shape.front - 3 * shape.width);
      const hi = shape.front + 3 * shape.width;
      out.push({ x, y, ...shape, lo2: lo * lo, hi2: hi * hi, splash });
    };
    const phrase = Math.floor(t / PHRASE_S);
    for (let k = phrase; k >= phrase - 1; k--) {
      for (const drop of DROPS) {
        add(drop.fx * this.width + drop.ox, drop.fy * this.visible + drop.oy, dropShape(t - (k * PHRASE_S + drop.at)), false);
      }
    }
    if (still) return out;
    for (const wake of this.wakes) add(wake.x, wake.y, wakeShape(t - wake.at, wake.amplitude), false);
    for (const ring of this.splashes) add(ring.x, ring.y, splashShape(t - ring.at, ring.amplitude), true);
    return out;
  }

  /** The waves on the 16px grid: height (with the swell), the splash's strength, and the push along x and y. */
  private fillGrid(rings: readonly Ring[], t: number) {
    const rowsG = Math.min(this.gRows, Math.ceil((this.limitRows * PITCH) / GRID) + 2);
    const [height, code, px, py] = this.grid;
    for (let gy = 0; gy < rowsG; gy++) {
      const y = gy * GRID - OUTSET;
      for (let gx = 0; gx < this.gCols; gx++) {
        const x = gx * GRID - OUTSET;
        let h = 0.18 * Math.sin(0.009 * x + 0.006 * y - 0.7 * t) + 0.08 * Math.sin(0.02 * x - 0.015 * y + 1.1 * t);
        let c = 0;
        let pushX = 0;
        let pushY = 0;
        for (let k = 0; k < rings.length; k++) {
          const ring = rings[k];
          const dx = x - ring.x;
          const dy = y - ring.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < ring.lo2 || d2 > ring.hi2) continue;
          const r = Math.sqrt(d2) || 1;
          const off = r - ring.front;
          if (off > 3 * ring.width || off < -3 * ring.width) continue;
          const e = off / ring.width;
          const env = ring.amplitude * fallOff(r) * Math.exp(-e * e);
          const wave = env * Math.cos((2 * Math.PI * off) / ring.wavelength);
          h += 0.45 * wave;
          pushX += (dx / r) * wave * 3;
          pushY += (dy / r) * wave * 3;
          if (ring.splash) c += ring.amplitude * Math.exp(-e * e);
        }
        const i = gy * this.gCols + gx;
        height[i] = h;
        code[i] = c;
        px[i] = pushX;
        py[i] = pushY;
      }
    }
  }

  private ensureSprites(palette: readonly string[]) {
    if (this.palette === palette && this.spriteRatio === this.ratio && this.sprites.length) return;
    this.palette = palette;
    this.spriteRatio = this.ratio;
    this.sprites = palette.map((colour) =>
      RADII.map((radius) => {
        const size = Math.ceil(radius * 2 * this.ratio) + 2;
        const sprite = document.createElement("canvas");
        sprite.width = size;
        sprite.height = size;
        const sc = sprite.getContext("2d");
        if (sc) {
          sc.fillStyle = colour;
          sc.beginPath();
          sc.arc(size / 2, size / 2, radius * this.ratio, 0, Math.PI * 2);
          sc.fill();
        }
        return sprite;
      }),
    );
    this.buildAtlas(palette);
  }

  private buildAtlas(palette: readonly string[]) {
    const chars = new Set<string>();
    for (const line of this.lines) for (const ch of line) if (ch !== " ") chars.add(ch);
    this.atlasIndex = new Map([...chars].map((ch, i) => [ch, i]));
    const cw = Math.round(PITCH * this.ratio);
    const chh = Math.round(14 * this.ratio);
    this.atlasCell = { w: cw, h: chh };
    const atlas = document.createElement("canvas");
    atlas.width = Math.max(1, chars.size * cw);
    atlas.height = chh * palette.length;
    const ac = atlas.getContext("2d");
    if (ac) {
      ac.font = CODE_FONT.replace("10px", `${10 * this.ratio}px`);
      ac.textAlign = "center";
      ac.textBaseline = "middle";
      palette.forEach((colour, s) => {
        ac.fillStyle = colour;
        for (const [ch, i] of this.atlasIndex) ac.fillText(ch, i * cw + cw / 2, s * chh + chh / 2);
      });
    }
    this.atlas = atlas;
  }

  /** The fonts arrived after the atlas was made: draw it again. */
  refreshAtlas() {
    this.palette = null;
  }

  /** Draw the field at its own time. `still` draws one still frame (reduced motion): the drops only. */
  draw(palette: readonly string[], still = false) {
    const ctx = this.ctx;
    if (!ctx || this.cols === 0 || typeof document === "undefined") return;
    const t = still ? STILL_T : this.t;
    this.ensureSprites(palette);
    const rings = this.ringsAt(t, still);
    this.fillGrid(rings, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const [height, code, px, py] = this.grid;
    const gc = this.gCols;
    const ratio = this.ratio;
    const hollow = still ? { x: 0, y: 0, strength: 0 } : this.hollow;
    const reach = REACH_K * R;
    const lines = this.lines;
    const scroll = Math.floor((SCROLL_ROWS_S / 2) * t);
    const first = OUTSET / PITCH;
    const cw = this.atlasCell.w;
    const chh = this.atlasCell.h;
    const maxX = this.canvas.width;
    const maxY = this.canvas.height;

    for (let r = 0; r < this.limitRows; r++) {
      const y0 = r * PITCH - OUTSET;
      const line = r % 2 === 0 && lines.length ? lines[((r >> 1) + scroll) % lines.length] : null;
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const s = this.strength[i];
        if (s <= 0) continue;
        const x0 = c * PITCH - OUTSET;
        const g = this.gridIndex[i];
        const fx = this.gridFx[i];
        const fy = this.gridFy[i];
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        let tone = this.base[i] + height[g] * w00 + height[g + 1] * w10 + height[g + gc] * w01 + height[g + gc + 1] * w11;
        let x = x0;
        let y = y0;
        x += px[g] * w00 + px[g + 1] * w10 + px[g + gc] * w01 + px[g + gc + 1] * w11;
        y += py[g] * w00 + py[g + 1] * w10 + py[g + gc] * w01 + py[g + gc + 1] * w11;
        if (hollow.strength > 0) {
          const dx = x0 - hollow.x;
          const dy = y0 - hollow.y;
          if (dx < reach && dx > -reach && dy < reach && dy > -reach) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < reach) {
              tone += hollowToneAt(d) * hollow.strength;
              if (d > 0) {
                const push = pushAt(d) * hollow.strength;
                x += (dx / d) * push;
                y += (dy / d) * push;
              }
            }
          }
        }
        const fade = 0.25 + 0.75 * s;
        tone *= fade;
        const jit = this.jitter[i] * 0.22 * s;
        const v = clamp01(tone);

        /* A splash turns an even row's dots into the next characters of a line of this file's own source. */
        if (line) {
          const strengthHere = code[g] * w00 + code[g + 1] * w10 + code[g + gc] * w01 + code[g + gc + 1] * w11;
          if (strengthHere > CODE_AT && this.atlas) {
            const k = c - first;
            const ch = k >= 0 && k < line.length ? line[k] : " ";
            if (ch !== " ") {
              const edge = this.logo && s < 1 ? Math.min(this.logo.strength(x0 - 3, y0), this.logo.strength(x0 + 3, y0)) : 1;
              const index = this.atlasIndex.get(ch);
              if (edge >= CODE_DROP && s >= CODE_DROP && index !== undefined) {
                const shade = shadeOf(clamp01(v + 0.25) * (0.25 + 0.75 * Math.min(s, edge)) + jit);
                const dxp = Math.round(x * ratio - cw / 2);
                const dyp = Math.round(y * ratio - chh / 2);
                if (dxp > -cw && dyp > -chh && dxp < maxX && dyp < maxY) ctx.drawImage(this.atlas, index * cw, shade * chh, cw, chh, dxp, dyp, cw, chh);
              }
            }
            continue;
          }
        }

        /* Thin round the logo. */
        if (s < 1 && this.jitter[i] + 0.5 > s + 0.1) continue;
        let ri = v < 0.34 ? 0 : v < 0.52 ? 1 : v < 0.7 ? 2 : 3;
        if (s < 0.67) ri = Math.max(0, ri - (s < 0.34 ? 2 : 1));
        const sprite = this.sprites[shadeOf(v + jit)][ri];
        const sx = Math.round(x * ratio - sprite.width / 2);
        const sy = Math.round(y * ratio - sprite.height / 2);
        if (sx > -sprite.width && sy > -sprite.height && sx < maxX && sy < maxY) ctx.drawImage(sprite, sx, sy);
      }
    }
  }
}
