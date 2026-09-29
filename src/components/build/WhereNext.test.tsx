// Where next, rendered (RC-P14b): nothing asked until the foot is near; three
// rows in the reader's order when all have builds; an empty row left out;
// nothing at all when every row is empty; at most three cards a row, never the
// build being read; three columns wide, two between 768 and 1023, one below.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GalleryBuild, WhereNext as WhereNextData } from "@/lib/build";

const getWhereNext = vi.fn();

vi.mock("@/lib/build", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build")>()),
  getWhereNext: (input: unknown) => getWhereNext(input),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
/* RC-P16: the cards carry the engagement row, which reads the session and asks
   for counts. A signed-out reader and an empty answer; nothing here is about it. */
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, isLoggedIn: false }) }));
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  getEngagementCounts: vi.fn(async () => ({})),
}));

import { WhereNext } from "@/components/build/WhereNext";

const THIS = "build-this";

function card(id: string): GalleryBuild {
  return {
    id,
    creator_id: "maker-1",
    slug: `slug-${id}`,
    title: `Build ${id}`,
    outcome: "Does the dull half of a job the same way every time.",
    shape: "workflow",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 2,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-09-12T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
  } as GalleryBuild;
}

const cards = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`));

const FULL: WhereNextData = {
  rebuilds: cards("r", 3),
  sharedTool: { tool: "Claude", builds: cards("t", 3) },
  fromMaker: cards("m", 3),
  makerName: "Sam Ilori",
};

/* A stand-in IntersectionObserver the test can fire. */
let observers: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];

class FakeObserver {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function comeNear() {
  act(() => {
    for (const observer of observers) {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    }
  });
}

function renderFoot(width = 1440) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WhereNext buildId={THIS} creatorId="maker-1" madeWith={["Claude"]} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WhereNext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    getWhereNext.mockResolvedValue(FULL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for nothing until the foot is within 400px, then asks once", async () => {
    renderFoot();

    expect(screen.getByTestId("where-next-sentinel")).toBeInTheDocument();
    expect(getWhereNext).not.toHaveBeenCalled();
    expect(observers[0].options?.rootMargin).toBe("400px 0px");

    comeNear();

    await screen.findByTestId("where-next");
    expect(getWhereNext).toHaveBeenCalledTimes(1);
    expect(getWhereNext).toHaveBeenCalledWith({ buildId: THIS, creatorId: "maker-1", madeWith: ["Claude"] });
  });

  it("draws three rows when all have builds, in the reader's order, under DM Mono 12 headings", async () => {
    renderFoot();
    comeNear();

    const section = await screen.findByTestId("where-next");
    const headings = within(section).getAllByTestId("where-next-heading");
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Rebuilds of this",
      "More made with Claude",
      "More from Sam Ilori",
    ]);
    for (const heading of headings) {
      expect(heading.style.fontFamily).toContain("DM Mono");
      expect(heading.style.fontSize).toBe("12px");
      expect(heading.style.textTransform).toBe("uppercase");
    }
    expect(section.style.gap).toBe("40px");
  });

  it("leaves a row with nothing in it out", async () => {
    getWhereNext.mockResolvedValue({ ...FULL, sharedTool: { tool: "Claude", builds: [] } });
    renderFoot();
    comeNear();

    const section = await screen.findByTestId("where-next");
    expect(within(section).getAllByTestId("where-next-heading").map((heading) => heading.textContent)).toEqual([
      "Rebuilds of this",
      "More from Sam Ilori",
    ]);
    expect(within(section).queryByTestId("where-next-made-with")).toBeNull();
  });

  it("renders nothing at all when every row is empty: no heading, no empty state", async () => {
    getWhereNext.mockResolvedValue({ rebuilds: [], sharedTool: null, fromMaker: [], makerName: null });
    const { container } = renderFoot();
    comeNear();

    await vi.waitFor(() => expect(screen.queryByTestId("where-next-sentinel")).toBeNull());
    expect(container.innerHTML).toBe("");
  });

  it("draws at most three cards in a row", async () => {
    getWhereNext.mockResolvedValue({ ...FULL, rebuilds: cards("r", 5) });
    renderFoot();
    comeNear();

    const row = await screen.findByTestId("where-next-rebuilds");
    expect(within(row).getAllByTestId("where-next-card")).toHaveLength(3);
  });

  it("never offers the build being read", async () => {
    getWhereNext.mockResolvedValue({ ...FULL, fromMaker: [card(THIS), card("m1")] });
    renderFoot();
    comeNear();

    const section = await screen.findByTestId("where-next");
    expect(within(section).queryAllByRole("link").map((link) => link.getAttribute("href"))).not.toContain(
      `/b2/slug-${THIS}`,
    );
    expect(within(screen.getByTestId("where-next-maker")).getAllByTestId("where-next-card")).toHaveLength(1);
  });

  it.each([
    [1440, "repeat(3, minmax(0, 1fr))"],
    [1024, "repeat(3, minmax(0, 1fr))"],
    [900, "repeat(2, minmax(0, 1fr))"],
    [390, "minmax(0, 1fr)"],
  ])("lays each row out at %ipx as %s, 24 apart", async (width, columns) => {
    renderFoot(width);
    comeNear();

    const row = await screen.findByTestId("where-next-rebuilds");
    const grid = row.querySelector("ul") as HTMLElement;
    expect(grid.style.display).toBe("grid");
    expect(grid.style.gridTemplateColumns).toBe(columns);
    expect(grid.style.gap).toBe("24px");
  });
});
