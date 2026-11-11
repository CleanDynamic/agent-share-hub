// BF-08 P3 (C1): the gallery route prefetches the lens counts under the key the page reads them with, built from the same
// address, so a prefetched answer is the one the page uses (TanStack compares keys by value).

import { QueryClient, hashKey } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  listBuildsTable: vi.fn(async () => ({ builds: [], total: 0, countsLive: false })),
  getGalleryStats: vi.fn(async () => null),
  countGalleryLenses: vi.fn(async () => ({ all: 0, proven: 0, rebuilt: 0, unsolved: 0 })),
  getClassificationFacets: vi.fn(async () => null),
  getGalleryFacets: vi.fn(async () => null),
}));

import { countGalleryLenses } from "@/lib/build/gallery";
import { parseGalleryParams } from "@/lib/build/galleryParams";
import { lensCountParams } from "@/pages/site/builds/buildsModel";

import { ROUTE_TABLE } from "./routeTable";

async function prefetchedLensKey(search: string) {
  window.history.pushState({}, "", `/builds${search}`);
  const client = new QueryClient();
  const prefetch = vi.spyOn(client, "prefetchQuery");
  await ROUTE_TABLE.gallery.prefetch({}, client, { userId: null });
  const call = prefetch.mock.calls.find(([options]) => (options.queryKey as unknown[])[1] === "countGalleryLenses");
  return call?.[0].queryKey;
}

/** The key BuildsPage reads the lens counts with, for an address. */
const pageKey = (search: string) => ["build", "countGalleryLenses", lensCountParams(parseGalleryParams(new URLSearchParams(search)))];

afterEach(() => window.history.pushState({}, "", "/"));

describe("the gallery route's prefetch", () => {
  it("the gallery route prefetches the lens counts under the key the page uses", async () => {
    const key = await prefetchedLensKey("");
    expect(key).toBeDefined();
    expect(hashKey(key as unknown[])).toBe(hashKey(pageKey("")));
    expect(countGalleryLenses).toHaveBeenLastCalledWith(lensCountParams(parseGalleryParams(new URLSearchParams(""))));
  });

  it("follows the address's filters on /builds, as the page does", async () => {
    const key = await prefetchedLensKey("?f=field%3Alaw&sort=newest");
    expect(hashKey(key as unknown[])).toBe(hashKey(pageKey("?f=field%3Alaw&sort=newest")));
    expect(hashKey(key as unknown[])).not.toBe(hashKey(pageKey("")));
  });
});
