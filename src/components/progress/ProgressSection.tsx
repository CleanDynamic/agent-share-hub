// RC-P27 — PROGRESS: where the reader stands, and how XP is earned.
//
// Synth 15 Part E. The head is the fact: "Level 7" at 20/600 as the h2, with "1,240 XP · 260 to level 8" in mono 13 Text 2
// at the right. Under it the bar (6px, the Raised track, the Mint fill), then how XP is earned at 13 in Text 3: the sources
// of lib/progress/sources.ts that the page lists (publishing, being rebuilt, solving gaps; the run-based ones are not on
// the interface).
//
// STATES: loading keeps the final layout with blocks where the head and the bar go; a failed read is one sentence and "Try
// again", never level 1 and no XP that nobody measured. No row yet is the start, which is level 1 and no XP, and is drawn as
// such. The list is written here, not read, so it shows in every state.

import type { ReactNode } from "react";

import { useProgress } from "@/hooks/useProgress";
import { LISTED_XP_SOURCES } from "@/lib/progress/sources";
import { skeletonStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular, textStep } from "@/lib/theme/type";

import { LitBar } from "./LitBar";
import { SectionRefusal } from "./SectionRefusal";

/** A section's head on the progress page: the fact, 20/600. */
export const HEAD_STYLE = { margin: 0, fontFamily: FIGTREE, fontSize: textStep.headline, fontWeight: 600, lineHeight: "24px", color: t.text } as const;
/** A figure beside a head: mono 13 in Text 2. */
export const FIGURE_STYLE = { fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "20px", color: t.text2, whiteSpace: "nowrap", ...tabular } as const;
const NOTE_STYLE = { margin: 0, fontFamily: FIGTREE, fontSize: textStep.meta, lineHeight: "20px", color: t.label } as const;

const n = (value: number) => value.toLocaleString("en-GB");

function HowYouEarn() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h3 id="how-you-earn-heading" style={{ ...NOTE_STYLE, fontWeight: 400 }}>
        How you earn
      </h3>
      <ul aria-labelledby="how-you-earn-heading" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {LISTED_XP_SOURCES.map((source) => (
          <li key={source.event} data-testid="xp-source" style={{ ...NOTE_STYLE, display: "flex", flexWrap: "wrap", columnGap: 8 }}>
            <span>{source.event}</span>
            <span data-testid="xp-source-xp" style={{ fontFamily: DM_MONO, ...tabular }}>
              {source.xp} XP
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressSection() {
  const { level, xpInLevel, xpForNext, progress, isLoading, error, refetch } = useProgress();
  const next = level + 1;
  const refused = Boolean(error && !progress);

  let head: ReactNode;
  let standing: ReactNode;
  if (refused) {
    head = <h2 id="progress-heading" style={HEAD_STYLE}>Your level</h2>;
    standing = <SectionRefusal data-testid="progress-error" error={error} onRetry={refetch} />;
  } else if (isLoading) {
    head = (
      <>
        <h2 id="progress-heading" style={HEAD_STYLE}>Your level</h2>
        <span aria-hidden style={{ ...skeletonStyle(), display: "block", width: 160, height: 20 }} />
      </>
    );
    standing = <span data-testid="progress-loading" role="status" aria-label="Loading your level" style={{ ...skeletonStyle(), display: "block", height: 6 }} />;
  } else {
    const toGo = Math.max(0, xpForNext - xpInLevel);
    head = (
      <>
        <h2 id="progress-heading" data-testid="progress-level" style={HEAD_STYLE}>{`Level ${level}`}</h2>
        <span data-testid="progress-xp" style={FIGURE_STYLE}>{`${n(progress?.xp_total ?? 0)} XP · ${n(toGo)} to level ${next}`}</span>
      </>
    );
    standing = (
      <LitBar
        data-testid="level-bar"
        value={xpInLevel}
        max={xpForNext}
        label={`Progress to level ${next}`}
        valueText={`${n(xpInLevel)} of ${n(xpForNext)} XP`}
      />
    );
  }

  return (
    <section data-testid="progress-section" aria-labelledby="progress-heading" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "4px 16px", minWidth: 0 }}>{head}</div>
      {standing}
      <HowYouEarn />
    </section>
  );
}

export default ProgressSection;
