// The activity grid (UI-P12): one cell per day, seven rows, a column per week.
//
// THE LAMP, SPENT AS LIGHT. An active day is `--lit` at .3, .55, .8 or 1, by the
// quartile its volume falls in among the active days shown; an empty day is the
// unfilled `--bar-base`; a frozen day — one a freeze pass kept alive
// (`getStreakDays` kind `frozen`) — is hollow, a 1.5px `--evidence` outline on
// nothing, so it reads as kept rather than as missed. Amber is light, never
// text: no cell carries a number.
//
// SIZE IS FIXED: 12px cells at radius 4, 3px apart, so n weeks is `15n − 3`
// px wide (22 weeks is 327px, which is what desktop and mobile Profile both
// draw).

import { t } from "@/lib/theme/tokens";

export interface ActivityDay {
  /** Volume that day: 0 is an empty day. Any unit, since only the rank among the shown days matters. */
  count: number;
  /** A freeze pass kept the streak alive on this day. Wins over `count`. */
  frozen?: boolean;
  /** Shown on hover. */
  date?: string;
}

export interface ActivityGridProps {
  /** Oldest first, filled down each column. The last column may be short. */
  days: readonly ActivityDay[];
  /** The grid's accessible name. */
  label?: string;
}

const OPACITY = [0.3, 0.55, 0.8, 1] as const;
const ROWS = 7;

/** 1–4 by quartile of `count` among the non-empty days. */
export function activityLevels(days: readonly ActivityDay[]): number[] {
  const sorted = days
    .filter((d) => !d.frozen && d.count > 0)
    .map((d) => d.count)
    .sort((a, b) => a - b);
  const n = sorted.length;
  const cut = (k: number) => sorted[Math.max(0, Math.ceil((k / 4) * n) - 1)];
  const [q1, q2, q3] = [cut(1), cut(2), cut(3)];
  return days.map((d) =>
    d.frozen || d.count <= 0 ? 0 : 1 + (d.count > q1 ? 1 : 0) + (d.count > q2 ? 1 : 0) + (d.count > q3 ? 1 : 0),
  );
}

export function ActivityGrid({ days, label }: ActivityGridProps) {
  const levels = activityLevels(days);
  const columns = Math.ceil(days.length / ROWS);
  const active = days.filter((d, i) => levels[i] > 0).length;

  return (
    <div
      data-ui="activity-grid"
      role="img"
      aria-label={label ?? `Activity: ${active} active ${active === 1 ? "day" : "days"} in the last ${days.length}`}
      style={{ display: "flex", gap: 3 }}
    >
      {Array.from({ length: columns }, (_, c) => (
        <div key={c} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {days.slice(c * ROWS, c * ROWS + ROWS).map((day, r) => {
            const level = levels[c * ROWS + r];
            return (
              <span
                key={r}
                title={day.date}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  boxSizing: "border-box",
                  ...(day.frozen
                    ? { border: `1.5px solid ${t.evidence}` }
                    : level === 0
                      ? { backgroundColor: t.barBase }
                      : { backgroundColor: t.lit, opacity: OPACITY[level - 1] }),
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default ActivityGrid;
