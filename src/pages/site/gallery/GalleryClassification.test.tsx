// CA-16 P6, the Gallery with the classification filters: drawn only once `classification_facets` answers, in the order
// the prompt gives, with the two quick chips, no Sort menu, the address as the state, and two lines on a card.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGalleryFeed = vi.fn();
const getGalleryFacets = vi.fn();
const getClassificationFacets = vi.fn();
const getBuildClassifications = vi.fn();
const getBuildTries = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false, loading: false }) }));
vi.mock("@/lib/profile/searchMakers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/searchMakers")>()),
  searchMakers: async () => [],
}));
vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getGalleryFacets: () => getGalleryFacets(),
}));
vi.mock("@/lib/build/gallery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/gallery")>()),
  listGalleryFeed: (params: unknown) => listGalleryFeed(params),
  getClassificationFacets: () => getClassificationFacets(),
  getBuildClassifications: (ids: unknown) => getBuildClassifications(ids),
  getBuildTries: (ids: unknown) => getBuildTries(ids),
}));
vi.mock("@/lib/build/sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/sessions")>()),
  countDraftBuilds: async () => 0,
}));
vi.mock("@/components/connect/ConnectorDialog", () => ({ useConnectorDialog: () => ({ open: vi.fn() }) }));

import type { GalleryFeed, GalleryFeedRow } from "@/lib/build/gallery";
import { emptyClassification } from "@/lib/classify/facets";
import type { Classification } from "@/lib/classify/types";

import { GalleryPage } from "./GalleryPage";

const COUNTS = {
  "field:ai-ml": 5,
  "field:ai-ml.retrieval": 3,
  "field:ai-ml.retrieval.hybrid-search": 2,
  "field:medicine": 2,
  "field:medicine.dentistry": 2,
  "task:create": 4,
  "task:create.writing": 4,
  "built:web-app": 4,
  "built:dataset": 1,
  "stack:languages": 2,
  "stack:languages.python": 2,
  "stack:applications.stata": 1,
  "skill:no-coding": 5,
  "skill:some-setup": 1,
  "cost:free-plans-are-enough": 2,
  "setting:education": 1,
  "setting:education.lecturer": 1,
  "role:made-with-ai": 6,
  "field:education": 3,
  "setting:research": 2,
  "built:autonomous-agent": 1,
};

function row(id: string): GalleryFeedRow {
  return {
    id,
    creator_id: "c1",
    slug: `build-${id}`,
    title: `Build ${id}`,
    outcome: "It works.",
    shape: "agent",
    status: "published",
    made_for: [],
    made_with: ["Claude"],
    models_used: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 1,
    last_confirmed_at: new Date().toISOString(),
    last_confirmed_model: "Sonnet 5.5",
    published_at: new Date().toISOString(),
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    post_doc: null,
    nodes: [],
    media: [],
    bounties: [],
    creatorHandle: "maria",
    creatorName: "Maria",
    creatorAvatar: null,
    proof: [],
  } as unknown as GalleryFeedRow;
}

const page = (ids: string[]): GalleryFeed => ({ kind: "all", model: null, rows: ids.map(row), hasMore: false, counts: { all: ids.length, byModel: {} }, total: ids.length });

