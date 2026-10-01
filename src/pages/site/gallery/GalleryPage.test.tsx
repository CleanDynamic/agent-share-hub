// UI-P28 — the Gallery's container: the address is the state, the wall pages by
// appending, and each panel loads on its own.
//
// The data layer is stubbed and its calls are counted, as the legacy page's test
// does: what is claimed is which requests a filter, a lens and "Show more" make.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGallery = vi.fn();
const getGalleryFacets = vi.fn();
const getGalleryShapeFacets = vi.fn();
const countGalleryLenses = vi.fn();
const getGalleryStats = vi.fn();
const getFeaturedBuild = vi.fn();
const getOpenBountyPool = vi.fn();
const countRunsLastWeek = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({}), engagementFor: () => undefined }));
vi.mock("@/lib/profile/searchMakers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/searchMakers")>()),
  searchMakers: async () => [],
}));
vi.mock("@/lib/bounty/bounties", () => ({ getOpenBountyPool: () => getOpenBountyPool() }));
vi.mock("@/lib/build/signals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/signals")>()),
  countRunsLastWeek: () => countRunsLastWeek(),
}));
vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  listGallery: (options: unknown) => listGallery(options),
  getGalleryFacets: () => getGalleryFacets(),
}));
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  getGalleryShapeFacets: () => getGalleryShapeFacets(),
  countGalleryLenses: () => countGalleryLenses(),
  getGalleryStats: () => getGalleryStats(),
  getFeaturedBuild: () => getFeaturedBuild(),
}));

import { GALLERY_PAGE_SIZE, type GalleryBuild } from "@/lib/build";

import { GalleryPage } from "./GalleryPage";

function build(id: string, over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id,
    creator_id: "c1",
    slug: `build-${id}`,
    title: `Build ${id}`,
    outcome: "It works.",
    shape: "agent",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 3,
    last_confirmed_at: new Date().toISOString(),
    last_confirmed_model: null,
    published_at: new Date().toISOString(),
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
    ...over,
  };
}

const page = (ids: string[], total: number) => ({ builds: ids.map((id) => build(id)), total });

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="address">{pathname + search}</output>;
}

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <GalleryPage />
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const address = () => screen.getByTestId("address").textContent;

beforeEach(() => {
  vi.clearAllMocks();
  listGallery.mockResolvedValue(page(["a", "b", "c"], 3));
  getGalleryFacets.mockResolvedValue({
    roles: [
      { value: "lawyers", count: 12, label: null, logo_url: null },
      { value: "designers", count: 4, label: null, logo_url: null },
    ],
    tools: [{ value: "Claude", count: 9, label: "Claude", logo_url: null }],
  });
  getGalleryShapeFacets.mockResolvedValue([
    { value: "agent", count: 30 },
    { value: "study", count: 5 },
  ]);
  countGalleryLenses.mockResolvedValue({ all: 3, proven: 2, rebuilt: 1, unsolved: 0 });
  getGalleryStats.mockResolvedValue({ inGallery: 3, reproducedThisWeek: 9, weeklyGoal: null, freshPct: 66 });
  getOpenBountyPool.mockResolvedValue({ poolGbp: 450, open: 3, solutions: 1, withSolutions: 1 });
  countRunsLastWeek.mockResolvedValue(18);
  getFeaturedBuild.mockResolvedValue({ build: build("f", { title: "The featured one" }), reproductions30d: 40, outcome: "Does a thing." });
});

