/* SV-11: the Builds views that are not the Table, each its own chunk. The page renders the chosen one lazily, and the
   view switch fetches a view's code when it is pointed at or focused (bundle-dynamic-imports). SV-12 made Maps the pane
   (`BuildsMapsPane`); SV-13 made Classification the view itself. */

import { lazy } from "react";

import type { GalleryViewMode } from "@/lib/build/galleryParams";

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
  // SV-12: the Maps are read by their own chunk of the data layer; it comes with the view.
  if (view === "maps") void import("@/lib/build/buildsMaps").catch(() => undefined);
}
