// UI-P49 — the Gallery's container, as the feed: the address is the state, each
// list pages on its own, and the page never asks for the stats or the lens
// counts it no longer shows.
//
// The data layer is stubbed and its calls are counted: what is claimed is which
// requests a filter and "Show more" make, and what the address says after.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGalleryFeed = vi.fn();
const getGalleryFacets = vi.fn();
const countGalleryLenses = vi.fn();
const getGalleryStats = vi.fn();
const listGalleryDashboard = vi.fn();

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
  countGalleryLenses: () => countGalleryLenses(),
  getGalleryStats: () => getGalleryStats(),
  listGalleryDashboard: (params: unknown) => listGalleryDashboard(params),
}));
vi.mock("@/lib/build/sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/sessions")>()),
  countDraftBuilds: async () => 0,
}));
vi.mock("@/components/connect/ConnectorDialog", () => ({ useConnectorDialog: () => ({ open: vi.fn() }) }));

import { DASHBOARD_FIXTURE_ROWS } from "@/dev/fixtures/gallery-dashboard";
import type { GalleryFeed, GalleryFeedRow } from "@/lib/build/gallery";
import { MODEL_VERSIONS } from "@/lib/models/registry";

import { GalleryPage } from "./GalleryPage";

const SONNET = MODEL_VERSIONS.find((version) => version.id === "sonnet-5-5")!;
const COUNTS = { all: 12, byModel: { "sonnet-5-5": 4 } };

function row(id: string, over: Partial<GalleryFeedRow> = {}): GalleryFeedRow {
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
    last_confirmed_model: "GPT-6 Astra",
    published_at: new Date().toISOString(),
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
    models_used: ["claude-sonnet-5-5"],
    creatorHandle: "maria",
    proof: [{ modelId: "gpt-6-astra", modelName: "GPT-6 Astra", worked: 3, lastConfirmedAt: new Date().toISOString() }],
    ...over,
  };
}

const allPage = (ids: string[], hasMore = false, total = ids.length): GalleryFeed => ({
  kind: "all",
  model: null,
  rows: ids.map((id) => row(id)),
  hasMore,
  counts: COUNTS,
  total,
});

const modelPage = (on: string[], not: string[], more: { on?: boolean; not?: boolean } = {}): GalleryFeed => ({
  kind: "model",
  model: SONNET,
  reproducedOn: on.map((id) =>
    row(id, { proof: [{ modelId: "sonnet-5-5", modelName: "Sonnet 5.5", worked: 5, lastConfirmedAt: new Date().toISOString() }] }),
  ),
  notYet: not.map((id) => row(id)),
  hasMoreReproducedOn: more.on ?? false,
  hasMoreNotYet: more.not ?? false,
  counts: COUNTS,
  totalReproducedOn: 4,
  totalNotYet: 8,
});

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
  listGalleryDashboard.mockResolvedValue(DASHBOARD_FIXTURE_ROWS);
  listGalleryFeed.mockResolvedValue(allPage(["a", "b", "c"]));
  getGalleryFacets.mockResolvedValue({
    roles: [
      { value: "lawyers", count: 12, label: null, logo_url: null },
      { value: "designers", count: 4, label: null, logo_url: null },
    ],
    tools: [],
  });
});

