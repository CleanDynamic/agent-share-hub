// RC-P27 — THIS WEEK: the three weekly challenges and how far each has come.
//
// AT MOST THREE ⟦hicks-law › Budgets⟧, and they are XP-DESIGN.md's three,
// read from lib/progress/weekly.ts. Each is its title, its progress as
// "n of m" in DM Mono with tabular digits at the trailing edge (the value in
// --text, "of m" in --text2: a value beside its ceiling, law 1 of the theme),
// and under them the same bar PROGRESS draws ⟦law-of-similarity⟧. Nothing
// here is a control: a challenge is done by doing the thing, and completing
// one pays no XP, because XP-DESIGN.md lists no such source.
//
// SPACING: the title and its bar are 8 apart, the challenges 16, the section's
// children 16, inside this new wrapper ⟦law-of-proximity⟧.
//
// STATES: loading is the three rows in --recess blocks (STATES.md row 20); a
// failed read is STATES.md row 21, never "0 of 3" that nobody measured.

import type { ReactNode } from "react";

import { SectionHeading } from "@/components/analytics/BuildAnalytics";
import { useMyWeek } from "@/hooks/useProgressPage";
import { WEEKLY_CHALLENGE_LIMIT, WEEKLY_CHALLENGES, weeklyProgress } from "@/lib/progress/weekly";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, tabular } from "@/lib/theme/type";

import { LitBar } from "./LitBar";
import { SectionRefusal } from "./SectionRefusal";

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
} as const;

function Loading() {
  return (
    <ul data-testid="this-week-loading" aria-busy="true" aria-label="Loading this week's challenges" style={listStyle}>
      {WEEKLY_CHALLENGES.slice(0, WEEKLY_CHALLENGE_LIMIT).map((challenge) => (
        <li key={challenge.slug} style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
          <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: 24, maxWidth: 320 }} />
          <span aria-hidden style={{ ...skeletonStyle(), display: "block", height: SPACE.xs }} />
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
        {weeklyProgress(week.data ?? [], new Date()).map(({ challenge, done, target }) => (
          <li
            key={challenge.slug}
            data-testid="weekly-challenge"
            style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}
          >
            <div style={{ display: "flex", alignItems: "baseline", columnGap: SPACE.sm }}>
              <span style={{ ...body, color: t.text, flex: "1 1 0", minWidth: 0 }}>{challenge.title}</span>
              <span
                data-testid="weekly-challenge-count"
                style={{ ...dataText, ...tabular, color: t.text, whiteSpace: "nowrap" }}
              >
                {done}
                <span style={{ color: t.text2 }}> of {target}</span>
              </span>
            </div>
            <LitBar
              data-testid="weekly-challenge-bar"
              value={done}
              max={target}
              label={challenge.title}
              valueText={`${done} of ${target}`}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      data-testid="this-week"
      aria-labelledby="this-week-heading"
      style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
    >
      <SectionHeading id="this-week-heading">This week</SectionHeading>
      {content}
    </section>
  );
}

export default ThisWeek;
