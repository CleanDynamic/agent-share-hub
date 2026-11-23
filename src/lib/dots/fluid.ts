/* Fluid loading fields, with no React: every loading state's shapes drawn as a dot field of water that holds their form
   without being hard rectangles.

   A REGION is one canvas over one loading area (a page placeholder, a panel, or one small element). Its SHAPES are the
   boxes of the skeletons inside it, measured relative to it, each with its corner radius. ONE FIELD PER AREA: the drops
   are placed over the region as fractions of its width and height, so the rings travel across every row of it together.
   ONE LOOP drives every region on the page, at 30 frames a second; a region that is off screen is skipped, and the loop
   stops when no region is on screen. Under reduced motion each region draws one still frame at t = 3, with no fade and
   no splash.

   THE LOOK. One square lattice, pitch 4px. Dot radius pitch * 0.46 * (0.58 + 0.42 * tone). Three colours from the dot
   tokens (tone over 0.74 Hi, over 0.44 Mid, else Deep, with a per-dot jitter of 0.11 either way so the colours dither).
   Tone is a base (value noise and a hash) plus a slow swell plus the rings of the drops (engine.ts); the rings also move
   each dot. The rhythm (`WATER_PHRASE_MS`, `WATER_DROPS`, `SPLASH_MS`) is decided in lib/theme/motion. Times are seconds;
   lengths are CSS pixels. */

import { BASE, SPLASH_MS, WATER_DROPS, WATER_PHRASE_MS } from "@/lib/theme/motion";

import { clamp01, dotPalette, dropRings, shadeOf, hash2, ringsOf, sizeCanvas, startLoop, swell, valueNoise, waveAt, DotBatch, DROP_POINTS, type Rings } from "./engine";

/** The lattice: 4px for a loading field (6px for a full-screen background). */
export const PITCH = 4;
/** A spinner keeps its own 7px circle of dots. */
export const STEP = 7;
export const MAX_RADIUS = 3;
/** A first show fades in over 200ms; the dots fade out over 200ms when the content is ready (BLOCKS_OUT_MS). */
const FADE_S = BASE / 1000;
/** Swapping placeholders: the old dots shrink out over 300ms. */
const SWAP_OUT_S = 0.3;
/** Drawn at most this often. */
const FRAME_S = 1 / 30;
/** InlineLoader: the bright arc goes round once every 1.1s (5.7 rad/s); the centre dot holds at 0.62. */
const ARC_SPEED = 5.7;
const CENTRE_V = 0.62;
const STILL_T = 3;
const PHRASE_S = WATER_PHRASE_MS / 1000;
const SPLASH_S = SPLASH_MS / 1000;

if (DROP_POINTS.length !== WATER_DROPS) throw new Error("the drop points and WATER_DROPS disagree");

const room = dotPalette;

const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const now = () => performance.now() / 1000;

