// UI-P89 — the Gallery feed in the refined look, rendered through the dev page with its fixture: the same parts,
// names and handlers as `GalleryFeedView`, on the refined controls.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import GalleryFeedDemo from "@/pages/dev/GalleryFeedDemo";

const REFINED = "/dev/kit/pages/gallery-feed";

const tree = (state: "populated" | "loading" | "empty" | "error" = "populated") => (
  <MemoryRouter initialEntries={[REFINED]}>
    <GalleryFeedDemo viewport="desktop" fit="content" state={state} />
  </MemoryRouter>
);

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

describe("GalleryFeedView on a desktop", () => {
  it("is the refined fork: the heading, the view switch, the search and four menu buttons", () => {
    render(tree());
    expect(screen.getByRole("heading", { level: 1, name: "Gallery" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Gallery view" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search the gallery" })).toBeTruthy();
    for (const key of ["model", "tool", "for", "sort"]) {
      expect(screen.getByTestId(`feed-menu-${key}`).getAttribute("data-ui")).toBe("menu-button");
    }
    expect(within(screen.getByTestId("feed-section-all")).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("switches to the dashboard from the radio group", () => {
    render(tree());
    const views = screen.getByRole("radiogroup", { name: "Gallery view" });
    fireEvent.click(within(views).getByRole("radio", { name: "Dashboard" }));
    expect(within(views).getByRole("radio", { name: "Dashboard" }).getAttribute("aria-checked")).toBe("true");
  });

  it("draws no serif, no glass and no lucide icon in its controls", () => {
    const html = renderToStaticMarkup(tree());
    const head = html.slice(0, html.indexOf('data-testid="gallery-feed"'));
    expect(head).not.toContain("Sentient");
    expect(head).not.toContain("var(--glass");
    expect(head).not.toContain("lucide");
  });

  it("keeps its loading, empty and error states", () => {
    const { rerender } = render(tree("loading"));
    expect(screen.getByTestId("gallery-loading")).toBeTruthy();
    rerender(tree("empty"));
    expect(screen.getByTestId("gallery-empty")).toBeTruthy();
    rerender(tree("error"));
    expect(screen.getByTestId("gallery-notice")).toBeTruthy();
  });
});

describe("GalleryFeedView on a phone", () => {
  it("keeps today's order: heading, search, the four chips, the list", () => {
    phone(true);
    render(tree());
    const viewEl = screen.getByTestId("gallery-view");
    expect(viewEl.getAttribute("data-viewport")).toBe("mobile");
    expect(screen.queryByRole("radiogroup", { name: "Gallery view" })).toBeNull();
    const chips = screen.getByRole("group", { name: "Filter the gallery" });
    expect(within(chips).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByTestId("gallery-feed")).toBeTruthy();
  });
});
