// The cover fallback: the landscape drawn when a build has no cover (UI-P06).
//
// WHEN. `resolveCover()` returned nothing. The build still needs a picture
// above its plaque, and a grey box says "broken"; a small dusk landscape says
// "nobody has photographed this yet". Six skies, one per hash bucket, so a
// gallery of cover-less builds does not read as one repeated tile.
//
// THE SKIES ARE ARTWORK, NOT TOKENS. They are the same in both themes — a
// picture of a sky does not follow the room — which is why they are written as
// named constants here, exactly where the design's token map says such values
// live (design/tokens/token-map.md, "Fixed values that are the same in both
// themes and sit on artwork"). Seven colours each: three for the sky gradient,
// one for the sun, three for the hills, back to front.
//
// STABLE. The palette index is a hash of the seed — the build id — so a build
// keeps its sky from one render to the next and on every surface it appears on.
// `sky` overrides it, which is how the dev fixtures reproduce the mockup's
// choice for a given board.

import { useId } from "react";

export type SkyPalette = readonly [string, string, string, string, string, string, string];

/** Sky top, sky middle, sky horizon, sun, far hill, mid hill, near hill. */
export const COVER_SKIES: readonly SkyPalette[] = [
  ["#2A2340", "#8C78C4", "#E8A283", "#F3C6A5", "#5C5480", "#372F4A", "#1F1B2B"],
  ["#1B2A3A", "#3F7A8C", "#86BDD3", "#D6EEF5", "#2F5566", "#1F3B48", "#12222B"],
  ["#2A1E2E", "#9A5B4A", "#E8B070", "#F7DDB0", "#6B4A4F", "#43303A", "#1F1B2B"],
  ["#1A1630", "#4B3F8C", "#A78BFA", "#E5DBFF", "#3A2F6A", "#2A2250", "#1A1630"],
  ["#15251E", "#3E6B55", "#9FD1A8", "#E3F2DA", "#2E5242", "#1F3A2F", "#12211B"],
  ["#2B1A26", "#8C4A6A", "#F0A0B8", "#FBE0E8", "#5E3450", "#3F2438", "#1F1420"],
];

/** Where the sun sits, per sky. */
const SUN_X = [70, 120, 190, 230, 150, 210] as const;

const HILLS = [
  "M0 118 C40 98 70 108 100 94 C130 80 160 102 200 96 C240 90 270 106 300 98 L300 180 L0 180Z",
  "M0 140 C50 126 90 138 140 128 C190 118 230 138 300 126 L300 180 L0 180Z",
  "M0 162 C60 152 120 164 180 156 C230 150 270 160 300 154 L300 180 L0 180Z",
] as const;

/** FNV-1a, 32-bit. Stable across runs and platforms, which `Math.random` and object order are not. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The sky a seed lands on, 0 to 5. */
export function skyIndex(seed: string): number {
  return hashSeed(seed) % COVER_SKIES.length;
}

export interface CoverFallbackProps {
  /** The build id. The same seed always draws the same sky. */
  seed: string;
  /** The corner radius of the picture, from the radius scale (`r.media`, `r.card`, …). */
  radius: string | number;
  /** Force a sky, 0 to 5. The dev fixtures pass the mockup's `cover_sky`. */
  sky?: number;
}

export function CoverFallback({ seed, radius, sky }: CoverFallbackProps) {
  const gradientId = `sky-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const i =
    sky !== undefined && Number.isInteger(sky) && sky >= 0 && sky < COVER_SKIES.length
      ? sky
      : skyIndex(seed);
  const [top, middle, horizon, sun, far, mid, near] = COVER_SKIES[i];

  return (
    <svg
      data-ui="cover-fallback"
      data-sky={i}
      width="100%"
      height="100%"
      viewBox="0 0 300 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", borderRadius: radius, flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset=".55" stopColor={middle} />
          <stop offset="1" stopColor={horizon} />
        </linearGradient>
      </defs>
      <rect width="300" height="180" fill={`url(#${gradientId})`} />
      <ellipse cx={SUN_X[i]} cy="112" rx="24" ry="24" fill={sun} opacity=".9" />
      <path d={HILLS[0]} fill={far} />
      <path d={HILLS[1]} fill={mid} />
      <path d={HILLS[2]} fill={near} />
    </svg>
  );
}

export default CoverFallback;
