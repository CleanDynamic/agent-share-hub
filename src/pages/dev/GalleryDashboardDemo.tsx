/* UI-P50 — /dev/kit/pages/gallery-dashboard?theme=noon|dusk&viewport=desktop|mobile.

   `GalleryDashboardView` with the ten builds from Miles's canvas, inside the
   frame `KitPages` draws. No board is compared (there is none). The controls
   work: the demo holds the state the live page keeps in its address and runs the
   fixture through the same filter, sort and CSV functions, so the sidebar, the
   toolbar, the footer and Export can all be checked here in both themes. The
   dashboard is desktop only: the mobile viewport shows the feed's demo. */

import { useMemo, useState } from "react";

import { DASHBOARD_FIXTURE_NOW, DASHBOARD_FIXTURE_ROWS } from "@/dev/fixtures/gallery-dashboard";
import type { DashboardActive, DashboardReport, DashboardSort, DashboardTab } from "@/lib/build/galleryParams";
import type { Lab } from "@/lib/models/registry";
import { LABS } from "@/lib/models/registry";
import { GalleryDashboardView } from "@/pages/site/gallery/GalleryDashboardView";
import { dashboardCounts, filterDashboardRows } from "@/pages/site/gallery/dashboardModel";

import GalleryFeedDemo from "./GalleryFeedDemo";
import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

export default function GalleryDashboardDemo(props: DesignPageProps) {
  const { fit = "board", state = "populated", viewport } = props;
  const [tab, setTab] = useState<DashboardTab>("builds");
  const [model, setModel] = useState<string | null>(null);
  const [lab, setLab] = useState<Lab | null>(null);
  const [audience, setAudience] = useState<string | null>(null);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [active, setActive] = useState<DashboardActive | null>(null);
  const [sort, setSort] = useState<DashboardSort>("engagement");
  const [query, setQuery] = useState<string | null>(null);

  const counts = useMemo(() => dashboardCounts(DASHBOARD_FIXTURE_ROWS, LABS, DASHBOARD_FIXTURE_NOW), []);
  const rows = useMemo(
    () => filterDashboardRows(DASHBOARD_FIXTURE_ROWS, { model, lab, audience, report, active, q: query }, DASHBOARD_FIXTURE_NOW),
    [model, lab, audience, report, active, query],
  );

  /* Below 768px the page shows the feed (UI-P49). */
  if (viewport === "mobile") return <GalleryFeedDemo {...props} />;

  return (
    <GalleryDashboardView
      fit={fit}
      tab={tab}
      onTabChange={setTab}
      onViewChange={noop}
      rows={state === "empty" ? [] : rows}
      allRows={DASHBOARD_FIXTURE_ROWS}
      counts={counts}
      status={state === "loading" ? "loading" : state === "error" ? "error" : "ready"}
      onRetry={noop}
      query={query}
      onSearch={setQuery}
      model={model}
      onModelChange={(id) => {
        setModel(id);
        setLab(null);
      }}
      lab={lab}
      onLabChange={(next) => {
        setLab(next);
        setModel(null);
      }}
      audience={audience}
      onAudienceChange={setAudience}
      report={report}
      onReportChange={setReport}
      active={active}
      onActiveChange={setActive}
      sort={sort}
      onSortChange={setSort}
      onClearFilters={() => {
        setQuery(null);
        setModel(null);
        setLab(null);
        setAudience(null);
        setReport(null);
        setActive(null);
      }}
      drafts={{ count: 3 }}
      onConnect={noop}
      onOpenBuild={noop}
    />
  );
}
