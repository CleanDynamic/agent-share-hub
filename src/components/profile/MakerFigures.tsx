// A maker's standing: four figures, under the profile header (RC-P21).
//
// FOUR FIGURES AND NOTHING ELSE IN THE ROW ⟦critique-information-density ›
// Content Prioritisation; Scanning Patterns⟧: what they built, how many times
// other people got it working, how many times other people rebuilt it, and
// how many gaps they solved. Follower counts are not standing and are not
// here; the header's own strip keeps them.
//
// EACH FIGURE SITS 8 ABOVE ITS LABEL AND THE FIGURES ARE 40 APART
// ⟦law-of-proximity⟧: the gap inside a figure is a fifth of the gap between
// figures, so a number is read with its own label and never with the
// neighbour's. The number is DM Mono 22 with tabular digits, in --text; the
// label is Figtree 16 in --text2 ⟦buildgallery-theme › Type⟧ (STATES.md row
// 22). Below 768 the row reflows into two by two ⟦responsive-design ›
// Reflow⟧, 40 apart both ways, and a label that meets its column's edge wraps
// rather than pushing the page sideways.
//
// The figures are text, not controls: a figure that opened something would be
// a fifth and sixth choice on a page whose tabs already are the choices
// ⟦hicks-law⟧.
//
// Loading is the final layout with --recess blocks where the numbers go
// (STATES.md row 20); a refusal or failure is its one sentence and a secondary
// "Try again" (row 21), never four zeros that were not measured.

import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { isPermissionError } from "@/lib/errors/permission";
import type { MakerStats } from "@/lib/profile/makerStats";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, tabular } from "@/lib/theme/type";

/** The row's labels, in the row's order. Nothing is added to this list. */
export const MAKER_FIGURE_LABELS = [
  "builds",
  "got working by others",
  "rebuilt by others",
  "gaps solved",
] as const;

/** DM Mono 22 sets a 26px line; the loading block holds exactly that. */
const FIGURE_LINE = 26;

export interface MakerFiguresProps {
  stats: MakerStats | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

function valuesOf(stats: MakerStats): readonly number[] {
  return [stats.builds, stats.reproductionsReceived, stats.rebuildsOfTheirWork, stats.gapsSolved];
}

export function MakerFigures({ stats, loading, error, onRetry }: MakerFiguresProps) {
  const phone = useBreakpoint() === "mobile";

  if (error && !stats) {
    return (
      <div
        data-testid="maker-figures-error"
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}
      >
        <p style={{ ...body, color: t.text, margin: 0 }}>
          {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
        </p>
        <Button type="button" variant="outline" onClick={onRetry} style={{ background: "transparent", minHeight: 44 }}>
          Try again
        </Button>
      </div>
    );
  }

  const values = stats && !loading ? valuesOf(stats) : null;

  return (
    <ul
      data-testid="maker-figures"
      aria-label="Standing"
      aria-busy={values === null}
      style={{
        /* No margin here: the page's column spaces its sections, and an
           inline margin would cancel that spacing for this one. */
        listStyle: "none",
        padding: 0,
        display: "grid",
        gridTemplateColumns: phone ? "repeat(2, minmax(0, 1fr))" : "repeat(4, auto)",
        justifyContent: "start",
        columnGap: SPACE.lg,
        rowGap: SPACE.lg,
      }}
    >
      {MAKER_FIGURE_LABELS.map((label, index) => (
        <li
          key={label}
          data-testid="maker-figure"
          style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, minWidth: 0 }}
        >
          {values ? (
            <span
              data-testid="maker-figure-value"
              style={{
                fontFamily: DM_MONO,
                fontSize: 22,
                fontWeight: 500,
                lineHeight: `${FIGURE_LINE}px`,
                color: t.text,
                ...tabular,
              }}
            >
              {values[index].toLocaleString("en-GB")}
            </span>
          ) : (
            <span aria-hidden style={{ ...skeletonStyle(), display: "block", width: 48, height: FIGURE_LINE }} />
          )}
          <span style={{ ...body, fontSize: 16, lineHeight: 1.3, color: t.text2, overflowWrap: "break-word" }}>
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}
