/* UI-P49 — `/gallery` in the site frame: the container.

   Loads the Gallery feed through `src/lib/` functions only, maps it to
   `GalleryFeedView`'s props and renders it. No Supabase call in this file.

   TWO VIEWS OF THE SAME BUILDS, picked by `view`: the feed (this prompt) and
   the dashboard (UI-P50). Until UI-P50 lands, and always below 768px (decision
   9), `view=dashboard` renders the feed too; the switch still writes it.

   THE ADDRESS IS THE STATE. view, for, model, sort and q are read from the URL
   with `parseGalleryParams` and every change writes it with `galleryHref`; an
   address the feed cannot read in full is replaced by the one it can. The old
   lens, with and shape parameters are read and ignored — the canonical address
   leaves them out, because the page no longer shows anything they decide.

   EACH LIST PAGES ON ITS OWN. A page of the feed is one `listGalleryFeed` call,
   which answers both lists when a model is chosen; the page keeps a count of
   pages per list and reads pages 0…max of them, so "Show more" under one list
   fetches the next page and takes only that list's rows from it. The pages are
   cached per filter set, so a new view starts again at the first page.

   NO STATS, NO LENS COUNTS: the page asks for neither getGalleryStats nor
   countGalleryLenses. */

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { useAuth } from "@/contexts/AuthContext";
import { galleryHref, getGalleryFacets, parseGalleryParams, type GalleryParams } from "@/lib/build";
import {
  listGalleryFeed,
  type GalleryFeed,
  type GalleryFeedRow,
  type GalleryFeedSort,
} from "@/lib/build/gallery";
import { isPermissionError } from "@/lib/errors/permission";
import { MODEL_VERSIONS, type ModelVersion } from "@/lib/models/registry";
import { searchMakers } from "@/lib/profile/searchMakers";

import { MakersRow } from "./GalleryExtras";
import { GalleryFeedView, type FeedListView, type FeedSectionView } from "./GalleryFeedView";
import { feedRowView } from "./galleryModel";

/** Facets change far more slowly than the builds they describe. */
const FACETS_STALE_MS = 5 * 60 * 1000;

