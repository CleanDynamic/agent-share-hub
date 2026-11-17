/* UI-P31 — /dev/kit/pages/rebuild?theme=noon|dusk&viewport=desktop|mobile.

   `RebuildView` in `board` fit with the sample data, inside the frame
   `KitPages` draws. The compare harness photographs this against
   `design/reference/…/rebuild.html`. The phone board draws a shorter change
   list; `rebuildFixture` takes the viewport. */

import { rebuildFixture } from "@/dev/fixtures/rebuild";
import { readOf } from "@/components/pagestate/pageStateModel";
import { RebuildView, RebuildViewSkeleton, RebuildViewState } from "@/pages/site/rebuild/RebuildView";

import type { DesignPageProps } from "./KitPages";

export default function RebuildDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const sample = rebuildFixture(viewport);
  /* UI-P37 — the other three states, from the same sample. */
  if (state === "loading") return <RebuildViewSkeleton fit={fit} />;
  if (state === "error") return <RebuildViewState title="Rebuild" read={readOf("error")} thing="this build" region="The rebuild" />;
  if (state === "empty") return <RebuildView fit={fit} {...sample} family={{ ...sample.family!, children: [] }} changes={[]} />;
  return <RebuildView fit={fit} {...sample} />;
}