describe("GalleryPage — the feed", () => {
  it("loads one page of the feed, never the stats or the lens counts, and says how many and in what order", async () => {
    renderAt("/gallery");
    expect(await screen.findByRole("heading", { level: 1, name: "Gallery" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("feed-count")).toHaveTextContent("3 builds, newest first"));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Build a", "Build b", "Build c"]);
    expect(listGalleryFeed).toHaveBeenCalledTimes(1);
    expect(listGalleryFeed).toHaveBeenCalledWith({ model: undefined, audience: undefined, sort: "newest", q: undefined, page: 0 });
    expect(countGalleryLenses).not.toHaveBeenCalled();
    expect(getGalleryStats).not.toHaveBeenCalled();
    // The credit: the maker's profile, and the models by name.
    expect(screen.getAllByRole("link", { name: "@maria" })[0]).toHaveAttribute("href", "/profile/maria");
    expect(screen.getAllByTestId("row-credit")[0]).toHaveTextContent("by @maria · made with Sonnet 5.5");
  });

  it("reads view, model, for, sort and q from the address and drops the old lens and facets", async () => {
    listGalleryFeed.mockResolvedValue(modelPage(["a"], ["b"]));
    renderAt("/gallery?lens=proven&with=Claude&shape=agent&for=lawyers&model=sonnet-5-5&sort=reproduced&q=inbox");
    await waitFor(() => expect(address()).toBe("/gallery?for=lawyers&model=sonnet-5-5&sort=reproduced&q=inbox"));
    expect(listGalleryFeed).toHaveBeenLastCalledWith({ model: "sonnet-5-5", audience: "lawyers", sort: "reproduced", q: "inbox", page: 0 });
  });

  it("with a model, splits the list into reproduced-on and not-yet, and the plaques speak for that model", async () => {
    listGalleryFeed.mockResolvedValue(modelPage(["on1"], ["not1"]));
    renderAt("/gallery?model=sonnet-5-5");

    const on = await screen.findByTestId("feed-section-reproduced");
    const not = screen.getByTestId("feed-section-not-yet");
    expect(within(on).getByRole("heading", { level: 2 })).toHaveTextContent("Reproduced on Sonnet 5.5 · 4");
    expect(within(not).getByRole("heading", { level: 2 })).toHaveTextContent("Not yet reproduced on Sonnet 5.5 · 8");
    expect(within(on).getByText("5 reproduced")).toBeInTheDocument();
    expect(within(on).getAllByText(/, on Sonnet 5\.5/).length).toBeGreaterThan(0);
    expect(within(not).getByText("not yet reproduced")).toBeInTheDocument();
    expect(screen.getByTestId("feed-count")).toHaveTextContent("4 of 12 builds reproduced on Sonnet 5.5, newest first");
    expect(screen.getByRole("button", { name: "Remove Proof on Sonnet 5.5" })).toBeInTheDocument();
  });

  it("pages each list on its own: Show more under one asks for the next page and takes only its rows", async () => {
    listGalleryFeed.mockImplementation(async ({ page }: { page: number }) =>
      page === 0 ? modelPage(["on1"], ["not1"], { on: true, not: true }) : modelPage(["on2"], ["not2"]),
    );
    renderAt("/gallery?model=sonnet-5-5");

    const on = await screen.findByTestId("feed-section-reproduced");
    fireEvent.click(within(on).getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(within(on).getAllByRole("heading", { level: 3 })).toHaveLength(2));
    expect(listGalleryFeed).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));

    const not = screen.getByTestId("feed-section-not-yet");
    expect(within(not).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Build not1"]);
    expect(within(not).getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("the switch writes view=dashboard and shows the dashboard's table; Feed brings the feed back", async () => {
    renderAt("/gallery");
    fireEvent.click(await screen.findByRole("radio", { name: "Dashboard" }));
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard"));
    expect(await screen.findByRole("table", { name: "Builds" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dashboard" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByTestId("gallery-feed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Feed" }));
    await waitFor(() => expect(address()).toBe("/gallery"));
    expect(await screen.findByTestId("gallery-feed")).toBeInTheDocument();
  });

  it("on a phone, view=dashboard shows the feed and keeps the address", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    try {
      renderAt("/gallery?view=dashboard");
      expect(await screen.findByTestId("gallery-feed")).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: "Builds" })).not.toBeInTheDocument();
      expect(listGalleryDashboard).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("writes the search 300ms after typing stops, and Clear all keeps the sort", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAt("/gallery?sort=rebuilt&for=lawyers");
      const field = await screen.findByRole("searchbox", { name: "Search the gallery" });
      fireEvent.change(field, { target: { value: "inbox" } });
      expect(address()).toBe("/gallery?for=lawyers&sort=rebuilt");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      await waitFor(() => expect(address()).toBe("/gallery?for=lawyers&sort=rebuilt&q=inbox"));

      fireEvent.click(await screen.findByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(address()).toBe("/gallery?sort=rebuilt"));
      expect(screen.getByRole("searchbox", { name: "Search the gallery" })).toHaveValue("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says nobody has hung a build for the search yet, with the way to ask for it", async () => {
    listGalleryFeed.mockResolvedValue(allPage([]));
    renderAt("/gallery?q=zzzz");
    expect(await screen.findByText("Nobody has hung a build for “zzzz” yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask for it on Bounties" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(address()).toBe("/gallery"));
  });

  it("says That didn't load. when the read fails, and a retry asks again", async () => {
    listGalleryFeed.mockRejectedValue(new Error("boom"));
    renderAt("/gallery");
    expect(await screen.findByText("That didn't load.")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again|retry/i }));
    await waitFor(() => expect(listGalleryFeed).toHaveBeenCalledTimes(2));
  });
});

describe("GalleryPage — the dashboard", () => {
  it("asks the data layer with the address's filters and keeps the sidebar counts unfiltered", async () => {
    renderAt("/gallery?view=dashboard&lab=Google&report=multi&active=30&dsort=prompts&q=inbox");
    await screen.findByRole("table", { name: "Builds" });
    expect(listGalleryDashboard).toHaveBeenCalledWith(undefined);
    expect(listGalleryDashboard).toHaveBeenCalledWith({ lab: "Google", activeWithinDays: 30, report: "multi", q: "inbox" });
    expect(screen.getByTestId("dash-pill")).toHaveTextContent("Google models");
    expect(screen.getByTestId("dash-lab-Google")).toHaveTextContent("3");
    expect(address()).toBe("/gallery?view=dashboard&lab=Google&report=multi&active=30&dsort=prompts&q=inbox");
  });

  it("writes each control to the address, and a lab clears the model", async () => {
    renderAt("/gallery?view=dashboard&model=opus-5-5");
    await screen.findByRole("table", { name: "Builds" });
    expect(screen.getByTestId("dash-pill")).toHaveTextContent("Made with Opus 5.5");

    fireEvent.click(screen.getByTestId("dash-lab-OpenAI"));
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard&lab=OpenAI"));
    fireEvent.click(screen.getByTestId("dash-report-multi"));
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard&lab=OpenAI&report=multi"));
    fireEvent.click(screen.getByTestId("dash-lab-OpenAI"));
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard&report=multi"));
    fireEvent.click(screen.getByTestId("dash-nav-makers"));
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard&tab=makers&report=multi"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Makers");
  });

  it("drops what the dashboard cannot read from the address", async () => {
    renderAt("/gallery?view=dashboard&sort=rebuilt&dsort=nonsense");
    await screen.findByRole("table", { name: "Builds" });
    await waitFor(() => expect(address()).toBe("/gallery?view=dashboard"));
  });
});
