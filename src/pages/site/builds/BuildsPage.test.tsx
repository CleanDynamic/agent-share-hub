// SV-11: the Builds page, rendered. The claims: the view is read from the address and the builds are loaded once for
// every view; the list, the stats, the lens counts and both facet reads start together (one round); a filter, a lens,
// a sort and a chip write the address and the list follows it; an empty result is one line and one action; a failed
// read is one sentence and Retry, and is reported. The data layer is stubbed at src/lib/build/gallery.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const report = vi.hoisted(() => vi.fn());
vi.mock("@/lib/errors/report", () => ({ reportError: report }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } } }));

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const sets = vi.hoisted(() => ({
  listMyFilterSets: vi.fn(),
  getFilterSet: vi.fn(),
  createFilterSet: vi.fn(),
  renameFilterSet: vi.fn(),
  setFilterSetPublic: vi.fn(),
  deleteFilterSet: vi.fn(),
  joinFilterSet: vi.fn(),
  leaveFilterSet: vi.fn(),
  saveFilterSetLayout: vi.fn(),
}));
vi.mock("@/lib/build/filterSets", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/filterSets")>()), ...sets }));

const listBuildsTable = vi.fn();
const getGalleryStats = vi.fn();
const countGalleryLenses = vi.fn();
const getClassificationFacets = vi.fn();
const getGalleryFacets = vi.fn();
const getCountSpread = vi.fn();
const getWorksOnModelCounts = vi.fn();
const countBuildsTable = vi.fn();
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  listBuildsTable: (...args: unknown[]) => listBuildsTable(...args),
  getGalleryStats: () => getGalleryStats(),
  countGalleryLenses: (...args: unknown[]) => countGalleryLenses(...args),
  getClassificationFacets: () => getClassificationFacets(),
  getGalleryFacets: () => getGalleryFacets(),
  getCountSpread: () => getCountSpread(),
  getWorksOnModelCounts: () => getWorksOnModelCounts(),
  countBuildsTable: (...args: unknown[]) => countBuildsTable(...args),
}));

import { emptyClassification } from "@/lib/classify/facets";
import { AUTONOMY_VALUES } from "@/lib/classify/taxonomy";
import { t } from "@/lib/theme/tokens";

import { hasFilters } from "@/lib/build/gallery";

import BuildsPage from "./BuildsPage";
import { statParts } from "./BuildsView";

const build = (n: number) => ({
  id: `b${n}`, slug: `b${n}`, title: `Build ${n}`, shape: "app", madeWith: ["Claude Code"], reproductionCount: n, lastConfirmedAt: null, lastConfirmedModel: null,
  publishedAt: null, rebuildCount: 0, maker: { handle: "kit", name: null }, open: { count: 0, reward: null },
});

