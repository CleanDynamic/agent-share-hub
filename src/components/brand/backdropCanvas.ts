// The living backdrop's canvas (UI-P13b): one WebGL canvas for the whole document.
//
// ONE CANVAS, NOT ONE PER FRAME. `SiteFrame` is mounted by `AppShell`, by
// `/rebuild/:slug` and by the entrance routes, so a `PageBackdrop` comes and goes
// as the reader crosses between them. The canvas, its context, its compiled
// program and its animation loop live here at module level instead, and a
// `PageBackdrop` only lends it a host element (`attachBackdrop`). Crossing frames
// moves the same element; nothing is recompiled. A theme switch changes uniforms,
// not shaders. When no host is attached the loop and the listeners stop.
//
// IT SITS OVER THE STATIC LAYER. `PageBackdrop` always paints the UI-P13 room
// (ambient, horizon, arc, grain). The canvas is drawn on top of it, so if WebGL
// is missing, the program fails to compile or the context is lost, the reader
// sees that room and nothing throws.
//
// TIME IS SECONDS. The loop accumulates its own clock from frame deltas (capped
// at 100ms), so a hidden tab, a slow frame or a long pause never makes the folds
// jump. Ripple ages are seconds as well.
//
// REDUCED MOTION. Under `prefers-reduced-motion: reduce` the loop does not run:
// one frame is drawn (again only on resize or a theme switch) and pointer and
// key input are ignored. The media query is watched, so changing the setting
// with the page open takes effect at once.
//
// INPUT IS HEARD IN THE CAPTURE PHASE, on `window`, so a control that stops its
// event's propagation (a menu, a card) still sends its ripple. Listening never
// prevents or stops anything.

import type { TokenName } from "@/lib/theme/tokens";

import type { Room } from "./useRoom";

export const MAX_RIPPLES = 8;
export const RIPPLE_LIFETIME_S = 4;

const DPR_CAP = 1.5;
const BUFFER_SCALE = 0.85;
const LARGE_VIEWPORT_PX = 2_200_000;
const LARGE_VIEWPORT_SCALE = 0.72;
const MAX_FRAME_S = 0.1;

/** The drawing buffer for a viewport: `min(dpr, 1.5) × 0.85`, × 0.72 above 2.2 megapixels, in whole pixels. */
export function bufferSize(cssWidth: number, cssHeight: number, dpr: number): [number, number] {
  const scale =
    Math.min(dpr || 1, DPR_CAP) * BUFFER_SCALE * (cssWidth * cssHeight > LARGE_VIEWPORT_PX ? LARGE_VIEWPORT_SCALE : 1);
  return [Math.max(1, Math.round(cssWidth * scale)), Math.max(1, Math.round(cssHeight * scale))];
}

/** A point in CSS pixels as the shader's uv: 0..1 across the viewport, y up, clamped. */
export function viewportUv(x: number, y: number, viewportWidth: number, viewportHeight: number): [number, number] {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return [clamp(x / viewportWidth), clamp(1 - y / viewportHeight)];
}

/** Input types where Space or Enter is typing or submitting text, not activating a control. */
const TEXT_INPUT = /^(text|search|email|url|tel|password|number|date|datetime-local|month|week|time)$/;

/** Whether a keydown is a keyboard activation that should send a ripple from its target. */
export function isRippleKey(event: Pick<KeyboardEvent, "key" | "repeat" | "target">): boolean {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return false;
  const el = event.target;
  if (!(el instanceof Element) || el === document.body || el === document.documentElement) return false;
  if (el.closest('textarea, select, [contenteditable]:not([contenteditable="false"])')) return false;
  if (el instanceof HTMLInputElement && TEXT_INPUT.test(el.type)) return false;
  return true;
}

/** The room's colours, as the tokens that hold them, and the two amounts the shader varies by room. */
// `ringTone` is how the wavefront reads: a lift on Dusk's dark ground, a soft
// shade on Noon's light one, where a lift would be lost.
const ROOM: Record<
  Room,
  { glowA: TokenName; glowB: TokenName; horizon: TokenName; horizonAmount: number; shadow: number; ringTone: number }
> = {
  noon: { glowA: "arc-1", glowB: "arc-2", horizon: "arc-haze", horizonAmount: 0.3, shadow: 0.42, ringTone: -0.09 },
  dusk: { glowA: "arc-haze", glowB: "arc-3", horizon: "arc-haze", horizonAmount: 0, shadow: 1, ringTone: 0.06 },
};

/** `#rgb`, `#rrggbb` or `rgb()/rgba()` as 0..1 channels; null for anything else. */
export function parseColor(value: string): [number, number, number] | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  }
  const rgb = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((c) => Number(c) / 255) as [number, number, number];
  return null;
}

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform vec3 bgColor;
uniform vec3 glowA;
uniform vec3 glowB;
uniform vec3 horizonColor;
uniform float horizonAmount;
uniform float shadowStrength;
uniform float ringTone;
// xy: origin in uv (y up); z: age in seconds, negative when the slot is empty.
uniform vec3 ripples[${MAX_RIPPLES}];

