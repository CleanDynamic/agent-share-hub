// SV-11: the Builds page, rendered. The claims: the view is read from the address and the builds are loaded once for
// every view; the list, the stats, the lens counts and both facet reads start together (one round); a filter, a lens,
// a sort and a chip write the address and the list follows it; an empty result is one line and one action; a failed
// read is one sentence and Retry, and is reported. The data layer is stubbed at src/lib/build/gallery.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/errors/report", () => ({ reportError: report }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } } }));

const listBuildsTable = vi.fn();
const getGalleryStats = vi.fn();
const countGalleryLenses = vi.fn();
const getClassificationFacets = vi.fn();
const getGalleryFacets = vi.fn();
const getCountSpread = vi.fn();
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  listBuildsTable: (...args: unknown[]) => listBuildsTable(...args),
  getGalleryStats: () => getGalleryStats(),
  countGalleryLenses: () => countGalleryLenses(),
  getClassificationFacets: () => getClassificationFacets(),
  getGalleryFacets: () => getGalleryFacets(),
  getCountSpread: () => getCountSpread(),
}));

import { emptyClassification } from "@/lib/classify/facets";

import BuildsPage from "./BuildsPage";

const build = (n: number) => ({
  id: `b${n}`, slug: `b${n}`, title: `Build ${n}`, shape: "app", madeWith: ["Claude Code"], reproductionCount: n, lastConfirmedAt: null, lastConfirmedModel: null,
  publishedAt: null, rebuildCount: 0, maker: { handle: "kit", name: null }, open: { count: 0, reward: null },
});

let address = "";
function Where() {
  const location = useLocation();
  address = `${location.pathname}${location.search}`;
  return null;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <BuildsPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  report.mockReset();
  listBuildsTable.mockReset();
  listBuildsTable.mockResolvedValue({ builds: [build(1), build(2)], total: 2 });
  getGalleryStats.mockReset();
  getGalleryStats.mockResolvedValue({ inGallery: 120, reproducedThisWeek: 214, weeklyGoal: null, freshPct: 78 });
  countGalleryLenses.mockReset();
  countGalleryLenses.mockResolvedValue({ all: 120, proven: 40, rebuilt: 12, unsolved: 3 });
  getClassificationFacets.mockReset();
  getClassificationFacets.mockResolvedValue({ live: true, counts: { "field:education": 9, "field:law": 4, "autonomy:fully-autonomous": 2 } });
  getGalleryFacets.mockReset();
  getGalleryFacets.mockResolvedValue({ roles: [], tools: [], patterns: [], patternsLive: false });
  getCountSpread.mockReset();
  getCountSpread.mockResolvedValue(null);
});

