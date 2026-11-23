// RC-P27 — BADGES: earned first, then not yet.
//
// Synth 15 Part E. Every badge is a BadgeMark, as the repo draws it (a tier is weight and fill, never a hue; the tier is in
// each mark's accessible name), each on a Card (Card fill, radius 12, 8 of padding). The badges earned by runs are not on
// the interface (`listedBadges`). The head is the fact: "4 of 6 badges".
//
// THE GRID fills the column with cards 8 apart and at least 112 wide, except that on a phone the minimum gives way to a
// third of the column, so there are always three across.
//
// STATES: loading is a block per card; a failed read is one sentence and "Try again", never unearned badges that nobody
// measured.

import type { ReactNode } from "react";

import { SectionHeading } from "@/components/analytics/BuildAnalytics";
import { BadgeMark } from "@/components/trophies/BadgeMark";
import { BADGES } from "@/components/trophies/badge-data";
import { useMyBadges } from "@/hooks/useProgressPage";
import { badgesInOrder, listedBadges } from "@/lib/progress/badges";
import { skeletonStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";

import { SectionRefusal } from "./SectionRefusal";

const GAP = 8;
/** A third of the column less two gaps, with a pixel to spare so three always fit. */
const THIRD = `calc((100% - ${2 * GAP + 1}px) / 3)`;

const gridStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(112px, ${THIRD}), 1fr))`,
  gap: GAP,
} as const;

const card = { background: t.module, borderRadius: 12, padding: 8, boxSizing: "border-box", minWidth: 0 } as const;

const SHOWN = listedBadges(BADGES);

/** "4 of 6 badges". */
export const badgesFact = (earned: number, total: number): string => `${earned} of ${total} badges`;

export function BadgesSection() {
  const held = useMyBadges();

  let content: ReactNode;
  let heading = "Badges";
  if (held.isLoading) {
    content = (
      <ul data-testid="badges-loading" aria-busy="true" aria-label="Loading your badges" style={gridStyle}>
        {SHOWN.map((badge) => (
          <li key={badge.id} aria-hidden style={{ ...skeletonStyle(), aspectRatio: "1 / 1", borderRadius: 12 }} />
        ))}
      </ul>
    );
  } else if (held.error && !held.data) {
    content = <SectionRefusal data-testid="badges-error" error={held.error} onRetry={() => void held.refetch()} />;
  } else {
    const ordered = badgesInOrder(SHOWN, held.data ?? new Set<string>());
    heading = badgesFact(ordered.filter((entry) => entry.earned).length, ordered.length);
    content = (
      <ul aria-label="Your badges, earned first" style={gridStyle}>
        {ordered.map(({ badge, earned }) => (
          <li key={badge.id} data-testid="badge-slot" style={card}>
            <BadgeMark badge={badge} earned={earned} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section data-testid="badges" aria-labelledby="badges-heading" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeading id="badges-heading">{heading}</SectionHeading>
      {content}
    </section>
  );
}

export default BadgesSection;
