/* SV-11: /builds, the container.

   THE ADDRESS IS THE STATE. The view, the lens, the filters, the sort and the query are read from the address
   (`parseGalleryParams`) on every render and written back with `galleryHref`; nothing is copied into state. A change is
   the same page with new parameters: the old rows stay until the new arrive, and nothing fades. How a checklist is
   ordered is the panel's own, kept for the visit. BF-08: what is chosen in the Filters dialog is a draft (`draft`), counted
   while it differs from the address, and written to the address once, by Apply.

   ONE ROUND. The Table's first page, the stats, the lens counts and both facet reads start together; the first screen
   needs nothing after them. The classifications and the makers come in the list's own select (`listBuildsTable`).

   ONE LOAD FOR EVERY VIEW. The same builds are passed to the view the address names: the Table here, Maps and
   Classification as their own chunks (`buildsViews.ts`). Classification makes no read of its own: the list carries each
   build's classification, and a value links to this page, filtered in the view the reader is on, with that facet added.

   SV-23 P1: Steps and Sessions (the columns and their range filters) are drawn once the list carries the stored counts
   (`countsLive`) and their spread has answered; the median steps sits in the footer. The spread is read in the same round.

   SV-23 P2: Runs, 12 weeks are twelve weekly counts embedded in the list's select; Last confirmed and Confirmed or stale read
   `last_confirmed_at`; Reproductions, Rebuilds and Likes are ranges on their columns; Works on model filters `worked_models`,
   its counts read beside the facets. The ranges and Works on model are drawn with the stored counts.

   SV-24 P1: Saved filter sets are live for a signed-in reader. The reader's sets are one request of the first round (none signed
   out); the open set (`set=` in the address, which is only a marker: the filters are the other parameters) is read with it, and
   only when the address names one. A set is opened with the same view the reader is on. Saving, renaming, making public and
   deleting write, then the lists are read again; Library is kept in step by the data layer.

   SV-24 P2: THE LAYOUT IS THE READER'S (`buildsLayout.ts`, `useBuildsLayout`): the Table's columns (the Columns chooser, 12 of 24)
   and the footer's calculations (sum, median, most common, from the rows loaded: no request). It is kept in the open filter set when the
   reader made it, and in this browser otherwise. */

