/* UI-P35 — /dev/kit/pages/activity?theme=noon|dusk&viewport=desktop|mobile.

   `ActivityView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against
   `design/reference/…/activity.html`.

   THE PHONE BOARD DRAWS SIX ROWS and the desktop board seven, so the phone gets
   all but the last. Two of its details are worded shorter ("on haiku-4.5",
   "£150 ask"), in sample content only. */

import { activityFixture } from "@/dev/fixtures/activity";
import { ActivityView } from "@/pages/site/activity/ActivityView";
import type { ActivityGroup } from "@/pages/site/activity/activityModel";

import type { DesignPageProps } from "./KitPages";

const PHONE_ROWS = 6;

const PHONE_DETAIL: Record<string, string> = {
  "on haiku-4.5 · “worked first try”": "on haiku-4.5",
  "£150 ask on Meeting notes to tasks": "£150 ask",
};

function forPhone(groups: readonly ActivityGroup[]): ActivityGroup[] {
  let left = PHONE_ROWS;
  return groups
    .map((group) => {
      const rows = group.rows.slice(0, Math.max(0, left)).map((row) => ({
        ...row,
        detail: row.detail ? (PHONE_DETAIL[row.detail] ?? row.detail) : null,
      }));
      left -= rows.length;
      return { day: group.day, rows };
    })
    .filter((group) => group.rows.length > 0);
}

export default function ActivityDemo({ fit = "board", viewport }: DesignPageProps) {
  const sample = activityFixture();
  if (viewport !== "mobile") return <ActivityView fit={fit} {...sample} />;
  return <ActivityView fit={fit} {...sample} list={{ ...sample.list, groups: forPhone(sample.list.groups) }} />;
}
