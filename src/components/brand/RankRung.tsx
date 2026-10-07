// Rank rungs and creator-mark tiles (UI-P12): a ladder of weight and fill.
//
// RARITY IS WEIGHT AND FILL, NEVER A RAINBOW OF HUES. Four rungs:
//
//   highest   the lamp: `--lit` with `--on-lit`
//   rare      a recessed well: `--recess` with `--text`
//   common    a 1.5px `--line` outline on nothing, `--text`
//   none      no ground at all, `--label`
//
// so a reader can find the top of any list by the one filled amber square, and
// can tell a rare thing from a common one by whether it has a ground, in either
// room, with the colour-blind and the grey-scale alike.
//
// `RankRung` is the numbered square of a ranked list ("Top solvers"): the rank in
// Sentient at 16 / 18 / 22 for 28 / 32 / 40px. The reference draws the 28px rank
// at 16px; Sentient has a 17px floor in this system (`type.display`), so it is
// 17 here. `MarkTile` is the same ladder at 46px with a trophy for a creator
// mark, and the highest tile adds `--rank-glow` — a glow on Dusk, none on Noon.

import type { CSSProperties } from "react";
import { Trophy, type LucideIcon } from "lucide-react";

import { denseHeight } from "@/lib/theme/density";
import { t } from "@/lib/theme/tokens";
import { display, FIGTREE } from "@/lib/theme/type";

export type RankTier = "highest" | "rare" | "common" | "none";
export type RankRungSize = 28 | 32 | 40;

/** The ladder: ground, edge and ink per tier. */
const LADDER: Record<RankTier, CSSProperties> = {
  highest: { backgroundColor: t.lit, color: t.onLit },
  rare: { backgroundColor: t.recess, color: t.text },
  common: { border: `1.5px solid ${t.line}`, color: t.text },
  none: { color: t.label },
};

const RUNG: Record<RankRungSize, { radius: number; font: number }> = {
  28: { radius: 9, font: 17 },
  32: { radius: 10, font: 18 },
  40: { radius: 12, font: 22 },
};

const CENTRED: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  flexShrink: 0,
};

export interface RankRungProps {
  rank: number | string;
  tier: RankTier;
  size?: RankRungSize;
}

/* UI-P54, the density pass: a rung is a square, so its side goes through the
   table (28 → 23, 32 → 26, 40 → 33) and so does the mark tile's (46 → 38); the
   radii are not in the table, and the rank type is drawn at the sizes above and
   rendered by `display()`. */
export function RankRung({ rank, tier, size = 28 }: RankRungProps) {
  const { radius, font } = RUNG[size];
  const side = denseHeight(size);
  return (
    <span
      data-ui="rank-rung"
      data-tier={tier}
      style={{
        ...CENTRED,
        width: side,
        height: side,
        borderRadius: radius,
        ...LADDER[tier],
        ...display(font),
        letterSpacing: "normal",
      }}
    >
      {rank}
    </span>
  );
}

export interface MarkTileProps {
  tier: RankTier;
  /** What the mark is called: it is the tile's caption and its accessible name. */
  caption: string;
  /** A lucide icon, drawn at 20px. A trophy by default. */
  icon?: LucideIcon;
}

export function MarkTile({ tier, caption, icon: Icon = Trophy }: MarkTileProps) {
  return (
    <div
      data-ui="mark-tile"
      data-tier={tier}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 64 }}
    >
      <span
        aria-hidden="true"
        style={{
          ...CENTRED,
          width: 38,
          height: 38,
          borderRadius: 13,
          ...LADDER[tier],
          boxShadow: tier === "highest" ? t.rankGlow : undefined,
        }}
      >
        <Icon size={20} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
      </span>
      <span style={{ fontFamily: FIGTREE, fontSize: 10, color: t.text2, textAlign: "center", lineHeight: 1.2 }}>
        {caption}
      </span>
    </div>
  );
}

export default RankRung;