describe("BuildsPage", () => {
  it("starts the list, the stats, the lens counts and the facets together", async () => {
    renderAt("/builds");
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    expect(getGalleryStats).toHaveBeenCalledTimes(1);
    expect(countGalleryLenses).toHaveBeenCalledTimes(1);
    expect(getClassificationFacets).toHaveBeenCalledTimes(1);
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    expect(getCountSpread).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { level: 1, name: /^2 builds/ })).toBeTruthy();
  });

  it("draws the head from the stats and the rows from the list", async () => {
    renderAt("/builds");
    expect(await screen.findByText("214 reproductions")).toBeTruthy();
    expect(screen.getByText(/78% confirmed in the last 120 days/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Build 1" }).getAttribute("href")).toBe("/b2/b1");
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
  });

  it("reads the view from the address and loads the builds once for it", async () => {
    renderAt("/builds?view=maps");
    expect(await screen.findByTestId("builds-maps")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maps" }).getAttribute("aria-current")).toBe("page");
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(listBuildsTable.mock.calls[0][0])).not.toContain("maps");
  });

  it("draws Classification from the builds already loaded, with no read of its own", async () => {
    listBuildsTable.mockResolvedValue({ builds: [{ ...build(1), classifiedAs: { ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "education" }] } } }, build(2)], total: 2 });
    renderAt("/builds?view=classification");
    expect(await screen.findByTestId("builds-classification")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Classification" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByTestId("classification-card")).toHaveLength(2);
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    expect(getClassificationFacets).toHaveBeenCalledTimes(1);
  });

  it("links a Classification value to the Table with that facet added, and the view dropped", async () => {
    listBuildsTable.mockResolvedValue({ builds: [{ ...build(1), classifiedAs: { ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "education" }] } } }], total: 1 });
    renderAt("/builds?view=classification&f=field%3Alaw");
    const link = await screen.findByRole("link", { name: "Education" });
    expect(link.getAttribute("href")).toBe("/builds?f=field%3Alaw&f=field%3Aeducation");
    fireEvent.click(link);
    await waitFor(() => expect(address).toBe("/builds?f=field%3Alaw&f=field%3Aeducation"));
    expect(await screen.findByTestId("builds-page")).toBeTruthy();
  });

  it("writes a checked value to the address, and the list follows it", async () => {
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("checkbox", { name: /Education/ }));
    await waitFor(() => expect(address).toBe("/builds?f=field%3Aeducation"));
    await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["field:education"] })));
  });

  it("writes the lens, and a chip takes its value away", async () => {
    renderAt("/builds?f=field%3Alaw");
    fireEvent.click(await screen.findByRole("tab", { name: /Reproduced/ }));
    await waitFor(() => expect(address).toBe("/builds?lens=proven&f=field%3Alaw"));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Field" }));
    await waitFor(() => expect(address).toBe("/builds?lens=proven"));
  });

  it("sorts from a column head", async () => {
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("button", { name: "Rebuilds" }));
    await waitFor(() => expect(address).toBe("/builds?sort=rebuilt"));
  });

  it("opens a closed filter in place", async () => {
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("button", { name: /^Task\s*Any/ }));
    expect(screen.getByRole("region", { name: "Task" })).toBeTruthy();
  });

  it("shows one line and one action when nothing matches", async () => {
    listBuildsTable.mockResolvedValue({ builds: [], total: 0 });
    renderAt("/builds?f=field%3Alaw");
    expect(await screen.findByText("No builds match these filters.")).toBeTruthy();
  });

  it("says so when the list fails, offers Retry, and reports it", async () => {
    listBuildsTable.mockRejectedValue(new Error("listBuildsTable failed"));
    renderAt("/builds");
    expect(await screen.findByText("Builds didn't load.")).toBeTruthy();
    await waitFor(() => expect(report).toHaveBeenCalledWith(expect.any(Error), { source: "query", context: "listBuildsTable" }));
    listBuildsTable.mockResolvedValue({ builds: [build(1)], total: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1, name: /^1 build\b/ })).toBeTruthy();
  });

  describe("the stored counts (SV-23 P1)", () => {
    const counted = (n: number, steps: number | null, sessions: number | null) => ({ ...build(n), stepCount: steps, sessionCount: sessions });
    const SPREAD = { steps: new Map([[2, 4], [12, 9], [60, 1]]), sessions: new Map([[1, 7], [3, 2]]) };

    it("draws no Steps or Sessions, and offers no range, until the list carries the counts", async () => {
      renderAt("/builds");
      await screen.findByRole("link", { name: "Build 1" });
      expect(screen.queryByRole("columnheader", { name: "Steps" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Steps/ })).toBeNull();
    });

    it("draws the columns, the median in the footer and a closed filter for each range once they are live", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 4, 1), counted(2, 12, 3), counted(3, null, 0)], total: 3 });
      renderAt("/builds");
      expect(await screen.findByRole("columnheader", { name: "Steps" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Sessions" })).toBeTruthy();
      expect(screen.getByText("Median 8 steps")).toBeTruthy();
      expect(await screen.findByRole("button", { name: /^Steps\s*Any/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Sessions\s*Any/ })).toBeTruthy();
    });

    it("writes a range to the address, replacing the entry so dragging leaves one step in history, and the list follows", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 4, 1)], total: 1 });
      renderAt("/builds");
      fireEvent.click(await screen.findByRole("button", { name: /^Steps\s*Any/ }));
      const from = await screen.findByRole("slider", { name: "Steps from" });
      from.focus();
      fireEvent.keyDown(from, { key: "ArrowRight" });
      await waitFor(() => expect(address).toBe("/builds?steps=1-"));
      await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ ranges: { steps: { min: 1 } } })));
      expect(await screen.findByRole("button", { name: "Remove filter Steps" })).toBeTruthy();
    });

    it("opens a range already in the address, and a chip takes it away", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 6, 1)], total: 1 });
      renderAt("/builds?sessions=2-");
      expect(await screen.findByRole("slider", { name: "Sessions from" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Sessions, 2 or more" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove filter Sessions" }));
      await waitFor(() => expect(address).toBe("/builds"));
    });
  });
});