/** A shape inside a region: its box relative to the region, and its corner radius. */
export interface Shape {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** Signed distance from a point to a rounded rectangle (negative inside). */
export function roundedDistance(px: number, py: number, s: Shape): number {
  const r = Math.min(s.radius, s.width / 2, s.height / 2);
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const qx = Math.abs(px - cx) - (s.width / 2 - r);
  const qy = Math.abs(py - cy) - (s.height / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Where a shape's dots go, in region coordinates: on the page-wide 4px lattice for large shapes; for thin shapes
 * (height ≤ 28) rows centred on the shape and columns on the page lattice; for small shapes (both sides ≤ 44) rows and
 * columns centred on the shape. A dot is kept when its signed distance to the rounded box is ≤ 2.
 */
export function dotsOf(s: Shape, pageX: number, pageY: number): { x: number[]; y: number[]; sd: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const sds: number[] = [];
  const small = s.width <= 44 && s.height <= 44;
  const thin = !small && s.height <= 28;
  const pageGrid = (from: number, to: number, origin: number) => {
    const out: number[] = [];
    for (let v = Math.ceil((from + origin) / PITCH) * PITCH; v <= to + origin; v += PITCH) out.push(v - origin);
    return out;
  };
  const centred = (start: number, length: number) => {
    const count = Math.max(1, Math.round(length / PITCH));
    const first = start + length / 2 - ((count - 1) * PITCH) / 2;
    return Array.from({ length: count }, (_, i) => first + i * PITCH);
  };
  const columns = small ? centred(s.x, s.width) : pageGrid(s.x - 2, s.x + s.width + 2, pageX);
  const rows = small || thin ? centred(s.y, s.height) : pageGrid(s.y - 2, s.y + s.height + 2, pageY);
  for (const y of rows) {
    for (const x of columns) {
      const sd = roundedDistance(x, y, s);
      if (sd <= 2) {
        xs.push(x);
        ys.push(y);
        sds.push(sd);
      }
    }
  }
  return { x: xs, y: ys, sd: sds };
}

/** InlineLoader's dots: a circle on its own 7px lattice centred on the circle (so there is a centre dot), kept when within 3. */
export function loaderDotsOf(s: Shape): { x: number[]; y: number[]; sd: number[] } {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const radius = Math.min(s.width, s.height) / 2;
  const reach = Math.floor((radius + 3) / STEP);
  const xs: number[] = [];
  const ys: number[] = [];
  const sds: number[] = [];
  for (let j = -reach; j <= reach; j++) {
    for (let i = -reach; i <= reach; i++) {
      const sd = Math.hypot(i * STEP, j * STEP) - radius;
      if (sd > 3) continue;
      xs.push(cx + i * STEP);
      ys.push(cy + j * STEP);
      sds.push(sd);
    }
  }
  return { x: xs, y: ys, sd: sds };
}

/* ── splashes: a press on the page drops a ring train at the pointer, alive for SPLASH_MS ── */

interface Splash {
  /** Viewport position and when it fell. */
  x: number;
  y: number;
  at: number;
}
const splashes: Splash[] = [];
let splashListeners = 0;
const onPointerDown = (event: PointerEvent) => {
  if (reduced()) return;
  splashes.push({ x: event.clientX, y: event.clientY, at: now() });
  if (splashes.length > 8) splashes.shift();
};

/* ── regions ── */

export type RegionMode = "shapes" | "loader";

export class FluidRegion {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly batch = new DotBatch();
  private shapes = new Map<object, Shape>();
  /* The dots, worked out once per layout. */
  private count = 0;
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private sd = new Float32Array(0);
  /** Each dot's base tone and its colour jitter, fixed per layout. */
  private base = new Float32Array(0);
  private jitter = new Float32Array(0);
  /** The region's top-left on the page at layout, so the base and the swell stay put while the page scrolls. */
  private pageX = 0;
  private pageY = 0;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private dirty = true;
  visible = true;
  shownAt = now();
  /** When the next frame may be drawn (the 30 frames a second). */
  nextAt = 0;
  goneAt: number | null = null;
  /** A placeholder that went while another took its place: shrinking out from this time. */
  swapOutAt: number | null = null;
  private viewport = { left: 0, top: 0 };
  /** A loader's canvas reaches this far past its element, so its outer dots are not cut. */
  private readonly pad: number;

  constructor(
    readonly host: HTMLElement,
    readonly mode: RegionMode = "shapes",
  ) {
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.dataset.fluid = mode;
    this.pad = mode === "loader" ? 4 : 0;
    Object.assign(this.canvas.style, { position: "absolute", left: `${-this.pad}px`, top: `${-this.pad}px`, pointerEvents: "none" });
    this.ctx = this.canvas.getContext("2d");
  }

  setShape(key: object, shape: Shape) {
    const held = this.shapes.get(key);
    if (held && held.x === shape.x && held.y === shape.y && held.width === shape.width && held.height === shape.height && held.radius === shape.radius) return;
    this.shapes.set(key, shape);
    this.dirty = true;
    stillFrame(this);
  }

  removeShape(key: object) {
    if (this.shapes.delete(key)) {
      this.dirty = true;
      stillFrame(this);
    }
  }

  /** The region's own size changed. */
  resized() {
    this.dirty = true;
    stillFrame(this);
  }

  private layout() {
    this.dirty = false;
    const box = this.host.getBoundingClientRect();
    this.width = Math.ceil(this.host.clientWidth || box.width);
    this.height = Math.ceil(this.host.clientHeight || box.height);
    this.ratio = sizeCanvas(this.canvas, this.width + 2 * this.pad, this.height + 2 * this.pad);
    this.pageX = box.left + window.scrollX + this.host.clientLeft;
    this.pageY = box.top + window.scrollY + this.host.clientTop;
    const xs: number[] = [];
    const ys: number[] = [];
    const sds: number[] = [];
    for (const shape of this.shapes.values()) {
      if (shape.width <= 0 || shape.height <= 0) continue;
      const dots = this.mode === "loader" ? loaderDotsOf(shape) : dotsOf(shape, this.pageX, this.pageY);
      xs.push(...dots.x);
      ys.push(...dots.y);
      sds.push(...dots.sd);
    }
    this.count = xs.length;
    this.x = Float32Array.from(xs);
    this.y = Float32Array.from(ys);
    this.sd = Float32Array.from(sds);
    this.base = new Float32Array(this.count);
    this.jitter = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const px = this.pageX + xs[i];
      const py = this.pageY + ys[i];
      const cx = Math.round(px / PITCH);
      const cy = Math.round(py / PITCH);
      // Base tone: 0.42 + 0.22 * valueNoise(x * 0.07, y * 0.18) + 0.06 * (hash - 0.5); jitter of 0.11 either way.
      this.base[i] = 0.42 + 0.22 * valueNoise(px * 0.07, py * 0.18) + 0.06 * (hash2(cx, cy) - 0.5);
      this.jitter[i] = 0.22 * (hash2(cx + 7919, cy - 104729) - 0.5);
    }
  }

  /** The region's dots are all gone (its fade-out or its shrink-out is over). */
  finished(t: number): boolean {
    if (this.swapOutAt !== null) return t - this.swapOutAt >= SWAP_OUT_S;
    return this.goneAt !== null && t - this.goneAt >= FADE_S;
  }

  /** The rings alive at `t` over this region: its drops, and any splash that landed on it. */
  private ringsAt(t: number, still: boolean): Rings[] {
    const rings = dropRings(t, this.width, this.height, PHRASE_S);
    if (still || this.mode === "loader") return rings;
    for (const splash of splashes) {
      const own = ringsOf(splash.x - this.viewport.left, splash.y - this.viewport.top, t - splash.at, SPLASH_S);
      if (own) rings.push(own);
    }
    return rings;
  }

  /** Measures where the region is this frame, for `draw`. */
  step() {
    const box = this.host.isConnected ? this.host.getBoundingClientRect() : null;
    if (box) this.viewport = { left: box.left + this.host.clientLeft, top: box.top + this.host.clientTop };
  }

  /** Draw at time `t`; `still` is reduced motion's single frame (t = 3, no fade, no splash). */
  draw(t: number, still: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.dirty) this.layout();
    if (still && this.host.isConnected) this.step();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, this.pad * this.ratio, this.pad * this.ratio);
    const colours = room();
    const shrink = this.swapOutAt === null || still ? 1 : clamp01(1 - (t - this.swapOutAt) / SWAP_OUT_S);
    const fadeIn = still ? 1 : clamp01((t - this.shownAt) / FADE_S);
    const fadeOut = still || this.goneAt === null ? 1 : clamp01(1 - (t - this.goneAt) / FADE_S);
    const rings = this.mode === "loader" ? [] : this.ringsAt(t, still);
    this.batch.begin(colours.length);
    for (let i = 0; i < this.count; i++) {
      const lx = this.x[i];
      const ly = this.y[i];
      let tone: number;
      let m = 1;
      let dx = 0;
      let dy = 0;
      let jitter = 0;
      let pitch = PITCH;
      if (this.mode === "loader") {
        // InlineLoader: a bright arc travelling clockwise once every 1.1s; the centre dot holds at 0.62.
        pitch = STEP;
        const ax = lx - this.width / 2;
        const ay = ly - this.height / 2;
        if (Math.abs(ax) < 0.5 && Math.abs(ay) < 0.5) tone = CENTRE_V;
        else {
          const arc = 0.5 + 0.5 * Math.cos(Math.atan2(ay, ax) - ARC_SPEED * t);
          tone = 0.42 + 0.58 * arc * arc;
        }
      } else {
        const base = this.base[i];
        jitter = this.jitter[i];
        const wave = rings.length ? waveAt(rings, lx, ly) : 0;
        tone = base + swell(this.pageX + lx, this.pageY + ly, t) + 0.42 * wave * (0.6 + base);
        if (rings.length) {
          dx = 3 * (waveAt(rings, lx + 3, ly) - wave);
          dy = 1.3 * wave;
        }
        // The edge: a dot on the shape's rim is half grown, one just outside is gone.
        m = clamp01(0.5 - this.sd[i] / (PITCH * 0.7));
      }
      tone = clamp01(tone);
      const radius = pitch * 0.46 * (0.58 + 0.42 * tone) * m * shrink;
      const shade = tone + jitter;
      this.batch.add(shadeOf(shade), lx + dx, ly + dy, radius);
    }
    ctx.globalAlpha = fadeIn * fadeOut;
    this.batch.flush(ctx, colours);
    ctx.globalAlpha = 1;
  }
}

