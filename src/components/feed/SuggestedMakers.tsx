import { useId } from "react";
import { useQuery } from "@tanstack/react-query";

import { MakerLink } from "@/components/profile/MakerLink";
import { linkableMakers } from "@/lib/profile/searchMakers";
import { listSuggestedMakers } from "@/lib/profile/suggestedMakers";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { eyebrow } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P11 — the product's one suggestion list ⟦hicks-law › Budgets⟧.

   Rendered only under Home's Following tab when the reader follows nobody: at
   most three makers, the creators of the most reproduced builds of the last
   ninety days. The label states that order, the way the gallery states its
   own; nothing here is tuned to the reader. Its one request is made only when
   this renders, and a failure costs the row, never the empty state above it.
   ──────────────────────────────────────────────────────────────────────────── */

/** The makers change slowly; one answer serves a visit. */
const SUGGESTIONS_STALE_MS = 5 * 60 * 1000;

/**
 * Every maker's box is one width, so when the row wraps on a phone the three
 * stack with their avatars on one edge instead of each centring on its own
 * name ⟦law-of-continuity › Alignment⟧. Three of them and two 8 gaps fit the
 * empty state's 472px measure on a desktop; 148 leaves a name about 108px
 * beside its avatar before it wraps.
 */
const MAKER_WIDTH = 148;

export function SuggestedMakers({ excludeId }: { excludeId: string | null }) {
  const headingId = useId();
  const makers = useQuery({
    queryKey: ["home_suggested_makers"],
    queryFn: listSuggestedMakers,
    staleTime: SUGGESTIONS_STALE_MS,
  });

  // The reader is never suggested to themself.
  const rows = linkableMakers(makers.data ?? []).filter((maker) => maker.id !== excludeId);
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="suggested-makers"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SPACE.xs,
        marginTop: SPACE.lg,
      }}
    >
      <h2 id={headingId} style={{ ...eyebrow, margin: 0, color: t.text2 }}>
        Most reproduced · 90 days
      </h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: SPACE.xs,
          rowGap: SPACE.xs,
        }}
      >
        {rows.map((maker) => (
          /* textAlign start: the notice above centres its text, and a
             centred link inside each box would undo the shared edge. */
          <li key={maker.id} style={{ width: MAKER_WIDTH, minWidth: 0, textAlign: "start" }}>
            <MakerLink maker={maker} testId="suggested-maker" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SuggestedMakers;