describe("GalleryPage", () => {
  it("loads the wall, the facets and the counts, each with one request, and puts the featured build first", async () => {
    renderAt("/gallery");

    await screen.findByTestId("gallery-wall");
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByTestId("gallery-featured").getAttribute("href")).toBe("/b2/build-f");
    expect(listGallery).toHaveBeenCalledTimes(1);
    expect(listGallery).toHaveBeenCalledWith(
      expect.objectContaining({ lens: "all", madeFor: [], madeWith: [], shapes: [], offset: 0, limit: GALLERY_PAGE_SIZE }),
    );
    await waitFor(() => expect(screen.getByText("£450")).toBeTruthy());
    for (const fn of [getGalleryFacets, getGalleryShapeFacets, countGalleryLenses, getGalleryStats, getOpenBountyPool, countRunsLastWeek, getFeaturedBuild]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("shows the lenses with their counts and writes the address when one is chosen", async () => {
    renderAt("/gallery");
    fireEvent.click(await screen.findByRole("button", { name: "Proven 2" }));
    await waitFor(() => expect(address()).toBe("/gallery?lens=proven"));
    await waitFor(() => expect(listGallery).toHaveBeenLastCalledWith(expect.objectContaining({ lens: "proven" })));
  });

  it("toggles a facet through the address, keeping the rest — and a shape the same way", async () => {
    renderAt("/gallery?lens=rebuilt");

    const forGroup = await screen.findByTestId("gallery-facets-made-for");
    fireEvent.click(await within(forGroup).findByRole("button", { name: /lawyers/ }));
    await waitFor(() => expect(address()).toBe("/gallery?lens=rebuilt&for=lawyers"));

    const shapeGroup = screen.getByTestId("gallery-facets-shape");
    fireEvent.click(await within(shapeGroup).findByRole("button", { name: /study/ }));
    await waitFor(() => expect(address()).toBe("/gallery?lens=rebuilt&for=lawyers&shape=study"));
    await waitFor(() =>
      expect(listGallery).toHaveBeenLastCalledWith(expect.objectContaining({ madeFor: ["lawyers"], shapes: ["study"] })),
    );

    // On again → off again.
    fireEvent.click(within(screen.getByTestId("gallery-facets-shape")).getByRole("button", { name: /study/ }));
    await waitFor(() => expect(address()).toBe("/gallery?lens=rebuilt&for=lawyers"));
  });

  it("marks an applied facet as pressed, and steps the featured build aside while anything narrows the gallery", async () => {
    renderAt("/gallery?for=lawyers");
    const forGroup = await screen.findByTestId("gallery-facets-made-for");
    expect((await within(forGroup).findByRole("button", { name: /lawyers/ })).getAttribute("aria-pressed")).toBe("true");
    await screen.findByTestId("gallery-wall");
    expect(screen.queryByTestId("gallery-featured")).toBeNull();
  });

  it("keeps an applied facet on offer even when it is outside the top of its group", async () => {
    getGalleryFacets.mockResolvedValue({
      roles: [1, 2, 3, 4, 5].map((n) => ({ value: `role-${n}`, count: 100 - n, label: null, logo_url: null })),
      tools: [],
    });
    renderAt("/gallery?for=role-5");
    const forGroup = await screen.findByTestId("gallery-facets-made-for");
    expect(await within(forGroup).findAllByRole("button")).toHaveLength(5);
    expect(within(forGroup).getByRole("button", { name: /role-5/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("tidies an address it cannot read in full", async () => {
    renderAt("/gallery?lens=trending&focus=search&shape=toaster");
    await waitFor(() => expect(address()).toBe("/gallery"));
  });

  it("appends the next 24 on Show more, and a new view starts again from the first page", async () => {
    const first = Array.from({ length: GALLERY_PAGE_SIZE }, (_, i) => `p1-${i}`);
    const second = ["p2-0", "p2-1"];
    listGallery.mockImplementation(async ({ offset }: { offset: number }) =>
      offset === 0 ? page(first, GALLERY_PAGE_SIZE + 2) : page(second, GALLERY_PAGE_SIZE + 2),
    );
    getFeaturedBuild.mockResolvedValue(null);

    renderAt("/gallery");
    await screen.findByTestId("gallery-wall");
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(GALLERY_PAGE_SIZE);

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() =>
      expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(GALLERY_PAGE_SIZE + 2),
    );
    expect(listGallery).toHaveBeenLastCalledWith(expect.objectContaining({ offset: GALLERY_PAGE_SIZE }));
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Proven/ }));
    await waitFor(() => expect(listGallery).toHaveBeenLastCalledWith(expect.objectContaining({ lens: "proven", offset: 0 })));
  });

  it("does not show the featured build twice", async () => {
    listGallery.mockResolvedValue(page(["a", "f", "c"], 3));
    renderAt("/gallery");
    await screen.findByTestId("gallery-featured");
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("says nothing here yet for a lens with no builds, and its button goes back to the whole gallery", async () => {
    listGallery.mockResolvedValue({ builds: [], total: 0 });
    renderAt("/gallery?lens=unsolved");
    expect(await screen.findByText("Nothing here yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See all builds" }));
    await waitFor(() => expect(address()).toBe("/gallery"));
  });

  it("says the gallery could not be loaded when the read fails, and a retry asks again", async () => {
    listGallery.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(page(["a"], 1));
    renderAt("/gallery");
    expect(await screen.findByText("The gallery could not be loaded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByTestId("gallery-wall");
    expect(listGallery).toHaveBeenCalledTimes(2);
  });

  it("a failed stats read costs the stats, never the wall", async () => {
    getGalleryStats.mockRejectedValue(new Error("nope"));
    renderAt("/gallery");
    await screen.findByTestId("gallery-wall");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
