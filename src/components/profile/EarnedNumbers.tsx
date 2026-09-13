// The creator's two earned numbers — BG-P25.
//
// WHAT THESE ARE. Reproductions received and rebuilds of their work, summed
// across everything the creator has published. They are the profile's half of
// the same claim a card's plaque makes: somebody who is not the creator ran
// this, and somebody who is not the creator built on it. Nothing here can be
// self-served — both counters are maintained by database triggers and both
// count other people.
//
// THEY MATCH THE PLAQUE BECAUSE THEY ARE THE SAME SIGNAL. The theme's rule is
// that a reader learns one treatment and reads it everywhere, so this borrows
// the plaque's exactly rather than approximating it: the same `chipType` mono
// at the same size, `tabular-nums` so the digits align, a filled
// `--evidence-fill` tag with `--text` on it for the number that should be
// remembered, and the second signal beside it as plain mono in `--text2`. Put a
// card and a profile header side by side and the two rows are the same object.
// (`law-of-similarity` — shared face, size and fill is what says "these mean
// the same kind of thing".)
//
// WHY ONE OF THE TWO IS FILLED AND THE OTHER IS NOT. The plaque fills the
// reproduction count and leaves freshness as text, because a single deviation
// against a consistent background is what isolation costs (`von-restorff`);
// filling both would leave neither emphasised and would put two tags in a
// header that already carries a primary button. Reproduction is the figure that
// earns the fill in both places, and for the same reason: it is the number that
// answers "does this person's work actually run".
//
// ZERO IS SHOWN, NEVER HIDDEN. "Nobody has reproduced this creator's work yet"
// is a state a reader is entitled to, and suppressing the row leaves them
// unable to tell it apart from "we are not saying". The wording is the plaque's
// own — "not yet reproduced" — not a warning and not a nudge.

import type { CSSProperties } from "react";
import { categoryFill } from "@/lib/theme/category";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { tabular } from "@/lib/theme/type";

export interface EarnedNumbersProps {
  /** Reproductions recorded against this creator's builds, by other people. */
  reproductions: number;
  /** Published rebuilds of this creator's builds, by other people. */
  rebuilds: number;
  /** Still counting. Renders the row's shape with neither figure asserted. */
  loading?: boolean;
  style?: CSSProperties;
}

const NEVER_REPRODUCED = "not yet reproduced";
const NEVER_REBUILT = "not yet rebuilt";

function reproductionTitle(count: number): string {
  if (count === 0) {
    return "Nobody other than this creator has recorded running their work yet.";
  }
  const who = count === 1 ? "person" : "people";
  return `${count} ${who} other than this creator ran something of theirs and said what happened.`;
}

function rebuildTitle(count: number): string {
  if (count === 0) return "Nobody has published a rebuild of this creator's work yet.";
  const times = count === 1 ? "once" : `${count} times`;
  return `Somebody took this creator's work as a starting point and published the result — ${times}.`;
}

export function EarnedNumbers({
  reproductions,
  rebuilds,
  loading = false,
  style,
}: EarnedNumbersProps) {
  const evidence = categoryFill("evidence");

  return (
    <div
      data-visual-slot="earned-numbers"
      data-earned-state={loading ? "counting" : "counted"}
      style={{
        display: "flex",
        alignItems: "center",
        /* Wraps rather than clips: at 390 the two signals stack, and a
           `nowrap` row would have pushed the header past the viewport. */
        flexWrap: "wrap",
        /* The plaque's own gap. The pair reads as one object because the gap
           between them is smaller than the gap to anything else
           (`law-of-proximity`), which is the whole reason they are one
           element's children. */
        gap: 8,
        minWidth: 0,
        ...style,
      }}
    >
      {/* 1. REPRODUCTIONS RECEIVED. The filled tag, exactly as on a card. */}
      <span
        data-earned-reproductions=""
        data-testid="earned-reproductions"
        title={loading ? undefined : reproductionTitle(reproductions)}
        style={{
          ...chipType,
          ...tabular,
          /* Inline flow rather than flex, for the plaque's reason: a flex
             container swallows the space between the numeral and the word, and
             "128reproduced" is what a screen reader then says. */
          display: "inline-block",
          flexShrink: 0,
          padding: "2px 8px",
          borderRadius: r.chip,
          /* The measured pair: `--evidence-fill` with `--text` on it, 11.89:1
             on Exhibition. Longhand rather than the `background` shorthand —
             a shorthand whose whole value is a `var()` is the declaration
             jsdom's cssstyle drops. */
          backgroundColor: evidence.background,
          color: t.text,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? "counting" : reproductions === 0 ? NEVER_REPRODUCED : `${reproductions} reproduced`}
      </span>

      {/* 2. REBUILDS OF THEIR WORK. Plain mono in `--text2`, the treatment the
           plaque gives its second signal. No lamp: a lamp means a freshness
           claim, and a rebuild count is not one. */}
      <span
        data-earned-rebuilds=""
        data-testid="earned-rebuilds"
        title={loading ? undefined : rebuildTitle(rebuilds)}
        style={{
          ...chipType,
          ...tabular,
          minWidth: 0,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: t.text2,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {loading
          ? "counting"
          : rebuilds === 0
            ? NEVER_REBUILT
            : `rebuilt ${rebuilds === 1 ? "once" : `${rebuilds} times`}`}
      </span>
    </div>
  );
}

export default EarnedNumbers;
