// partColour: the one way a maker's colour reaches the page (CA-06 P4).
//
// A tile's colour is `payload.colour` on its node; a session's is `builds.making.sessions_meta[key].colour`. Both are
// "#RRGGBB", chosen by the maker; nothing is coloured by default, and nothing here chooses a colour for anyone. The
// look rules (lookRules.test.ts) let a border colour come from these helpers and from no other maker value.
//
// PURE. The theme's values are read with `resolveToken`, so the link fill can be measured against the surface the
// post sits on before it is drawn.

import type { CSSProperties } from "react";

import { contrast, over, parse } from "./luminance";
import { resolveToken, type ThemeKey } from "./resolve";

/** `#RGB`, `RGB`, `#RRGGBB` or `RRGGBB`, any case, spaces trimmed, as `#RRGGBB` in upper case; anything else is null. */
export function normaliseHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${[...raw].map((c) => c + c).join("")}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

/** The colour at an alpha, as `rgba(…)`. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${Math.round(alpha * 100) / 100})`;
}

/** A coloured tile: a 1px border in its colour, and the same colour at 35% inside it. */
export function borderFor(hex: string): CSSProperties {
  return { borderColor: hex, boxShadow: `inset 0 0 0 1px ${withAlpha(hex, 0.35)}` };
}

/** A coloured session: a 1px line round its head and its tiles, radius 12. */
export function outlineFor(hex: string): CSSProperties {
  return { border: `1px solid ${hex}`, borderRadius: 12 };
}

/** The weakest and strongest fill a coloured link takes, and how much stronger hover is. */
export const HIGHLIGHT_MIN = 0.16;
export const HIGHLIGHT_MAX = 0.34;
export const HIGHLIGHT_HOVER_STEP = 0.12;
export const HIGHLIGHT_HOVER_MAX = 0.46;
/** What the words on a link must keep against its fill. */
export const HIGHLIGHT_TEXT_FLOOR = 4.5;

export interface Highlight {
  alpha: number;
  hoverAlpha: number;
  fill: string;
  hover: string;
}

const STEP = 0.01;

/** The post's ground in a theme: its surface, composited on the frame if it lets the frame through. */
function ground(theme: ThemeKey): string {
  const surface = resolveToken(theme, "surface");
  return parse(surface)[3] === 1 ? surface : over(surface, resolveToken(theme, "frame"));
}

/** The contrast of the theme's text on `hex` at `alpha` over the post's surface. */
export function textContrastOn(hex: string, alpha: number, theme: ThemeKey): number {
  return contrast(resolveToken(theme, "text"), over(withAlpha(hex, alpha), ground(theme)));
}

/**
 * How strongly a coloured link is filled: the strongest alpha from 0.16 to 0.34 that keeps `--text` at 4.5:1 or
 * better on the fill over the post's surface (0.16 when none does), and hover 0.12 above it, at most 0.46.
 */
export function highlightFor(hex: string, theme: ThemeKey): Highlight {
  let alpha = HIGHLIGHT_MIN;
  for (let a = HIGHLIGHT_MAX; a >= HIGHLIGHT_MIN - 1e-9; a -= STEP) {
    if (textContrastOn(hex, a, theme) >= HIGHLIGHT_TEXT_FLOOR) {
      alpha = Math.round(a * 100) / 100;
      break;
    }
  }
  const hoverAlpha = Math.min(HIGHLIGHT_HOVER_MAX, Math.round((alpha + HIGHLIGHT_HOVER_STEP) * 100) / 100);
  return { alpha, hoverAlpha, fill: withAlpha(hex, alpha), hover: withAlpha(hex, hoverAlpha) };
}

/** The six muted colours the picker suggests. None is ever applied for the maker. */
export const SUGGESTED_COLOURS = ["#C9A86B", "#7FB88A", "#7FA7D9", "#B79AD6", "#D98C8C", "#8FBFB8"] as const;

/** What a code that is not a colour is told: "Use a code like #7FA7D9", the third suggestion. */
export const HEX_HINT = `Use a code like ${SUGGESTED_COLOURS[2]}`;

/* ── a part's name drawn as text (CA-17 P5) ── */

/** What a part's name must keep against the surface it is drawn on. */
export const NAME_TEXT_FLOOR = 4.5;

function toHsl([r, g, b]: [number, number, number, number]): [number, number, number] {
  const [x, y, z] = [r, g, b].map((v) => v / 255);
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const channel = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[channel(0), channel(8), channel(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * The colour a part's NAME is drawn in, as text on the surface (in the List and on the map). The maker's colour when it
 * reaches 4.5:1 on that surface in that theme; otherwise the same colour with only its lightness moved, as far as it takes
 * to reach 4.5:1: lighter in Dusk, darker in Noon. Hue and saturation are kept. The stored colour never changes.
 */
export function nameColourFor(hex: string, theme: ThemeKey): string {
  const colour = normaliseHex(hex);
  if (!colour) return hex;
  const surface = ground(theme);
  if (contrast(colour, surface) >= NAME_TEXT_FLOOR) return colour;
  const [h, s, l] = toHsl(parse(colour));
  const step = theme === "dusk" ? 0.005 : -0.005;
  let last = colour;
  for (let next = l + step; next >= 0 && next <= 1; next += step) {
    last = fromHsl(h, s, next);
    if (contrast(last, surface) >= NAME_TEXT_FLOOR) return last;
  }
  return last;
}
