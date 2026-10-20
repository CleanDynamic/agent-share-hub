// colourWheel: the colour picker's numbers (CA-06 P5). PURE.
//
// The wheel: angle is hue (0 at the right, going round as the canvas's y goes down), distance from the centre is
// saturation from 0 to 70%, at the lightness the slider sets (30 to 80, 62 to start). Recent holds up to 8 colours,
// newest first, no repeats; Favourites up to 24.

import { normaliseHex } from "./partColour";

export const SATURATION_MAX = 70;
export const LIGHTNESS_MIN = 30;
export const LIGHTNESS_MAX = 80;
export const LIGHTNESS_START = 62;
/** How far an arrow key moves hue or saturation. */
export const WHEEL_STEP = 2;
export const RECENT_MAX = 8;
export const FAVOURITES_MAX = 24;

export interface Hsl {
  /** 0 to 360. */
  h: number;
  /** 0 to 100. */
  s: number;
  /** 0 to 100. */
  l: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const wrap = (hue: number) => ((hue % 360) + 360) % 360;

/** Red, green and blue, 0 to 255, for a colour in HSL. */
export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function hslToHex(hsl: Hsl): string {
  return `#${hslToRgb(hsl)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/** A colour's HSL; null for anything `normaliseHex` refuses. */
export function hexToHsl(input: string): Hsl | null {
  const hex = normaliseHex(input);
  if (!hex) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: wrap(h * 60), s: s * 100, l: l * 100 };
}

/** Where on a wheel of `radius` a hue and a saturation sit, from its centre. Saturation past 70 sits on the rim. */
export function wheelPoint(h: number, s: number, radius: number): { x: number; y: number } {
  const r = (clamp(s, 0, SATURATION_MAX) / SATURATION_MAX) * radius;
  const angle = (wrap(h) * Math.PI) / 180;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/** The hue and saturation at a point from the wheel's centre; a point off the wheel takes the rim. */
export function wheelAt(x: number, y: number, radius: number): { h: number; s: number } {
  const distance = Math.min(1, Math.hypot(x, y) / radius);
  return { h: wrap((Math.atan2(y, x) * 180) / Math.PI), s: distance * SATURATION_MAX };
}

/** The colour at a point of the wheel, at a lightness. */
export function wheelHex(x: number, y: number, radius: number, l: number): string {
  const { h, s } = wheelAt(x, y, radius);
  return hslToHex({ h, s, l });
}

/** An arrow key on the wheel: left and right move hue, up and down saturation, by 2. Null for any other key. */
export function wheelKey(key: string, at: { h: number; s: number }): { h: number; s: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { h: wrap(at.h - WHEEL_STEP), s: at.s };
    case "ArrowRight":
      return { h: wrap(at.h + WHEEL_STEP), s: at.s };
    case "ArrowUp":
      return { h: at.h, s: clamp(at.s + WHEEL_STEP, 0, SATURATION_MAX) };
    case "ArrowDown":
      return { h: at.h, s: clamp(at.s - WHEEL_STEP, 0, SATURATION_MAX) };
    default:
      return null;
  }
}

/** A lightness kept to the slider's range. */
export const lightnessOf = (l: number): number => clamp(Math.round(l), LIGHTNESS_MIN, LIGHTNESS_MAX);

/** Recent with `hex` first: no repeats, at most 8. */
export function withRecent(recent: readonly string[], hex: string): string[] {
  const colour = normaliseHex(hex);
  if (!colour) return [...recent];
  return [colour, ...recent.filter((entry) => entry !== colour)].slice(0, RECENT_MAX);
}

/** Favourites with `hex` added at the end, or taken out when it is there; never past 24. */
export function toggleFavourite(favourites: readonly string[], hex: string): string[] {
  const colour = normaliseHex(hex);
  if (!colour) return [...favourites];
  if (favourites.includes(colour)) return favourites.filter((entry) => entry !== colour);
  return favourites.length >= FAVOURITES_MAX ? [...favourites] : [...favourites, colour];
}

/** Every pixel of the wheel, as RGBA bytes for an ImageData of `size` square. Outside the circle is clear. */
export function wheelPixels(size: number, l: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  const radius = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - radius;
      const dy = y + 0.5 - radius;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) continue;
      const { h, s } = wheelAt(dx, dy, radius);
      const [r, g, b] = hslToRgb({ h, s, l });
      const at = (y * size + x) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      // The last pixel of the rim is softened, so the circle has no jagged edge.
      data[at + 3] = Math.round(255 * Math.min(1, radius - distance + 0.5));
    }
  }
  return data;
}
