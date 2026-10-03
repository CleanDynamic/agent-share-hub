// UI-P28 — Gallery's view: both layouts, the controls' callbacks and every empty state.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { galleryFixture } from "@/dev/fixtures/gallery";

import { GalleryView, type GalleryViewProps } from "./GalleryView";

function mount(over: Partial<GalleryViewProps> = {}) {
  const props: GalleryViewProps = { ...galleryFixture(), ...over };
  return {
    props,
    ...render(
      <MemoryRouter>
        <GalleryView fit="content" {...props} />
      </MemoryRouter>,
    ),
  };
}

function phone(on: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: on && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("GalleryView on a desktop", () => {
  it("has one h1, the lenses with their counts, the order note and the stats", () => {
    mount();
    expect(screen.getByRole("heading", { level: 1, name: "Builds worth running" })).toBeTruthy();
    const lens = screen.getByRole("group", { name: "Lens" });
    expect(within(lens).getByRole("button", { name: "All 1,284" })).toBeTruthy();
    expect(within(lens).getByRole("button", { name: "Unsolved 23" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED")).toBeTruthy();
    expect(screen.getByText("£4,250")).toBeTruthy();
    expect(screen.getByText("86%")).toBeTruthy();
    expect(screen.getByText("Reproduced this week")).toBeTruthy();
  });

  it("changes lens through the callback", () => {
    const onLensChange = vi.fn();
    mount({ onLensChange });
    fireEvent.click(screen.getByRole("button", { name: "Proven 512" }));
    expect(onLensChange).toHaveBeenCalledWith("proven");
  });

  it("draws the three facet groups as toggle buttons that say whether they are on", () => {
    const onToggle = vi.fn();
    const base = galleryFixture();
    const facets = base.facets.map((group, index) =>
      index === 2
        ? { ...group, rows: group.rows.map((row, i) => (i === 0 ? { ...row, selected: true, onToggle } : row)) }
        : group,
    );
    mount({ facets });

    expect(screen.getByTestId("gallery-facets-made-for")).toBeTruthy();
    expect(screen.getByTestId("gallery-facets-made-with")).toBeTruthy();
    const shape = screen.getByTestId("gallery-facets-shape");
    const on = within(shape).getByRole("button", { name: /agent/ });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    expect(within(shape).getByRole("button", { name: /workflow/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(on);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("puts the featured build first on the wall as a link, then the cards after it", () => {
    mount();
    const featured = screen.getByTestId("gallery-featured");
    expect(featured.getAttribute("href")).toBe("/b2/support-reply-drafter");
    expect(within(featured).getByText("MOST REPRODUCED THIS MONTH")).toBeTruthy();
    expect(within(featured).getByText("01")).toBeTruthy();
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("starts the wall at the first card when there is no featured build", () => {
    mount({ featured: null });
    expect(screen.queryByTestId("gallery-featured")).toBeNull();
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("offers Show more only while there is more", () => {
    const onMore = vi.fn();
    const base = galleryFixture();
    const { unmount } = mount();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    unmount();

    mount({ wall: { ...base.wall, hasMore: true, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("holds a bone where each figure goes, not a made-up number, until the stats arrive", () => {
    mount({ stats: null, lensCounts: null });
    const region = screen.getByTestId("gallery-stats-loading");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.textContent).toContain("Loading the gallery’s figures");
    // Four figures, and a bone for the bar under three of them.
    expect(region.querySelectorAll('[data-ui="skeleton"]')).toHaveLength(7);
    expect(screen.queryByText("—")).toBeNull();
    expect(within(screen.getByRole("group", { name: "Lens" })).getByRole("button", { name: "All" })).toBeTruthy();
  });

  it("says what is being searched, with a way to clear it", () => {
    const onSearch = vi.fn();
    mount({ query: "inbox", onSearch });
    expect(screen.getByText("Results for “inbox”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onSearch).toHaveBeenCalledWith(null);
  });
});

describe("GalleryView's empty and failed states", () => {
  const wallOf = (over: Partial<GalleryViewProps["wall"]>): GalleryViewProps["wall"] => ({
    ...galleryFixture().wall,
    ...over,
  });

  it("a lens with no builds says so, with a way back to all of them", () => {
    const onClearAll = vi.fn();
    mount({ featured: null, narrowed: true, onClearAll, wall: wallOf({ cards: [] }) });
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See all builds" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("an empty gallery points at publishing", () => {
    const onNavigate = vi.fn();
    mount({ featured: null, narrowed: false, onNavigate, wall: wallOf({ cards: [] }) });
    fireEvent.click(screen.getByRole("button", { name: "Show what you built" }));
    expect(onNavigate).toHaveBeenCalledWith("/compose/new");
  });

  it("a failed read says That didn't load. and retries; a refused one is not an empty gallery", () => {
    const onRetry = vi.fn();
    const { unmount } = mount({ wall: wallOf({ status: "error", cards: [], onRetry }) });
    expect(screen.getByTestId("gallery-notice").textContent).toContain("That didn't load.");
    expect(screen.getByTestId("gallery-notice").textContent).toContain("The gallery");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    unmount();

    mount({ wall: wallOf({ status: "error", errorKind: "permission", cards: [] }) });
    expect(screen.getByText("You don't have access to this.")).toBeTruthy();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
  });

  it("holds the wall's place with skeletons while it loads, busy and named for assistive technology", () => {
    mount({ wall: wallOf({ status: "loading", cards: [] }) });
    const loading = screen.getByTestId("gallery-loading");
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(loading.textContent).toContain("Loading the gallery");
    expect(screen.queryByTestId("gallery-wall")).toBeNull();
  });

  it("holds the featured plate's place and six cards while the first wall loads, and eight cards under a lens", () => {
    const { unmount } = mount({ featured: null, wall: wallOf({ status: "loading", cards: [] }) });
    expect(screen.getByTestId("gallery-loading").querySelectorAll('[data-ui="card-skeleton"]')).toHaveLength(6);
    expect(screen.getByTestId("gallery-loading").querySelectorAll('[data-ui="skeleton"][style*="flex-grow"]')).toHaveLength(1);
    unmount();

    mount({ featured: null, narrowed: true, wall: wallOf({ status: "loading", cards: [] }) });
    expect(screen.getByTestId("gallery-loading").querySelectorAll('[data-ui="card-skeleton"]')).toHaveLength(8);
  });

  it("puts each failed facet group's failure in its own place and leaves the others", () => {
    const base = galleryFixture();
    const onRetry = vi.fn();
    mount({
      facets: base.facets.map((group, index) => (index === 2 ? { ...group, rows: [], failure: { onRetry } } : group)),
    });
    const failed = screen.getByTestId("gallery-facets-shape-error");
    expect(failed.textContent).toContain("That didn't load.");
    expect(failed.textContent).toContain("Shape filters");
    fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The groups that loaded still toggle.
    expect(within(screen.getByTestId("gallery-facets-made-for")).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("leaves a facet group with no counts out, and the whole column when none has any", () => {
    const base = galleryFixture();
    const { unmount } = mount({ facets: base.facets.map((group, index) => (index === 1 ? { ...group, rows: [] } : group)) });
    expect(screen.queryByTestId("gallery-facets-made-with")).toBeNull();
    expect(screen.getByTestId("gallery-facets-made-for")).toBeTruthy();
    unmount();

    mount({ facets: base.facets.map((group) => ({ ...group, rows: [] })) });
    expect(screen.queryByRole("navigation", { name: "Filter the gallery" })).toBeNull();
  });

  it("says why the figures are missing when they could not be read, in the label's own place", () => {
    const onRetry = vi.fn();
    mount({ stats: null, statsError: { onRetry } });
    const failed = screen.getByTestId("gallery-stats-error");
    expect(failed.textContent).toContain("Gallery figures");
    fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The wall is not held back by it.
    expect(screen.getByTestId("gallery-wall")).toBeTruthy();
  });
});

describe("GalleryView on a phone", () => {
  it("draws the heading, lens chips, search and Filters, the stats, the featured build and the wall", () => {
    phone(true);
    mount();
    expect(screen.getByTestId("gallery-view").getAttribute("data-viewport")).toBe("mobile");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^All\s*1,284$/ })).toBeTruthy();
    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByText("Open asks")).toBeTruthy();
    expect(screen.getByTestId("gallery-featured")).toBeTruthy();
    expect(within(screen.getByTestId("gallery-wall")).getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("submits the search through the callback, trimmed, and an empty one as none", () => {
    phone(true);
    const onSearch = vi.fn();
    mount({ onSearch });
    const input = screen.getByRole("searchbox", { name: "Search builds" }) as HTMLInputElement;
    expect(input.style.fontSize).toBe("16px");
    fireEvent.change(input, { target: { value: "  inbox  " } });
    fireEvent.submit(input.closest("form")!);
    expect(onSearch).toHaveBeenLastCalledWith("inbox");
    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.submit(input.closest("form")!);
    expect(onSearch).toHaveBeenLastCalledWith(null);
  });

  it("counts the applied filters on the button, and opens them in a sheet with a Show button", () => {
    phone(true);
    mount({ appliedCount: 2, total: 37 });
    fireEvent.click(screen.getByRole("button", { name: "Filters · 2" }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByText("Made for")).toBeTruthy();
    expect(within(sheet).getByText("Shape")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Show 37 builds" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reads just 'Filters' when none are applied", () => {
    phone(true);
    mount({ appliedCount: 0 });
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  it("offers no Filters button when there is nothing to filter by", () => {
    phone(true);
    const base = galleryFixture();
    mount({ facets: base.facets.map((group) => ({ ...group, rows: [] })) });
    expect(screen.queryByRole("button", { name: /^Filters/ })).toBeNull();
  });

  it("holds six cards and the featured plate's place while the wall loads", () => {
    phone(true);
    mount({ featured: null, wall: { ...galleryFixture().wall, status: "loading", cards: [] } });
    expect(screen.getByTestId("gallery-loading").querySelectorAll('[data-ui="card-skeleton"]')).toHaveLength(6);
  });
});