/* ── the one loop ── */

const regions = new Set<FluidRegion>();
/** Regions that went this frame: if another arrives in their place, they shrink out (a swap of placeholders). */
const leaving = new Map<FluidRegion, { at: number; rect: DOMRect }>();
const ghosts = new Set<{ region: FluidRegion; layer: HTMLElement }>();
let stop: (() => void) | null = null;
let observer: IntersectionObserver | null = null;
let last = -1;
let lastDrawn = -1;

function recordCost(ms: number) {
  const store = (window as unknown as { __dotsFrameTimes?: Record<string, number[]> }).__dotsFrameTimes;
  if (store) (store.fluid ??= []).push(ms);
}

/** Under reduced motion a region is drawn once per change, at t = 3. */
function stillFrame(region: FluidRegion) {
  if (!reduced()) return;
  region.draw(STILL_T, true);
}

function frame(t: number): boolean | void {
  const started = performance.now();
  const anyOn = [...regions].some((region) => region.visible) || ghosts.size > 0;
  if (!anyOn && leaving.size === 0) {
    stop = null;
    return false;
  }
  settleLeaving(t);
  if (!anyOn) return;
  // 30 frames a second: a frame that comes early is skipped.
  if (t - lastDrawn < FRAME_S - 0.004) return;
  lastDrawn = t;
  while (splashes.length && t - splashes[0].at > SPLASH_S) splashes.shift();
  for (const region of regions) {
    if (!region.visible) continue;
    region.step();
    region.draw(t, false);
  }
  for (const ghost of ghosts) {
    ghost.region.draw(t, false);
    if (ghost.region.finished(t)) {
      ghost.layer.remove();
      ghosts.delete(ghost);
    }
  }
  recordCost(performance.now() - started);
}

