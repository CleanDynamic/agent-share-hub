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
const openFilters = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Filters" }));
  return screen.getByRole("region", { name: "Filters" });
};

beforeEach(() => {
  vi.clearAllMocks();
  listGalleryFeed.mockResolvedValue(page(["a", "b"]));
  getGalleryFacets.mockResolvedValue({ roles: [], tools: [] });
  getClassificationFacets.mockResolvedValue({ live: true, counts: COUNTS });
  getBuildClassifications.mockResolvedValue({});
});

describe("Gallery filters: before the columns are live", () => {
  it("is exactly what it was: the Sort menu, no filters, no quick chips, no classification asked of the feed", async () => {
    getClassificationFacets.mockResolvedValue({ live: false, counts: {} });
    renderAt("/gallery?f=field:ai-ml");
    expect(await screen.findByTestId("feed-menu-sort")).toBeTruthy();
    await waitFor(() => expect(listGalleryFeed).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
    expect(screen.queryByTestId("quick-chips")).toBeNull();
    expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.not.objectContaining({ facets: expect.anything() }));
    expect(listGalleryFeed.mock.calls.every(([params]) => !("classified" in (params as object)) || (params as { classified?: boolean }).classified === undefined)).toBe(true);
    expect(getBuildClassifications).not.toHaveBeenCalled();
  });
});

