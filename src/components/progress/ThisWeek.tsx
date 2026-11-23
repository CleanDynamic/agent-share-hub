// RC-P27 — THIS WEEK: the weekly challenges and how far each has come.
//
// Synth 15 Part E: only the challenges that are not about runs ("Solve a gap"). Each is its title at 15, its progress as
// "0 / 1" in mono 13 at the right, and under them the 4px bar. Nothing here is a control: a challenge is done by doing the
// thing.
//
// STATES: loading is the rows in blocks; a failed read is one sentence and "Try again", never "0 / 1" that nobody measured.

import type { ReactNode } from "react";

import { SectionHeading } from "@/components/analytics/BuildAnalytics";
import { useMyWeek } from "@/hooks/useProgressPage";
import { LISTED_WEEKLY_CHALLENGES, WEEKLY_CHALLENGE_LIMIT, weeklyProgress } from "@/lib/progress/weekly";
import { skeletonStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular, textStep } from "@/lib/theme/type";

import { LitBar } from "./LitBar";
import { SectionRefusal } from "./SectionRefusal";

const listStyle = { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 } as const;

function Loading() {
  return (
    <ul data-testid="this-week-loading" aria-busy="true" aria-label="Loading this week's challenges" style={listStyle}>
      {LISTED_WEEKLY_CHALLENGES.slice(0, WEEKLY_CHALLENGE_LIMIT).map((challenge) => (
        <li key={challenge.slug} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: 20, maxWidth: 320 }} />
          <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: 4 }} />
        </li>
      ))}
    </ul>
  );
}

export function ThisWeek() {
  const week = useMyWeek();

  let content: ReactNode;
  if (week.isLoading) content = <Loading />;
  else if (week.error && !week.data) {
    content = <SectionRefusal data-testid="this-week-error" error={week.error} onRetry={() => void week.refetch()} />;
  } else {
    content = (
      <ul style={listStyle}>
        {weeklyProgress(week.data ?? [], new Date(), LISTED_WEEKLY_CHALLENGES).map(({ challenge, done, target }) => (
          <li key={challenge.slug} data-testid="weekly-challenge" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", columnGap: 12 }}>
              <span style={{ fontFamily: FIGTREE, fontSize: textStep.body, lineHeight: "20px", color: t.text, flex: "1 1 0", minWidth: 0 }}>{challenge.title}</span>
              <span data-testid="weekly-challenge-count" style={{ fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "20px", color: t.text2, whiteSpace: "nowrap", ...tabular }}>
                {`${done} / ${target}`}
              </span>
            </div>
            <LitBar data-testid="weekly-challenge-bar" height={4} value={done} max={target} label={challenge.title} valueText={`${done} of ${target}`} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section data-testid="this-week" aria-labelledby="this-week-heading" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeading id="this-week-heading">This week</SectionHeading>
      {content}
    </section>
  );
}

export default ThisWeek;
