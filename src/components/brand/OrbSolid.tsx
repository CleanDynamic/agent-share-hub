// The solid orb (UI-P10): a total, as one large number.
//
// "This week · 312 · runs reported". A dark sphere in Noon and a pale one in
// Dusk — the inverse of the room, so it reads as the heaviest object on the page
// — with the number in DM Mono at 17% of its diameter and the two lines of words
// above and below it in the quiet ink.

import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { orbBase, ORB_DROP } from "./orb";

export interface OrbSolidProps {
  /** Diameter in px: 162, 150, 140, 128 or 118. */
  size: number;
  /** The line above the number: "This week". */
  top: string;
  /** The number. */
  value: string | number;
  /** The line below it: "runs reported". */
  bottom: string;
}

const LINE = { fontFamily: FIGTREE, fontSize: 11, lineHeight: "normal", color: t.onOrbSolid2 } as const;

export function OrbSolid({ size, top, value, bottom }: OrbSolidProps) {
  return (
    <div
      data-ui="orb-solid"
      style={{ ...orbBase(size), background: t.orbSolid, boxShadow: ORB_DROP, gap: 3 }}
    >
      <div style={LINE}>{top}</div>
      <div
        style={{
          fontFamily: DM_MONO,
          fontSize: Math.trunc(size * 0.17),
          lineHeight: "normal",
          color: t.onOrbSolid,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div style={LINE}>{bottom}</div>
    </div>
  );
}

export default OrbSolid;
