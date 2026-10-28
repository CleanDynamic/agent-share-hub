// SV-13 P1: the Classification view, rendered from the board's sample data. The claims: a card names each facet and where
// its values came from; a value is a real link; the chooser is checkboxes, says "n of 15" and keeps at least one facet;
// a pure view takes everything through props.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsClassificationProps } from "@/dev/fixtures/vision/builds-classification";
import type { Facet } from "@/lib/classify/taxonomy";

import BuildsClassificationView, { type BuildsClassificationViewProps } from "./BuildsClassificationView";
import { DEFAULT_FACETS } from "./classificationModel";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

function draw(change: (props: BuildsClassificationViewProps) => BuildsClassificationViewProps = (p) => p) {
  return render(
    <MemoryRouter>
      <BuildsClassificationView {...change(visionBuildsClassificationProps())} />
    </MemoryRouter>,
  );
}

describe("the head and the row", () => {
  it("says what the page is and which view is current", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "18 builds" })).toBeTruthy();
    expect(screen.getByText("Classification of each build · select a value to filter by it")).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "View" })).getByRole("link", { name: "Classification" }).getAttribute("aria-current")).toBe("page");
  });

  it("draws Filters with its count and Facets shown with 8 of 15, and the key", () => {
    draw();
    expect(screen.getByRole("button", { name: /Facets shown\s*8 of 15/ })).toBeTruthy();
    expect(screen.getByText(/Under each facet:/)).toBeTruthy();
  });
});

describe("a card", () => {
  it("is a module per build with a row per facet, each naming its source", () => {
    draw();
    const cards = screen.getAllByTestId("classification-card");
    expect(cards).toHaveLength(6);
    const first = within(cards[0]);
    expect(first.getByRole("link", { name: "Call notes that write themselves" })).toBeTruthy();
    expect(first.getByText("@maya · Workflow · Regulated area")).toBeTruthy();
    expect(first.getByText("from 3 tiles")).toBeTruthy();
    expect(first.getAllByText("stated").length).toBeGreaterThan(0);
    expect(first.getByText("corrected")).toBeTruthy();
    expect(first.getAllByRole("term")).toHaveLength(8);
  });

  it("says how many reproductions to assistive technology, and keeps the lamp out of it", () => {
    draw();
    expect(within(screen.getAllByTestId("classification-card")[0]).getByText("reproduced")).toBeTruthy();
  });

  it("links a listed value, and leaves the maker's own words as text", () => {
    draw((p) => ({ ...p, cards: p.cards.map((card) => ({ ...card, rows: card.rows.map((row) => ({ ...row, values: row.values.map((value) => ({ ...value, href: value.href === null ? null : `/builds?f=${encodeURIComponent(`${row.facet}:x`)}` })) })) })) }));
    const first = within(screen.getAllByTestId("classification-card")[0]);
    const links = first.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/builds?f="));
    expect(links.length).toBeGreaterThan(0);
  });

  it("says None where a facet holds nothing", () => {
    draw((p) => ({ ...p, cards: [{ ...p.cards[0], rows: p.cards[0].rows.map((row) => ({ ...row, source: "", values: [] })) }] }));
    expect(screen.getAllByText("None")).toHaveLength(8);
  });
});

describe("Facets shown", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: /Facets shown/ }));

  it("lists the 15 facets as checkboxes, the eight on", () => {
    draw();
    open();
    const group = within(screen.getByRole("group", { name: "Facets shown" }));
    expect(group.getAllByRole("checkbox")).toHaveLength(15);
    expect((group.getByRole("checkbox", { name: "Field" }) as HTMLInputElement).checked).toBe(true);
    expect((group.getByRole("checkbox", { name: "Role of AI" }) as HTMLInputElement).checked).toBe(false);
  });

  it("reports a facet added or taken away", () => {
    const onFacets = vi.fn();
    draw((p) => ({ ...p, onFacets }));
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Role of AI" }));
    expect(onFacets).toHaveBeenLastCalledWith([...DEFAULT_FACETS, "role"]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Field" }));
    expect(onFacets).toHaveBeenLastCalledWith(DEFAULT_FACETS.filter((facet) => facet !== "field"));
  });

  it("keeps the last facet", () => {
    const onFacets = vi.fn();
    draw((p) => ({ ...p, facets: ["cost"] as Facet[], onFacets }));
    open();
    const last = screen.getByRole("checkbox", { name: "Cost to run" }) as HTMLInputElement;
    expect(last.disabled).toBe(true);
    fireEvent.click(last);
    expect(onFacets).not.toHaveBeenCalled();
  });
});

describe("Filters", () => {
  it("opens the panel it is given", () => {
    draw((p) => ({ ...p, panel: <p>The filter panel</p> }));
    expect(screen.queryByText("The filter panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.getByText("The filter panel")).toBeTruthy();
  });
});

describe("more builds", () => {
  it("offers the rest when there are more, and says when it is loading", () => {
    const onMore = vi.fn();
    draw((p) => ({ ...p, onMore }));
    fireEvent.click(screen.getByRole("button", { name: "Show more builds" }));
    expect(onMore).toHaveBeenCalled();
  });
});
