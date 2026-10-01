// The shared drawing of an orb (UI-P10).
//
// Three orbs, one sphere. The glass orb and the ring's inner disc are the same
// painted ground (`--orb-glass`: a low warm horizon rising in a cool sky, in
// both rooms) and the solid orb is its night-time inverse (`--orb-solid`). They
// are circles — `border-radius: 50%` — and circles only: with avatars and lamp
// dots they are the one place a full radius is for.
//
// TWO VALUES ARE NOT TOKENS. The inner light (white at 18%) and the neutral drop
// shadow (black at 25%) are the same in both rooms and sit on artwork, so
// design/tokens/token-map.md puts them in the component that owns them, as
// named constants. Nothing theme-dependent is ever a constant: the ground, the
// edge and every ink come from the tokens.

import type { CSSProperties } from "react";

/** The soft light along the glass orb's upper edge. Identical in both themes. */
const INNER_LIGHT = "rgba(255,255,255,.18)";
/** The neutral drop shadow every orb casts. Identical in both themes. */
const DROP_SHADOW = "rgba(0,0,0,.25)";

/** The drop shadow alone, for the solid orb. */
export const ORB_DROP: string = `0 20px 50px ${DROP_SHADOW}`;

/** The glass orb's three shadows: the edge, the inner light, the drop. */
export const ORB_GLASS_SHADOW: string = [
  "inset 0 0 0 1px var(--orb-glass-edge)",
  `inset 0 12px 40px ${INNER_LIGHT}`,
  ORB_DROP,
].join(", ");

/** A circle of `size` px on a flex column, centred. */
export function orbBase(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    flexShrink: 0,
  };
}
