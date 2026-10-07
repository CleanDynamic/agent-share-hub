// The glass orb (UI-P10): one live count, said in words.
//
// "Reproduced today · 48 runs". A sphere of the painted glass ground with a
// dotted ring above its label and a sub-label beneath, all of it sitting above
// the glow at the orb's foot — which is what `padding-bottom: 16%` of the size
// is for. The dotted circle is static; it is a promise of the live reading, not
// an animation of it, and nothing here moves.
//
// ONE REAL NUMBER, NEVER DECORATION. If the orb has nothing true to say it is
// not drawn; it is not a placeholder for a count that has not arrived.

import { denseSpace } from "@/lib/theme/density";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { orbBase, ORB_GLASS_SHADOW } from "./orb";

export interface OrbGlassProps {
  /** Diameter in px: 162, 150, 140, 128 or 118. */
  size: number;
  /** What is being counted, in words: "Reproduced today". */
  label: string;
  /** The reading: "48 runs". */
  sub?: string;
}

export function OrbGlass({ size, label, sub }: OrbGlassProps) {
  return (
    <div
      data-ui="orb-glass"
      style={{
        ...orbBase(size),
        background: t.orbGlass,
        boxShadow: ORB_GLASS_SHADOW,
        gap: 5,
        paddingBottom: denseSpace(Math.trunc(size * 0.16)),
      }}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle
          cx="10"
          cy="10"
          r="7.5"
          fill="none"
          stroke="var(--on-orb-glass)"
          strokeWidth="1.6"
          strokeDasharray="1.2 3.4"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          fontFamily: FIGTREE,
          fontWeight: 500,
          fontSize: 12,
          lineHeight: "normal",
          color: t.onOrbGlass,
          textAlign: "center",
        }}
      >
        {label}
      </div>
      {sub ? (
        <div style={{ fontFamily: DM_MONO, fontSize: 10, lineHeight: "normal", color: t.onOrbGlass, opacity: 0.8 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default OrbGlass;
