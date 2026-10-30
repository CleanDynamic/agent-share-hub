/* SV-11: /builds, the container.

   THE ADDRESS IS THE STATE. The view, the lens, the filters, the sort and the query are read from the address
   (`parseGalleryParams`) on every render and written back with `galleryHref`; nothing is copied into state. A change is
   the same page with new parameters: the old rows stay until the new arrive, and nothing fades. Which filters are open
   and how a checklist is ordered are the panel's own, kept for the visit.

   ONE ROUND. The Table's first page, the stats, the lens counts and both facet reads start together; the first screen
   needs nothing after them. The classifications and the makers come in the list's own select (`listBuildsTable`).

   ONE LOAD FOR EVERY VIEW. The same builds are passed to the view the address names: the Table here, Maps and
   Classification as their own chunks (`buildsViews.ts`). Classification makes no read of its own: the list carries each
   build's classification, and a value links to this page as the Table with that facet added.

   SV-23 P1: Steps and Sessions (the columns and their range filters) are drawn once the list carries the stored counts
   (`countsLive`) and their spread has answered; the median steps sits in the footer. The spread is read in the same round.

   SV-23 P2: Runs, 12 weeks are twelve weekly counts embedded in the list's select; Last confirmed and Confirmed or stale read
   `last_confirmed_at`; Reproductions, Rebuilds and Likes are ranges on their columns; Works on model filters `worked_models`,
   its counts read beside the facets. The ranges and Works on model are drawn with the stored counts.

   NOT LIVE YET (drawn on the dev page only): Saved filter sets, moving filters, the Columns chooser and Add a
   calculation (SV-24). */

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { reportError } from "@/lib/errors/report";
import { GALLERY_LENSES, countGalleryLenses, getClassificationFacets, getCountSpread, getGalleryFacets, getWorksOnModelCounts, getGalleryStats, listBuildsTable, type GalleryFeedSort, type GalleryLens } from "@/lib/build/gallery";
import { RANGE_KEYS, type RangeKey } from "@/lib/build/galleryRanges";
import { galleryHref, parseGalleryParams, type GalleryParams, type GalleryViewMode } from "@/lib/build/galleryParams";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsLoadingView, ClassificationLoadingView, MapsLoadingView, text } from "./BuildsFrame";
import { BuildsFiltersView, type BuildsFiltersViewProps } from "./BuildsFiltersView";
import { BuildsView, statParts } from "./BuildsView";
import {
  LENS_LABEL,
  MAPS_PAGE,
  SORT_COLUMN,
  SORT_OPTIONS,
  activeChips,
  activeCount,
  columnsFor,
  listParamsOf,
  liveCatalogue,
  nextTableOffset,
  panelSections,
  tableFooter,
  tableRow,
  toggled,
  withRange,
  withoutChip,
  type PanelOrder,
} from "./buildsModel";
import { BuildsClassificationView, BuildsMapsPane, prefetchView } from "./buildsViews";
import { cardOf, readFacetChoice, writeFacetChoice } from "./classificationModel";
import type { MapsDirection } from "./BuildsMapsView";

/** One sentence and Retry (CA-28's wording). */
function TableError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
      <p style={{ ...text(13, 400, t.text), margin: 0 }}>Builds didn't load.</p>
      <BuildsControl onClick={onRetry}>Retry</BuildsControl>
    </div>
  );
}

/** One sentence and Retry: the Maps did not load (the builds did). */
function MapsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <p style={{ ...text(13, 400, t.text), margin: 0 }}>Maps didn't load.</p>
      <BuildsControl onClick={onRetry}>Retry</BuildsControl>
    </div>
  );
}

