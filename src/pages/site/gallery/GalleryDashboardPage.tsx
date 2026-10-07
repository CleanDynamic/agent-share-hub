/* UI-P50 — `/gallery?view=dashboard` in the site frame: the container.

   Loads the dashboard's rows through `src/lib/` functions only, maps them to
   `GalleryDashboardView`'s props and renders it. No Supabase call in this file.

   TWO READS OF THE SAME BUILDS. The table asks `listGalleryDashboard` with the
   filters in the address, so the database narrows before its cap; the sidebar's
   counts and the "Made for" menu come from the one unfiltered read, so they do
   not shrink as the reader filters. With no filter set the two are one query.

   THE ADDRESS IS THE STATE. view, tab, model, lab, for, report, active, dsort
   and q are read with `parseGalleryParams` and every change writes them with
   `galleryHref`; an address the dashboard cannot read in full (a feed sort, a
   one-letter query) is replaced by the one it can. Choosing a lab clears the
   model and the other way round, so the two never contradict each other. */

import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { galleryHref, parseGalleryParams, type GalleryParams } from "@/lib/build";
import { listGalleryDashboard, type GalleryDashboardParams } from "@/lib/build/gallery";
import { countDraftBuilds } from "@/lib/build/sessions";
import { LABS } from "@/lib/models/registry";

import { GalleryDashboardView } from "./GalleryDashboardView";
import { dashboardCounts } from "./dashboardModel";

const STALE_MS = 60 * 1000;

export function GalleryDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const connector = useConnectorDialog();

  const params = useMemo(() => parseGalleryParams(searchParams), [searchParams]);
  const tab = params.tab ?? "builds";
  const model = params.model ?? null;
  const lab = params.lab ?? null;
  const audience = params.madeFor[0] ?? null;
  const report = params.report ?? null;
  const active = params.active ?? null;
  const sort = params.dsort ?? "engagement";
  const { query } = params;

  /** What the dashboard's address holds: the feed's sort and the old lens parameters are left out. */
  const dashParams = useMemo<Partial<GalleryParams>>(
    () => ({
      view: "dashboard",
      tab: params.tab,
      model: model ?? undefined,
      lab: lab ?? undefined,
      madeFor: audience ? [audience] : [],
      report: report ?? undefined,
      active: active ?? undefined,
      dsort: params.dsort,
      query,
    }),
    [params.tab, params.dsort, model, lab, audience, report, active, query],
  );
  const go = (next: Partial<GalleryParams>) => navigate(galleryHref({ ...dashParams, ...next }));

  const written = searchParams.toString();
  useEffect(() => {
    const canonical = galleryHref(dashParams);
    const current = written ? `${pathname}?${written}` : pathname;
    if (current !== canonical) navigate(canonical, { replace: true });
  }, [written, pathname, dashParams, navigate]);

  const filters: GalleryDashboardParams = {
    ...(model ? { model } : {}),
    ...(lab ? { lab } : {}),
    ...(audience ? { audience } : {}),
    ...(active ? { activeWithinDays: active } : {}),
    ...(report ? { report } : {}),
    ...(query ? { q: query } : {}),
  };

  const everything = useQuery({
    queryKey: ["build", "listGalleryDashboard", {}],
    queryFn: () => listGalleryDashboard(),
    staleTime: STALE_MS,
  });
  const filtered = useQuery({
    queryKey: ["build", "listGalleryDashboard", filters],
    queryFn: () => listGalleryDashboard(filters),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });

  const allRows = everything.data ?? [];
  const counts = useMemo(() => dashboardCounts(allRows, LABS), [allRows]);

  const drafts = useQuery({
    queryKey: ["build", "countDraftBuilds"],
    queryFn: countDraftBuilds,
    enabled: !!user,
    staleTime: STALE_MS,
  });

  const error = filtered.error ?? null;
  const status = error && !filtered.data ? "error" : !filtered.data ? "loading" : "ready";

  return (
    <>
      <SeoHead
        title="Gallery dashboard — buildgallery"
        description="How the builds in the gallery were made: the AI models, sessions, prompts and what people did with them."
        path="/gallery"
      />
      <GalleryDashboardView
        fit="content"
        tab={tab}
        onTabChange={(next) => go({ tab: next === "builds" ? undefined : next })}
        onViewChange={(next) => navigate(galleryHref({ view: next, model: model ?? undefined, madeFor: audience ? [audience] : [], query }))}
        rows={filtered.data ?? []}
        allRows={allRows}
        counts={counts}
        status={status}
        error={error ?? undefined}
        onRetry={() => void filtered.refetch()}
        query={query}
        onSearch={(next) => go({ query: next })}
        model={model}
        onModelChange={(id) => go({ model: id ?? undefined, lab: undefined })}
        lab={lab}
        onLabChange={(next) => go({ lab: next ?? undefined, model: undefined })}
        audience={audience}
        onAudienceChange={(next) => go({ madeFor: next ? [next] : [] })}
        report={report}
        onReportChange={(next) => go({ report: next ?? undefined })}
        active={active}
        onActiveChange={(next) => go({ active: next ?? undefined })}
        sort={sort}
        onSortChange={(next) => go({ dsort: next === "engagement" ? undefined : next })}
        onClearFilters={() => go({ query: null, model: undefined, lab: undefined, madeFor: [], report: undefined, active: undefined })}
        drafts={user ? { count: drafts.data ?? null } : undefined}
        onConnect={connector.open}
        /* UI-P51's detail sheet is not built yet: until it is, a build opens on its own page. */
        onOpenBuild={(row) => navigate(`/b2/${row.slug}`)}
      />
    </>
  );
}

export default GalleryDashboardPage;
