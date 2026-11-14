/* Fluid loading fields (Reference E), with no React: every loading state's shapes drawn as a living dot field that holds
   their form without being hard rectangles.

   A REGION is one canvas over one loading area (a page placeholder, a panel, or one small element). Its SHAPES are the
   boxes of the skeletons inside it, measured relative to it, each with its corner radius. ONE LOOP drives every region on
   the page; a region that is off screen is skipped, and the loop stops when no region is on screen. Under reduced motion
   each region draws one still frame at t = 3, with no reveal, no wind-down and no cursor.

   Every number is Reference E's, as written. Times are seconds; lengths are CSS pixels. */

import { clamp01, CoarseGrid, DotBatch, pn, sizeCanvas, smoothstep, startLoop } from "./engine";

export const STEP = 7;
export const MAX_RADIUS = 3;
/** The reveal and the wind-down travel down a region at 900px/s over an 80px ramp. */
const SPEED = 900;
const RAMP = 80;
/** Swapping placeholders: the old dots shrink out over 300ms. */
const SWAP_OUT_S = 0.3;
/** Cursor repulsion, as Reference C's with reach 100 and push 16. */
const REACH = 100;
const PUSH = 16;
const POINTER_RATE = 16;
const GAIN_RATE = 6;
const GROW_RATE = 14;
const RETURN_RATE = 3.2;
/** InlineLoader: the bright arc goes round once every 1.1s (5.7 rad/s); the centre dot holds at 0.62. */
const ARC_SPEED = 5.7;
const CENTRE_V = 0.62;
const STILL_T = 3;

export const FLUID_DARK = ["#2B6424", "#337A2C", "#3C8333", "#4A9C50", "#58BA71", "#6BE2A0"] as const;
export const FLUID_LIGHT = ["#BFEDAE", "#A6EB8C", "#8DEB6B", "#77FC49", "#56C93A", "#3F9230"] as const;
const STEPS = [0.5, 0.6, 0.7, 0.8, 0.92];

const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const room = () => (typeof document !== "undefined" && document.documentElement.dataset.theme === "dusk" ? FLUID_DARK : FLUID_LIGHT);
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
 * Where a shape's dots go, in region coordinates (Reference E): on the page-wide 7px grid for large shapes; for thin
 * shapes (height ≤ 28) rows centred on the shape and columns on the page grid; for small shapes (both sides ≤ 44) rows
 * and columns centred on the shape. A dot is kept when its signed distance to the rounded box is ≤ 3.
 */
export function dotsOf(s: Shape, pageX: number, pageY: number): { x: number[]; y: number[]; sd: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const sds: number[] = [];
  const small = s.width <= 44 && s.height <= 44;
  const thin = !small && s.height <= 28;
  const pageGrid = (from: number, to: number, origin: number) => {
    const out: number[] = [];
    for (let v = Math.ceil((from + origin) / STEP) * STEP; v <= to + origin; v += STEP) out.push(v - origin);
    return out;
  };
  const centred = (start: number, length: number) => {
    const count = Math.max(1, Math.round(length / STEP));
    const first = start + length / 2 - ((count - 1) * STEP) / 2;
    return Array.from({ length: count }, (_, i) => first + i * STEP);
  };
  const columns = small ? centred(s.x, s.width) : pageGrid(s.x - 3, s.x + s.width + 3, pageX);
  const rows = small || thin ? centred(s.y, s.height) : pageGrid(s.y - 3, s.y + s.height + 3, pageY);
  for (const y of rows) {
    for (const x of columns) {
      const sd = roundedDistance(x, y, s);
      if (sd <= 3) {
        xs.push(x);
        ys.push(y);
        sds.push(sd);
      }
    }
  }
  return { x: xs, y: ys, sd: sds };
}

/** InlineLoader's dots: a circle on its own 7px grid centred on the circle (so there is a centre dot), kept when within 3. */
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

/* ── the shared field ── */

const F = 0;
const W = 1;
const grid = new CoarseGrid(2);
let gridSize = "";

function fillField(t: number) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const size = `${width}x${height}`;
  if (size !== gridSize) {
    grid.resize(0, 0, width, height);
    gridSize = size;
  }
  const cx = width / 2;
  const cy = height / 2;
  const angle = 0.12 * t;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const drift = 0.06 * t;
  grid.fill((x, y, out) => {
    // The pattern turns clockwise on screen, so the samples turn the other way.
    const ex = x - cx;
    const ey = y - cy;
    const qx = (ex * cos + ey * sin) / 240;
    const qy = (-ex * sin + ey * cos) / 240;
    const w = pn(0.6 * qx + 4.1 + drift, 0.6 * qy - 2.3);
    const w2 = pn(0.6 * qx - 8.4, 0.6 * qy + 5.2 - drift);
    const X = qx + 0.9 * (w - 0.5);
    const Y = qy + 0.9 * (w2 - 0.5) + 7.7;
    out[F] = 0.76 * pn(X, Y) + 0.24 * pn(2.03 * X + 17.1, 2.03 * Y - 9.3);
    out[W] = w;
  });
}

