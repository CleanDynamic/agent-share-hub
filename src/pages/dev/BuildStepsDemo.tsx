/* UI-P73 — /dev/kit/pages/build-steps?theme=noon|dusk&viewport=desktop|mobile.

   `BuildView` with the build page's steps drawn (The build, What you need and
   the tabs), whatever BUILD_PAGE_STEPS_ENABLED says. `?build=list` is B1-PageList,
   `?build=team` B3-PageTeam and `?build=one` B4-PageOne; the default is the list.
   `&tab=watch|understand|broke|rebuilds` draws that tab's body under the strip.
   The first screen is the build page's sample, with each build's own title. */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/brand/EmptyState";
import { buildFixture, buildTabFixture, SAMPLE_TABS } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import { BuildView } from "@/pages/site/build/BuildView";
import { landTab, stepTabs, type BuildTabKey } from "@/pages/site/build/buildModel";

import type { DesignPageProps } from "./KitPages";

const SAMPLES: readonly BuildStepsSample[] = ["list", "team", "one"];

export default function BuildStepsDemo({ viewport }: DesignPageProps) {
  const [params] = useSearchParams();
  const asked = params.get("build") as BuildStepsSample | null;
  const which: BuildStepsSample = asked && SAMPLES.includes(asked) ? asked : "list";
  const first = params.get("tab") as BuildTabKey | null;
  const [tab, setTab] = useState<BuildTabKey>(landTab(first && SAMPLE_TABS.includes(first) ? first : "anatomy", true));

  const { title, outcome, ...steps } = buildStepsFixture(which);
  const props = buildFixture(viewport);
  return (
    <BuildView
      fit="content"
      {...props}
      hero={{ ...props.hero, title, outcome }}
      viewer={{
        ...props.viewer,
        tabs: stepTabs(tab === "rebuilds"),
        tab,
        onTabChange: (next) => setTab(landTab(next, true)),
        content: tab === "anatomy" ? null : (SAMPLE_TABS.includes(tab) ? buildTabFixture(tab, viewport) : <EmptyState line="Nothing here yet." />),
      }}
      steps={steps}
    />
  );
}