describe("Gallery filters: with the columns live", () => {
  it("shows the two quick chips and no Sort menu, and says the order in the count line", async () => {
    renderAt("/gallery");
    const quick = await screen.findByTestId("quick-chips");
    expect(within(quick).getAllByRole("button").map((b) => b.textContent)).toEqual(["No coding", "Free plans are enough"]);
    expect(screen.queryByTestId("feed-menu-sort")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("feed-count")).toHaveTextContent("2 builds, newest first"));
  });

  it("opens the filters in the order Field, Task, What was built, Tools and stack, then a closed More filters", async () => {
    renderAt("/gallery");
    const panel = await openFilters();
    const headings = within(panel).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Field", "Task", "What was built", "Tools and stack"]);
    const more = within(panel).getByRole("button", { name: "More filters" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    const after = within(panel).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(after.slice(4)).toEqual(["Setting", "Role of AI", "Skill needed", "Cost to run"]);
    expect(within(panel).queryByRole("heading", { name: "Techniques" })).toBeNull();
  });

  it("shows counts, hides values with no builds, and shows Areas and Domains opening to their children", async () => {
    renderAt("/gallery");
    const panel = await openFilters();
    const field = within(panel).getByRole("region", { name: "Field" });
    expect(within(field).getByRole("button", { name: /^AI and machine learning/ }).textContent).toContain("5");
    expect(within(field).getByRole("button", { name: /^Medicine and health/ }).textContent).toContain("2");
    expect(within(field).queryByRole("button", { name: /^Law/ })).toBeNull();
    expect(within(field).queryByRole("button", { name: /^Retrieval systems/ })).toBeNull();
    fireEvent.click(within(field).getByRole("button", { name: "Show what is under AI and machine learning" }));
    expect(within(field).getByRole("button", { name: /^Retrieval systems/ }).textContent).toContain("3");
    fireEvent.click(within(field).getByRole("button", { name: "Show what is under Retrieval systems" }));
    expect(within(field).getByRole("button", { name: /^Hybrid search/ }).textContent).toContain("2");
    const task = within(panel).getByRole("region", { name: "Task" });
    expect(within(task).getByRole("button", { name: /^Create/ })).toBeTruthy();
    expect(within(task).queryByRole("button", { name: /^Writing/ })).toBeNull();
    fireEvent.click(within(task).getByRole("button", { name: "Show what is under Create" }));
    expect(within(task).getByRole("button", { name: /^Writing/ })).toBeTruthy();
  });

  it("shows the top 6 values and then Show all", async () => {
    const many: Record<string, number> = {};
    ["web-app", "mobile-app", "game", "dataset", "video", "audio", "presentation", "image-set"].forEach((id, i) => {
      many[`built:${id}`] = 10 - i;
    });
    getClassificationFacets.mockResolvedValue({ live: true, counts: many });
    renderAt("/gallery");
    const panel = await openFilters();
    const built = within(panel).getByRole("region", { name: "What was built" });
    expect(within(built).getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"))).toHaveLength(6);
    fireEvent.click(within(built).getByRole("button", { name: "Show all What was built" }));
    expect(within(built).getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"))).toHaveLength(8);
    expect(within(built).getByRole("button", { name: "Show fewer What was built" })).toBeTruthy();
  });

  it("searches Tools and stack inside its own box", async () => {
    renderAt("/gallery");
    const panel = await openFilters();
    const stack = within(panel).getByRole("region", { name: "Tools and stack" });
    expect(within(stack).getByRole("button", { name: /^Python/ })).toBeTruthy();
    fireEvent.change(within(stack).getByRole("searchbox", { name: "Search Tools and stack" }), { target: { value: "stat" } });
    expect(within(stack).getByRole("button", { name: /^Stata/ })).toBeTruthy();
    expect(within(stack).queryByRole("button", { name: /^Python/ })).toBeNull();
  });

  it("writes the address and asks the feed: an OR within a facet, an AND across facets", async () => {
    renderAt("/gallery");
    const panel = await openFilters();
    const field = within(panel).getByRole("region", { name: "Field" });
    fireEvent.click(within(field).getByRole("button", { name: /^AI and machine learning/ }));
    await waitFor(() => expect(address()).toBe("/gallery?f=field:ai-ml"));
    fireEvent.click(within(field).getByRole("button", { name: /^Medicine and health/ }));
    fireEvent.click(within(screen.getByTestId("quick-chips")).getByRole("button", { name: "No coding" }));
    await waitFor(() => expect(address()).toBe("/gallery?f=field:ai-ml&f=field:medicine&f=skill:no-coding"));
    expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["field:ai-ml", "field:medicine", "skill:no-coding"], classified: true }));
    expect(within(screen.getByTestId("feed-active-filters")).getByRole("button", { name: "Remove Field: AI and machine learning" })).toBeTruthy();
    fireEvent.click(within(screen.getByTestId("feed-active-filters")).getByRole("button", { name: "Remove Skill needed: No coding" }));
    await waitFor(() => expect(address()).toBe("/gallery?f=field:ai-ml&f=field:medicine"));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(address()).toBe("/gallery"));
  });

  it("reads facets from a link, and drops one the lists do not know", async () => {
    renderAt("/gallery?f=skill:no-coding&f=skill:nope&f=cost:free-plans-are-enough");
    await waitFor(() => expect(address()).toBe("/gallery?f=skill:no-coding&f=cost:free-plans-are-enough"));
    await waitFor(() => expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.objectContaining({ facets: ["skill:no-coding", "cost:free-plans-are-enough"] })));
    expect(within(screen.getByTestId("quick-chips")).getByRole("button", { name: "No coding" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Gallery cards: two lines and the Regulated area tag", () => {
  it("draws the lines under the build line, and the tag beside the title, for a classified build only", async () => {
    const c: Classification = {
      ...emptyClassification(),
      declared: { ...emptyClassification().declared, field: [{ id: "law.contracts" }], task: [{ id: "assess.reviewing-and-critiquing", primary: true }], setting: [{ id: "work.small-business" }] },
      derived: { built: { values: ["web-app"], from: [] }, role: { values: ["made-with-ai"], from: [] }, skill: { values: ["no-coding"], from: [] }, stack: { values: ["ai-applications.claude", "languages.python", "applications.stata"], from: [] } },
    };
    getBuildClassifications.mockResolvedValue({ a: c });
    renderAt("/gallery");
    const lines = await screen.findAllByText("Claude + Python · Web app · Made with AI · No coding");
    expect(lines).toHaveLength(1);
    expect(screen.getByText("Contracts · Reviewing and critiquing · Small business")).toBeTruthy();
    expect(screen.getAllByText("Regulated area")).toHaveLength(1);
    expect(screen.getAllByTestId("feed-build-title")).toHaveLength(2);
    expect(document.querySelectorAll("[data-card-part='classification']")).toHaveLength(1);
  });
});
