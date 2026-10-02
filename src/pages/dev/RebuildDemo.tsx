/* UI-P31 — /dev/kit/pages/rebuild?theme=noon|dusk&viewport=desktop|mobile.

   `RebuildView` in `board` fit with the sample data, inside the frame
   `KitPages` draws. The compare harness photographs this against
   `design/reference/…/rebuild.html`. The phone board draws a shorter change
   list; `rebuildFixture` takes the viewport. */

import { rebuildFixture } from "@/dev/fixtures/rebuild";
import { RebuildView } from "@/pages/site/rebuild/RebuildView";

import type { DesignPageProps } from "./KitPages";

export default function RebuildDemo({ fit = "board", viewport }: DesignPageProps) {
  return <RebuildView fit={fit} {...rebuildFixture(viewport)} />;
}