let address = "";
/** BF-08: every history entry the page has been on, by its key, to count the navigations. */
let entries: string[] = [];
function Where() {
  const location = useLocation();
  address = `${location.pathname}${location.search}`;
  if (!entries.includes(location.key)) entries.push(location.key);
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

/** BF-06: the filters are in a dialog the Filters button opens; Done closes it. Behind an open dialog the page is hidden
    from assistive technology, so a test that reads the table or the chips closes it first. */
async function openFilters(group?: string) {
  fireEvent.click(await screen.findByRole("button", { name: /^Filters/ }, { timeout: 4000 }));
  await screen.findByRole("dialog", { name: "Filters" });
  if (group) fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${group}`) }));
}
function closeFilters() {
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
}
/** BF-08: the dialog's choices are a draft; Apply writes them to the address once and closes it. */
function applyFilters() {
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

beforeEach(() => {
  entries = [];
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
  getWorksOnModelCounts.mockReset();
  getWorksOnModelCounts.mockResolvedValue(null);
  countBuildsTable.mockReset();
  countBuildsTable.mockResolvedValue(1);
  auth.user = null;
  localStorage.clear();
  for (const fn of Object.values(sets)) fn.mockReset();
  sets.listMyFilterSets.mockResolvedValue([]);
  sets.getFilterSet.mockResolvedValue(null);
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
    expect(getWorksOnModelCounts).toHaveBeenCalledTimes(1);
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

  const withEducation = () =>
    listBuildsTable.mockResolvedValue({ builds: [{ ...build(1), classifiedAs: { ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "education" }] } } }], total: 1 });

  it("Classification: a value's link keeps view=classification and adds the facet", async () => {
    withEducation();
    renderAt("/builds?view=classification&f=field%3Alaw");
    const link = await screen.findByRole("link", { name: "Education" });
    const query = new URLSearchParams((link.getAttribute("href") ?? "").split("?")[1]);
    expect(query.get("view")).toBe("classification");
    expect(query.getAll("f")).toEqual(["field:law", "field:education"]);
  });

  it("Classification: pressing a value leaves the reader on Classification with the cards filtered", async () => {
    withEducation();
    renderAt("/builds?view=classification&f=field%3Alaw");
    fireEvent.click(await screen.findByRole("link", { name: "Education" }));
    await waitFor(() => expect(address).toBe("/builds?view=classification&f=field%3Alaw&f=field%3Aeducation"));
    await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["field:law", "field:education"] })));
    expect(screen.getByTestId("builds-classification")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "View" })).getByRole("link", { name: "Classification" }).getAttribute("aria-current")).toBe("page");
  });

  it("writes a checked value to the address on Apply, and the list follows it", async () => {
    renderAt("/builds");
    await openFilters();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Education/ }));
    applyFilters();
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

  // BF-07 (A5): every filter is drawn in its group; none is a closed row to open first.
  it("draws every filter of a group, with nothing to open first", async () => {
    renderAt("/builds");
    await openFilters();
    expect(await screen.findByRole("region", { name: "Task" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Task\s*Any/ })).toBeNull();
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
      await openFilters("Structure");
      expect(screen.queryByRole("region", { name: "Steps" })).toBeNull();
    });

    it("draws the columns, the median in the footer and a filter for each range once they are live", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 4, 1), counted(2, 12, 3), counted(3, null, 0)], total: 3 });
      renderAt("/builds");
      expect(await screen.findByRole("columnheader", { name: "Steps" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Sessions" })).toBeTruthy();
      expect(screen.getByText("Median 8")).toBeTruthy();
      await openFilters("Structure");
      expect(await screen.findByRole("region", { name: "Steps" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Sessions" })).toBeTruthy();
    });

    it("writes a range to the address on Apply, and the list follows", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 4, 1)], total: 1 });
      renderAt("/builds");
      await openFilters("Structure");
      const from = await screen.findByRole("slider", { name: "Steps from" });
      from.focus();
      fireEvent.keyDown(from, { key: "ArrowRight" });
      applyFilters();
      await waitFor(() => expect(address).toBe("/builds?steps=1-"));
      await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ ranges: { steps: { min: 1 } } })));
      expect(await screen.findByRole("button", { name: "Remove filter Steps" })).toBeTruthy();
    });

    it("opens a range already in the address, and a chip takes it away", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [counted(1, 6, 1)], total: 1 });
      renderAt("/builds?sessions=2-");
      await openFilters("Structure");
      expect(await screen.findByRole("slider", { name: "Sessions from" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Sessions, 2 or more" })).toBeTruthy();
      closeFilters();
      fireEvent.click(screen.getByRole("button", { name: "Remove filter Sessions" }));
      await waitFor(() => expect(address).toBe("/builds"));
    });
  });

  describe("the proof (SV-23 P2)", () => {
    const SPREAD = { steps: new Map(), sessions: new Map(), reproductions: new Map([[1, 4], [3, 2]]), rebuilds: new Map(), likes: new Map() };
    const OPUS = { id: "opus-5-5", name: "Opus 5.5" };

    it("draws Runs, 12 weeks from the list, with words for the bars", async () => {
      listBuildsTable.mockResolvedValue({ builds: [{ ...build(1), runs: [0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 1, 1] }], total: 1 });
      renderAt("/builds");
      expect(await screen.findByRole("columnheader", { name: "Runs, 12 weeks" })).toBeTruthy();
      expect(screen.getByRole("img", { name: "Runs per week over 12 weeks, oldest first: 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 1, 1" })).toBeTruthy();
    });

    it("offers Last confirmed and Confirmed or stale from the columns that exist, and writes the choice to the address", async () => {
      renderAt("/builds");
      await openFilters("Proof");
      fireEvent.click(await screen.findByRole("checkbox", { name: /Within 30 days/ }));
      applyFilters();
      await waitFor(() => expect(address).toBe("/builds?within=30"));
      await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ confirmedWithin: 30 })));
      await openFilters("Proof");
      fireEvent.click(screen.getByRole("checkbox", { name: /Within 30 days/ }));
      fireEvent.click(screen.getByRole("checkbox", { name: /Stale, not confirmed in 120 days/ }));
      applyFilters();
      await waitFor(() => expect(address).toBe("/builds?state=stale"));
      await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ confirmedState: "stale" })));
      expect(await screen.findByRole("button", { name: "Remove filter Confirmed or stale" })).toBeTruthy();
    });

    it("draws Works on model once its counts answer with the stored counts live, and writes the model", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      getWorksOnModelCounts.mockResolvedValue([{ model: OPUS, builds: 18 }]);
      listBuildsTable.mockResolvedValue({ countsLive: true, builds: [build(1)], total: 1 });
      renderAt("/builds");
      await openFilters("Proof");
      fireEvent.click(await screen.findByRole("checkbox", { name: /Opus 5.5/ }));
      applyFilters();
      await waitFor(() => expect(address).toBe("/builds?model=opus-5-5"));
      await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ worksOn: "opus-5-5" })));
      expect(await screen.findByRole("button", { name: "Remove filter Works on" })).toBeTruthy();
    });

    it("draws no Works on model, and no Reproductions range, while the stored counts are not live", async () => {
      getCountSpread.mockResolvedValue(SPREAD);
      getWorksOnModelCounts.mockResolvedValue([{ model: OPUS, builds: 18 }]);
      renderAt("/builds");
      await screen.findByRole("link", { name: "Build 1" });
      await openFilters("Proof");
      expect(screen.queryByRole("region", { name: "Works on model" })).toBeNull();
      expect(screen.queryByRole("region", { name: "Reproductions" })).toBeNull();
    });
  });
});

describe("SV-24 P1: saved filter sets", () => {
  const SET_ID = "0b6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c10";
  const mine = { id: SET_ID, name: "Stale agents", search: "shape=agent&state=stale", isPublic: false, ownerId: "reader-1", layout: null };

  it("draws no section, and makes no request for sets, when nobody is signed in", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    expect(screen.queryByRole("region", { name: "Saved filter sets" })).toBeNull();
    expect(sets.listMyFilterSets).not.toHaveBeenCalled();
    expect(sets.getFilterSet).not.toHaveBeenCalled();
  });

  it("lists the reader's sets as links that open them on the same view, with the set marked in the address", async () => {
    auth.user = { id: "reader-1" };
    sets.listMyFilterSets.mockResolvedValue([mine, { ...mine, id: "9d6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c11", name: "Sales", search: "f=field%3Asales", isPublic: true }]);
    renderAt("/builds?view=maps");
    await openFilters("Saved");
    const link = await screen.findByRole("link", { name: /Stale agents/ });
    expect(link.getAttribute("href")).toBe(`/builds?view=maps&shape=agent&state=stale&set=${SET_ID}`);
    expect(screen.getByRole("link", { name: /Sales/ }).textContent).toContain("Public");
  });

  it("starts the sets with the first round, and reads the open set only when the address names one", async () => {
    auth.user = { id: "reader-1" };
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    expect(sets.listMyFilterSets).toHaveBeenCalledTimes(1);
    expect(sets.getFilterSet).not.toHaveBeenCalled();
  });

  it("saves the current filters under a name, and opens the new set", async () => {
    auth.user = { id: "reader-1" };
    sets.createFilterSet.mockResolvedValue(mine);
    renderAt("/builds?view=maps&f=field%3Alaw&sort=newest");
    await openFilters("Saved");
    fireEvent.click(await screen.findByRole("button", { name: "Save current" }));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Law, newest" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Public/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sets.createFilterSet).toHaveBeenCalledWith({ name: "Law, newest", search: "f=field%3Alaw&sort=newest", isPublic: true }));
    await waitFor(() => expect(address).toBe(`/builds?view=maps&shape=agent&state=stale&set=${SET_ID}`));
  });

  it("renames a set from its menu", async () => {
    auth.user = { id: "reader-1" };
    sets.listMyFilterSets.mockResolvedValue([mine]);
    sets.renameFilterSet.mockResolvedValue("Old agents");
    renderAt("/builds");
    await openFilters("Saved");
    fireEvent.keyDown(await screen.findByRole("button", { name: "More for Stale agents" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const field = await screen.findByLabelText("Name");
    expect((field as HTMLInputElement).value).toBe("Stale agents");
    fireEvent.change(field, { target: { value: "Old agents" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => expect(sets.renameFilterSet).toHaveBeenCalledWith(SET_ID, "Old agents"));
  });

  it("deletes the open set after asking, and drops the marker from the address", async () => {
    auth.user = { id: "reader-1" };
    sets.listMyFilterSets.mockResolvedValue([mine]);
    sets.getFilterSet.mockResolvedValue({ ...mine, mine: true, members: 0, member: false });
    sets.deleteFilterSet.mockResolvedValue(undefined);
    renderAt(`/builds?shape=agent&state=stale&set=${SET_ID}`);
    await openFilters("Saved");
    fireEvent.keyDown(await screen.findByRole("button", { name: "More for Stale agents" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(sets.deleteFilterSet).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(sets.deleteFilterSet).toHaveBeenCalledWith(SET_ID));
    await waitFor(() => expect(address).toBe("/builds?shape=agent&state=stale"));
  });

  it("lets a reader follow a public set that is not theirs, and leave it", async () => {
    auth.user = { id: "reader-1" };
    const group = { ...mine, ownerId: "maker-9", name: "Sales agents", isPublic: true };
    sets.getFilterSet.mockResolvedValue({ ...group, mine: false, members: 12, member: false });
    sets.joinFilterSet.mockResolvedValue(undefined);
    renderAt(`/builds?set=${SET_ID}`);
    await openFilters("Saved");
    expect(await screen.findByText("Group · 12 members")).toBeTruthy();
    sets.getFilterSet.mockResolvedValue({ ...group, mine: false, members: 13, member: true });
    fireEvent.click(screen.getByRole("button", { name: "Join Sales agents" }));
    await waitFor(() => expect(sets.joinFilterSet).toHaveBeenCalledWith(SET_ID));
    fireEvent.click(await screen.findByRole("button", { name: "Leave Sales agents" }));
    await waitFor(() => expect(sets.leaveFilterSet).toHaveBeenCalledWith(SET_ID));
  });

  it("reports a failed save and tells the reader, and the window stays open to try again", async () => {
    auth.user = { id: "reader-1" };
    sets.createFilterSet.mockRejectedValue(new Error("nope"));
    // BF-09 (F1): there must be something to save.
    renderAt("/builds?f=field%3Alaw");
    await openFilters("Saved");
    fireEvent.click(await screen.findByRole("button", { name: "Save current" }));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(report).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ context: "createFilterSet" })));
    expect(await screen.findByText("Couldn't save that. Try again.")).toBeTruthy();
  });
});

describe("SV-24 P2: the reader's layout", () => {
  const SET_ID = "0b6f3a42-1c52-4e0e-9a3c-6d2f1f4a9c10";
  const sectionNames = () => Array.from(screen.getByTestId("builds-filters").querySelectorAll("section[aria-label]")).map((node) => node.getAttribute("aria-label")).filter((name) => name !== "Saved filter sets");
  const stored = () => JSON.parse(localStorage.getItem("builds:layout:v1") ?? "null");

  // BF-07 (A6): the filters have fixed places; there is no order, nothing opened and no height to keep.
  it("draws the filters in their fixed places on every visit, and keeps nothing about them", async () => {
    const first = renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    const before = sectionNames();
    expect(before.slice(0, 2)).toEqual(["Field", "Autonomy"]);
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    expect(sectionNames()).toEqual(before);
    expect(stored()).toBeNull();
    first.unmount();
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    expect(sectionNames()).toEqual(before);
  });

  it("chooses the Table's columns from the Columns chooser, and keeps them", async () => {
    listBuildsTable.mockResolvedValue({ countsLive: true, builds: [{ ...build(1), classifiedAs: { ...emptyClassification(), derived: { skill: { values: ["no-coding"] } } } }], total: 1 });
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("button", { name: "Columns: 12 of 28" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Skill" }));
    expect(await screen.findByRole("columnheader", { name: "Skill" })).toBeTruthy();
    expect(screen.getByText("No coding")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Columns: 13 of 28" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Rebuilds" }));
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Rebuilds" })).toBeNull());
    expect(stored().columns).toContain("skill");
    expect(stored().columns).not.toContain("rebuilds");
    fireEvent.click(screen.getByRole("button", { name: "Back to the default columns" }));
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Skill" })).toBeNull());
    expect(stored().columns).toBeNull();
  });

  it("offers no Steps or Sessions column until the list carries the stored counts", async () => {
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("button", { name: "Columns: 10 of 25" }));
    expect(screen.queryByRole("checkbox", { name: "Steps" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Shape" })).toBeTruthy();
  });

  it("adds a calculation to the footer, worked out from the rows loaded with no request, and takes it off", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("button", { name: "Add a calculation" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Sum, Reproductions" }));
    expect(await screen.findByText("Sum, Reproductions 3")).toBeTruthy();
    expect(stored().calculations).toEqual([{ column: "reproductions", kind: "sum" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Sum, Reproductions 3" }));
    await waitFor(() => expect(screen.queryByText("Sum, Reproductions 3")).toBeNull());
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
  });

  it("keeps the layout in the reader's own open set, and not in the browser", async () => {
    auth.user = { id: "reader-1" };
    const own = { id: SET_ID, name: "Mine", search: "shape=agent", isPublic: false, ownerId: "reader-1", layout: { columns: null, calculations: [] }, mine: true, members: 0, member: false };
    sets.getFilterSet.mockResolvedValue(own);
    sets.listMyFilterSets.mockResolvedValue([own]);
    sets.saveFilterSetLayout.mockResolvedValue(undefined);
    renderAt(`/builds?shape=agent&set=${SET_ID}`);
    await screen.findByRole("link", { name: "Build 1" });
    await waitFor(() => expect(sets.getFilterSet).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: /^Columns:/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Skill" }));
    expect(await screen.findByRole("columnheader", { name: "Skill" })).toBeTruthy();
    await waitFor(() => expect(sets.saveFilterSetLayout).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(sets.saveFilterSetLayout).toHaveBeenCalledWith(SET_ID, "shape=agent", expect.objectContaining({ columns: expect.arrayContaining(["skill"]) }));
    expect(stored()).toBeNull();
  });

  it("keeps the layout in the browser when the open set is someone else's", async () => {
    auth.user = { id: "reader-1" };
    sets.getFilterSet.mockResolvedValue({ id: SET_ID, name: "Theirs", search: "", isPublic: true, ownerId: "maker-9", layout: { columns: null, calculations: [] }, mine: false, members: 3, member: false });
    renderAt(`/builds?set=${SET_ID}`);
    await screen.findByRole("link", { name: "Build 1" });
    await waitFor(() => expect(sets.getFilterSet).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: /^Columns:/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Skill" }));
    await waitFor(() => expect(stored()).not.toBeNull());
    expect(stored().columns).toContain("skill");
    expect(sets.saveFilterSetLayout).not.toHaveBeenCalled();
  });
});


describe("BF-01 the head line", () => {
  it('with no filter the head reads "2 builds" and its meta line starts "Of 2 published"', async () => {
    getGalleryStats.mockResolvedValue({ inGallery: 2, reproducedThisWeek: 0, weeklyGoal: null, freshPct: 50 });
    renderAt("/builds");
    await screen.findByRole("heading", { level: 1, name: "2 builds" });
    /* BF-03: the h1 holds the number only; the meta line is under it in the one head. */
    const head = screen.getByTestId("builds-head");
    await waitFor(() => expect(head.textContent).toMatch(/^2 buildsOf 2 published/));
  });

  it('with a filter on, the head reads "1 of 2 builds" and the meta line has no "Of 2 published" part', async () => {
    listBuildsTable.mockResolvedValue({ builds: [build(1)], total: 1 });
    getGalleryStats.mockResolvedValue({ inGallery: 2, reproducedThisWeek: 0, weeklyGoal: null, freshPct: 50 });
    renderAt(`/builds?f=${encodeURIComponent(`autonomy:${AUTONOMY_VALUES[0].id}`)}`);
    await screen.findByRole("heading", { level: 1, name: "1 of 2 builds" });
    const head = screen.getByTestId("builds-head");
    await waitFor(() => expect(head.textContent).toContain("this week"));
    expect(head.textContent).not.toContain("published");
  });

  it("the reproductions clause is in the evidence colour only when the number is above zero", async () => {
    /* jsdom drops a `color: var(...)` from inline style, so the colour is read from the element statParts returns. */
    const runsSpan = (runsThisWeek: number) => {
      const fragment = statParts({ published: 2, runsThisWeek, freshPct: 50 })[1].text as ReactElement<{ children: ReactNode }>;
      return Children.toArray(fragment.props.children).find((child) => isValidElement(child) && (child.props as Record<string, unknown>)["data-testid"] === "stat-runs") as ReactElement<{ style: CSSProperties }>;
    };
    expect(runsSpan(0).props.style.color).toBe(t.text2);
    expect(runsSpan(3).props.style.color).toBe(t.evidence);
    getGalleryStats.mockResolvedValue({ inGallery: 2, reproducedThisWeek: 0, weeklyGoal: null, freshPct: 50 });
    renderAt("/builds");
    expect((await screen.findByTestId("stat-runs")).textContent).toBe("0 reproductions");
  });
});

describe("BF-02 the updating state", () => {
  /** A list answer held back until the test lets it go. */
  function held() {
    let release: (value: unknown) => void = () => undefined;
    const answer = new Promise((resolve) => (release = resolve));
    return { answer, release };
  }

  it("changing a filter: the old rows stay, marked as updating, until the new page lands", async () => {
    renderAt("/builds");
    expect(await screen.findByRole("link", { name: "Build 2" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("false");
    const next = held();
    listBuildsTable.mockReturnValueOnce(next.answer);
    await openFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    applyFilters();
    await waitFor(() => expect(address).toBe("/builds?f=field%3Aeducation"));
    await waitFor(() => expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("true"));
    expect(screen.getByRole("link", { name: "Build 1" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Build 2" })).toBeTruthy();
    expect(screen.getByText("Updating")).toBeTruthy();
    next.release({ builds: [build(1)], total: 1 });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Build 2" })).toBeNull());
    expect(screen.getByRole("link", { name: "Build 1" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByText("Updating")).toBeNull();
  });

  it("the first load is the loading view, not the updating state", async () => {
    const first = held();
    listBuildsTable.mockReturnValueOnce(first.answer);
    renderAt("/builds");
    expect(await screen.findByTestId("builds-loading")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Builds table" })).toBeNull();
    expect(screen.queryByText("Updating")).toBeNull();
    first.release({ builds: [build(1), build(2)], total: 2 });
    expect(await screen.findByRole("link", { name: "Build 2" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByText("Updating")).toBeNull();
  });
});

describe("BF-02 one Clear all", () => {
  const SET = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("Clear all in the chip row keeps the lens and the sort and drops every filter and the open set", async () => {
    renderAt(`/builds?lens=rebuilt&f=field%3Alaw&open=1&within=30&sort=newest&q=notes&set=${SET}`);
    const chips = await screen.findByRole("group", { name: "Active filters" });
    fireEvent.click(within(chips).getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(address).toBe("/builds?lens=rebuilt&sort=newest"));
  });

  for (const view of ["maps", "classification"] as const) {
    it(`Classification and Maps: Clear all keeps the view and drops every filter (${view})`, async () => {
      renderAt(`/builds?view=${view}&lens=rebuilt&f=field%3Alaw&open=1&within=30&sort=newest&q=notes&set=${SET}`);
      const chips = await screen.findByRole("group", { name: "Active filters" });
      fireEvent.click(within(chips).getByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(address).toBe(`/builds?view=${view}&lens=rebuilt&sort=newest`));
    });

    it(`removing a chip in ${view} drops only that filter and keeps the view`, async () => {
      renderAt(`/builds?view=${view}&f=field%3Alaw&open=1`);
      const chips = await screen.findByRole("group", { name: "Active filters" });
      fireEvent.click(within(chips).getByRole("button", { name: /^Remove filter Still open/ }));
      await waitFor(() => expect(address).toBe(`/builds?view=${view}&f=field%3Alaw`));
    });
  }

  for (const view of [undefined, "maps", "classification"] as const) {
    const on = view ? `view=${view}&` : "";
    const where = view ?? "table";

    it(`empty state with filters on (${where}): the button is Clear all, and it keeps the lens and the sort`, async () => {
      listBuildsTable.mockResolvedValue({ builds: [], total: 0 });
      renderAt(`/builds?${on}lens=rebuilt&sort=newest&f=field%3Alaw`);
      const empty = await screen.findByTestId("builds-empty");
      expect(within(empty).getByText("No builds match these filters.")).toBeTruthy();
      expect(within(empty).queryByRole("button", { name: "Show all builds" })).toBeNull();
      fireEvent.click(within(empty).getByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(address).toBe(`/builds?${on}lens=rebuilt&sort=newest`));
    });

    it(`empty state with no filter on a lens other than All (${where}): the sentence is "No builds here yet." and the button is Show all builds, which opens /builds with the same view`, async () => {
      listBuildsTable.mockResolvedValue({ builds: [], total: 0 });
      renderAt(`/builds?${on}lens=rebuilt`);
      const empty = await screen.findByTestId("builds-empty");
      expect(within(empty).getByText("No builds here yet.")).toBeTruthy();
      expect(within(empty).queryByRole("button", { name: "Clear all" })).toBeNull();
      fireEvent.click(within(empty).getByRole("button", { name: "Show all builds" }));
      await waitFor(() => expect(address).toBe(view ? `/builds?view=${view}` : "/builds"));
    });
  }

  it("empty state with no filter on All: the sentence and no button, since there is nothing to show instead", async () => {
    listBuildsTable.mockResolvedValue({ builds: [], total: 0 });
    renderAt("/builds");
    const empty = await screen.findByTestId("builds-empty");
    expect(within(empty).getByText("No builds here yet.")).toBeTruthy();
    expect(within(empty).queryByRole("button")).toBeNull();
  });
});

/* ── BF-08 P2 (A2) ── */

describe("BF-08 draft and Apply", () => {
  it("ticking values in the dialog does not change the address or ask for the list", async () => {
    renderAt("/builds?sort=newest");
    await screen.findByRole("link", { name: "Build 1" });
    const asked = listBuildsTable.mock.calls.length;
    await openFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Law/ }));
    expect((screen.getByRole("checkbox", { name: /Education/ }) as HTMLInputElement).checked).toBe(true);
    await waitFor(() => expect(countBuildsTable).toHaveBeenCalled());
    expect(address).toBe("/builds?sort=newest");
    expect(listBuildsTable).toHaveBeenCalledTimes(asked);
    expect(entries).toHaveLength(1);
  });

  it("the footer says how many builds will match the draft", async () => {
    countBuildsTable.mockResolvedValue(4);
    renderAt("/builds");
    await openFilters();
    const status = within(screen.getByRole("dialog", { name: "Filters" })).getByRole("status");
    expect(status.textContent).toBe("2 builds match");
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    await waitFor(() => expect(status.textContent).toBe("4 builds match"));
    expect(countBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["field:education"] }));
  });

  it("Apply navigates once with every draft filter, keeps the view and the sort, and closes the dialog", async () => {
    renderAt("/builds?view=classification&sort=newest");
    await screen.findByTestId("builds-classification");
    const asked = listBuildsTable.mock.calls.length;
    await openFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Law/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Proof/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Within 30 days/ }));
    applyFilters();
    await waitFor(() => expect(new URLSearchParams(address.split("?")[1]).getAll("f")).toEqual(["field:education", "field:law"]));
    const query = new URLSearchParams(address.split("?")[1]);
    expect([query.get("view"), query.get("sort"), query.get("within")]).toEqual(["classification", "newest", "30"]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(entries).toHaveLength(2);
    await waitFor(() => expect(listBuildsTable).toHaveBeenCalledTimes(asked + 1));
  });

  it("Cancel, Close and Escape discard the draft", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    for (const close of [
      () => closeFilters(),
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
      () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }),
    ]) {
      await openFilters();
      fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
      close();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await openFilters();
      expect((screen.getByRole("checkbox", { name: /Education/ }) as HTMLInputElement).checked).toBe(false);
      closeFilters();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    expect(address).toBe("/builds");
  });

  it("reopening after Apply starts from the applied filters", async () => {
    renderAt("/builds");
    await openFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    applyFilters();
    await waitFor(() => expect(address).toBe("/builds?f=field%3Aeducation"));
    await openFilters();
    expect((screen.getByRole("checkbox", { name: /Education/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Clear all in the dialog clears the draft only; the address changes on Apply", async () => {
    renderAt("/builds?f=field%3Alaw&sort=newest");
    await openFilters();
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect((screen.getByRole("checkbox", { name: /Law/ }) as HTMLInputElement).checked).toBe(false);
    expect(address).toBe("/builds?f=field%3Alaw&sort=newest");
    applyFilters();
    await waitFor(() => expect(address).toBe("/builds?sort=newest"));
  });

  it("with no change, Apply is disabled", async () => {
    renderAt("/builds");
    await openFilters();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    /* Nothing changed: the dialog says the page's own total and asks for no count (the first screen is as it was). */
    expect(countBuildsTable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dragging a range handle updates the address of nothing and asks for one count when the handle is let go", async () => {
    getCountSpread.mockResolvedValue({ steps: new Map([[2, 4]]), sessions: new Map() });
    listBuildsTable.mockResolvedValue({ countsLive: true, builds: [build(1)], total: 1 });
    renderAt("/builds");
    await openFilters("Structure");
    const from = await screen.findByRole("slider", { name: "Steps from" });
    from.focus();
    // A key press is a change and a commit at once, as a handle let go is.
    fireEvent.keyDown(from, { key: "ArrowRight" });
    await waitFor(() => expect(countBuildsTable).toHaveBeenCalledTimes(1));
    expect(countBuildsTable).toHaveBeenCalledWith(expect.objectContaining({ ranges: { steps: { min: 1 } } }));
    expect(address).toBe("/builds");
    expect(entries).toHaveLength(1);
  });
});

/* ── BF-08 P3 (C1) ── */

describe("BF-08 lens counts follow the filters", () => {
  it("with a filter on, the All tab's number equals the number of rows the list reports", async () => {
    listBuildsTable.mockResolvedValue({ builds: [build(1)], total: 1 });
    countGalleryLenses.mockImplementation(async (filters?: { facets?: string[] }) => ((filters?.facets?.length ?? 0) > 0 ? { all: 1, proven: 1, rebuilt: 0, unsolved: 0 } : { all: 2, proven: 1, rebuilt: 0, unsolved: 0 }));
    renderAt("/builds?f=field%3Alaw");
    await screen.findByRole("heading", { level: 1, name: /^1 / });
    await waitFor(() => expect(screen.getByRole("tab", { name: /^All/ }).textContent).toBe("All1"));
    expect(countGalleryLenses).toHaveBeenCalledWith(expect.objectContaining({ facets: ["field:law"] }));
  });

  it("with no filter, the lens counts are asked once and with the unfiltered key", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    expect(countGalleryLenses).toHaveBeenCalledTimes(1);
    const [filters] = countGalleryLenses.mock.calls[0];
    expect(hasFilters(filters)).toBe(false);
    expect(filters).not.toHaveProperty("lens");
    expect(filters).not.toHaveProperty("sort");
  });
});

/* ── BF-09 P4 (F1) ── */

describe("BF-09 Save current", () => {
  const saveCurrent = async () => {
    await openFilters("Saved");
    return screen.findByRole("button", { name: "Save current" }) as Promise<HTMLButtonElement>;
  };

  beforeEach(() => {
    auth.user = { id: "reader-1" };
  });

  it('Save current is disabled when no filter is on and the layout is the default, and a line under it says "Choose a filter or change the columns first."', async () => {
    renderAt("/builds");
    const button = await saveCurrent();
    expect(button.disabled).toBe(true);
    const line = screen.getByText("Choose a filter or change the columns first.");
    expect(button.getAttribute("aria-describedby")).toBe(line.id);
  });

  it('Save current is disabled while the draft differs from what is applied, and the line says "Apply your changes first."', async () => {
    renderAt("/builds?f=field%3Alaw");
    await openFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Saved/ }));
    const button = (await screen.findByRole("button", { name: "Save current" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Apply your changes first.")).toBeTruthy();
  });

  it("Save current is enabled with a filter on", async () => {
    renderAt("/builds?f=field%3Alaw");
    const button = await saveCurrent();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("Save current is enabled with a changed layout and no filter", async () => {
    localStorage.setItem("builds:layout:v1", JSON.stringify({ columns: ["build", "skill"], calculations: [] }));
    renderAt("/builds");
    const button = await saveCurrent();
    expect(button.disabled).toBe(false);
  });
});

describe("BF-11 a filter's column", () => {
  const AUTONOMY = AUTONOMY_VALUES[0];
  const stored = () => JSON.parse(localStorage.getItem("builds:layout:v1") ?? "null");
  const autonomyHead = () => screen.queryByRole("columnheader", { name: /^Autonomy/ });

  it("filtering by Autonomy draws an Autonomy column; removing the chip removes it", async () => {
    renderAt(`/builds?f=autonomy%3A${AUTONOMY.id}`);
    await screen.findByRole("link", { name: "Build 1" });
    expect(autonomyHead()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Autonomy" }));
    await waitFor(() => expect(address).toBe("/builds"));
    await waitFor(() => expect(autonomyHead()).toBeNull());
    expect(stored()).toBeNull();
  });

  it("a column the reader ticked stays when its filter is removed", async () => {
    localStorage.setItem("builds:layout:v1", JSON.stringify({ columns: ["build", "field", "autonomy"], calculations: [] }));
    renderAt(`/builds?f=autonomy%3A${AUTONOMY.id}`);
    await screen.findByRole("link", { name: "Build 1" });
    expect(autonomyHead()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Autonomy" }));
    await waitFor(() => expect(address).toBe("/builds"));
    expect(autonomyHead()).toBeTruthy();
  });

  it("opening /builds?view=classification and pressing a value, then choosing Table, shows that value's column", async () => {
    listBuildsTable.mockResolvedValue({ builds: [{ ...build(1), classifiedAs: { ...emptyClassification(), derived: { autonomy: { values: [AUTONOMY.id], from: [] } } } }], total: 1 });
    renderAt("/builds?view=classification");
    fireEvent.click(await screen.findByRole("link", { name: AUTONOMY.label }));
    await waitFor(() => expect(new URLSearchParams(address.split("?")[1]).getAll("f")).toEqual([`autonomy:${AUTONOMY.id}`]));
    fireEvent.click(within(screen.getByRole("navigation", { name: "View" })).getByRole("link", { name: "Table" }));
    expect(await screen.findByRole("columnheader", { name: /^Autonomy/ })).toBeTruthy();
    expect(stored()).toBeNull();
  });

  it('the dialog\'s footer has "Add a column for each filter", ticked; unticking it and applying draws only the reader\'s columns, and the choice is kept', async () => {
    renderAt(`/builds?f=autonomy%3A${AUTONOMY.id}`);
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    const box = screen.getByRole("checkbox", { name: "Add a column for each filter" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect((screen.getByRole("checkbox", { name: "Add a column for each filter" }) as HTMLInputElement).checked).toBe(false);
    expect(stored().filterColumns).toBe(false);
    closeFilters();
    await waitFor(() => expect(autonomyHead()).toBeNull());
    expect(address).toBe(`/builds?f=autonomy%3A${AUTONOMY.id}`);
  });

  it("the Columns label counts the reader's own columns", async () => {
    renderAt(`/builds?f=autonomy%3A${AUTONOMY.id}&shape=agent`);
    await screen.findByRole("link", { name: "Build 1" });
    expect(autonomyHead()).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /^Shape/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Columns: 10 of 25" })).toBeTruthy();
  });
});

describe("BF-12 every head sorts when its answer is true", () => {
  const many = (countsLive = false) => listBuildsTable.mockResolvedValue({ countsLive, builds: Array.from({ length: 50 }, (_, at) => build(at + 1)), total: 120 });
  const withFields = () =>
    listBuildsTable.mockResolvedValue({
      builds: [
        { ...build(1), classifiedAs: { ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "education" }] } } },
        { ...build(2), classifiedAs: { ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id: "law" }] } } },
      ],
      total: 2,
    });
  const titles = () => screen.getAllByRole("link", { name: /^Build \d+$/ }).map((link) => link.textContent);
  const head = (name: RegExp) => screen.getByRole("columnheader", { name });
  const query = () => new URLSearchParams(address.split("?")[1]);

  it("every drawn column's head is a button when the whole list is loaded", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    const heads = screen.getAllByRole("columnheader");
    expect(heads.length).toBe(10);
    for (const cell of heads) expect(within(cell).queryByRole("button")).toBeTruthy();
  });

  it("with more pages to load, only Reproductions, Last confirmed, Rebuilds, Steps, Sessions and Published are buttons; the rest are text", async () => {
    many(true);
    localStorage.setItem("builds:layout:v1", JSON.stringify({ columns: ["build", "field", "steps", "sessions", "reproductions", "confirmed", "rebuilds", "published", "skill"], calculations: [] }));
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    const buttons = screen.getAllByRole("columnheader").filter((cell) => within(cell).queryByRole("button")).map((cell) => cell.textContent?.replace(/[↑↓2]/g, ""));
    expect(buttons).toEqual(["Steps", "Sessions", "Reproductions", "Confirmed", "Rebuilds", "Published"]);
  });

  it("pressing Field (whole list loaded) writes by=field and reorders the rows without asking the list again", async () => {
    withFields();
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    expect(titles()).toEqual(["Build 1", "Build 2"]);
    const asked = listBuildsTable.mock.calls.length;
    fireEvent.click(within(head(/^Field/)).getByRole("button"));
    await waitFor(() => expect(query().get("by")).toBe("field"));
    expect(titles()).toEqual(["Build 2", "Build 1"]);
    expect(listBuildsTable.mock.calls.length).toBe(asked);
  });

  it("pressing it again writes dir=asc; a third press clears by and dir", async () => {
    withFields();
    renderAt("/builds?by=field");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(within(head(/^Field/)).getByRole("button"));
    await waitFor(() => expect(query().get("dir")).toBe("asc"));
    expect(titles()).toEqual(["Build 1", "Build 2"]);
    fireEvent.click(within(head(/^Field/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds"));
  });

  it("pressing Steps writes sort=steps and asks the list; again, dir=asc; a third press returns to the default sort", async () => {
    listBuildsTable.mockResolvedValue({ countsLive: true, builds: [build(1), build(2)], total: 2 });
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(within(head(/^Steps/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds?sort=steps"));
    await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "steps", ascending: false })));
    fireEvent.click(within(head(/^Steps/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds?sort=steps&dir=asc"));
    await waitFor(() => expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "steps", ascending: true })));
    fireEvent.click(within(head(/^Steps/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds"));
  });

  it("pressing Reproductions, the default sort, only flips the direction", async () => {
    renderAt("/builds");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(within(head(/^Reproductions/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds?dir=asc"));
    fireEvent.click(within(head(/^Reproductions/)).getByRole("button"));
    await waitFor(() => expect(address).toBe("/builds"));
  });

  it("aria-sort is descending, ascending or none on each head, and the arrow matches", async () => {
    withFields();
    renderAt("/builds?by=field&dir=asc");
    await screen.findByRole("link", { name: "Build 1" });
    expect(head(/^Field/).getAttribute("aria-sort")).toBe("ascending");
    expect(head(/^Field/).textContent).toContain("↑");
    for (const cell of screen.getAllByRole("columnheader").filter((entry) => !/^Field/.test(entry.textContent ?? ""))) {
      expect(cell.getAttribute("aria-sort")).toBe("none");
      expect(cell.textContent).not.toMatch(/[↑↓]/);
    }
  });

  it("an address with by=field while more pages exist draws no arrow on Field and sorts by the server's order", async () => {
    many();
    renderAt("/builds?by=field");
    await screen.findByRole("link", { name: "Build 1" });
    expect(head(/^Field/).getAttribute("aria-sort")).toBeNull();
    expect(head(/^Field/).textContent).not.toMatch(/[↑↓]/);
    expect(head(/^Reproductions/).getAttribute("aria-sort")).toBe("descending");
    expect(titles().slice(0, 3)).toEqual(["Build 1", "Build 2", "Build 3"]);
    expect(listBuildsTable).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "reproduced", ascending: false }));
  });

  it("with sort=newest and no Published column chosen, the Published column is drawn", async () => {
    renderAt("/builds?sort=newest");
    await screen.findByRole("link", { name: "Build 1" });
    expect(head(/^Published/).getAttribute("aria-sort")).toBe("descending");
  });
});

describe("BF-12 one sort control on the page", () => {
  it("the Sort menu and the heads never disagree", async () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    listBuildsTable.mockResolvedValue({ countsLive: true, builds: [build(1), build(2)], total: 2 });
    renderAt("/builds?sort=steps&dir=asc");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Steps" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Reproductions" }));
    await waitFor(() => expect(address).toBe("/builds"));
    fireEvent.keyDown(screen.getByRole("button", { name: "Sort: Reproductions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Steps" }));
    await waitFor(() => expect(address).toBe("/builds?sort=steps"));
    expect(screen.getByRole("columnheader", { name: /^Steps/ }).getAttribute("aria-sort")).toBe("descending");
  });
});

describe("BF-12 a second key with Shift", () => {
  const field = (id: string) => ({ ...emptyClassification(), declared: { ...emptyClassification().declared, field: [{ id }] } });
  const three = () =>
    listBuildsTable.mockResolvedValue({
      builds: [{ ...build(1), classifiedAs: field("education") }, { ...build(2), classifiedAs: field("law") }, { ...build(3), classifiedAs: field("education") }],
      total: 3,
    });
  const titles = () => screen.getAllByRole("link", { name: /^Build \d+$/ }).map((link) => link.textContent);
  const button = (name: RegExp) => within(screen.getByRole("columnheader", { name })).getByRole("button");
  const query = () => new URLSearchParams(address.split("?")[1]);

  it("Shift-pressing Reproductions while sorted by Field writes by2=reproductions and orders within each field", async () => {
    three();
    renderAt("/builds?by=field");
    await screen.findByRole("link", { name: "Build 1" });
    expect(titles()).toEqual(["Build 2", "Build 1", "Build 3"]);
    fireEvent.click(button(/^Reproductions/), { shiftKey: true });
    await waitFor(() => expect(query().get("by2")).toBe("reproductions"));
    expect(query().get("by")).toBe("field");
    expect(titles()).toEqual(["Build 2", "Build 3", "Build 1"]);
  });

  it('the second key\'s head shows its arrow followed by "2", and its aria-sort is "other"', async () => {
    three();
    renderAt("/builds?by=field&by2=reproductions");
    await screen.findByRole("link", { name: "Build 1" });
    const second = screen.getByRole("columnheader", { name: /^Reproductions/ });
    expect(second.getAttribute("aria-sort")).toBe("other");
    expect(second.textContent).toBe("Reproductions↓2");
    const sorted = screen.getAllByRole("columnheader").filter((cell) => ["ascending", "descending"].includes(cell.getAttribute("aria-sort") ?? ""));
    expect(sorted.map((cell) => cell.textContent)).toEqual(["Field↓"]);
  });

  it("Shift-press again flips it; a third clears it", async () => {
    three();
    renderAt("/builds?by=field&by2=reproductions");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(button(/^Reproductions/), { shiftKey: true });
    await waitFor(() => expect(query().get("dir2")).toBe("asc"));
    expect(titles()).toEqual(["Build 2", "Build 1", "Build 3"]);
    fireEvent.click(button(/^Reproductions/), { shiftKey: true });
    await waitFor(() => expect(address).toBe("/builds?by=field"));
  });

  it("a plain press on any head clears the second key", async () => {
    three();
    renderAt("/builds?by=field&by2=reproductions");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(button(/^Field/));
    await waitFor(() => expect(address).toBe("/builds?dir=asc&by=field"));
    fireEvent.click(button(/^Rebuilds/));
    await waitFor(() => expect(address).toBe("/builds?sort=rebuilt"));
  });

  it("with more pages to load, Shift-press does nothing", async () => {
    listBuildsTable.mockResolvedValue({ builds: Array.from({ length: 50 }, (_, at) => build(at + 1)), total: 120 });
    renderAt("/builds?sort=rebuilt");
    await screen.findByRole("link", { name: "Build 1" });
    fireEvent.click(button(/^Reproductions/), { shiftKey: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(address).toBe("/builds?sort=rebuilt");
  });

  it("Shift with Enter or Space on a focused head does the same as Shift-click", async () => {
    three();
    renderAt("/builds?by=field");
    await screen.findByRole("link", { name: "Build 1" });
    button(/^Reproductions/).focus();
    fireEvent.keyDown(button(/^Reproductions/), { key: "Enter", shiftKey: true });
    await waitFor(() => expect(query().get("by2")).toBe("reproductions"));
    fireEvent.keyDown(button(/^Reproductions/), { key: " ", shiftKey: true });
    await waitFor(() => expect(query().get("dir2")).toBe("asc"));
  });
});

describe("BF-14 match some conditions", () => {
  const THREE = "/builds?shape=app&pattern=router&rebuilds=1-";
  const candidates = () =>
    listBuildsTable.mockResolvedValue({
      builds: [
        { ...build(1), shape: "app", patterns: ["router"], rebuildCount: 0 },
        { ...build(2), shape: "agent", patterns: [], rebuildCount: 3 },
        { ...build(3), shape: "app", patterns: [], rebuildCount: 2 },
        { ...build(4), shape: "workflow", patterns: [], rebuildCount: 0 },
      ],
      total: 4,
    });
  const titles = () => screen.getAllByRole("link", { name: /^Build \d+$/ }).map((link) => link.textContent);

  it("with match unset, the list is asked exactly as before and no row is filtered in the browser", async () => {
    candidates();
    renderAt(THREE);
    await screen.findByRole("link", { name: "Build 1" });
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    expect(listBuildsTable.mock.calls[0][0]).toEqual({
      lens: "all", facets: [], tool: undefined, shapes: ["app"], pattern: "router", stillOpen: false, query: undefined, ranges: { rebuilds: { min: 1 } },
      confirmedWithin: undefined, confirmedState: undefined, worksOn: undefined, sort: "reproduced", ascending: false, offset: 0,
    });
    expect(titles()).toEqual(["Build 1", "Build 2", "Build 3", "Build 4"]);
  });

  it("with match=2 and three countable filters on, the list is asked with the lens and the required filters only, and the rows shown are those meeting at least two", async () => {
    candidates();
    renderAt(`${THREE}&match=2`);
    await screen.findByRole("link", { name: "Build 1" });
    expect(listBuildsTable).toHaveBeenCalledTimes(1);
    expect(listBuildsTable.mock.calls[0][0]).toMatchObject({ shapes: [], pattern: undefined, ranges: undefined, sort: "reproduced" });
    expect(titles()).toEqual(["Build 1", "Build 3"]);
  });

  it('the head reads "<shown> of <published> builds" from the rows shown', async () => {
    candidates();
    renderAt(`${THREE}&match=2`);
    await screen.findByRole("link", { name: "Build 1" });
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("2 of 120 builds"));
    expect(within(screen.getByRole("tablist", { name: "Lens" })).getByRole("tab", { name: /^All/ }).textContent).toContain("2");
  });

  it('when the lens holds more builds than one page, the Match control is disabled and a line says "Available when every build is loaded: <n> of <total> so far.", and Load all asks for the remaining pages', async () => {
    listBuildsTable.mockImplementation(async (options: { offset?: number }) => ({ builds: Array.from({ length: options.offset ? 20 : 50 }, (_, at) => ({ ...build((options.offset ?? 0) + at + 1), shape: "app", patterns: ["router"] })), total: 70 }));
    renderAt(`${THREE}&match=2`);
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    const select = screen.getByRole("combobox", { name: "Builds must match" }) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText("Available when every build is loaded: 50 of 70 so far.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load all" }));
    await waitFor(() => expect(listBuildsTable).toHaveBeenCalledWith(expect.objectContaining({ offset: 50, shapes: [] })));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Builds must match" }) as HTMLSelectElement).disabled).toBe(false));
  });

  it("past 200 builds the line says so and the control stays disabled", async () => {
    listBuildsTable.mockImplementation(async (options: { offset?: number }) => ({ builds: Array.from({ length: 50 }, (_, at) => ({ ...build((options.offset ?? 0) + at + 1), shape: "app" })), total: 260 }));
    renderAt(`${THREE}&match=2`);
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    expect((screen.getByRole("combobox", { name: "Builds must match" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText("Available when every build is loaded: these filters leave more than 200.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load all" })).toBeNull();
  });

  it("the dialog's footer shows the Match control only with two or more countable filters in the draft, and the match count follows it", async () => {
    candidates();
    const first = renderAt("/builds?shape=app&pattern=router");
    await screen.findByRole("link", { name: "Build 1" });
    await openFilters();
    const select = screen.getByRole("combobox", { name: "Builds must match" }) as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["All 2 filters", "At least 1 of 2"]);
    fireEvent.change(select, { target: { value: "1" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("2 builds match"));
    expect(address).toBe("/builds?shape=app&pattern=router");
    applyFilters();
    await waitFor(() => expect(new URLSearchParams(address.split("?")[1]).get("match")).toBe("1"));
    first.unmount();
    renderAt("/builds?shape=app");
    await openFilters();
    expect(screen.queryByRole("combobox", { name: "Builds must match" })).toBeNull();
  });

  it('each chip of a countable filter is unchanged; one extra chip reads "Match · at least 2 of 3" and removing it returns to All', async () => {
    candidates();
    renderAt(`${THREE}&match=2`);
    await screen.findByRole("link", { name: "Build 1" });
    expect(screen.getByRole("button", { name: "Remove filter Shape" })).toBeTruthy();
    const chip = screen.getByRole("button", { name: "Remove filter Match" }).parentElement as HTMLElement;
    expect(chip.textContent?.replace(/×/g, "").trim()).toMatch(/Match\s*at least 2 of 3/);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Match" }));
    await waitFor(() => expect(address).toBe(THREE));
  });
});
