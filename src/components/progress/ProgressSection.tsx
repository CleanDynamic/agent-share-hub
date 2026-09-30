// RC-P27 — PROGRESS: where the reader stands, and how XP is earned.
//
// THREE FIGURES, THEN THE BAR ⟦better-layout › Order by importance⟧: the
// level, the XP, and the XP still to go to the next level, each a number in
// DM Mono with tabular digits in --text over a Figtree label in --text2
// (STATES.md row 22), drawn the way YOUR BUILDS draws its figures, 8 inside a
// figure and 40 between ⟦law-of-proximity⟧ ⟦law-of-similarity⟧. Under them,
// the bar: the level's progress as light, with nothing written on it
// ⟦buildgallery-theme › Progress and achievement⟧.
//
// HOW YOU EARN is the six sources of XP-DESIGN.md as a plain list, in its
// words and its order (lib/progress/sources.ts): what happens, then its XP in
// DM Mono. No XP source exists that is not on it.
//
// SPACING ⟦buildgallery-theme › Spacing scale⟧: this section's children are
// 16 apart, inside this new wrapper; a list's rows and a heading over its own
// list are 8.
//
// STATES: loading keeps the final layout with --recess blocks where the
// numbers and the bar go (STATES.md row 20); a failed read is STATES.md row
// 21, never level 1 and no XP that nobody measured. No row yet is the start,
// which is level 1 and no XP, and is drawn as such. The list is written here,
// not read, so it shows in every state.

import type { ReactNode } from "react";

import { SectionHeading } from "@/components/analytics/BuildAnalytics";
import { useProgress } from "@/hooks/useProgress";
import { XP_SOURCES } from "@/lib/progress/sources";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, data as dataText, label as labelText, tabular } from "@/lib/theme/type";

import { LitBar } from "./LitBar";
import { SectionRefusal } from "./SectionRefusal";

/** DM Mono 22 sets a 26px line; a loading block holds exactly that, as MakerFigures' do. */
const FIGURE_LINE = 26;

interface Figure {
  label: string;
  value: number;
}

function Figures({ figures }: { figures: Figure[] | null }) {
  return (
    <ul
      data-testid="progress-figures"
      aria-label="Level and XP"
      aria-busy={figures === null}
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexWrap: "wrap",
        columnGap: SPACE.lg,
        rowGap: SPACE.sm,
      }}
    >
      {(figures ?? PLACEHOLDERS).map((figure) => (
        <li
          key={figure.label}
          data-testid="progress-figure"
          style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, minWidth: 0 }}
        >
          {figures ? (
            <span
              data-testid="progress-figure-value"
              style={{
                fontFamily: DM_MONO,
                fontSize: 22,
                fontWeight: 500,
                lineHeight: `${FIGURE_LINE}px`,
                color: t.text,
                ...tabular,
              }}
            >
              {figure.value.toLocaleString("en-GB")}
            </span>
          ) : (
            <span aria-hidden style={{ ...skeletonStyle(), display: "block", width: 48, height: FIGURE_LINE }} />
          )}
          <span style={{ ...body, lineHeight: 1.3, color: t.text2, overflowWrap: "break-word" }}>{figure.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The labels a loading row holds, so the row keeps its shape. */
const PLACEHOLDERS: Figure[] = [
  { label: "level", value: 0 },
  { label: "XP", value: 0 },
  { label: "XP to the next level", value: 0 },
];

function HowYouEarn() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
      <h3 id="how-you-earn-heading" style={{ ...labelText, color: t.text2, margin: 0 }}>
        How you earn
      </h3>
      <ul
        aria-labelledby="how-you-earn-heading"
        style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: SPACE.xs }}
      >
        {XP_SOURCES.map((source) => (
          <li
            key={source.event}
            data-testid="xp-source"
            style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: SPACE.xs }}
          >
            <span style={{ ...body, color: t.text }}>{source.event}</span>
            <span data-testid="xp-source-xp" style={{ ...dataText, ...tabular, color: t.text2 }}>
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

  let standing: ReactNode;
  if (error && !progress) {
    standing = <SectionRefusal data-testid="progress-error" error={error} onRetry={refetch} />;
  } else if (isLoading) {
    standing = (
      <>
        <Figures figures={null} />
        <span
          data-testid="progress-loading"
          role="status"
          aria-label="Loading your level"
          style={{ ...skeletonStyle(), display: "block", height: SPACE.xs }}
        />
      </>
    );
  } else {
    standing = (
      <>
        <Figures
          figures={[
            { label: "level", value: level },
            { label: "XP", value: progress?.xp_total ?? 0 },
            { label: `XP to level ${next}`, value: Math.max(0, xpForNext - xpInLevel) },
          ]}
        />
        <LitBar
          data-testid="level-bar"
          value={xpInLevel}
          max={xpForNext}
          label={`Progress to level ${next}`}
          valueText={`${xpInLevel.toLocaleString("en-GB")} of ${xpForNext.toLocaleString("en-GB")} XP`}
        />
      </>
    );
  }

  return (
    <section
      data-testid="progress-section"
      aria-labelledby="progress-heading"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
    >
      <SectionHeading id="progress-heading">Progress</SectionHeading>
      {standing}
      <HowYouEarn />
    </section>
  );
}

export default ProgressSection;
