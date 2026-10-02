/* UI-P35 — Activity's sample data, as `ActivityView` takes it.

   DEV ONLY (imported from `src/pages/dev/**` and `src/dev/**` alone). This is
   where `design/fixtures/sample-data.json → activity` becomes rows: each row is
   [kind, initials, who, title, detail, when, unread], its times are "12m", "1h",
   and its days are the board's own. Nothing here reaches a production bundle.

   THE SAMPLE CARRIES NO HUES, SKIES OR SERIES for this board, so the three are
   written down below as the Activity board draws them: each actor's avatar hue,
   each row's cover sky, and the runs chart's 64 points (read back off the
   board's polyline into the unit interval the chart takes, with the rebuild at
   point 23). They are sample pictures, not data. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { ActivityRuns, ActivityViewProps } from "@/pages/site/activity/ActivityView";
import type { ActivityDay, ActivityGroup, ActivityKind, ActivityRow, KindCounts } from "@/pages/site/activity/activityModel";

import { FIXTURE_NOW, fixtures } from "../designFixtures";

type SampleRow = [kind: string, initials: string, who: string, title: string, detail: string, when: string, unread: boolean];

interface ActivitySample {
  unread: number;
  groups: Record<string, SampleRow[]>;
  kind_counts: Record<ActivityKind, number>;
  ran_this_week: number;
}

const sample = fixtures.activity as unknown as ActivitySample;

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "12m" → the instant that long before the moment the mockups were drawn. */
function atOf(when: string): string {
  const match = /^(\d+)([mhd])$/.exec(when);
  const ms = match ? Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS] : 0;
  return new Date(FIXTURE_NOW.getTime() - ms).toISOString();
}

/** Each actor's hue on this board, by their initials. */
const HUE: Record<string, number> = { AD: 3, KO: 0, TO: 2, IN: 4, LE: 5, SA: 1, MA: 1 };

/** Each row's cover sky on this board, in the sample's order; null where the row is about no build. */
const SKY: ReadonlyArray<number | null> = [0, 4, 1, 3, 3, null, 0];

/** The runs chart as the board draws it: 64 points, 0–1, oldest first. */
const RUNS: readonly number[] = [
  0.463, 0.407, 0.393, 0.345, 0.284, 0.27, 0.329, 0.37, 0.408, 0.369, 0.374, 0.343, 0.297, 0.25, 0.25, 0.31,
  0.356, 0.399, 0.441, 0.398, 0.371, 0.389, 0.421, 0.641, 0.695, 0.637, 0.651, 0.676, 0.677, 0.632, 0.628, 0.57,
  0.631, 0.682, 0.689, 0.66, 0.718, 0.729, 0.782, 0.831, 0.832, 0.819, 0.834, 0.823, 0.777, 0.749, 0.793, 0.729,
  0.665, 0.683, 0.652, 0.657, 0.653, 0.631, 0.701, 0.658, 0.646, 0.604, 0.622, 0.592, 0.571, 0.606, 0.581, 0.589,
];
const RUNS_MARKER = 23;

export function activityGroups(): ActivityGroup[] {
  let index = 0;
  return Object.entries(sample.groups).map(([day, rows]) => ({
    day: day as ActivityDay,
    rows: rows.map(([kind, initials, who, title, detail, when, unread]): ActivityRow => {
      const sky = SKY[index] ?? null;
      const id = `sample-activity-${index++}`;
      return {
        id,
        kind: kind as ActivityKind,
        at: atOf(when),
        actor: { id: initials, name: initials, hue: HUE[initials] },
        who,
        title: title || null,
        detail: detail || null,
        cover: sky === null ? null : { src: null, seed: id, sky },
        unread,
        href: "#",
      };
    }),
  }));
}

export const ACTIVITY_RUNS: ActivityRuns = {
  values: RUNS,
  markerIndex: RUNS_MARKER,
  label: "Runs of your builds over the last 90 days",
};

const noop = () => undefined;

/**
 * UI-P37 — the same page in its other three states, from the same sample. Loading has
 * the list, the orb and the chart waiting; empty is nothing to catch up on; error has
 * the list, the orb and the chart failing, each in its own place.
 */
function inState(base: Omit<ActivityViewProps, "fit">, state: DesignState): Omit<ActivityViewProps, "fit"> {
  if (state === "loading") {
    return {
      ...base,
      list: { ...base.list, status: "loading", groups: [] },
      unread: null,
      peopleThisWeek: null,
      runs: { status: "loading" },
    };
  }
  if (state === "empty") {
    return {
      ...base,
      list: { ...base.list, groups: [] },
      unread: 0,
      kindCounts: Object.fromEntries(Object.keys(base.kindCounts).map((kind) => [kind, 0])) as unknown as KindCounts,
      peopleThisWeek: 0,
    };
  }
  if (state === "error") {
    const failure = { onRetry: noop };
    return {
      ...base,
      list: { ...base.list, status: "error", groups: [] },
      unread: null,
      peopleThisWeek: null,
      peopleError: failure,
      runs: { status: "error", ...failure },
    };
  }
  return base;
}

export function activityFixture(state: DesignState = "populated"): Omit<ActivityViewProps, "fit"> {
  return inState({
    now: FIXTURE_NOW.getTime(),
    list: { status: "ready", groups: activityGroups(), hasMore: false, loadingMore: false, onMore: noop, onRetry: noop },
    unread: sample.unread,
    live: true,
    kindCounts: sample.kind_counts as KindCounts,
    peopleThisWeek: sample.ran_this_week,
    runs: { status: "ready", data: ACTIVITY_RUNS },
    onOpen: noop,
    onMarkAllRead: noop,
  }, state);
}
