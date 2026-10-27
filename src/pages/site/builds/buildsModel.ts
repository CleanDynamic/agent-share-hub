/* SV-11: Builds' words and shapes, pure: what the list is asked for, and how a row, a filter and the head are put. */

import { BUILDS_TABLE_PAGE_SIZE, type BuildsTableOptions, type BuildsTablePage } from "@/lib/build/gallery";
import { DEFAULT_GALLERY_SORT, type GalleryParams } from "@/lib/build/galleryParams";

/** What the list is asked for: everything in the address but the view, which changes what is drawn, not what is read. */
export function listParamsOf(params: GalleryParams): BuildsTableOptions {
  return {
    lens: params.lens,
    facets: params.facets ?? [],
    tool: params.tool,
    shapes: params.shapes ?? [],
    pattern: params.pattern,
    openBounties: params.open === true,
    query: params.query ?? undefined,
    sort: params.sort ?? DEFAULT_GALLERY_SORT,
  };
}

/** The next page's offset, or none when the last page was short. */
export function nextTableOffset(last: BuildsTablePage, pages: readonly BuildsTablePage[]): number | undefined {
  return last.builds.length === BUILDS_TABLE_PAGE_SIZE ? pages.length * BUILDS_TABLE_PAGE_SIZE : undefined;
}
