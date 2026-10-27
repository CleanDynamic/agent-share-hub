/* SV-11: /builds, the container.

   THE ADDRESS IS THE STATE. The view, the lens, the filters, the sort and the query are read from the address
   (`parseGalleryParams`) on every render and written back with `galleryHref`; nothing is copied into state. A change is
   the same page with new parameters: the old rows stay until the new arrive, and nothing fades.

   ONE LOAD FOR EVERY VIEW. The builds are read once, through `src/lib/build` only, and the same builds are passed to the
   view the address names: the Table here, Maps and Classification as their own chunks (`buildsViews.ts`). */

import { Suspense } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { listBuildsTable } from "@/lib/build/gallery";
import { galleryHref, parseGalleryParams, type GalleryViewMode } from "@/lib/build/galleryParams";
import { LIST_STALE_MS } from "@/lib/query/client";
import { usePageReady } from "@/lib/routing/pageReady";

import { BuildsColumns, BuildsHead, BuildsLoadingView, TableRowSkeletons, ViewSwitch, useBuildsTwoColumns } from "./BuildsFrame";
import { listParamsOf, nextTableOffset } from "./buildsModel";
import { BuildsClassificationView, BuildsMapsView, prefetchView } from "./buildsViews";

export default function BuildsPage() {
  const [search] = useSearchParams();
  const params = parseGalleryParams(search);
  const view: GalleryViewMode = params.view ?? "table";
  const two = useBuildsTwoColumns();
  const listParams = listParamsOf(params);
  const hrefFor = (next: GalleryViewMode) => galleryHref({ ...params, view: next === "table" ? undefined : next });

  const list = useInfiniteQuery({
    queryKey: ["build", "listBuildsTable", listParams],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listBuildsTable({ ...listParams, offset: pageParam }),
    getNextPageParam: nextTableOffset,
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_MS,
  });
  const builds = list.data?.pages.flatMap((page) => page.builds) ?? [];
  const total = list.data?.pages[0]?.total ?? null;
  const loading = list.isLoading;
  usePageReady("builds", !loading);

  const otherView = view === "maps" ? <BuildsMapsView builds={builds} /> : view === "classification" ? <BuildsClassificationView builds={builds} /> : null;

  return (
    <>
      <SeoHead title="Builds · buildgallery" description="Things people built with AI, and the exact model versions other people got them working on." path="/builds" />
      <PageArrival loading={loading} placeholder={<BuildsLoadingView />}>
        <BuildsColumns
          two={two}
          head={
            <BuildsHead
              figure={`${total ?? builds.length} builds`}
              parts={[]}
              switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={prefetchView} />}
            />
          }
          filters={null}
          main={
            otherView ? (
              <Suspense fallback={<TableRowSkeletons count={6} />}>{otherView}</Suspense>
            ) : (
              <ol data-testid="builds-table">
                {builds.map((build) => (
                  <li key={build.id}>{build.title}</li>
                ))}
              </ol>
            )
          }
        />
      </PageArrival>
    </>
  );
}
