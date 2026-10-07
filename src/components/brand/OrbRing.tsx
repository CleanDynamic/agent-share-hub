// The ring orb (UI-P10): progress as light.
//
// A glass orb inside a ring of `--lit` that fills clockwise from the top to
// `percent`, over `--ring-track`; on Dusk the ring glows (`--ring-glow`, none on
// Noon). The number in the middle is the level, in the display face at 20% of
// the diameter, with a one-word caption under it. The ring is a picture of a
// number that is also said in words, so the whole orb is one image with a full
// label — "Level 7, 77% of the way to level 8" — and nothing inside it is read
// separately.
//
// Sentient is never set under 17px, so a small ring (the profile's 80px, the
// feed's 36px) takes the floor rather than 20% of itself.

import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { DM_MONO, DRAWN_HEADING_MIN_PX, display } from "@/lib/theme/type";

export interface OrbRingProps {
  /** Diameter in px: 150, 120, 118 or 112 for the orb; smaller for an avatar's ring. */
  size: number;
  /** Progress, 0 to 100. Clamped. */
  percent: number;
  /** The figure in the middle: the level. */
  value: string | number;
  /** A word under it: "level". */
  caption?: string;
  /** The whole orb as one image: "Level 7, 77% of the way to level 8". */
  label: string;
  /** The ring's thickness in px. 9 at the orb sizes; an avatar's ring is thinner. */
  thickness?: number;
  /** Replaces the figure and caption: an avatar inside the ring. */
  children?: ReactNode;
}

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

export function OrbRing({ size, percent, value, caption, label, thickness = 9, children }: OrbRingProps) {
  const p = clamp(percent);
  const figure = Math.max(DRAWN_HEADING_MIN_PX, Math.trunc(size * 0.2));

  return (
    <div
      data-ui="orb-ring"
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${t.lit} 0 ${p}%, ${t.ringTrack} ${p}% 100%)`,
        padding: thickness,
        boxShadow: t.ringGlow,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: t.orbGlass,
          boxShadow: "inset 0 0 0 1px var(--orb-glass-edge)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          paddingBottom: children ? undefined : Math.trunc(size * 0.12),
          boxSizing: "border-box",
          overflow: children ? "hidden" : undefined,
        }}
      >
        {children ?? (
          <>
            <div style={{ ...display(figure), lineHeight: 1, letterSpacing: "-0.03em", color: t.onOrbGlass }}>
              {value}
            </div>
            {caption ? (
              <div style={{ fontFamily: DM_MONO, fontSize: 10, lineHeight: "normal", color: t.onOrbGlass }}>
                {caption}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default OrbRing;
