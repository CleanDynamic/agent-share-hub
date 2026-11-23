// The logo: the dot-drawn beaver on its own. A transparent PNG (the beaver and its water on nothing): no tile behind it and no
// wordmark with it. `size` is its WIDTH; the height follows the picture's own ratio. Where a solid ground is needed (an app
// icon, a social image) the black is `#040504`, the Page shade.

import type { CSSProperties } from "react";

/** The picture's height over its width (cropped to the drawing, so the beaver fills it). */
export const BEAVER_RATIO = 587 / 898;

export function BeaverLogo({ theme, size = 96, style }: { theme: "dusk" | "noon"; size?: number; style?: CSSProperties }) {
  const base = `/brand/beaver-${theme === "dusk" ? "dark" : "light"}-logo`;
  return (
    <img
      src={`${base}-192.png`}
      srcSet={`${base}-192.png 1x, ${base}-384.png 2x`}
      width={size}
      height={Math.round(size * BEAVER_RATIO)}
      alt=""
      style={{ display: "block", flexShrink: 0, ...style }}
    />
  );
}