function Probe() {
  const { pathname, search } = useLocation();
  return <output data-testid="address">{decodeURIComponent(pathname + search)}</output>;
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
const filters = async () => within(await screen.findByRole("complementary", { name: "Filters" }));

beforeEach(() => {
  vi.clearAllMocks();
  listGalleryFeed.mockResolvedValue(page(["a", "b"]));
  getGalleryFacets.mockResolvedValue({ roles: [], tools: [] });
  getClassificationFacets.mockResolvedValue({ live: true, counts: COUNTS });
  getBuildClassifications.mockResolvedValue({});
  getBuildTries.mockResolvedValue({});
});

describe("Gallery filters: before the columns are live", () => {
  it("is exactly what it was: the Sort menu, no filters, no quick chips, no classification asked of the feed", async () => {
    getClassificationFacets.mockResolvedValue({ live: false, counts: {} });
    renderAt("/builds?f=field:ai-ml");
    expect(await screen.findByTestId("feed-menu-sort")).toBeTruthy();
    await waitFor(() => expect(listGalleryFeed).toHaveBeenCalled());
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(screen.queryByTestId("quick-chips")).toBeNull();
    expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.not.objectContaining({ facets: expect.anything() }));
    expect(listGalleryFeed.mock.calls.every(([params]) => !("classified" in (params as object)) || (params as { classified?: boolean }).classified === undefined)).toBe(true);
    expect(getBuildClassifications).not.toHaveBeenCalled();
  });
});

