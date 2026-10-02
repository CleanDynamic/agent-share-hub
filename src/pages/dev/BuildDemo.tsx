/* UI-P29 — /dev/kit/pages/build?theme=noon|dusk&viewport=desktop|mobile.

   `BuildView` in `board` fit with the sample data, inside the frame `KitPages`
   draws. The compare harness photographs this against `design/reference/…/build.html`.

   THE PHONE BOARD IS DRAWN A LITTLE DIFFERENTLY FROM THE DESKTOP ONE, in sample
   content only: a shorter outcome, a credit that names the source alone, the
   part's text without its last sentence, four of the five events and no
   completeness block. `buildFixture` takes the viewport.

   UI-P30 — `&tab=watch|run|understand|broke|rebuilds` draws that tab's body in
   the viewer, and `&lower=1` the sections under the first screen, both from the
   same sample and in `content` fit so nothing is clipped. There is no board for
   either; without them this page is the board, unchanged. */

import { useSearchParams } from "react-router-dom";

import { LAYER_BLURB } from "@/lib/build";
import { SAMPLE_TABS, buildFixture, buildLowerFixture, buildTabFixture } from "@/dev/fixtures/build";
import { LowerSections } from "@/pages/site/build/BuildLower";
import { EmptyState } from "@/components/brand/EmptyState";
import { BuildView, BuildViewFailed, BuildViewSkeleton } from "@/pages/site/build/BuildView";
import { buildTabs, tabLayer, type BuildTabKey } from "@/pages/site/build/buildModel";

import type { DesignPageProps } from "./KitPages";

export default function BuildDemo({ fit = "board", viewport, state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const asked = params.get("tab") as BuildTabKey | null;
  const tab: BuildTabKey = asked && SAMPLE_TABS.includes(asked) ? asked : "anatomy";
  const lower = params.get("lower") === "1";
  const props = buildFixture(viewport);

  /* UI-P37 — the other three states, from the same sample. */
  if (state === "loading") return <BuildViewSkeleton fit={fit} />;
  if (state === "error") return <BuildViewFailed onRetry={() => undefined} />;
  if (state === "empty") {
    return (
      <BuildView
        fit={fit}
        {...props}
        anatomy={{ ...props.anatomy, parts: [], gaps: 0, selectedId: null, full: null }}
        timeline={{ ...props.timeline, events: [], duration: null }}
        viewer={{ ...props.viewer, content: <EmptyState line="This build has no parts yet." /> }}
      />
    );
  }

  if (tab === "anatomy" && !lower) return <BuildView fit={fit} {...props} />;

  const layer = tabLayer(tab);
  const viewer =
    tab === "anatomy"
      ? props.viewer
      : {
          ...props.viewer,
          tabs: buildTabs(tab === "rebuilds"),
          tab,
          mode: layer ?? props.viewer.mode,
          blurb: layer ? LAYER_BLURB[layer] : null,
          content: buildTabFixture(tab, viewport),
        };

  return (
    <div>
      <BuildView fit="content" {...props} viewer={viewer} />
      {lower ? <LowerSections>{buildLowerFixture(viewport)}</LowerSections> : null}
    </div>
  );
}
