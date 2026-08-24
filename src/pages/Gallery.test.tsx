// Acceptance cover for the gallery page.
//
// The two claims worth a test here are both about REQUEST COUNT, because that
// is the thing this page was built to get right and the thing that silently
// regresses: a card that resolves its own media, a filter that reads everything
// and narrows it in the browser, a facet list recomputed on every click. So the
// data layer is stubbed and the calls are counted.
//
// The card bodies have their own file. This one is about the page around them.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGallery = vi.fn();
const getGalleryFacets = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    listGallery: (options: unknown) => listGallery(options),
    getGalleryFacets: () => getGalleryFacets(),
  };
});

/** Every signing call, so a card that signs its own media is visible here. */
const createSignedUrls = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls }) },
  },
}));

import Gallery from "@/pages/Gallery";

function build(over: Record<string, unknown> = {}) {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "inbox-triage",
    title: "Inbox triage agent",
    outcome: "Triages an inbox in under a minute.",
    shape: "app",
    status: "published",
    made_for: ["lawyer"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    completeness: 82,
    reproduction_count: 4,
    last_confirmed_at: "2026-08-20T00:00:00Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T00:00:00Z",
    nodes: [],
    media: [],
    ...over,
  };
}

const FACETS = {
  roles: [
    { value: "lawyer", count: 3, label: null, logo_url: null },
    { value: "designer", count: 1, label: null, logo_url: null },
  ],
  tools: [{ value: "Claude", count: 4, label: "Claude", logo_url: null }],
};

function renderGallery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/gallery"]}>
          <Gallery />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

describe("the gallery page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSignedUrls.mockResolvedValue({ data: [], error: null });
    getGalleryFacets.mockResolvedValue(FACETS);
    listGallery.mockResolvedValue({ builds: [build()], total: 1 });
  });

  // ACCEPTANCE 5
  it("issues two requests on load: one page of builds, one set of facets", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    expect(listGallery).toHaveBeenCalledTimes(1);
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    // No media on these builds, so nothing is signed either. A card resolving
    // its own media would show up here as a third call and then some.
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("signs every card's media in one call, not one call per card", async () => {
    const withMedia = (id: string) =>
      build({
        id,
        slug: id,
        title: `Build ${id}`,
        hero_node_id: `n-${id}`,
        media: [
          {
            id: `m-${id}`,
            node_id: `n-${id}`,
            bucket: "build-media",
            path: `${id}/hero.png`,
            kind: "image",
            width: 800,
            height: 600,
          },
        ],
      });

    listGallery.mockResolvedValue({
      builds: [withMedia("one"), withMedia("two"), withMedia("three")],
      total: 3,
    });

    renderGallery();
    await screen.findByText("Build one");

    await waitFor(() => expect(createSignedUrls).toHaveBeenCalledTimes(1));
    expect(createSignedUrls.mock.calls[0][0]).toEqual([
      "one/hero.png",
      "three/hero.png",
      "two/hero.png",
    ]);
  });

  // ACCEPTANCE 4
  it("applies a Made for filter in the query, one request per change", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");
    expect(listGallery).toHaveBeenCalledTimes(1);
    expect(listGallery.mock.calls[0][0]).toMatchObject({ madeFor: [], madeWith: [] });

    listGallery.mockResolvedValue({ builds: [], total: 0 });
    fireEvent.click(screen.getByRole("button", { name: /lawyer/i }));

    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));
    expect(listGallery.mock.calls[1][0]).toMatchObject({ madeFor: ["lawyer"] });

    // ONE request, and it was the builds query. The facets are the options,
    // not the results, so they are not refetched when a filter changes.
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    await screen.findByText(/Nothing matches those filters yet/i);
  });

  it("narrows and then widens again, and both filters combine", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    fireEvent.click(screen.getByRole("button", { name: /lawyer/i }));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: /Claude/i }));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(3));
    expect(listGallery.mock.calls[2][0]).toMatchObject({
      madeFor: ["lawyer"],
      madeWith: ["Claude"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(4));
    expect(listGallery.mock.calls[3][0]).toMatchObject({ madeFor: [], madeWith: [] });
  });

  it("puts both filters at the top of the page rather than behind a menu", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // Open, on the page, with their counts — not inside a disclosure.
    expect(screen.getByText("Made for")).toBeInTheDocument();
    expect(screen.getByText("Made with")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lawyer/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("leads each card with the reproduction count and the freshness line", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // Scoped by the figure's own explanation, because a facet chip also
    // carries a count and the assertion must be about the card.
    const figure = screen.getByTitle(/4 people other than the creator ran this/i);
    expect(figure).toHaveTextContent("4");
    expect(figure).toHaveTextContent("REPRODUCTIONS");
    expect(
      screen.getByText(/last confirmed working .* on Sonnet 4\.5/i)
    ).toBeInTheDocument();
  });

  it("says so plainly when a build has never been confirmed", async () => {
    listGallery.mockResolvedValue({
      builds: [build({ reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null })],
      total: 1,
    });
    renderGallery();

    expect(await screen.findByText("not confirmed by anyone yet")).toBeInTheDocument();
    // Zero is shown. A reader must be able to tell "nobody yet" from silence.
    expect(screen.getByTitle(/Nobody other than the creator/i)).toHaveTextContent("0");
  });

  it("surfaces a failed load instead of an empty grid", async () => {
    listGallery.mockRejectedValue(new Error("column does not exist"));
    renderGallery();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });

  it("invites a first build when there is nothing and nothing is filtered", async () => {
    listGallery.mockResolvedValue({ builds: [], total: 0 });
    renderGallery();
    expect(await screen.findByText(/Nothing here yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Write one up/i })).toHaveAttribute(
      "href",
      "/compose/new"
    );
  });
});