/* ── the pointer ── */

const pointer = { x: 0, y: 0, tx: 0, ty: 0, has: false, over: false, gain: 0 };
let pointerListeners = 0;
const onPointerMove = (event: PointerEvent) => {
  pointer.tx = event.clientX;
  pointer.ty = event.clientY;
  if (!pointer.has) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.has = true;
  }
  pointer.over = true;
};
const onPointerOut = (event: PointerEvent) => {
  if (!event.relatedTarget) pointer.over = false;
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
  private amp = new Float32Array(0);
  private ox = new Float32Array(0);
  private oy = new Float32Array(0);
  private width = 0;
  private height = 0;
  private ratio = 1;
  private dirty = true;
  visible = true;
  shownAt = now();
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
    const pageX = box.left + window.scrollX + this.host.clientLeft;
    const pageY = box.top + window.scrollY + this.host.clientTop;
    const xs: number[] = [];
    const ys: number[] = [];
    const sds: number[] = [];
    const amps: number[] = [];
    for (const shape of this.shapes.values()) {
      if (shape.width <= 0 || shape.height <= 0) continue;
      const dots = this.mode === "loader" ? loaderDotsOf(shape) : dotsOf(shape, pageX, pageY);
      // The edge's breathing: a = min(3.2, 0.16 * min(width, height)). A loader has none.
      const a = this.mode === "loader" ? 0 : Math.min(3.2, 0.16 * Math.min(shape.width, shape.height));
      xs.push(...dots.x);
      ys.push(...dots.y);
      sds.push(...dots.sd);
      for (let i = 0; i < dots.x.length; i++) amps.push(a);
    }
    this.count = xs.length;
    this.x = Float32Array.from(xs);
    this.y = Float32Array.from(ys);
    this.sd = Float32Array.from(sds);
    this.amp = Float32Array.from(amps);
    this.ox = new Float32Array(this.count);
    this.oy = new Float32Array(this.count);
  }

  /** The region's dots are all gone (its wind-down or its shrink-out is over). */
  finished(t: number): boolean {
    if (this.swapOutAt !== null) return t - this.swapOutAt >= SWAP_OUT_S;
    return this.goneAt !== null && (t - this.goneAt) * SPEED > this.height + RAMP;
  }

  /** Dots with a cursor offset still easing back. */
  private moving = 0;

  /** Move every dot's cursor offset on by `dt`. Measures where the region is this frame, for `draw` too. */
  step(dt: number) {
    const box = this.host.isConnected ? this.host.getBoundingClientRect() : null;
    if (box) this.viewport = { left: box.left + this.host.clientLeft, top: box.top + this.host.clientTop };
    // Nothing to move: no offset left to ease back, and the pointer is beyond reach of every dot.
    if (this.moving === 0 && box) {
      const dx = Math.max(box.left - pointer.x, 0, pointer.x - box.right);
      const dy = Math.max(box.top - pointer.y, 0, pointer.y - box.bottom);
      if (!pointer.has || dx * dx + dy * dy > (REACH + 8) ** 2) return;
    }
    let moving = 0;
    const grow = 1 - Math.exp(-GROW_RATE * dt);
    const back = 1 - Math.exp(-RETURN_RATE * dt);
    for (let i = 0; i < this.count; i++) {
      let tx = 0;
      let ty = 0;
      if (pointer.has && this.mode === "shapes") {
        const dx = this.viewport.left + this.x[i] - pointer.x;
        const dy = this.viewport.top + this.y[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REACH * REACH && d2 > 0) {
          const d = Math.sqrt(d2);
          const k = (1 - d / REACH) ** 2 * PUSH * pointer.gain;
          tx = (dx / d) * k;
          ty = (dy / d) * k;
        }
      }
      if (tx === 0 && ty === 0 && this.ox[i] === 0 && this.oy[i] === 0) continue;
      const k = tx * tx + ty * ty > this.ox[i] ** 2 + this.oy[i] ** 2 ? grow : back;
      this.ox[i] += (tx - this.ox[i]) * k;
      this.oy[i] += (ty - this.oy[i]) * k;
      // An offset under a thousandth of a pixel is drawn as none: it is let go, and the dot stops being moved.
      if (Math.abs(this.ox[i]) < 1e-3 && Math.abs(this.oy[i]) < 1e-3 && tx === 0 && ty === 0) {
        this.ox[i] = 0;
        this.oy[i] = 0;
      } else moving++;
    }
    this.moving = moving;
  }

  /** Draw at time `t`; `still` is reduced motion's single frame (t = 3, no reveal, no wind-down, no cursor). */
  draw(t: number, still: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.dirty) {
      this.layout();
      this.moving = 0;
    }
    // A still frame (reduced motion) has no step before it to say where the region is.
    if (still && this.host.isConnected) {
      const box = this.host.getBoundingClientRect();
      this.viewport = { left: box.left + this.host.clientLeft, top: box.top + this.host.clientTop };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, this.pad * this.ratio, this.pad * this.ratio);
    const at = new Float64Array(3);
    const palette = room();
    const shrink = this.swapOutAt === null || still ? 1 : clamp01(1 - (t - this.swapOutAt) / SWAP_OUT_S);
    const pageX = this.viewport.left + window.scrollX;
    const pageY = this.viewport.top + window.scrollY;
    this.batch.begin(palette.length);
    for (let i = 0; i < this.count; i++) {
      const lx = this.x[i];
      const ly = this.y[i];
      const vx = this.viewport.left + lx;
      const vy = this.viewport.top + ly;
      const lead = still ? 1 : clamp01(((t - this.shownAt) * SPEED - ly) / RAMP);
      const trail = still || this.goneAt === null ? 1 : clamp01(1 - ((t - this.goneAt) * SPEED - ly) / RAMP);
      if (lead <= 0 || trail <= 0) continue;
      grid.locate(vx, vy, at);
      const f = grid.sample(F, at);
      const w = grid.sample(W, at);
      let v: number;
      let m = 1;
      // The dot's page position, for the breathing edge and the reverberation (stable while the page scrolls).
      const x = pageX + lx;
      const y = pageY + ly;
      if (this.mode === "loader") {
        // InlineLoader: a bright arc travelling clockwise once every 1.1s; the centre dot holds at 0.62.
        const cxLocal = this.width / 2;
        const cyLocal = this.height / 2;
        const dx = lx - cxLocal;
        const dy = ly - cyLocal;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) v = CENTRE_V;
        else {
          const arc = 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) - ARC_SPEED * t);
          v = 0.42 + 0.58 * arc * arc;
        }
      } else {
        const sd = this.sd[i];
        const a = this.amp[i];
        if (sd > -(1.5 * a + 2)) {
          const e = sd + 1.5 * a * (2 * pn(0.03 * x + 0.3 * t, 0.03 * y - 0.24 * t) - 1);
          m = clamp01(0.5 - e / 2.6);
        }
        const fc = smoothstep(clamp01((f - 0.28) / 0.44));
        const s = 0.5 + 0.5 * Math.sin((0.6 * x + 0.8 * y + 90 * (w - 0.5)) / 140 - 2.0 * t);
        const rv = s * s;
        v = 0.45 + 0.27 * fc + 0.28 * rv * (0.35 + 0.65 * fc);
      }
      const ox = this.ox[i];
      const oy = this.oy[i];
      const push = ox === 0 && oy === 0 ? 0 : Math.sqrt(ox * ox + oy * oy);
      const radius = MAX_RADIUS * v ** 0.9 * m * lead * trail * shrink * (1 - Math.min(0.75, 0.05 * push));
      let colour = 0;
      while (colour < STEPS.length && v > STEPS[colour]) colour++;
      const jx = this.mode === "loader" ? 0 : 2.4 * (w - 0.5);
      const jy = this.mode === "loader" ? 0 : 4 * (f - 0.5);
      this.batch.add(colour, lx + ox + jx, ly + oy + jy, radius);
    }
    this.batch.flush(ctx, palette);
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