import { Suspense, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { useAuth } from "@/contexts/AuthContext";
import { reportError } from "@/lib/errors/report";
import { isEmptyLayout, withCalculation, withColumns, withFilterColumns, type BuildsLayout } from "@/lib/build/buildsLayout";
import { createFilterSet, deleteFilterSet, getFilterSet, joinFilterSet, leaveFilterSet, listMyFilterSets, renameFilterSet, saveFilterSetLayout, setFilterSetPublic, type FilterSet, type FilterSetDetail } from "@/lib/build/filterSets";
import { GALLERY_LENSES, countBuildsTable, countGalleryLenses, getClassificationFacets, getCountSpread, getGalleryFacets, getWorksOnModelCounts, getGalleryStats, listBuildsTable, type GalleryFeedSort, type GalleryLens } from "@/lib/build/gallery";
import { RANGE_KEYS, type RangeKey } from "@/lib/build/galleryRanges";
import { galleryHref, parseGalleryParams, type GalleryParams, type GalleryViewMode } from "@/lib/build/galleryParams";
import { LIST_STALE_MS, SLOW_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsLoadingView, ClassificationLoadingView, MapsLoadingView, text } from "./BuildsFrame";
import type { BuildsFiltersViewProps, SavedSetsProps } from "./BuildsFiltersView";
import { BuildsView, statParts } from "./BuildsView";
import {
  LENS_LABEL,
  MAPS_PAGE,
  SERVER_SORT,
  activeChips,
  activeCount,
  calculationOptions,
  clearedFilters,
  chosenColumns,
  columnsLabel,
  columnsMenu,
  drawnColumns,
  filteredColumns,
  firstSortStep,
  footerCalculations,
  lensCountParams,
  listParamsOf,
  movedColumn,
  placedColumn,
  nextSort,
  nextTableOffset,
  panelSections,
  serverSortColumn,
  sortRows,
  tableFooter,
  tableRow,
  toggled,
  toggledColumns,
  withRange,
  withoutChip,
  type PanelOrder,
} from "./buildsModel";
import { BuildsClassificationView, BuildsMapsPane, prefetchView } from "./buildsViews";
import { EXTRA_COLUMNS, type ColumnId, type ExtraColumnId } from "./BuildsTableView";
import { useBuildsLayout } from "./useBuildsLayout";
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

/** BF-02 (X2): one line and one action when the list is empty. With a filter on, Clear all; with none, on a lens other than All,
    Show all builds; on All with nothing at all, the line alone. */
function NoMatches({ filtered, onClear, onShowAll }: { filtered: boolean; onClear: () => void; onShowAll?: () => void }) {
  return (
    <div data-testid="builds-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingBlock: 16 }}>
      <p style={{ ...text(13, 400, t.text2), margin: 0 }}>{filtered ? "No builds match these filters." : "No builds here yet."}</p>
      {filtered ? <BuildsControl onClick={onClear}>Clear all</BuildsControl> : onShowAll ? <BuildsControl onClick={onShowAll}>Show all builds</BuildsControl> : null}
    </div>
  );
}

export default function BuildsPage() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const params = parseGalleryParams(search);
  const view: GalleryViewMode = params.view ?? "table";
  const listParams = listParamsOf(params);
  const go = (next: GalleryParams) => navigate(galleryHref(next), { preventScrollReset: true });
  const hrefFor = (next: GalleryViewMode) => galleryHref({ ...params, view: next === "table" ? undefined : next });

  /* The panel's own, for the visit: how every checklist is ordered (BF-07: one order for all, most builds first). */
  const [order, setOrder] = useState<PanelOrder>("count");
  /* BF-08 (A2): the dialog's choices, a draft until Apply; null while nothing is chosen. The panel draws `shown`. */
  const [draft, setDraft] = useState<GalleryParams | null>(null);
  const shown = draft ?? params;
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
  /* BF-08 (C1): the lens counts follow the filters (exact while one is on, so a tab's number is the list's); the old numbers stay
     until the new arrive. */
  const lensFilters = lensCountParams(params);
  const lensCounts = useQuery({ queryKey: ["build", "countGalleryLenses", lensFilters], queryFn: () => countGalleryLenses(lensFilters), placeholderData: keepPreviousData, staleTime: SLOW_STALE_MS });
  const classification = useQuery({ queryKey: ["build", "getClassificationFacets"], queryFn: getClassificationFacets, staleTime: SLOW_STALE_MS });
  const facets = useQuery({ queryKey: ["build", "getGalleryFacets"], queryFn: getGalleryFacets, staleTime: SLOW_STALE_MS });
  const spread = useQuery({ queryKey: ["build", "getCountSpread"], queryFn: getCountSpread, staleTime: SLOW_STALE_MS });
  const worksOn = useQuery({ queryKey: ["build", "getWorksOnModelCounts"], queryFn: getWorksOnModelCounts, staleTime: SLOW_STALE_MS });
  /* SV-24 P1: the reader's filter sets, and the one the address names. Neither waits for another read; signed out, neither is a request. */
  const mySets = useQuery({ queryKey: ["build", "listMyFilterSets", userId], queryFn: () => listMyFilterSets(), enabled: userId !== null, staleTime: SLOW_STALE_MS });
  const openSet = useQuery({ queryKey: ["build", "getFilterSet", params.set], queryFn: () => getFilterSet(params.set as string), enabled: Boolean(params.set), staleTime: SLOW_STALE_MS });

  /* SV-24 P2: the layout, in the open set when the reader made it and in this browser otherwise. */
  const openDetail = openSet.data ?? null;
  const { layout, update } = useBuildsLayout(
    openDetail?.mine ? { id: openDetail.id, search: openDetail.search, layout: openDetail.layout } : null,
    async (set, next: BuildsLayout) => {
      try {
        await saveFilterSetLayout(set.id, set.search, next);
        queryClient.setQueryData<FilterSetDetail | null>(["build", "getFilterSet", set.id], (current) => (current ? { ...current, layout: next } : current));
      } catch (error) {
        reportError(error, { source: "query", context: "saveFilterSetLayout" });
        toast.error("Couldn't keep the layout in the filter set.");
      }
    },
  );

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
  const countsLive = list.data?.pages[0]?.countsLive === true;
  /* BF-11 (B1): the reader's own columns, then the column of each filter that holds a value, worked out from the address on
     every render: a filter set by the dialog, a value's link, a saved set or Back all draw the same. Nothing is stored. */
  const chosen = chosenColumns(layout.columns, countsLive);
  const filteredIds = filteredColumns(params);
  /* BF-12: the column the database sorts by is drawn too (Published, with Newest). */
  const serverColumn = serverSortColumn(params);
  const columns = drawnColumns(chosen, filteredIds, layout.filterColumns, countsLive, serverColumn ? [serverColumn] : []);
  const extras = columns.filter((id): id is ExtraColumnId => (EXTRA_COLUMNS as readonly string[]).includes(id));
  /* BF-12 (B3): a head sorts only when its answer is true for the whole list: with every match loaded any drawn column sorts in
     the browser; with more pages waiting, only the database's six. */
  const allLoaded = Boolean(list.data) && !list.hasNextPage && !list.isPlaceholderData;
  const sortable = new Set(allLoaded ? columns : columns.filter((id) => SERVER_SORT[id]));
  const browserBy = allLoaded && params.by && columns.includes(params.by as ColumnId) ? (params.by as ColumnId) : null;
  const browserBy2 = browserBy && params.by2 && columns.includes(params.by2 as ColumnId) ? (params.by2 as ColumnId) : undefined;
  const loadedRows = builds.map((build) => tableRow(build, now, extras));
  const rows = browserBy ? sortRows(loadedRows, browserBy, params.dir === "asc", browserBy2, params.dir2 === "asc") : loadedRows;
  /* The arrow: the browser's key while it applies, else the database's sort, in the direction the address says. A `by` that
     does not apply draws no arrow, and the database's sort is drawn descending as the list was asked. */
  const sortColumn = browserBy ? { id: browserBy, ascending: params.dir === "asc" } : serverColumn ? { id: serverColumn, ascending: params.dir === "asc" && !params.by } : null;
  const calculationChoices = calculationOptions(layout.calculations, columns);
  const loading = list.isLoading;
  /* BF-02 (C2): the rows on screen are the last address's until the new page lands. They stay, and say so. */
  const updating = list.isPlaceholderData;
  usePageReady("builds", !loading && (view !== "maps" || mapsSettled));

  const classified = classification.data?.live === true;
  const patternsLive = facets.data?.patternsLive === true;
  const sections = panelSections({
    facets: shown.facets ?? [],
    shapes: shown.shapes ?? [],
    pattern: shown.pattern,
    open: shown.open === true,
    counts: classified ? (classification.data?.counts ?? {}) : null,
    patterns: patternsLive ? (facets.data?.patterns ?? []) : null,
    order,
    ranges: shown.ranges,
    spread: countsLive ? (spread.data ?? null) : null,
    within: shown.within,
    confirmState: shown.state,
    model: shown.model,
    worksOn: countsLive ? (worksOn.data ?? null) : null,
  });
  const count = total ?? builds.length;
  /* BF-01 P2: with a filter on, the head says how many of the published builds match; the meta line then drops "Of n published". */
  const filtered = activeCount(params) > 0 && Boolean(stats.data);
  const buildsLabel = filtered && stats.data ? `${count} of ${stats.data.inGallery} ${stats.data.inGallery === 1 ? "build" : "builds"}` : `${count} ${count === 1 ? "build" : "builds"}`;

  /* ── saved filter sets (SV-24 P1) ── */

  /** The filters as the address writes them: not the view (a set holds filters) and not the marker of the open set. */
  const currentSearch = galleryHref({ ...params, view: undefined, set: undefined }).split("?")[1] ?? "";
  /** A set's address on the view the reader is on. */
  const setHref = (set: Pick<FilterSet, "id" | "search">) => galleryHref({ ...parseGalleryParams(new URLSearchParams(set.search)), view: params.view, set: set.id });
  const refreshSets = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["build", "listMyFilterSets"] });
    void queryClient.invalidateQueries({ queryKey: ["build", "getFilterSet", id ?? params.set] });
    void queryClient.invalidateQueries({ queryKey: ["build", "listGroups"] });
  };
  /** A write: when it fails the reason is reported and the reader is told once, in a sentence. */
  const attempt = async (context: string, failure: string, write: () => Promise<void>, rethrow = false) => {
    try {
      await write();
    } catch (error) {
      reportError(error, { source: "query", context });
      toast.error(failure);
      if (rethrow) throw error;
    }
  };

  /* BF-08 (A2): the draft is dirty when its filters are not the applied ones. */
  const filtersOf = (of: GalleryParams) => galleryHref({ ...of, view: undefined, set: undefined });
  const dirty = draft !== null && filtersOf(draft) !== filtersOf(params);
  /* BF-09 (F1): Save current saves the applied address and the layout, so there must be one of them to save, and no draft
     waiting to be applied. */
  const somethingToSave = activeCount(params) > 0 || params.query !== null || !isEmptyLayout(layout);
  const canSave = !dirty && somethingToSave;
  const saveHint = dirty ? "Apply your changes first." : somethingToSave ? undefined : "Choose a filter or change the columns first.";

  const savedSets: SavedSetsProps | undefined =
    userId === null
      ? undefined
      : {
          rows: (mySets.data ?? []).map((set) => ({ id: set.id, name: set.name, href: setHref(set), isPublic: set.isPublic, note: set.isPublic ? "Public" : undefined, current: params.set === set.id })),
          canSave,
          saveHint,
          onSaveCurrent: (name, isPublic) =>
            attempt("createFilterSet", "Couldn't save the filter set.", async () => {
              const set = await createFilterSet({ name, search: currentSearch, isPublic });
              refreshSets(set.id);
              navigate(setHref(set), { preventScrollReset: true });
            }, true),
          onRename: (id, name) =>
            attempt("renameFilterSet", "Couldn't rename the filter set.", async () => {
              await renameFilterSet(id, name);
              refreshSets(id);
            }, true),
          onTogglePublic: (id, isPublic) =>
            void attempt("setFilterSetPublic", "Couldn't change who can open the filter set.", async () => {
              await setFilterSetPublic(id, isPublic);
              refreshSets(id);
            }),
          onDelete: (id) =>
            attempt("deleteFilterSet", "Couldn't delete the filter set.", async () => {
              await deleteFilterSet(id);
              refreshSets(id);
              if (params.set === id) navigate(galleryHref({ ...params, set: undefined }), { preventScrollReset: true, replace: true });
            }, true),
          open: openDetail
            ? {
                id: openDetail.id,
                name: openDetail.name,
                mine: openDetail.mine,
                isPublic: openDetail.isPublic,
                members: openDetail.members,
                member: openDetail.member,
                onJoin: () =>
                  void attempt("joinFilterSet", "Couldn't join the group.", async () => {
                    await joinFilterSet(openDetail.id);
                    refreshSets(openDetail.id);
                  }),
                onLeave: () =>
                  void attempt("leaveFilterSet", "Couldn't leave the group.", async () => {
                    await leaveFilterSet(openDetail.id);
                    refreshSets(openDetail.id);
                  }),
              }
            : undefined,
        };

  /* BF-08 (A2): only while the draft is dirty is the count asked, so the first screen is as it was; with nothing changed the
     dialog says the page's own total. */
  const draftCount = useQuery({
    queryKey: ["build", "countBuildsTable", listParamsOf(draft ?? params)],
    queryFn: () => countBuildsTable(listParamsOf(draft as GalleryParams)),
    enabled: dirty,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_MS,
  });

  const filters: BuildsFiltersViewProps = {
      activeCount: activeCount(shown),
      savedSets,
      sections,
      onRange: (sectionId, value) => {
        if ((RANGE_KEYS as readonly string[]).includes(sectionId)) setDraft(withRange(shown, sectionId as RangeKey, value));
      },
      onToggleOption: (sectionId, key) => setDraft(toggled(shown, sectionId, key)),
      onToggleSegment: (sectionId, key) => setDraft(toggled(shown, sectionId, key)),
      dirty,
      matchCount: dirty ? (draftCount.data ?? null) : total,
      onOpen: () => setDraft(null),
      onCancel: () => setDraft(null),
      onClear: () => setDraft(clearedFilters(shown)),
      /* One navigation for every choice. The open set's marker goes: the filters are no longer that set's. */
      onApply: () => {
        if (draft) go({ ...draft, view: params.view, sort: params.sort, set: undefined });
        setDraft(null);
      },
      order,
      onOrder: setOrder,
      /* BF-11 (B1): a layout setting, applied at once; the draft is not touched. */
      addColumns: layout.filterColumns,
      onAddColumns: (on) => update((current) => withFilterColumns(current, on)),
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

  /* BF-02 (X2): one empty state for the three views. Clear all clears the filters only; with none on, a lens with nothing in it
     offers the way back to every build. */
  const noMatches = (
    <NoMatches
      filtered={activeCount(params) > 0 || params.query !== null}
      onClear={() => go(clearedFilters(params))}
      onShowAll={params.lens === "all" ? undefined : () => go({ ...clearedFilters(params), lens: "all" })}
    />
  );

  /* A value's link: the page as it is (the view the reader is on) with the value's facet key added to the filters. */
  const valueHref = (key: string) => galleryHref({ ...params, facets: [...new Set([...(params.facets ?? []), key])] });

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
            onClearAll={() => go(clearedFilters(params))}
            filters={filters}
            setName={openDetail?.name}
            direction={direction}
            onDirection={setDirection}
            buildsLabel={buildsLabel}
            builds={mapBuilds}
            maps={maps.flatMap((entry) => entry.data ?? [])}
            failed={mapsFailed}
            notice={mapsFailed ? <MapsError onRetry={() => maps.forEach((entry) => entry.isError && void entry.refetch())} /> : undefined}
            now={now}
            empty={noMatches}
            onMore={mapsShown < builds.length || list.hasNextPage ? onMoreMaps : undefined}
            loadingMore={list.isFetchingNextPage}
            updating={updating}
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
            buildsLabel={buildsLabel}
            activeCount={activeCount(params)}
            chips={activeChips(params)}
            onRemoveChip={(key) => go(withoutChip(params, key))}
            onClearAll={() => go(clearedFilters(params))}
            filters={filters}
            setName={openDetail?.name}
            facets={shownFacets}
            onFacets={onFacets}
            cards={builds.map((build) => cardOf(build, shownFacets, valueHref, now))}
            empty={noMatches}
            onMore={list.hasNextPage ? () => void list.fetchNextPage() : undefined}
            loadingMore={list.isFetchingNextPage}
            updating={updating}
          />
        </Suspense>
      )
    ) : null;

  const page = (
    <BuildsView
      figure={buildsLabel}
      parts={stats.data ? statParts({ published: stats.data.inGallery, runsThisWeek: stats.data.reproducedThisWeek, freshPct: stats.data.freshPct, filtered }) : [{ text: " " }]}
      view={view}
      hrefFor={hrefFor}
      onViewIntent={prefetchView}
      filters={filters}
      table={
        view === "table" && !(list.error && !list.data)
          ? {
              lenses: GALLERY_LENSES.map((lens) => ({ value: lens, label: LENS_LABEL[lens], count: lensCounts.data?.[lens] })),
              lens: params.lens,
              setName: openDetail?.name,
              onLens: (lens) => go({ ...params, lens: lens as GalleryLens }),
              chips: activeChips(params),
              onRemoveChip: (key) => go(withoutChip(params, key)),
              onClearAll: () => go(clearedFilters(params)),
              columns,
              columnsLabel: columnsLabel(chosen, countsLive),
              columnsMenu: columnsMenu(
                chosen,
                countsLive,
                (id) => update((current) => withColumns(current, toggledColumns(chosenColumns(current.columns, countsLive), id))),
                layout.columns === null ? undefined : () => update((current) => withColumns(current, null)),
                columns.filter((id) => !chosen.includes(id)),
                (id, direction) => update((current) => withColumns(current, movedColumn(chosenColumns(current.columns, countsLive), id, direction))),
              ),
              /* BF-13 (C6): the reader's own columns move; a filter's derived column is not in the reader's list. */
              movable: new Set(chosen.filter((id) => id !== "build")),
              onDropColumn: (id, index) => update((current) => withColumns(current, placedColumn(chosenColumns(current.columns, countsLive), id, index + 1))),
              rows,
              sortColumn,
              sortColumn2: browserBy2 ? { id: browserBy2, ascending: params.dir2 === "asc" } : null,
              sortable,
              onSortColumn: (id, second, fresh) => go(fresh ? firstSortStep(params, id) : nextSort(params, id, allLoaded, second)),
              filtered: new Set(filteredIds),
              footer: {
                ...tableFooter(total, rows),
                calculations: footerCalculations(layout.calculations, columns, rows, (calculation) => update((current) => withCalculation(current, calculation, false))),
                calculate:
                  calculationChoices.length > 0
                    ? {
                        options: calculationChoices,
                        onToggle: (column, kind) => update((current) => withCalculation(current, { column, kind }, !current.calculations.some((entry) => entry.column === column && entry.kind === kind))),
                      }
                    : undefined,
              },
              onMore: list.hasNextPage ? () => void list.fetchNextPage() : undefined,
              loadingMore: list.isFetchingNextPage,
              empty: noMatches,
            }
          : null
      }
      other={list.error && !list.data ? <TableError onRetry={() => void list.refetch()} /> : null}
      updating={updating}
    />
  );

  return (
    <>
      <SeoHead title="Builds" description="Things people built with AI, and the exact model versions other people got them working on." path="/builds" />
      {/* While the first screen loads the page is its loading state, the route's Placeholder; the page fades in over it. */}
      <PageArrival loading={loading} placeholder={<BuildsLoadingView />}>
        {loading ? <BuildsLoadingView /> : view === "maps" ? mapsPage : view === "classification" ? classificationPage : page}
      </PageArrival>
    </>
  );
}
