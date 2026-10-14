// The streak day (UI-P86, refined look): one day of a streak week.
//
// 32 high, radius 6, `flex: 1` in a row with a gap of 6 (`StreakWeek`). Lit is the control recipe with a 14×3 lamp
// bar; frozen is the control recipe with a 14×3 `--frozen` bar; not lit is transparent with a 1px dashed `--line`
// edge. The day's letter sits under it, 11 `--label`.
//
// THE STATE IS DATA (RULES §5): the caller passes the day's kind from the streak record. Each day keeps its accessible
// name, "Monday: lit", on the item, and the letter under it is hidden from it.

import type { ReactNode } from "react";

import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { LampBar } from "./LampDot";

export type StreakDayState = "active" | "frozen" | "none";

const SPOKEN: Record<StreakDayState, string> = { active: "lit", frozen: "frozen", none: "not lit" };

/** "Monday: lit". */
export function streakDayLabel(dayName: string, state: StreakDayState): string {
  return `${dayName}: ${SPOKEN[state]}`;
}

export interface StreakDayProps {
  state: StreakDayState;
  /** The day's full name, for the accessible name. */
  dayName: string;
  /** The letter under the mark. */
  letter: string;
}

export function StreakDay({ state, dayName, letter }: StreakDayProps) {
  return (
    <li
      aria-label={streakDayLabel(dayName, state)}
      data-ui="streak-day"
      data-state={state}
      style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "100%",
          height: 32,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          ...(state === "none" ? { background: "transparent", border: `1px dashed ${t.line}` } : CONTROL),
        }}
      >
        {state === "active" ? <LampBar width={14} /> : null}
        {state === "frozen" ? (
          <span style={{ width: 14, height: 3, borderRadius: 1, backgroundColor: t.frozen }} />
        ) : null}
      </span>
      <span aria-hidden="true" style={{ fontFamily: FIGTREE, fontSize: 11, lineHeight: "normal", color: t.label }}>
        {letter}
      </span>
    </li>
  );
}

/** The week: the days in a row with a gap of 6, as a list. */
export function StreakWeek({ children, ...rest }: { children: ReactNode; "data-testid"?: string }) {
  return (
    <ul {...rest} style={{ display: "flex", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
      {children}
    </ul>
  );
}

export default StreakDay;
