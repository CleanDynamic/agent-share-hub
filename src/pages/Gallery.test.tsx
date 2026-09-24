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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGallery = vi.fn();
const getGalleryFacets = vi.fn();
const countOpenBountyBuilds = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    listGallery: (options: unknown) => listGallery(options),
    getGalleryFacets: () => getGalleryFacets(),
    countOpenBountyBuilds: () => countOpenBountyBuilds(),
  };
});

/**
 * Every signing call, with the transform it asked for.
 *
 * Signing is one call per image since NS-P31 — the transform has to be signed
 * into the token, so a batch call cannot carry one — which makes the thing
 * worth asserting the WIDTH rather than the count. A card serving originals is
 * the regression this guards, and it shows up here as a missing transform.
 */
const createSignedUrl = vi.fn();

/**
 * A LIVE `matchMedia`, replacing the flat `matches: false` in the shared setup.
 *
 * TWO THINGS MAKE THIS FIDDLIER THAN IT LOOKS, and both are properties of
 * `controls.ts` rather than of this test.
 *
 * It caches ONE MediaQueryList per query for the whole application, so
 * reassigning `window.matchMedia` between tests would be ignored the moment any
 * earlier render had already asked the same question. The object below answers
 * from a GETTER, so the cached list stays correct however many times the flag
 * moves.
 *
 * And the cache is filled at IMPORT time, not at render time: `tabsListStyle`
 * is a module-level const whose `transition` calls `uiTransition()`, which asks
 * about reduced motion while the module is still being evaluated. ES imports
 * are hoisted above every statement in this file, so a plain top-level
 * assignment here would land after `controls.ts` had already cached the setup's
 * inert object. `vi.hoisted` is what runs first.
 */
const motion = vi.hoisted(() => {
  const state = { reduced: false };
  Object.defineProperty(globalThis.window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query.includes("prefers-reduced-motion") ? state.reduced : false;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  return state;
});

/**
 * IntersectionObserver, which jsdom does not ship.
 *
 * HELD RATHER THAN AUTO-FIRING, so a test can assert the hidden state of the
 * grid BEFORE the reveal and the shown state after. Without that gap there is
 * no way to tell a stagger that ran from cards that were simply never hidden,
 * which is exactly the difference the reduced-motion claim turns on.
 */
class ObserverStub implements IntersectionObserver {
  static instances: ObserverStub[] = [];
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = 0;
  readonly thresholds: readonly number[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    ObserverStub.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Report everything this instance watches as on screen. */
  reveal() {
    this.callback(
      this.observed.map(
        (target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
      ),
      this,
    );
  }
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl }) },
  },
}));

/**
 * Who is looking.
 *
 * BG-P19 gave this page its first signed-in-only affordance — the shortfall
 * line on a creator's own below-threshold build — so the viewer is now part of
 * what the page renders and has to be controllable from a test. Reassigned per
 * test rather than re-mocked, which is the shape every other suite in this
 * codebase uses for `useAuth`.
 */