/** The rows of one list across its loaded pages, first occurrence kept. */
function collect(pages: readonly GalleryFeed[], pick: (page: GalleryFeed) => GalleryFeedRow[]): GalleryFeedRow[] {
  const seen = new Set<string>();
  const out: GalleryFeedRow[] = [];
  for (const page of pages) {
    for (const row of pick(page)) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

interface Paging {
  key: string;
  /** Pages shown of the one list, or of reproducedOn. */
  first: number;
  /** Pages shown of notYet. */
  second: number;
}

export function GalleryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const params = useMemo(() => parseGalleryParams(searchParams), [searchParams]);
  /* Read once, on arrival: the address rewrite below drops the parameter straight away. */
  const [focusSearch] = useState(() => searchParams.get("focus") === "search");
  const view = params.view ?? "feed";
  const modelId = params.model ?? null;
  const audience = params.madeFor[0] ?? null;
  const sort: GalleryFeedSort = params.sort ?? "newest";
  const { query } = params;
  const chosen = modelId ? (MODEL_VERSIONS.find((version) => version.id === modelId) ?? null) : null;

  /** What the feed's address holds: the old lens and facet parameters are left out. */
  const feedParams = useMemo<Partial<GalleryParams>>(
    () => ({
      view,
      model: modelId ?? undefined,
      madeFor: audience ? [audience] : [],
      sort,
      query,
    }),
    [view, modelId, audience, sort, query],
  );

  /** Every change writes the address; the query keys follow it. */
  const go = (next: Partial<GalleryParams>) => navigate(galleryHref({ ...feedParams, ...next }));

  /* An address the feed cannot read in full (an unknown model, a lens, a
     one-letter query, focus=search) is replaced by the one it can, so the
     address always says exactly what the page is showing. */
  const written = searchParams.toString();
  useEffect(() => {
    const canonical = galleryHref(feedParams);
    const current = written ? `${pathname}?${written}` : pathname;
    if (current !== canonical) navigate(canonical, { replace: true });
  }, [written, pathname, feedParams, navigate]);

  /* ── the feed, a page at a time ── */

  const filters = { model: modelId, audience, sort, q: query };
  const viewKey = JSON.stringify(filters);
  const [paging, setPaging] = useState<Paging>({ key: viewKey, first: 1, second: 1 });
  const shown: Paging = paging.key === viewKey ? paging : { key: viewKey, first: 1, second: 1 };
  const pageCount = Math.max(shown.first, shown.second);

  const pageQueries = useQueries({
    queries: Array.from({ length: pageCount }, (_, page) => ({
      queryKey: ["build", "listGalleryFeed", filters, page],
      queryFn: () =>
        listGalleryFeed({
          model: modelId ?? undefined,
          audience: audience ?? undefined,
          sort,
          q: query ?? undefined,
          page,
        }),
      // The previous list stays up while the next view loads, so a filter change does not blank the page.
      placeholderData: keepPreviousData,
    })),
  });

  const firstQuery = pageQueries[0];
  const firstPage = firstQuery?.data;
  /* Pages of the first page's own kind: while a model change loads, the kept
     page is the other kind, and the two never mix. */
  const loaded = pageQueries
    .map((entry) => entry.data)
    .filter((page): page is GalleryFeed => page !== undefined && page.kind === firstPage?.kind);

  const section = (
    pages: number,
    pick: (page: GalleryFeed) => GalleryFeedRow[],
    more: (page: GalleryFeed) => boolean,
    total: number | null,
    onMore: () => void,
    model: ModelVersion | null,
  ): FeedSectionView => {
    const own = loaded.slice(0, pages);
    const last = own[own.length - 1];
    const waiting = own.length < pages;
    return {
      rows: collect(own, pick).map((build) => feedRowView(build, model)),
      total,
      hasMore: waiting || (last ? more(last) : false),
      loadingMore: waiting,
      onMore,
    };
  };

  let list: FeedListView;
  if (firstPage?.kind === "model") {
    const model = firstPage.model;
    list = {
      kind: "model",
      reproducedOn: section(
        shown.first,
        (page) => (page.kind === "model" ? page.reproducedOn : []),
        (page) => page.kind === "model" && page.hasMoreReproducedOn,
        firstPage.totalReproducedOn,
        () => setPaging({ ...shown, first: shown.first + 1 }),
        model,
      ),
      notYet: section(
        shown.second,
        (page) => (page.kind === "model" ? page.notYet : []),
        (page) => page.kind === "model" && page.hasMoreNotYet,
        firstPage.totalNotYet,
        () => setPaging({ ...shown, second: shown.second + 1 }),
        model,
      ),
    };
  } else {
    list = {
      kind: "all",
      list: section(
        shown.first,
        (page) => (page.kind === "all" ? page.rows : []),
        (page) => page.kind === "all" && page.hasMore,
        firstPage?.kind === "all" ? firstPage.total : null,
        () => setPaging({ ...shown, first: shown.first + 1 }),
        null,
      ),
    };
  }

  /* ── the menus ── */

  const facets = useQuery({ queryKey: ["gallery-facets"], queryFn: getGalleryFacets, staleTime: FACETS_STALE_MS });
  const audiences = useMemo(
    () =>
      [...(facets.data?.roles ?? [])]
        .sort((a, b) => b.count - a.count)
        .map((role) => ({ value: role.value, label: role.label ?? role.value, count: role.count })),
    [facets.data],
  );

  /* Up to three makers whose names match the query: the one extra request, and only with a query. */
  const makers = useQuery({
    queryKey: ["gallery-makers", query],
    queryFn: () => searchMakers(query as string),
    enabled: query !== null,
    staleTime: FACETS_STALE_MS,
  });

  /* ── covers: one signing pass for every row on the page (useSignedMedia keys on the paths, not the array) ── */

  const allRows = list.kind === "all" ? list.list.rows : [...list.reproducedOn.rows, ...list.notYet.rows];
  const srcByPath = useSignedMedia(allRows.flatMap((row) => cardMedia(row.build)));

  const error = firstQuery?.error ?? null;
  const status = error && !firstPage ? "error" : !firstPage ? "loading" : "ready";

  return (
    <>
      <SeoHead
        title="Gallery — buildgallery"
        description="Things people built with AI, and the exact model versions other people got them working on."
        path="/gallery"
      />
      <GalleryFeedView
        fit="content"
        view={view}
        onViewChange={(next) => go({ view: next })}
        query={query}
        onSearch={(next) => go({ query: next })}
        model={chosen}
        onModelChange={(id) => go({ model: id ?? undefined })}
        audience={audience}
        onAudienceChange={(next) => go({ madeFor: next ? [next] : [] })}
        audiences={audiences}
        sort={sort}
        onSortChange={(next) => go({ sort: next })}
        counts={firstPage?.counts ?? null}
        status={status}
        errorKind={error && isPermissionError(error) ? "permission" : "error"}
        error={error ?? undefined}
        onRetry={() => void firstQuery?.refetch()}
        list={list}
        srcByPath={srcByPath}
        viewerId={user?.id ?? null}
        aboveList={query !== null ? <MakersRow makers={makers.data ?? []} /> : undefined}
        onClearAll={() => go({ query: null, model: undefined, madeFor: [] })}
        onNavigate={navigate}
        autoFocusSearch={focusSearch}
      />
    </>
  );
}

export default GalleryPage;
