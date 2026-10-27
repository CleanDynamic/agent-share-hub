/* SV-11: the Builds views that are not the Table, each its own chunk. The page renders the chosen one lazily, and the
   view switch fetches a view's code when it is pointed at or focused (bundle-dynamic-imports). SV-12 made Maps the pane
   (`BuildsMapsPane`); SV-13 replaces the Classification module. */

import { lazy } from "react";

import type { GalleryViewMode } from "@/lib/build/galleryParams";

import type { BuildsOtherViewProps } from "./buildsOther";

const LOAD = {
  maps: () => import("./BuildsMapsPane"),
  classification: () => import("./BuildsClassificationView"),
} as const;

export const BuildsMapsPane = lazy(LOAD.maps);
export const BuildsClassificationView = lazy(LOAD.classification);

/** Starts the chunk of a view other than the Table; the Table is in the page's own chunk. */
export function prefetchView(view: GalleryViewMode): void {
  if (view === "table") return;
  void LOAD[view]().catch(() => undefined);
}

export type { BuildsOtherViewProps };