let auth: { user: { id: string } | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Gallery from "@/pages/Gallery";
import { CARD_MEDIA_WIDTH } from "@/components/gallery/cardMedia";
import { DEFAULT_MEDIA_QUALITY } from "@/lib/build";

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

/**
 * jsdom reports 1024, which is the first width at which the facet band is open.
 * `useBreakpoint` reads `innerWidth` on mount, so setting it before the render
 * is enough — no resize event is needed.
 */
function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

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
    setViewport(1024);
    auth = { user: null };
    motion.reduced = false;
    ObserverStub.instances = [];
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      ObserverStub;
    createSignedUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.test/${path}` },
      error: null,
    }));
    getGalleryFacets.mockResolvedValue(FACETS);
    countOpenBountyBuilds.mockResolvedValue(0);
    listGallery.mockResolvedValue({ builds: [build()], total: 1 });
  });

  // ACCEPTANCE 5
  it("issues two requests on load: one page of builds, one set of facets", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    expect(listGallery).toHaveBeenCalledTimes(1);
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    // NS-P52 adds one head request for the bounty chip's number, cached beside
    // the facets and never refetched on a filter change. One, not one per card.
    expect(countOpenBountyBuilds).toHaveBeenCalledTimes(1);
    // No media on these builds, so nothing is signed either. A card resolving
    // its own media would show up here as a third call and then some.
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  // NS-P31 ACCEPTANCE 2
  it("asks for every card image at card width, never the original", async () => {
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
            poster_path: null,
          },
        ],
      });

    listGallery.mockResolvedValue({
      builds: [withMedia("one"), withMedia("two"), withMedia("three")],
      total: 3,
    });

    renderGallery();
    await screen.findByText("Build one");

    // One image per card, and each one asked for at the card's own width. A
    // card that signed the same row twice, or asked for it without a
    // transform, fails here.
    await waitFor(() => expect(createSignedUrl).toHaveBeenCalledTimes(3));
    expect(createSignedUrl.mock.calls.map((call) => call[0]).sort()).toEqual([
      "one/hero.png",
      "three/hero.png",
      "two/hero.png",
    ]);
    for (const call of createSignedUrl.mock.calls) {
      expect(call[2]).toMatchObject({
        transform: { width: CARD_MEDIA_WIDTH, quality: DEFAULT_MEDIA_QUALITY },
      });
    }
  });

  // NS-P31 ACCEPTANCE 3
  it("leads a video card with its poster, not with the video", async () => {
    listGallery.mockResolvedValue({
      builds: [
        build({
          hero_node_id: "n1",
          media: [
            {
              id: "m1",
              node_id: "n1",
              bucket: "build-media",
              path: "b1/demo.mp4",
              kind: "video",
              width: 1920,
              height: 1080,
              poster_path: "b1/demo-poster.jpg",
            },
          ],
        }),
      ],
      total: 1,
    });

    renderGallery();
    await screen.findByText("Inbox triage agent");

    // The poster is signed at card width; the video file is never requested.
    await waitFor(() => expect(createSignedUrl).toHaveBeenCalledTimes(1));
    expect(createSignedUrl.mock.calls[0][0]).toBe("b1/demo-poster.jpg");
    expect(createSignedUrl.mock.calls[0][2]).toMatchObject({
      transform: { width: CARD_MEDIA_WIDTH },
    });
  });

  // ACCEPTANCE 4
  it("applies a Made for filter in the query, one request per change", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");
    expect(listGallery).toHaveBeenCalledTimes(1);
    expect(listGallery.mock.calls[0][0]).toMatchObject({ madeFor: [], madeWith: [] });

    listGallery.mockResolvedValue({ builds: [], total: 0 });
    fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));

    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));
    expect(listGallery.mock.calls[1][0]).toMatchObject({ madeFor: ["lawyer"] });

    // ONE request, and it was the builds query. The facets are the options,
    // not the results, so they are not refetched when a filter changes.
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    await screen.findByTestId("gallery-empty-filtered");
  });

  it("narrows and then widens again, and both filters combine", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId("facet-made-with-Claude"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(3));
    expect(listGallery.mock.calls[2][0]).toMatchObject({
      madeFor: ["lawyer"],
      madeWith: ["Claude"],
    });

    fireEvent.click(screen.getByTestId("gallery-clear-all"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(4));
    expect(listGallery.mock.calls[3][0]).toMatchObject({ madeFor: [], madeWith: [] });
  });

  // NS-P52 ACCEPTANCE 2
  it("filters to builds carrying an open bounty, in one request", async () => {
    countOpenBountyBuilds.mockResolvedValue(3);
    renderGallery();
    await screen.findByText("Inbox triage agent");
    expect(listGallery.mock.calls[0][0]).toMatchObject({ openBounties: false });

    const chip = screen.getByTestId("facet-bounties-open");
    expect(chip).toHaveTextContent("Open bounties");
    // The number is the size of the grid the chip produces, not the number of
    // asks: a reader is deciding about builds.
    await waitFor(() => expect(chip).toHaveTextContent("3"));

    fireEvent.click(chip);
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));
    expect(listGallery.mock.calls[1][0]).toMatchObject({ openBounties: true });
    expect(chip).toHaveAttribute("aria-pressed", "true");

    // The options are not the results: neither the facets nor the count is
    // refetched because a filter moved.
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    expect(countOpenBountyBuilds).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("gallery-clear-all"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(3));
    expect(listGallery.mock.calls[2][0]).toMatchObject({ openBounties: false });
  });

  it("puts a red bounty pill on a card with an open ask, and none on one without", async () => {
    listGallery.mockResolvedValue({
      builds: [
        build({
          id: "b1",
          slug: "asking",
          title: "Asking for help",
          bounties: [{ id: "bo1", reward_gbp: 120, status: "open" }],
        }),
        build({ id: "b2", slug: "settled", title: "Nothing outstanding", bounties: [] }),
      ],
      total: 2,
    });

    renderGallery();
    await screen.findByText("Asking for help");

    const pills = screen.getAllByTestId("gallery-card-bounty");
    expect(pills).toHaveLength(1);
    // BG-P09: the theme's words for a gap on a card. It has to read as an
    // invitation — the build works, one piece is missing on purpose — and
    // naming the missing piece is what says so.
    expect(pills[0]).toHaveTextContent("1 part unsolved · £120");
    // The pill rides in on the grid's own query: no card fetched anything.
    expect(listGallery).toHaveBeenCalledTimes(1);
  });

  it("says bounty without a price when the ask is unpriced", async () => {
    listGallery.mockResolvedValue({
      builds: [
        build({ bounties: [{ id: "bo1", reward_gbp: null, status: "open" }] }),
      ],
      total: 1,
    });

    renderGallery();
    const pill = await screen.findByTestId("gallery-card-bounty");
    // An unpriced gap is still a real open bounty: it keeps the invitation and
    // drops the price. See bountyDisplay.ts.
    expect(pill).toHaveTextContent("1 part unsolved");
    expect(pill).not.toHaveTextContent("£");
  });

  it("puts both filters at the top of the page rather than behind a menu", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // Open, on the page, with their counts — not inside a disclosure. At this
    // width (jsdom reports 1024) the band is open; the sheet is below it.
    expect(screen.getByText("Made for")).toBeInTheDocument();
    expect(screen.getByText("Made with")).toBeInTheDocument();
    expect(screen.queryByTestId("gallery-filters-trigger")).toBeNull();
    expect(screen.getByTestId("facet-made-for-lawyer")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("puts the reproduction count and the freshness line on every card", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // Scoped by the figure's own explanation, because a facet chip also
    // carries a count and the assertion must be about the card.
    //
    // BG-P09 made these two the PLAQUE: one object, always together, under the
    // title. The count reads "4 reproduced" as an --evidence-fill tag rather
    // than as the big figure in a right-hand rail it used to be — the theme's
    // own words for it, and the reason the title can now lead the card.
    const figure = screen.getByTitle(/4 people other than the creator ran this/i);
    expect(figure).toHaveTextContent("4 reproduced");
    expect(
      screen.getByText(/last confirmed working .* on Sonnet 4\.5/i)
    ).toBeInTheDocument();
    // Neither half may be rendered without the other.
    const plaque = figure.closest("[data-card-part='plaque']");
    expect(plaque).not.toBeNull();
    expect(plaque).toHaveTextContent(/last confirmed working/i);
  });

  it("says so plainly when a build has never been confirmed", async () => {
    listGallery.mockResolvedValue({
      builds: [build({ reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null })],
      total: 1,
    });
    renderGallery();

    expect(await screen.findByText("not confirmed by anyone yet")).toBeInTheDocument();
    // The zero state is SAID, not suppressed. A reader must be able to tell
    // "nobody yet" from silence, and BG-P09 says it in words rather than as a
    // nought — "not yet reproduced", which is the theme's third plaque state.
    expect(screen.getByTitle(/Nobody other than the creator/i)).toHaveTextContent(
      "not yet reproduced"
    );
    // And no lamp: an unlit lamp and a missing one say different things.
    expect(document.querySelector("[data-plaque-lamp]")).toBeNull();
  });

  // BG-P19 ACCEPTANCE 2
  it("shows every chosen facet as a removable chip, and clears them all at once", async () => {
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // Nothing chosen: no row, and nothing to clear.
    expect(screen.queryByTestId("gallery-selected-facets")).toBeNull();
    expect(screen.queryByTestId("gallery-clear-all")).toBeNull();

    fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));
    fireEvent.click(screen.getByTestId("facet-bounties-open"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(3));

    const chip = screen.getByTestId("selected-facet-made-for-lawyer");
    expect(chip).toHaveAttribute("aria-label", "Remove filter lawyer");
    expect(screen.getByTestId("selected-facet-bounties-open")).toBeInTheDocument();

    // One chip removes one facet and leaves the other in place.
    fireEvent.click(chip);
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(4));
    expect(listGallery.mock.calls[3][0]).toMatchObject({
      madeFor: [],
      openBounties: true,
    });
    expect(screen.queryByTestId("selected-facet-made-for-lawyer")).toBeNull();

    fireEvent.click(screen.getByTestId("gallery-clear-all"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(5));
    expect(listGallery.mock.calls[4][0]).toMatchObject({
      madeFor: [],
      madeWith: [],
      openBounties: false,
    });
    expect(screen.queryByTestId("gallery-selected-facets")).toBeNull();
  });

  // BG-P19 ACCEPTANCE 2 — the collapse
  it("collapses the band into a sheet below 1024, and filters the same way", async () => {
    setViewport(800);
    renderGallery();
    await screen.findByText("Inbox triage agent");

    // The band is gone; one control stands in for it.
    expect(screen.queryByText("Made for")).toBeNull();
    const trigger = screen.getByTestId("gallery-filters-trigger");

    fireEvent.click(trigger);
    // The same three groups, the same chips, the same one request per click.
    await screen.findByText("Made for");
    fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));
    await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(2));
    expect(listGallery.mock.calls[1][0]).toMatchObject({ madeFor: ["lawyer"] });
    expect(getGalleryFacets).toHaveBeenCalledTimes(1);
  });

  // BG-P19 ACCEPTANCE 3
  it("staggers the grid in once, and never again", async () => {
    listGallery.mockResolvedValue({
      builds: [build({ id: "a", slug: "a" }), build({ id: "b", slug: "b" })],
      total: 2,
    });

    renderGallery();
    await screen.findByTestId("gallery-grid");

    const cells = () =>
      Array.from(document.querySelectorAll('[data-visual-slot="gallery-grid-cell"]'));

    // Hidden and shifted until the observer says they are on screen, and the
    // second card carries a longer delay than the first — which is the stagger.
    expect(cells()).toHaveLength(2);
    for (const cell of cells()) {
      expect(cell).toHaveStyle({ opacity: "0" });
      expect(cell).not.toHaveAttribute("data-revealed");
    }

    for (const observer of ObserverStub.instances) observer.reveal();
    await waitFor(() => expect(cells()[0]).toHaveAttribute("data-revealed"));

    for (const cell of cells()) {
      expect(cell).toHaveStyle({ opacity: "1", transform: "none" });
    }
    // The theme's two figures, and the per-card step.
    expect(cells()[0].getAttribute("style")).toContain("450ms");
    expect(cells()[0].getAttribute("style")).toContain("0ms");
    expect(cells()[1].getAttribute("style")).toContain("50ms");
    // Once: every observer is torn down on the first intersection.
    expect(ObserverStub.instances.every((o) => o.disconnected)).toBe(true);

    // A filter change is not a first paint. The replacement cards arrive
    // already visible rather than fading in for a second time.
    listGallery.mockResolvedValue({
      builds: [build({ id: "c", slug: "c", title: "After the filter" })],
      total: 1,
    });
    const before = ObserverStub.instances.length;
    fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));
    await screen.findByText("After the filter");

    expect(ObserverStub.instances).toHaveLength(before);
    expect(cells()[0]).toHaveAttribute("data-revealed");
    expect(cells()[0].getAttribute("style")).toBeNull();
  });

  // BG-P19 ACCEPTANCE 3
  it("does not stagger at all under prefers-reduced-motion", async () => {
    motion.reduced = true;
    renderGallery();
    await screen.findByTestId("gallery-grid");

    const cell = document.querySelector('[data-visual-slot="gallery-grid-cell"]');
    // Not "animated to visible instantly" — never hidden, never observed, and
    // carrying no inline style at all. The card is simply there.
    expect(cell).toHaveAttribute("data-revealed");
    expect(cell?.getAttribute("style")).toBeNull();
    expect(ObserverStub.instances).toHaveLength(0);
  });

  // BG-P19 ACCEPTANCE 4
  describe("the shortfall line on a creator's own below-threshold build", () => {
    /* Promoted by an admin, which is the only way a build under its shape's
       threshold reaches this grid at all. 60 is under the app threshold of 72,
       and the two audience fields are the gap. */
    const promoted = () =>
      build({
        id: "mine",
        slug: "mine",
        title: "Promoted early",
        status: "gallery",
        creator_id: "c1",
        completeness: 60,
        made_for: [],
        made_with: [],
      });

    const LINE =
      "Only you can see this — to earn its place in the gallery, say who this is " +
      "for and list the models and tools this was made with.";

    it("names what is outstanding, in words and never as a score", async () => {
      auth = { user: { id: "c1" } };
      listGallery.mockResolvedValue({ builds: [promoted()], total: 1 });
      renderGallery();

      const note = await screen.findByTestId("gallery-shortfall");
      expect(note).toHaveTextContent(LINE);
      // No number anywhere in it: not the score, not the threshold, not a
      // count of what is left. The copy is the compose checklist's own.
      expect(note.textContent).not.toMatch(/\d/);
    });

    it("is invisible to a signed-out visitor", async () => {
      auth = { user: null };
      listGallery.mockResolvedValue({ builds: [promoted()], total: 1 });
      renderGallery();

      await screen.findByText("Promoted early");
      expect(screen.queryByTestId("gallery-shortfall")).toBeNull();
    });

    it("is invisible to a signed-in reader who is not the creator", async () => {
      auth = { user: { id: "someone-else" } };
      listGallery.mockResolvedValue({ builds: [promoted()], total: 1 });
      renderGallery();

      await screen.findByText("Promoted early");
      expect(screen.queryByTestId("gallery-shortfall")).toBeNull();
    });

    it("says nothing on the creator's own build that has cleared the bar", async () => {
      auth = { user: { id: "c1" } };
      // The default fixture is completeness 82 against an app threshold of 72.
      renderGallery();

      await screen.findByText("Inbox triage agent");
      expect(screen.queryByTestId("gallery-shortfall")).toBeNull();
    });

    it("stays silent rather than guessing when the row cannot see the gap", async () => {
      auth = { user: { id: "c1" } };
      // Below the bar, but every column a card row carries is filled in: the
      // outstanding items are in a node tree this page does not fetch. Naming
      // something anyway would be telling a creator to redo work they have
      // already done.
      listGallery.mockResolvedValue({
        builds: [
          build({
            id: "mine",
            slug: "mine",
            title: "Thin record",
            status: "gallery",
            creator_id: "c1",
            completeness: 60,
          }),
        ],
        total: 1,
      });
      renderGallery();

      await screen.findByText("Thin record");
      expect(screen.queryByTestId("gallery-shortfall")).toBeNull();
    });
  });

  it("surfaces a failed load instead of an empty grid", async () => {
    listGallery.mockRejectedValue(new Error("column does not exist"));
    renderGallery();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });

  // BG-P19 ACCEPTANCE 5 — all four states
  describe("its four states", () => {
    it("says the gallery is empty, and offers the one thing that fills it", async () => {
      listGallery.mockResolvedValue({ builds: [], total: 0 });
      renderGallery();

      const empty = await screen.findByTestId("gallery-empty");
      expect(empty).toHaveTextContent("Nothing in the gallery yet");
      // SECONDARY, not primary: the frame's compose control is already
      // spending this view's one primary action.
      expect(screen.getByRole("link", { name: "Write one up" })).toHaveAttribute(
        "href",
        "/compose/new"
      );
      // Not the same sentence as the filtered case, which is the whole point
      // of having two: "nothing exists" and "nothing matches" are different
      // problems with different fixes.
      expect(screen.queryByTestId("gallery-empty-filtered")).toBeNull();
    });

    it("says a filter is the reason, and clears it", async () => {
      renderGallery();
      await screen.findByText("Inbox triage agent");

      listGallery.mockResolvedValue({ builds: [], total: 0 });
      fireEvent.click(screen.getByTestId("facet-made-for-lawyer"));

      const empty = await screen.findByTestId("gallery-empty-filtered");
      expect(empty).toHaveTextContent("No builds match — clear a filter");

      listGallery.mockResolvedValue({ builds: [build()], total: 1 });
      fireEvent.click(within(empty).getByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(listGallery).toHaveBeenCalledTimes(3));
      expect(listGallery.mock.calls[2][0]).toMatchObject({ madeFor: [] });
    });

    it("holds the grid's shape while it loads, at the card's own proportions", async () => {
      let release: (value: { builds: unknown[]; total: number }) => void = () => {};
      listGallery.mockImplementation(
        () => new Promise((resolve) => { release = resolve; })
      );

      renderGallery();

      const loading = await screen.findByTestId("gallery-loading");
      // The real skeleton in the real grid container — not a spinner and not a
      // line of text, so the swap when the data lands does not move the page.
      expect(loading).toHaveClass("fs-grid");
      expect(loading).toHaveAttribute("aria-hidden", "true");
      expect(
        loading.querySelectorAll('[data-visual-slot="gallery-card-skeleton"]')
      ).toHaveLength(6);

      release({ builds: [build()], total: 1 });
      await screen.findByText("Inbox triage agent");
      expect(screen.queryByTestId("gallery-loading")).toBeNull();
    });

    it("repeats what the data layer said, and retries without a reload", async () => {
      listGallery.mockRejectedValue(new Error("column does not exist"));
      renderGallery();

      const failed = await screen.findByTestId("gallery-error");
      expect(failed).toHaveTextContent("The gallery could not be loaded");
      // The machine's own words, verbatim: this application's one maintainer
      // is not a developer, and that sentence is most of the state's value.
      expect(failed).toHaveTextContent("column does not exist");

      listGallery.mockResolvedValue({ builds: [build()], total: 1 });
      fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
      // The query is re-asked; the page is not reloaded and the filters are
      // not lost.
      await screen.findByText("Inbox triage agent");
      expect(getGalleryFacets).toHaveBeenCalledTimes(1);
    });
  });
});
