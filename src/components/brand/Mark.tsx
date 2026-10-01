// The mark: a lamp over a framed work (UI-P06).
//
// ONE DRAWING, ONE COLOUR RULE. The body is `currentColor`, so the mark takes
// the ink of whatever it stands on; the lamp is always `--lit` — light, never
// text — except in the tagline, where it is `--tagline-lamp` because the chip
// it sits on would swallow amber. The geometry is the reference's, verbatim, on
// a 40×40 grid: `design/reference/components/{noon,dusk}.html` → Identity.
//
// THE HALO IS DUSK'S. A lamp needs darkness to glow, so Dusk draws a soft
// ellipse of `--lit` at 22% behind the lamp, first so everything else lies on
// top of it. The caller decides — `halo` is a prop, and `Lockup` turns it on
// when the room is Dusk — because whether an element exists is a fact a colour
// token cannot carry.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";

export interface MarkProps {
  /** Width and height in px. */
  size: number;
  /** Draw Dusk's halo behind the lamp. */
  halo?: boolean;
  /** The lamp's fill. Defaults to `--lit`; the tagline passes `--tagline-lamp`. */
  lamp?: string;
  style?: CSSProperties;
}

export function Mark({ size, halo = false, lamp = t.lit, style }: MarkProps) {
  return (
    <svg
      data-ui="mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      style={{ color: "inherit", flexShrink: 0, ...style }}
    >
      {halo ? <ellipse cx="20" cy="9" rx="10" ry="4" fill={t.lit} opacity=".22" /> : null}
      <ellipse cx="20" cy="4.8" rx="5.5" ry="3.4" fill={lamp} />
      <rect
        x="5.5"
        y="11.5"
        width="29"
        height="26"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect x="12" y="18" width="16" height="13" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export default Mark;
