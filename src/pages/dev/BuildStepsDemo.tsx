/* UI-P73 — /dev/kit/pages/build-steps?theme=noon|dusk&viewport=desktop|mobile.

   `BuildView` with the build page's steps drawn (The build, What you need and
   the tabs), whatever BUILD_PAGE_STEPS_ENABLED says. `?build=list` is B1-PageList,
   `?build=team` B3-PageTeam and `?build=one` B4-PageOne; the default is the list.
   `&tab=watch|understand|broke|rebuilds` draws that tab's body under the strip.
   The first screen is the build page's sample, with each build's own title.

   UI-P91: `&look=refined&part=steps` is the Map board (`refined/{dusk,noon}/build-map.html`): no frame and no first
   screen, only the surface with the tabs, The build and What you need, laid out as that board crops them. */

import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/brand/EmptyState";
import { buildFixture, buildTabFixture, SAMPLE_TABS } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import { useLook } from "@/lib/theme/look";
import { BuildView } from "@/pages/site/build/BuildView";
import { RefinedNeedPanel } from "@/pages/site/build/RefinedBuildSteps";
import { BuildPanel, RefinedBuildView } from "@/pages/site/build/RefinedBuildView";
import { t } from "@/lib/theme/tokens";
import { landTab, stepTabs, type BuildTabKey } from "@/pages/site/build/buildModel";

import type { DesignPageProps } from "./KitPages";

const SAMPLES: readonly BuildStepsSample[] = ["list", "team", "one"];

export default function BuildStepsDemo({ viewport }: DesignPageProps) {
  const [params] = useSearchParams();
  const asked = params.get("build") as BuildStepsSample | null;
  const which: BuildStepsSample = asked && SAMPLES.includes(asked) ? asked : "list";
  const first = params.get("tab") as BuildTabKey | null;
  const [tab, setTab] = useState<BuildTabKey>(landTab(first && SAMPLE_TABS.includes(first) ? first : "anatomy", true));

  /* UI-P90: `?look=refined` draws the fork, from the same fixture. */
  const refined = useLook() === "refined";
  const View = refined ? RefinedBuildView : BuildView;
  const { title, outcome, ...steps } = buildStepsFixture(which);
  const props = buildFixture(viewport);
  const viewer = {
    ...props.viewer,
    tabs: stepTabs(tab === "rebuilds"),
    tab,
    onTabChange: (next: BuildTabKey) => setTab(landTab(next, true)),
    content: tab === "anatomy" ? null : SAMPLE_TABS.includes(tab) ? buildTabFixture(tab, viewport) : <EmptyState line="Nothing here yet." />,
  };
  if (refined && viewport === "desktop" && params.get("part") === "steps") {
    return (
      <BareSurface>
        <section aria-label="The build" style={{ flexGrow: 1, minWidth: 0 }}>
          <BuildPanel viewer={viewer} steps={steps} phone={false} announce={() => undefined} />
        </section>
        <div style={{ width: 300, flexShrink: 0, paddingLeft: 32, borderLeft: `1px solid ${t.hairline}` }}>
          <RefinedNeedPanel view={steps} onOpenOther={() => undefined} />
        </div>
      </BareSurface>
    );
  }
  return <View fit="content" {...props} hero={{ ...props.hero, title, outcome }} viewer={viewer} steps={steps} />;
}

/** The Map board's crop: the frame, and the surface 6 in from every edge, padding 32 48, its two columns 32 apart. */
function BareSurface({ children }: { children: ReactNode }) {
  return (
    <div data-testid="bare-surface" style={{ minHeight: "100dvh", boxSizing: "border-box", padding: 6, background: t.frame, color: t.text, lineHeight: "normal" }}>
      <div
        style={{
          minHeight: "calc(100dvh - 12px)",
          boxSizing: "border-box",
          padding: "32px 48px",
          background: t.surface,
          border: `1px solid ${t.surfaceBorder}`,
          borderRadius: 10,
          boxShadow: t.surfaceShadow,
          display: "flex",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        {children}
      </div>
    </div>
  );
}