const float RIPPLE_SPEED = 0.42;
const float RIPPLE_WIDTH = 0.07;
const float RIPPLE_LIFETIME = ${RIPPLE_LIFETIME_S.toFixed(1)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 1.0;
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    total += amplitude;
    amplitude *= 0.5;
    p *= 2.0;
  }
  return value / total;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float aspect = resolution.x / resolution.y;

  // Wavefronts: a ring expanding from each origin, measured in aspect-correct
  // space so it is round. It pushes the folds outward where it passes, and its
  // inner and outer edges split warm and cool, the chromatic fringe.
  vec2 push = vec2(0.0);
  float ring = 0.0;
  float inner = 0.0;
  float outer = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 r = ripples[i];
    if (r.z < 0.0) continue;
    vec2 d = vec2((uv.x - r.x) * aspect, uv.y - r.y);
    float dist = length(d);
    float band = (dist - r.z * RIPPLE_SPEED) / RIPPLE_WIDTH;
    float life = 1.0 - r.z / RIPPLE_LIFETIME;
    float env = exp(-band * band) * life * life * smoothstep(0.0, 0.12, r.z);
    push += (d / max(dist, 0.001)) * env * 0.05;
    ring += env;
    inner += env * smoothstep(0.0, -1.0, band);
    outer += env * smoothstep(0.0, 1.0, band);
  }
  push.x /= aspect;

  // The folds: fbm, domain-warped twice, drifting slowly.
  vec2 w = uv + push;
  float drift = time * 0.05;
  w.x += sin(time * 0.02) * 0.1;
  w.y += cos(time * 0.015) * 0.08;
  float f = fbm(w * 2.0 + vec2(drift, 0.0));
  float qf = fbm(w * 2.0 + vec2(f) + vec2(drift * 0.7, 0.0));
  float folds = fbm(w * 2.0 + vec2(qf) * 1.9 + vec2(drift * 0.5, 0.0));

  vec3 color = bgColor;
  color = mix(color, vec3(0.0), smoothstep(0.30, 0.95, folds) * shadowStrength);

  // The horizon band (Noon).
  color += horizonColor * exp(-pow((uv.y - 0.52) / 0.09, 2.0)) * horizonAmount;

  // The arc's glow, top right, where the static layer draws the arc.
  float glow = smoothstep(1.05, 0.05, distance(uv, vec2(0.92, 0.96)));
  color = mix(color, glowA, pow(glow, 1.6) * 0.5);
  color = mix(color, glowB, pow(glow, 1.9) * 0.3);

  color += qf * 0.005;

  // The wavefront itself: a soft lift or shade with a warm inner and cool outer edge.
  color += vec3(ringTone) * clamp(ring, 0.0, 1.5);
  color.r += 0.05 * clamp(inner, 0.0, 1.0);
  color.b += 0.05 * clamp(outer, 0.0, 1.0);

  // Grain, re-seeded 24 times a second.
  color += hash(gl_FragCoord.xy + mod(floor(time * 24.0), 509.0)) * 0.016 - 0.008;

  gl_FragColor = vec4(color, 1.0);
}
`;

const UNIFORMS = [
  "resolution",
  "time",
  "bgColor",
  "glowA",
  "glowB",
  "horizonColor",
  "horizonAmount",
  "shadowStrength",
  "ringTone",
  "ripples",
] as const;
type Uniform = (typeof UNIFORMS)[number];

interface Ripple {
  x: number;
  y: number;
  /** `performance.now()` at the input. */
  born: number;
}

interface Colors {
  bg: [number, number, number];
  glowA: [number, number, number];
  glowB: [number, number, number];
  horizon: [number, number, number];
}

interface Backdrop {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  locations: Record<Uniform, WebGLUniformLocation | null> | null;
}

let backdrop: Backdrop | null = null;
let unavailable = false;
let room: Room = "noon";
let colors: Colors | null = null;
const hosts: HTMLElement[] = [];
let ripples: Ripple[] = [];
let raf = 0;
let lastFrame = 0;
let elapsed = 0;
let reduceQuery: MediaQueryList | null = null;
let listening = false;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    console.warn("[backdrop] shader did not compile; showing the static backdrop.", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Compiles and links the program and binds the full-screen triangle. Null when the GPU refuses it. */
function buildProgram(gl: WebGLRenderingContext): Record<Uniform, WebGLUniformLocation | null> | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[backdrop] program did not link; showing the static backdrop.", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<
    Uniform,
    WebGLUniformLocation | null
  >;
}

function create(): Backdrop | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.dataset.ui = "backdrop-canvas";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "0",
    pointerEvents: "none",
    display: "block",
  });

  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const locations = buildProgram(gl);
  if (!locations) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  const made: Backdrop = { canvas, gl, locations };
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    made.locations = null;
    cancel();
    canvas.style.visibility = "hidden";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    made.locations = buildProgram(gl);
    if (!made.locations) return;
    canvas.style.visibility = "";
    resize();
    request();
  });
  return made;
}

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: TokenName, fallback: [number, number, number]) =>
    parseColor(style.getPropertyValue(`--${name}`)) ?? fallback;
  const r = ROOM[room];
  return {
    bg: read("bg", room === "dusk" ? [0.12, 0.09, 0.16] : [0.91, 0.92, 0.9]),
    glowA: read(r.glowA, [0.56, 0.65, 0.61]),
    glowB: read(r.glowB, [0.89, 0.65, 0.58]),
    horizon: read(r.horizon, [0.95, 0.84, 0.8]),
  };
}

const reduced = () => reduceQuery?.matches ?? false;

function resize() {
  if (!backdrop) return;
  const [width, height] = bufferSize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  if (backdrop.canvas.width !== width) backdrop.canvas.width = width;
  if (backdrop.canvas.height !== height) backdrop.canvas.height = height;
}

function draw(now: number) {
  if (!backdrop?.locations) return;
  const { gl, canvas, locations: u } = backdrop;
  colors ??= readColors();
  const r = ROOM[room];

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(u.resolution, canvas.width, canvas.height);
  gl.uniform1f(u.time, elapsed);
  gl.uniform3fv(u.bgColor, colors.bg);
  gl.uniform3fv(u.glowA, colors.glowA);
  gl.uniform3fv(u.glowB, colors.glowB);
  gl.uniform3fv(u.horizonColor, colors.horizon);
  gl.uniform1f(u.horizonAmount, r.horizonAmount);
  gl.uniform1f(u.shadowStrength, r.shadow);
  gl.uniform1f(u.ringTone, r.ringTone);

  const slots = new Float32Array(MAX_RIPPLES * 3);
  for (let i = 0; i < MAX_RIPPLES; i++) {
    const ripple = ripples[i];
    // A frame's timestamp can predate an input that arrived before it ran, so the first age can be below zero.
    slots.set(ripple ? [ripple.x, ripple.y, Math.max(0, now - ripple.born) / 1000] : [0, 0, -1], i * 3);
  }
  gl.uniform3fv(u.ripples, slots);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(now: number) {
  raf = 0;
  if (!hosts.length || document.hidden || !backdrop?.locations) return;
  const still = reduced();
  if (!still) elapsed += lastFrame ? Math.min((now - lastFrame) / 1000, MAX_FRAME_S) : 0;
  lastFrame = now;
  ripples = ripples.filter((ripple) => (now - ripple.born) / 1000 < RIPPLE_LIFETIME_S);
  draw(now);
  if (!still) raf = requestAnimationFrame(frame);
}

/** Schedules one frame; under motion the frame keeps the loop going. */
function request() {
  if (!raf && hosts.length && !document.hidden) raf = requestAnimationFrame(frame);
}

function cancel() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastFrame = 0;
}

function addRipple(x: number, y: number) {
  if (reduced() || !backdrop?.locations) return;
  if (ripples.length >= MAX_RIPPLES) ripples.shift();
  ripples.push({ x, y, born: performance.now() });
  request();
}

function onPointerDown(event: PointerEvent) {
  addRipple(...viewportUv(event.clientX, event.clientY, window.innerWidth, window.innerHeight));
}

function onKeyDown(event: KeyboardEvent) {
  if (!isRippleKey(event)) return;
  const rect = (event.target as Element).getBoundingClientRect();
  addRipple(...viewportUv(rect.left + rect.width / 2, rect.top + rect.height / 2, window.innerWidth, window.innerHeight));
}

function onResize() {
  resize();
  request();
}

function onVisibility() {
  if (document.hidden) cancel();
  else request();
}

function onReduceChange() {
  if (reduced()) {
    ripples = [];
    cancel();
  }
  request();
}

function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  reduceQuery ??= window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
  if (on) {
    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    reduceQuery?.addEventListener("change", onReduceChange);
  } else {
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    window.removeEventListener("keydown", onKeyDown, { capture: true });
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    reduceQuery?.removeEventListener("change", onReduceChange);
  }
}

/**
 * Lends the backdrop canvas a host. Returns the release. The canvas lives in the
 * most recently attached host; when the last host is released the loop and the
 * listeners stop, and the canvas, context and program are kept for the next one.
 * Does nothing when WebGL is unavailable: the static layer is the backdrop then.
 */
export function attachBackdrop(host: HTMLElement): () => void {
  if (unavailable) return () => {};
  backdrop ??= create();
  if (!backdrop) {
    unavailable = true;
    return () => {};
  }
  const { canvas } = backdrop;
  hosts.push(host);
  host.appendChild(canvas);
  listen(true);
  resize();
  request();

  return () => {
    const at = hosts.lastIndexOf(host);
    if (at >= 0) hosts.splice(at, 1);
    if (canvas.parentNode === host) {
      const next = hosts[hosts.length - 1];
      if (next) next.appendChild(canvas);
      else host.removeChild(canvas);
    }
    // Ripples are kept: a click that crosses into another frame keeps its wavefront.
    if (!hosts.length) {
      cancel();
      listen(false);
    }
  };
}

/** Tells the canvas which room it is painting; re-reads the room's tokens and redraws. */
export function setBackdropRoom(next: Room) {
  room = next;
  colors = null;
  request();
}
