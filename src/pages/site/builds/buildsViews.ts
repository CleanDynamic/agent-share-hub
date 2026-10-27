/* SV-11: the Builds views that are not the Table, each its own chunk. The page renders the chosen one lazily, and the
   view switch fetches a view's code when it is pointed at or focused (bundle-dynamic-imports). SV-12 and SV-13 replace
   the two modules; this file does not change. */

import { lazy } from "react";

import type { GalleryViewMode } from "@/lib/build/galleryParams";

import type { BuildsOtherViewProps } from "./buildsOther";

const LOAD = {
  maps: () => import("./BuildsMapsView"),
  classification: () => import("./BuildsClassificationView"),
} as const;

export const BuildsMapsView = lazy(LOAD.maps);
export const BuildsClassificationView = lazy(LOAD.classification);

/** Starts the chunk of a view other than the Table; the Table is in the page's own chunk. */
export function prefetchView(view: GalleryViewMode): void {
  if (view === "table") return;
  void LOAD[view]().catch(() => undefined);
}

export type { BuildsOtherViewProps };
