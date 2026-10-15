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
//
// UNDER THE REFINED LOOK (UI-P86) there is no landscape. The fallback is the
// picture the boards hang in every framed work: `--paper` with a sketch of a
// page on it, a 3px headline at 45% and two 2px lines at 70% and 55%. The ink
// is an artwork constant per room (RULES §2). The margin is 8, or 4 once the
// picture is under 50px high, as the boards draw it. `data-sky` is still the
// seed's sky, so the build keeps its identity in the markup.

import { useLayoutEffect, useRef, useState } from "react";

import { useResolvedTheme } from "@/contexts/ThemeContext";
import { t } from "@/lib/theme/tokens";

import { hashSeed } from "./hash";

export { hashSeed };

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

/** The sketch's ink per room: the headline, then the two lines. Artwork constants (RULES §2). */
export const SKETCH_INK = {
  dusk: ["rgba(255,255,255,.14)", "rgba(255,255,255,.06)"],
  noon: ["rgba(20,20,18,.16)", "rgba(20,20,18,.07)"],
} as const;

/** Under this height the sketch's margin goes from 8 to 4. */
const SKETCH_COMPACT_BELOW = 50;

function RefinedCoverFallback({ radius, index }: { radius: string | number; index: number }) {
  const room = useResolvedTheme();
  const ref = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setCompact(node.clientHeight > 0 && node.clientHeight < SKETCH_COMPACT_BELOW);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [head, line] = SKETCH_INK[room];
  return (
    <span
      ref={ref}
      data-ui="cover-fallback"
      data-sky={index}
      aria-hidden="true"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: compact ? 4 : 8,
        borderRadius: radius,
        background: t.paper,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <span style={{ width: "45%", height: 3, background: head }} />
      <span style={{ width: "70%", height: 2, background: line }} />
      <span style={{ width: "55%", height: 2, background: line }} />
    </span>
  );
}

export function CoverFallback(props: CoverFallbackProps) {
  const { seed, radius, sky } = props;
  const i =
    sky !== undefined && Number.isInteger(sky) && sky >= 0 && sky < COVER_SKIES.length
      ? sky
      : skyIndex(seed);
  return <RefinedCoverFallback radius={radius} index={i} />;
}

export default CoverFallback;