function recordCost(ms: number) {
  const store = (window as unknown as { __dotsFrameTimes?: Record<string, number[]> }).__dotsFrameTimes;
  if (store) (store.fluid ??= []).push(ms);
}

/** Under reduced motion a region is drawn once per change, at t = 3. */
function stillFrame(region: FluidRegion) {
  if (!reduced()) return;
  fillField(STILL_T);
  region.draw(STILL_T, true);
}

function frame(t: number, dt: number): boolean | void {
  const started = performance.now();
  const anyOn = [...regions].some((region) => region.visible) || ghosts.size > 0;
  if (!anyOn && leaving.size === 0) {
    stop = null;
    return false;
  }
  pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-POINTER_RATE * dt));
  pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-POINTER_RATE * dt));
  pointer.gain += ((pointer.over ? 1 : 0) - pointer.gain) * (1 - Math.exp(-GAIN_RATE * dt));
  settleLeaving(t);
  if (!anyOn) return;
  fillField(t);
  for (const region of regions) {
    if (!region.visible) continue;
    region.step(dt);
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
  stop = startLoop((t, dt) => {
    last = t;
    return frame(t, dt);
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
  if (pointerListeners++ === 0) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut);
  }
  if (reduced()) stillFrame(region);
  else ensureLoop();
}

/** Stop drawing a region; if another takes its place at once, its dots shrink out over 300ms first. */
export function removeRegion(region: FluidRegion) {
  regions.delete(region);
  observer?.unobserve(region.host);
  if (--pointerListeners === 0) {
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerout", onPointerOut);
  }
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