export default function BuildsPage() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const params = parseGalleryParams(search);
  const view: GalleryViewMode = params.view ?? "table";
  const listParams = listParamsOf(params);
  const sort = (listParams.sort ?? "reproduced") as GalleryFeedSort;
  const go = (next: GalleryParams) => navigate(galleryHref(next), { preventScrollReset: true });
  const hrefFor = (next: GalleryViewMode) => galleryHref({ ...params, view: next === "table" ? undefined : next });

  /* The panel's own: which filters were opened on this visit, and how each checklist is ordered. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [orders, setOrders] = useState<Record<string, PanelOrder>>({});
  /* Maps: which way the Map is drawn, kept for the visit. */
  const [direction, setDirection] = useState<MapsDirection>("horizontal");
  /* Maps: how many of the loaded builds are drawn; each 24 are one read. */
  const [mapsShown, setMapsShown] = useState(MAPS_PAGE);
  /* Classification: which facets the cards show, kept for the viewer. */
  const [shownFacets, setShownFacets] = useState(readFacetChoice);

  /* ── one round: the list, the stats, the lens counts and the facets start together ── */

  const list = useInfiniteQuery({
    queryKey: ["build", "listBuildsTable", listParams],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listBuildsTable({ ...listParams, offset: pageParam }),
    getNextPageParam: nextTableOffset,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_MS,
  });
  const stats = useQuery({ queryKey: ["build", "getGalleryStats"], queryFn: getGalleryStats, staleTime: SLOW_STALE_MS });
  const lensCounts = useQuery({ queryKey: ["build", "countGalleryLenses"], queryFn: countGalleryLenses, staleTime: SLOW_STALE_MS });
  const classification = useQuery({ queryKey: ["build", "getClassificationFacets"], queryFn: getClassificationFacets, staleTime: SLOW_STALE_MS });
  const facets = useQuery({ queryKey: ["build", "getGalleryFacets"], queryFn: getGalleryFacets, staleTime: SLOW_STALE_MS });
  const spread = useQuery({ queryKey: ["build", "getCountSpread"], queryFn: getCountSpread, staleTime: SLOW_STALE_MS });
  const worksOn = useQuery({ queryKey: ["build", "getWorksOnModelCounts"], queryFn: getWorksOnModelCounts, staleTime: SLOW_STALE_MS });

  useEffect(() => {
    if (list.error) reportError(list.error, { source: "query", context: "listBuildsTable" });
  }, [list.error]);

  const now = Date.now();
  const builds = list.data?.pages.flatMap((page) => page.builds) ?? [];

  /* MAPS: one read for each 24 builds drawn, started the moment the list has answered (the ids come from it). The data
     layer is a chunk of its own, brought on pointing at the Maps segment or here. */
  const mapBuilds = view === "maps" ? builds.slice(0, mapsShown) : [];
  const mapChunks = Array.from({ length: Math.ceil(mapBuilds.length / MAPS_PAGE) }, (_, at) => mapBuilds.slice(at * MAPS_PAGE, (at + 1) * MAPS_PAGE).map((build) => build.id));
  const maps = useQueries({
    queries: mapChunks.map((ids) => ({
      queryKey: ["build", "listBuildMaps", ids],
      queryFn: async () => (await import("@/lib/build/buildsMaps")).listBuildMaps(ids),
      staleTime: SLOW_STALE_MS,
    })),
  });
  const mapsFailed = maps.some((entry) => entry.isError);
  const mapsSettled = maps.every((entry) => !entry.isPending);
  useEffect(() => {
    const failure = maps.find((entry) => entry.error)?.error;
    if (failure) reportError(failure, { source: "query", context: "listBuildMaps" });
  }, [maps]);

  const total = list.data?.pages[0]?.total ?? null;
  const rows = builds.map((build) => tableRow(build, now));
  const loading = list.isLoading;
  usePageReady("builds", !loading && (view !== "maps" || mapsSettled));

  const classified = classification.data?.live === true;
  const patternsLive = facets.data?.patternsLive === true;
  const countsLive = list.data?.pages[0]?.countsLive === true;
  const sections = panelSections({
    facets: params.facets ?? [],
    shapes: params.shapes ?? [],
    pattern: params.pattern,
    open: params.open === true,
    counts: classified ? (classification.data?.counts ?? {}) : null,
    patterns: patternsLive ? (facets.data?.patterns ?? []) : null,
    opened,
    orders,
    ranges: params.ranges,
    spread: countsLive ? (spread.data ?? null) : null,
    within: params.within,
    confirmState: params.state,
    model: params.model,
    worksOn: countsLive ? (worksOn.data ?? null) : null,
  });
  const rangesLive = countsLive && Boolean(spread.data);
  const count = total ?? builds.length;

  const filters: BuildsFiltersViewProps = {
      activeCount: activeCount(params),
      sections,
      catalogue: { total: liveCatalogue(classified, patternsLive, rangesLive, Boolean(worksOn.data)).reduce((sum, group) => sum + group.count, 0), groups: liveCatalogue(classified, patternsLive, rangesLive, Boolean(worksOn.data)) },
      onRange: (sectionId, value) => {
        if ((RANGE_KEYS as readonly string[]).includes(sectionId)) navigate(galleryHref(withRange(params, sectionId as RangeKey, value)), { preventScrollReset: true, replace: true });
      },
      onToggleOption: (sectionId, key) => go(toggled(params, sectionId, key)),
      onToggleSegment: (sectionId, key) => go(toggled(params, sectionId, key)),
      onOrder: (sectionId, order) => setOrders((current) => ({ ...current, [sectionId]: order })),
      onOpenClosed: (sectionId) => setOpened((current) => new Set([...current, sectionId])),
  };

  const onMoreMaps = () => {
    const next = mapsShown + MAPS_PAGE;
    setMapsShown(next);
    if (next > builds.length && list.hasNextPage) void list.fetchNextPage();
  };

  const onFacets = (next: typeof shownFacets) => {
    setShownFacets(next);
    writeFacetChoice(next);
  };

  /* A value's link: the Table (no `view`) with the value's facet key added to the filters. */
  const valueHref = (key: string) => galleryHref({ ...params, view: undefined, facets: [...new Set([...(params.facets ?? []), key])] });

  const mapsPage =
    view === "maps" ? (
      list.error && !list.data ? (
        <TableError onRetry={() => void list.refetch()} />
      ) : (
        <Suspense fallback={<MapsLoadingView hrefFor={hrefFor} />}>
          <BuildsMapsPane
            view={view}
            hrefFor={hrefFor}
            onViewIntent={prefetchView}
            activeCount={activeCount(params)}
            chips={activeChips(params)}
            onRemoveChip={(key) => go(withoutChip(params, key))}
            panel={<BuildsFiltersView {...filters} collapsed={false} />}
            direction={direction}
            onDirection={setDirection}
            buildsLabel={`${count} ${count === 1 ? "build" : "builds"}`}
            builds={mapBuilds}
            maps={maps.flatMap((entry) => entry.data ?? [])}
            failed={mapsFailed}
            notice={mapsFailed ? <MapsError onRetry={() => maps.forEach((entry) => entry.isError && void entry.refetch())} /> : undefined}
            now={now}
            empty={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
                <p style={{ ...text(13, 400, t.text2), margin: 0 }}>No builds match these filters.</p>
                <BuildsControl onClick={() => go({ lens: "all", madeFor: [], madeWith: [], query: null, view: params.view })}>Clear all</BuildsControl>
              </div>
            }
            onMore={mapsShown < builds.length || list.hasNextPage ? onMoreMaps : undefined}
            loadingMore={list.isFetchingNextPage}
          />
        </Suspense>
      )
    ) : null;

  const classificationPage =
    view === "classification" ? (
      list.error && !list.data ? (
        <TableError onRetry={() => void list.refetch()} />
      ) : (
        <Suspense fallback={<ClassificationLoadingView hrefFor={hrefFor} />}>
          <BuildsClassificationView
            view={view}
            hrefFor={hrefFor}
            onViewIntent={prefetchView}
            buildsLabel={`${count} ${count === 1 ? "build" : "builds"}`}
            activeCount={activeCount(params)}
            panel={<BuildsFiltersView {...filters} collapsed={false} />}
            facets={shownFacets}
            onFacets={onFacets}
            cards={builds.map((build) => cardOf(build, shownFacets, valueHref, now))}
            empty={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
                <p style={{ ...text(13, 400, t.text2), margin: 0 }}>No builds match these filters.</p>
                <BuildsControl onClick={() => go({ lens: "all", madeFor: [], madeWith: [], query: null, view: params.view })}>Clear all</BuildsControl>
              </div>
            }
            onMore={list.hasNextPage ? () => void list.fetchNextPage() : undefined}
            loadingMore={list.isFetchingNextPage}
          />
        </Suspense>
      )
    ) : null;

  const page = (
    <BuildsView
      figure={`${count} ${count === 1 ? "build" : "builds"}`}
      parts={stats.data ? statParts({ published: stats.data.inGallery, runsThisWeek: stats.data.reproducedThisWeek, freshPct: stats.data.freshPct }) : [{ text: " " }]}
      view={view}
      hrefFor={hrefFor}
      onViewIntent={prefetchView}
      filters={filters}
      table={
        view === "table" && !(list.error && !list.data)
          ? {
              lenses: GALLERY_LENSES.map((lens) => ({ value: lens, label: LENS_LABEL[lens], count: lensCounts.data?.[lens] })),
              lens: params.lens,
              onLens: (lens) => go({ ...params, lens: lens as GalleryLens }),
              sort: { value: sort, options: SORT_OPTIONS, onChange: (value) => go({ ...params, sort: value as GalleryFeedSort }) },
              chips: activeChips(params),
              onRemoveChip: (key) => go(withoutChip(params, key)),
              onClearAll: () => go({ lens: params.lens, madeFor: [], madeWith: [], query: null, view: params.view, sort: params.sort }),
              columns: columnsFor(countsLive),
              rows,
              sortColumn: SORT_COLUMN[sort] ? { id: SORT_COLUMN[sort]!, ascending: false } : null,
              sortableBy: { reproductions: "reproduced", confirmed: "confirmed", rebuilds: "rebuilt" },
              footer: tableFooter(total, rows),
              onMore: list.hasNextPage ? () => void list.fetchNextPage() : undefined,
              loadingMore: list.isFetchingNextPage,
              empty: (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
                  <p style={{ ...text(13, 400, t.text2), margin: 0 }}>No builds match these filters.</p>
                  <BuildsControl onClick={() => go({ lens: "all", madeFor: [], madeWith: [], query: null, view: params.view })}>Clear all</BuildsControl>
                </div>
              ),
            }
          : null
      }
      other={list.error && !list.data ? <TableError onRetry={() => void list.refetch()} /> : null}
    />
  );

  return (
    <>
      <SeoHead title="Builds · buildgallery" description="Things people built with AI, and the exact model versions other people got them working on." path="/builds" />
      {/* While the first screen loads the page is its loading state, the route's Placeholder; the page fades in over it. */}
      <PageArrival loading={loading} placeholder={<BuildsLoadingView />}>
        {loading ? <BuildsLoadingView /> : view === "maps" ? mapsPage : view === "classification" ? classificationPage : page}
      </PageArrival>
    </>
  );
}
