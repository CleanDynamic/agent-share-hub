// BF-02 P2 (X2): one Clear all. A button called Clear all clears the filters and only the filters.

import { describe, expect, it } from "vitest";

import { galleryHref, parseGalleryParams } from "@/lib/build/galleryParams";

import { activeCount, clearedFilters } from "./buildsModel";

const params = (search: string) => parseGalleryParams(new URLSearchParams(search));

describe("clearedFilters", () => {
  it("clearedFilters keeps lens, view and sort and returns no filter, no query and no set", () => {
    const busy = params("view=maps&lens=rebuilt&f=field%3Alaw&shape=app&open=1&within=30&state=stale&steps=5-30&sort=newest&q=notes&set=0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(activeCount(busy)).toBeGreaterThan(0);
    const cleared = clearedFilters(busy);
    expect(cleared).toEqual({ lens: "rebuilt", madeFor: [], madeWith: [], query: null, view: "maps", sort: "newest" });
    expect(activeCount(cleared)).toBe(0);
    expect(galleryHref(cleared)).toBe("/builds?view=maps&lens=rebuilt&sort=newest");
  });

  it("on the resting address it gives the resting address", () => {
    expect(galleryHref(clearedFilters(params("")))).toBe("/builds");
  });
});
