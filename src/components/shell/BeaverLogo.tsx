// The logo: the dot-drawn beaver on its own. A transparent PNG (the beaver and its water on nothing): no tile behind it and no
// wordmark with it. `size` is its WIDTH; the height follows the picture's own ratio. Where a solid ground is needed (an app
// icon, a social image) the black is `#040504`, the Page shade. Mobile 29: a 768-wide export for 3x screens, so the 168 logo on
// the phone sign-in stays sharp (cropped from the 1024 masters, the ground taken out the same way as the 384s).

import type { CSSProperties } from "react";

/** The picture's height over its width (cropped to the drawing, so the beaver fills it). */
export const BEAVER_RATIO = 587 / 898;

/** `clear` marks the picture as the sign-in water's clear zone: the water fades to the page round it (`data-clear`). */
/** `loading="lazy"` for a logo below the first screen (the footer's), so it does not compete with what is on screen. */
export function BeaverLogo({ theme, size = 96, style, clear = false, loading }: { theme: "dusk" | "noon"; size?: number; style?: CSSProperties; clear?: boolean; loading?: "lazy" | "eager" }) {
  const base = `/brand/beaver-${theme === "dusk" ? "dark" : "light"}-logo`;
  return (
    <img
      src={`${base}-192.png`}
      srcSet={`${base}-192.png 1x, ${base}-384.png 2x, ${base}-768.png 3x`}
      width={size}
      height={Math.round(size * BEAVER_RATIO)}
      alt=""
      loading={loading}
      data-clear={clear ? "" : undefined}
      style={{ display: "block", flexShrink: 0, ...style }}
    />
  );
}