describe("Gallery board: the page, top to bottom", () => {
  it("heads the page with Gallery and the two quick filters at the right", async () => {
    renderAt("/builds");
    await screen.findByTestId("quick-chips");
    const heading = screen.getByRole("heading", { level: 1, name: "Gallery" });
    expect(heading.style.fontSize).toBe("22px");
    const quick = screen.getByTestId("quick-chips");
    expect(within(quick).getAllByRole("button").map((b) => b.textContent)).toEqual(["No coding", "Free plans are enough"]);
    expect(heading.compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("feed-menu-sort")).toBeNull();
  });

  it("has the search with the board's placeholder, then the tabs and the lens", async () => {
    renderAt("/builds");
    await screen.findByTestId("quick-chips");
    const search = screen.getByRole("searchbox", { name: "Search the gallery" }) as HTMLInputElement;
    expect(search.placeholder).toBe("Search builds, fields, tasks, tools. For example: NLP, Stata, marking, trading bot");
    expect(search.style.height).toBe("38px");
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All builds", "By field", "By task", "By what was built", "By technique"]);
    expect(screen.getByRole("tab", { name: "All builds" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "All builds" }).style.borderBottomWidth).toBe("2px");
    const lens = screen.getByRole("group", { name: "Lens" });
    expect(within(lens).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Proven", "Rebuilt", "Unsolved"]);
  });

  it("shows the collections that have builds, with their counts, and applies one as filters", async () => {
    renderAt("/builds");
    const collections = await screen.findByTestId("collections");
    const buttons = within(collections).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "AI for teachersMarking, lesson planning, presentations \u00B7 3 builds",
      "Research with AILiterature review, text analysis, statistics \u00B7 2 builds",
      "Runs on its ownAutonomous agents shown running \u00B7 1 build",
    ]);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(address()).toBe("/builds?f=field:education"));
    fireEvent.click(buttons[2]);
    await waitFor(() => expect(address()).toBe("/builds?f=field:education&f=built:autonomous-agent&f=built:multi-agent-system"));
  });

  it("hides a collection with no builds, and the whole row when none has any", async () => {
    getClassificationFacets.mockResolvedValue({ live: true, counts: { ...COUNTS, "field:education": 0, "setting:research": 0 } });
    renderAt("/builds");
    const collections = await screen.findByTestId("collections");
    expect(within(collections).getAllByRole("button").map((b) => b.textContent?.slice(0, 11))).toEqual(["Runs on its"]);
  });

  it("draws no collections row at all when none has builds", async () => {
    getClassificationFacets.mockResolvedValue({ live: true, counts: { "skill:no-coding": 5 } });
    renderAt("/builds");
    await screen.findByTestId("quick-chips");
    expect(screen.queryByTestId("collections")).toBeNull();
  });

  it("says the order the Gallery really uses", async () => {
    renderAt("/builds");
    await screen.findByTestId("quick-chips");
    expect(screen.getByTestId("feed-count")).toHaveTextContent("Proven builds first, then newest");
    await waitFor(() => expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "reproduced", classified: true })));
  });

  it("draws the filters in a 248 column in the order Field, Task, What was built, Tools and stack, then a closed More filters naming its groups", async () => {
    renderAt("/builds");
    const column = await screen.findByRole("complementary", { name: "Filters" });
    const f = within(column);
    expect(f.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["Field", "Task", "What was built", "Tools and stack", "More filters"]);
    for (const name of ["Field", "Task", "What was built", "Tools and stack"]) expect(f.getByRole("button", { name }).getAttribute("aria-expanded")).toBe("true");
    const more = f.getByRole("button", { name: "More filters" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(f.getByTestId("more-filters-line").textContent).toBe("Setting \u00B7 Role of AI \u00B7 Techniques \u00B7 Modality \u00B7 Build method \u00B7 Autonomy \u00B7 Data handled \u00B7 Skill needed \u00B7 Cost to run \u00B7 Age suitability");
    fireEvent.click(more);
    expect(f.queryByTestId("more-filters-line")).toBeNull();
    expect(f.getByRole("region", { name: "Setting" })).toBeTruthy();
    expect(f.getByRole("region", { name: "Role of AI" })).toBeTruthy();
    expect(f.queryByRole("region", { name: "Techniques" })).toBeNull();
  });

  it("uses checkboxes with counts, hides values with no builds, and opens Areas to their children", async () => {
    renderAt("/builds");
    const f = await filters();
    const field = f.getByRole("region", { name: "Field" });
    const ai = within(field).getByRole("checkbox", { name: "AI and machine learning" });
    expect(ai.closest("label")?.textContent).toContain("5");
    expect(within(field).queryByRole("checkbox", { name: "Law" })).toBeNull();
    expect(within(field).queryByRole("checkbox", { name: "Retrieval systems" })).toBeNull();
    fireEvent.click(within(field).getByRole("button", { name: "Show what is under AI and machine learning" }));
    expect(within(field).getByRole("checkbox", { name: "Retrieval systems" }).closest("label")?.textContent).toContain("3");
    expect(f.getByRole("region", { name: "Task" }).querySelectorAll("input[type=checkbox]").length).toBeGreaterThan(0);
  });

  it("shows the top 6 values and then a text link, Show all for What was built", async () => {
    const many: Record<string, number> = {};
    ["web-app", "mobile-app", "game", "dataset", "video", "audio", "presentation", "image-set"].forEach((id, i) => {
      many[`built:${id}`] = 10 - i;
    });
    getClassificationFacets.mockResolvedValue({ live: true, counts: many });
    renderAt("/builds");
    const f = await filters();
    const built = f.getByRole("region", { name: "What was built" });
    expect(within(built).getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.click(within(built).getByText("Show all"));
    expect(within(built).getAllByRole("checkbox")).toHaveLength(8);
    expect(within(built).getByText("Show fewer")).toBeTruthy();
  });

  it("opens the search box of Tools and stack from its link, and finds a tool in it", async () => {
    renderAt("/builds");
    const f = await filters();
    const stack = f.getByRole("region", { name: "Tools and stack" });
    expect(within(stack).queryByRole("searchbox")).toBeNull();
    fireEvent.click(within(stack).getByText("Search tools"));
    fireEvent.change(within(stack).getByRole("searchbox", { name: "Search Tools and stack" }), { target: { value: "stat" } });
    expect(within(stack).getByRole("checkbox", { name: "Stata" })).toBeTruthy();
    expect(within(stack).queryByRole("checkbox", { name: "Python" })).toBeNull();
  });

  it("writes the address and asks the feed: an OR within a facet, an AND across facets", async () => {
    renderAt("/builds");
    const f = await filters();
    fireEvent.click(f.getByRole("checkbox", { name: "AI and machine learning" }));
    await waitFor(() => expect(address()).toBe("/builds?f=field:ai-ml"));
    fireEvent.click(f.getByRole("checkbox", { name: "Medicine and health" }));
    fireEvent.click(within(screen.getByTestId("quick-chips")).getByRole("button", { name: "No coding" }));
    await waitFor(() => expect(address()).toBe("/builds?f=field:ai-ml&f=field:medicine&f=skill:no-coding"));
    expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["field:ai-ml", "field:medicine", "skill:no-coding"], classified: true }));
    fireEvent.click(within(screen.getByTestId("feed-active-filters")).getByRole("button", { name: "Remove Skill needed: No coding" }));
    await waitFor(() => expect(address()).toBe("/builds?f=field:ai-ml&f=field:medicine"));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(address()).toBe("/builds"));
  });

  it("reads facets and a tab from a link, and drops a facet the lists do not know", async () => {
    renderAt("/builds?f=skill:no-coding&f=skill:nope&f=cost:free-plans-are-enough&by=field");
    await waitFor(() => expect(address()).toBe("/builds?f=skill:no-coding&f=cost:free-plans-are-enough&by=field"));
    expect((await screen.findByRole("tab", { name: "By field" })).getAttribute("aria-selected")).toBe("true");
    expect(within(screen.getByTestId("quick-chips")).getByRole("button", { name: "No coding" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Gallery board: the items", () => {
  const classified: Classification = {
    ...emptyClassification(),
    declared: { ...emptyClassification().declared, field: [{ id: "law.contracts" }], task: [{ id: "assess.reviewing-and-critiquing", primary: true }], setting: [{ id: "work.small-business" }] },
    derived: { built: { values: ["web-app"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["no-coding"], from: [] }, stack: { values: ["ai-applications.claude", "languages.python", "applications.stata"], from: [] } },
  };

  it("reads author, title with the Regulated area tag, summary, the two lines and the proof line, with no cover", async () => {
    getBuildClassifications.mockResolvedValue({ a: classified });
    getBuildTries.mockResolvedValue({ a: { tried: 4, worked: 3 }, b: { tried: 2, worked: 1 } });
    renderAt("/builds");
    const items = await screen.findAllByTestId("board-item");
    expect(items).toHaveLength(2);
    const item = items[0];
    expect(within(item).getByText("Maria")).toBeTruthy();
    expect(within(item).getByText("@maria")).toBeTruthy();
    expect(within(item).getByTestId("feed-build-title").textContent).toBe("Build a");
    expect(within(item).getByText("Regulated area")).toBeTruthy();
    expect(within(item).getByText("It works.")).toBeTruthy();
    expect(within(item).getByText("Claude + Python \u00B7 Web app \u00B7 Made with AI \u00B7 No coding")).toBeTruthy();
    expect(within(item).getByText("Contracts \u00B7 Reviewing and critiquing \u00B7 Small business")).toBeTruthy();
    expect(within(item).getByTestId("board-proof").textContent).toBe("3 of 4 people got it working");
    expect(item.querySelector("img")).toBeNull();
    // the second build has no classification: no lines, no tag
    expect(within(items[1]).queryByText("Regulated area")).toBeNull();
    expect(items[1].querySelector("[data-card-part='classification-1']")).toBeNull();
  });

  it("draws the proof dot only when more than half got it working", async () => {
    getBuildTries.mockResolvedValue({ a: { tried: 4, worked: 3 }, b: { tried: 4, worked: 2 } });
    renderAt("/builds");
    const items = await screen.findAllByTestId("board-item");
    await waitFor(() => expect(within(items[0]).getByTestId("board-proof").textContent).toBe("3 of 4 people got it working"));
    expect(within(items[0]).queryByTestId("board-proof-dot")).not.toBeNull();
    expect(within(items[1]).getByTestId("board-proof").textContent).toBe("2 of 4 people got it working");
    expect(within(items[1]).queryByTestId("board-proof-dot")).toBeNull();
  });

  it("says Not yet reproduced when nobody has tried it", async () => {
    listGalleryFeed.mockResolvedValue({ ...page(["a"]), rows: [{ ...row("a"), reproduction_count: 0 }] });
    renderAt("/builds");
    const item = await screen.findByTestId("board-item");
    expect(within(item).getByTestId("board-proof").textContent).toBe("Not yet reproduced");
  });

  it("filters the loaded builds by the lens", async () => {
    listGalleryFeed.mockResolvedValue({ ...page(["a", "b"]), rows: [{ ...row("a"), reproduction_count: 3 }, { ...row("b"), reproduction_count: 0, rebuild_count: 2 }] });
    renderAt("/builds");
    await screen.findAllByTestId("board-item");
    fireEvent.click(within(screen.getByRole("group", { name: "Lens" })).getByRole("button", { name: "Rebuilt" }));
    await waitFor(() => expect(screen.getAllByTestId("board-item")).toHaveLength(1));
    expect(screen.getByTestId("feed-build-title").textContent).toBe("Build b");
    await waitFor(() => expect(address()).toBe("/builds?lens=rebuilt"));
  });
});

describe("Gallery board: the tabs", () => {
  it("groups the builds by the facet's top-level values, most first, each with its first three builds and Show all", async () => {
    listGalleryFeed.mockImplementation(async (params: { facets?: string[] }) => {
      const key = (params.facets ?? []).find((f) => f.startsWith("field:"));
      return key === "field:ai-ml" ? page(["a", "b", "c", "d"]) : key === "field:medicine" ? page(["e"]) : page(["a", "b"]);
    });
    renderAt("/builds?by=field");
    const groups = await screen.findByTestId("board-groups");
    const sections = await within(groups).findAllByTestId("board-group");
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual(["AI and machine learning", "Education", "Medicine and health"]);
    expect(within(sections[0]).getAllByTestId("board-item")).toHaveLength(3);
    expect(within(sections[0]).getByRole("button", { name: "Show all 5" })).toBeTruthy();
    expect(within(sections[1]).getAllByTestId("board-item")).toHaveLength(2);
    expect(within(sections[2]).getAllByTestId("board-item")).toHaveLength(1);
    expect(listGalleryFeed).toHaveBeenCalledWith(expect.objectContaining({ facets: ["field:ai-ml"] }));
  });

  it("keeps the filters inside a tab, and Show all chooses the value and returns to All builds", async () => {
    renderAt("/builds?by=task&f=skill:no-coding");
    const groups = await screen.findByTestId("board-groups");
    await within(groups).findAllByTestId("board-group");
    expect(listGalleryFeed).toHaveBeenCalledWith(expect.objectContaining({ facets: ["skill:no-coding", "task:create"] }));
    fireEvent.click(within(groups).getByRole("button", { name: "Show all 4" }));
    await waitFor(() => expect(address()).toBe("/builds?f=skill:no-coding&f=task:create"));
    expect(screen.queryByTestId("board-groups")).toBeNull();
  });

  it("writes the tab in the address and reads it back", async () => {
    renderAt("/builds");
    fireEvent.click(await screen.findByRole("tab", { name: "By technique" }));
    await waitFor(() => expect(address()).toBe("/builds?by=technique"));
    fireEvent.click(screen.getByRole("tab", { name: "All builds" }));
    await waitFor(() => expect(address()).toBe("/builds"));
  });
});

describe("Gallery board: narrower windows", () => {
  it("below 768 puts the filters behind a Filters button in a sheet, with one column", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    renderAt("/builds");
    expect(await screen.findByTestId("board-grid")).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(screen.getByTestId("board-grid").style.gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(await screen.findByRole("region", { name: "Field" })).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("below 1100 has two columns, and from 1100 three", async () => {
    const stub = (wide: boolean) => vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width: ?1100/.test(query) ? wide : /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    stub(false);
    const { unmount } = renderAt("/builds");
    expect((await screen.findByTestId("board-grid")).style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    unmount();
    stub(true);
    renderAt("/builds");
    expect((await screen.findByTestId("board-grid")).style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    vi.unstubAllGlobals();
  });
});
