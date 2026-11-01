/* UI-P73 — /dev/kit/pages/build-steps?theme=noon|dusk&viewport=desktop|mobile.

   `BuildView` with the build page's steps drawn (The build, What you need and
   the tabs), whatever BUILD_PAGE_STEPS_ENABLED says. `?build=list` is B1-PageList,
   `?build=team` B3-PageTeam and `?build=one` B4-PageOne; the default is the list.
   `&tab=watch|understand|broke|rebuilds` draws that tab's body under the strip.
   CA-06 P7: `?build=links` is "A post with links" as a reader gets it: the maker's thread over the build, its links
   going to the parts they name.
   The first screen is the build page's sample, with each build's own title.

   UI-P91: `&part=steps` is the Map board (`refined/{dusk,noon}/build-map.html`): no frame and no first
   screen, only the surface with the tabs, The build and What you need, laid out as that board crops them. */

import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "@/components/brand/EmptyState";
import { buildFixture, buildTabFixture, SAMPLE_TABS } from "@/dev/fixtures/build";
import { buildStepsFixture, type BuildStepsSample } from "@/dev/fixtures/buildSteps";
import { BuildPanel, BuildView } from "@/pages/site/build/BuildView";
import { NeedPanel } from "@/pages/site/build/BuildSteps";
import { t } from "@/lib/theme/tokens";
import { landTab, stepTabs, type BuildTabKey } from "@/pages/site/build/buildModel";

import { linksBuild, linksPost } from "@/dev/fixtures/postLinks";
import { splitThread } from "@/lib/build/thread";
import type { BuildThreadView } from "@/pages/site/build/buildModel";
import { useReaderPostLinks, type ReaderFocus } from "@/pages/site/build/useReaderPostLinks";

import type { DesignPageProps } from "./KitPages";

const SAMPLES: readonly BuildStepsSample[] = ["list", "team", "one", "one-sitting", "runs-on-github", "everything", "links", "chief-of-staff", "pipeline-product-categories", "pipeline-support-bot-evals", "sessions-sdlc"];

export default function BuildStepsDemo({ viewport }: DesignPageProps) {
  const [params] = useSearchParams();
  const asked = params.get("build") as BuildStepsSample | null;
  const which: BuildStepsSample = asked && SAMPLES.includes(asked) ? asked : "list";
  const first = params.get("tab") as BuildTabKey | null;
  const [tab, setTab] = useState<BuildTabKey>(landTab(first && SAMPLE_TABS.includes(first) ? first : "anatomy", true));

  const { title, outcome, ...fixtureSteps } = buildStepsFixture(which, [], params.get("presets") === "1");
  const props = buildFixture(viewport);
  /* CA-06 P7: `?build=links` has the maker's thread over it, its links working as they do for a reader. */
  const [focus, setFocus] = useState<ReaderFocus | null>(null);
  // `&presets=1`: every suggested colour on a linked part, for the contrast sweep.
  const presets = params.get("presets") === "1";
  const linked = useMemo(() => linksBuild(presets), [presets]);
  const links = useReaderPostLinks({ tree: linked.tree, making: linked.making, enabled: which === "links", onFocus: setFocus });
  const steps = links ? { ...fixtureSteps, focus, onBackToPost: links.onBackToPost, groups: links.groups } : fixtureSteps;
  const thread: BuildThreadView | null = links
    ? {
        posts: splitThread(linksPost),
        mediaById: new Map(),
        srcByPath: new Map(),
        published: "14 Oct",
        build: { id: "fixture-build", slug: "bakery-order-page", title, rebuild_count: 0 },
        engagement: { counts: null, liked: false, saved: false },
        refs: { lookup: links.lookup, onGo: links.onGo },
      }
    : null;
  const viewer = {
    ...props.viewer,
    tabs: stepTabs(tab === "rebuilds"),
    tab,
    onTabChange: (next: BuildTabKey) => setTab(landTab(next, true)),
    content: tab === "anatomy" ? null : SAMPLE_TABS.includes(tab) ? buildTabFixture(tab, viewport) : <EmptyState line="Nothing here yet." />,
  };
  if (viewport === "desktop" && params.get("part") === "steps") {
    return (
      <BareSurface>
        <section aria-label="The build" style={{ flexGrow: 1, minWidth: 0 }}>
          <BuildPanel viewer={viewer} steps={steps} phone={false} announce={() => undefined} />
        </section>
        <div style={{ width: 300, flexShrink: 0, paddingLeft: 32, borderLeft: `1px solid ${t.hairline}` }}>
          <NeedPanel view={steps} onOpenOther={() => undefined} />
        </div>
      </BareSurface>
    );
  }
  // CA-04 P4: Download is a menu once the build has a session setup.
  const hasSetup = steps.steps.some((entry) => entry.chat?.kind === "new" && entry.chat.setup.length > 0);
  const actions = hasSetup ? { ...props.actions, onDownloadSetup: () => undefined } : props.actions;
  return <BuildView fit="content" {...props} actions={actions} hero={{ ...props.hero, title, outcome, ...(thread ? { thread, maker: { name: "Sam Rivera", handle: "sam", avatarUrl: null, userId: "dev-maker" } } : null) }} viewer={viewer} steps={steps} />;
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