/** A region that left last frame shrinks out if another region now covers where it was; otherwise it is simply gone. */
function settleLeaving(t: number) {
  for (const [region, { at, rect }] of leaving) {
    if (t - at < 1 / 60) continue;
    leaving.delete(region);
    const replaced = [...regions].some((other) => {
      if (!other.host.isConnected) return false;
      const box = other.host.getBoundingClientRect();
      return box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
    });
    if (!replaced) continue;
    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: "none" });
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.fluidGhost = "";
    layer.appendChild(region.canvas);
    document.body.appendChild(layer);
    region.swapOutAt = at;
    ghosts.add({ region, layer });
  }
}

function ensureLoop() {
  if (reduced() || stop) return;
  last = -1;
  stop = startLoop((t) => {
    last = t;
    return frame(t);
  });
}

function visibility(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === "undefined") return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      for (const region of regions) {
        if (region.host !== entry.target) continue;
        region.visible = entry.isIntersecting;
        // G28: a region off screen is not drawn; its canvas says so.
        region.canvas.dataset.visible = String(entry.isIntersecting);
      }
    }
    ensureLoop();
  });
  return observer;
}

/** Start drawing a region (G28: one loop for every region, regions off screen skipped). */
export function addRegion(region: FluidRegion) {
  region.host.appendChild(region.canvas);
  regions.add(region);
  visibility()?.observe(region.host);
  if (splashListeners++ === 0) window.addEventListener("pointerdown", onPointerDown, { passive: true });
  if (reduced()) stillFrame(region);
  else ensureLoop();
}

/** Stop drawing a region; if another takes its place at once, its dots shrink out over 300ms first. */
export function removeRegion(region: FluidRegion) {
  regions.delete(region);
  observer?.unobserve(region.host);
  if (--splashListeners === 0) window.removeEventListener("pointerdown", onPointerDown);
  // Measured before the region's element leaves the page (a layout effect's cleanup); a region already gone has no box.
  if (!reduced() && region.visible && last >= 0) {
    const rect = region.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) leaving.set(region, { at: last, rect });
  }
  if (!leaving.has(region)) region.canvas.remove();
}

/** The content is ready: the region's dots wind down from the top. */
export function markGone(region: FluidRegion) {
  if (region.goneAt === null) region.goneAt = reduced() ? 0 : now();
  if (reduced()) region.canvas.style.visibility = "hidden";
}
