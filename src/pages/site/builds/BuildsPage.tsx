/* SV-11: /builds, the container.

   THE ADDRESS IS THE STATE. The view, the lens, the filters, the sort and the query are read from the address
   (`parseGalleryParams`) on every render and written back with `galleryHref`; nothing is copied into state. A change is
   the same page with new parameters: the old rows stay until the new arrive, and nothing fades. Which filters are open
   and how a checklist is ordered are the panel's own, kept for the visit.

   ONE ROUND. The Table's first page, the stats, the lens counts and both facet reads start together; the first screen
   needs nothing after them. The classifications and the makers come in the list's own select (`listBuildsTable`).

   ONE LOAD FOR EVERY VIEW. The same builds are passed to the view the address names: the Table here, Maps and
   Classification as their own chunks (`buildsViews.ts`).

   NOT LIVE YET (drawn on the dev page only): Steps, Sessions and Runs 12 weeks, the number filters, Works on model, Last
   confirmed, Rebuilds and Likes as filters (SV-23); Saved filter sets, moving filters, the Columns chooser and Add a
   calculation (SV-24). */

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { reportError } from "@/lib/errors/report";
import { GALLERY_LENSES, countGalleryLenses, getClassificationFacets, getGalleryFacets, getGalleryStats, listBuildsTable, type GalleryFeedSort, type GalleryLens } from "@/lib/build/gallery";
import { galleryHref, parseGalleryParams, type GalleryParams, type GalleryViewMode } from "@/lib/build/galleryParams";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsLoadingView, TableRowSkeletons, text } from "./BuildsFrame";
import { BuildsView } from "./BuildsView";
import {
  LENS_LABEL,
  LIVE_COLUMNS,
  SORT_COLUMN,
  SORT_OPTIONS,
  activeChips,
  activeCount,
  listParamsOf,
  liveCatalogue,
  nextTableOffset,
  panelSections,
  statParts,
  tableFooter,
  tableRow,
  toggled,
  withoutChip,
  type PanelOrder,
} from "./buildsModel";
import { BuildsClassificationView, BuildsMapsView, prefetchView } from "./buildsViews";

/** One sentence and Retry (CA-28's wording). */
function TableError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
      <p style={{ ...text(13, 400, t.text), margin: 0 }}>Builds didn't load.</p>
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

  useEffect(() => {
    if (list.error) reportError(list.error, { source: "query", context: "listBuildsTable" });
  }, [list.error]);

  const now = Date.now();
  const builds = list.data?.pages.flatMap((page) => page.builds) ?? [];
  const total = list.data?.pages[0]?.total ?? null;
  const rows = builds.map((build) => tableRow(build, now));
  const loading = list.isLoading;
  usePageReady("builds", !loading);

  const classified = classification.data?.live === true;
  const patternsLive = facets.data?.patternsLive === true;
  const sections = panelSections({
    facets: params.facets ?? [],
    shapes: params.shapes ?? [],
    pattern: params.pattern,
    open: params.open === true,
    counts: classified ? (classification.data?.counts ?? {}) : null,
    patterns: patternsLive ? (facets.data?.patterns ?? []) : null,
    opened,
    orders,
  });
  const count = total ?? builds.length;

  const other =
    view === "maps" ? <BuildsMapsView builds={builds} /> : view === "classification" ? <BuildsClassificationView builds={builds} /> : null;

  const page = (
    <BuildsView
      figure={`${count} ${count === 1 ? "build" : "builds"}`}
      parts={stats.data ? statParts(stats.data) : [{ text: " " }]}
      view={view}
      hrefFor={hrefFor}
      onViewIntent={prefetchView}
      filters={{
        activeCount: activeCount(params),
        sections,
        catalogue: { total: liveCatalogue(classified, patternsLive).reduce((sum, group) => sum + group.count, 0), groups: liveCatalogue(classified, patternsLive) },
        onToggleOption: (sectionId, key) => go(toggled(params, sectionId, key)),
        onToggleSegment: (sectionId, key) => go(toggled(params, sectionId, key)),
        onOrder: (sectionId, order) => setOrders((current) => ({ ...current, [sectionId]: order })),
        onOpenClosed: (sectionId) => setOpened((current) => new Set([...current, sectionId])),
      }}
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
              columns: LIVE_COLUMNS,
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
      other={
        list.error && !list.data ? (
          <TableError onRetry={() => void list.refetch()} />
        ) : (
          <Suspense fallback={<TableRowSkeletons count={6} />}>{other}</Suspense>
        )
      }
    />
  );

  return (
    <>
      <SeoHead title="Builds · buildgallery" description="Things people built with AI, and the exact model versions other people got them working on." path="/builds" />
      {/* While the first screen loads the page is its loading state, the route's Placeholder; the page fades in over it. */}
      <PageArrival loading={loading} placeholder={<BuildsLoadingView />}>
        {loading ? <BuildsLoadingView /> : page}
      </PageArrival>
    </>
  );
}
