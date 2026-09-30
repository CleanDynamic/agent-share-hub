// RC-P27 — BADGES: the ten of XP-DESIGN.md, earned first, then not yet.
//
// EVERY BADGE IS A BadgeMark (RC-P26), so a tier is weight and fill and never
// a hue: common an outline, rare a --recess fill, highest a --lit fill with
// --on-lit ink, and a badge not yet earned the outline, a --text2 icon and
// "Not yet", whatever its tier ⟦buildgallery-theme › Progress and
// achievement⟧. The tier is also in each mark's accessible name.
//
// THE ORDER is earned first, then not yet, each in the catalogue's order
// (lib/progress/badges.ts), and it is stated by the marks themselves: nothing
// here is a control ⟦hicks-law⟧.
//
// THE GRID fills the column with tiles 16 apart and at least 96 wide, except
// that on a phone the minimum gives way to a third of the column, so there
// are always three across: at 390 the column is 318, a pixel short of three
// tiles of 96 and two gaps, and two across made five rows of 150px squares.
// Measured: three across at 360 to 412, four at 768, five from 1024 (a 560
// column). A new wrapper; the section's children are 16 apart.
//
// STATES: loading is ten --recess tiles at the marks' size (STATES.md row 20);
// a failed read is STATES.md row 21, never ten unearned badges that nobody
// measured.

import type { ReactNode } from "react";

import { SectionHeading } from "@/components/analytics/BuildAnalytics";
import { BadgeMark } from "@/components/trophies/BadgeMark";
import { BADGES } from "@/components/trophies/badge-data";
import { useMyBadges } from "@/hooks/useProgressPage";
import { badgesInOrder } from "@/lib/progress/badges";
import { skeletonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";

import { SectionRefusal } from "./SectionRefusal";

/** A third of the column less two gaps, with a pixel to spare so three always fit. */
const THIRD = `calc((100% - ${2 * SPACE.sm + 1}px) / 3)`;

const gridStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(96px, ${THIRD}), 1fr))`,
  gap: SPACE.sm,
} as const;

export function BadgesSection() {
  const held = useMyBadges();

  let content: ReactNode;
  if (held.isLoading) {
    content = (
      <ul data-testid="badges-loading" aria-busy="true" aria-label="Loading your badges" style={gridStyle}>
        {BADGES.map((badge) => (
          <li key={badge.id} aria-hidden style={{ ...skeletonStyle(), aspectRatio: "1 / 1", borderRadius: r.chip }} />
        ))}
      </ul>
    );
  } else if (held.error && !held.data) {
    content = <SectionRefusal data-testid="badges-error" error={held.error} onRetry={() => void held.refetch()} />;
  } else {
    content = (
      <ul aria-label="Your badges, earned first" style={gridStyle}>
        {badgesInOrder(BADGES, held.data ?? new Set<string>()).map(({ badge, earned }) => (
          <li key={badge.id} data-testid="badge-slot">
            <BadgeMark badge={badge} earned={earned} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      data-testid="badges"
      aria-labelledby="badges-heading"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
    >
      <SectionHeading id="badges-heading">Badges</SectionHeading>
      {content}
    </section>
  );
}

export default BadgesSection;
