// UX-03 P4: the build page's Classification in two groups, by provenance, and nothing empty for a reader.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { emptyClassification } from "@/lib/classify/facets";
import type { Classification } from "@/lib/classify/types";

import { ClassificationSection } from "./ClassificationSection";

afterEach(cleanup);

const make = (over: Partial<Classification> = {}, declared: Partial<Classification["declared"]> = {}): Classification => ({ ...emptyClassification(), ...over, declared: { ...emptyClassification().declared, ...declared } });

const DERIVED_ONLY = make({ derived: { built: { values: ["web-app"], from: ["n1"] }, technique: { values: ["prompt-chain"], from: [] } } });
const BOTH = make({ derived: { built: { values: ["web-app"], from: ["n1"] } } }, { field: [{ id: "ai-ml.retrieval.hybrid-search" }] });

const draw = (classification: Classification, maker?: { editHref: string }) =>
  render(
    <MemoryRouter>
      <ClassificationSection classification={classification} maker={maker} />
    </MemoryRouter>,
  );

const group = (name: string) => screen.queryByRole("group", { name });

describe("UX-03 P4: two groups by provenance", () => {
  it("shows a reader with only derived values one group and no Not stated", () => {
    draw(DERIVED_ONLY);
    const derived = group("Derived from the build");
    expect(derived).not.toBeNull();
    expect(group("Stated by the maker")).toBeNull();
    expect(screen.getByRole("region", { name: "Classification" }).textContent).not.toContain("Not stated");
    expect(within(derived as HTMLElement).getByText("What was built")).toBeTruthy();
    expect(within(derived as HTMLElement).getByText("Techniques")).toBeTruthy();
  });

  it("puts each value under its provenance, the maker's first", () => {
    draw(BOTH);
    const stated = group("Stated by the maker") as HTMLElement;
    const derived = group("Derived from the build") as HTMLElement;
    expect(within(stated).getByText("Hybrid search")).toBeTruthy();
    expect(within(derived).getByText("Web app")).toBeTruthy();
    expect(stated.compareDocumentPosition(derived) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A facet is its label above its values, in a grid of four columns on a desktop.
    expect((stated.querySelector("[data-testid='classification-grid']") as HTMLElement).style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("shows the maker, on their own build, Not stated for each empty facet they set, and where to fill it", () => {
    draw(DERIVED_ONLY, { editHref: "/compose/b1" });
    const stated = group("Stated by the maker") as HTMLElement;
    for (const facet of ["field", "task", "setting", "data", "age"]) {
      expect((stated.querySelector(`[data-facet='${facet}']`) as HTMLElement).textContent).toContain("Not stated");
    }
    expect(within(stated).getByRole("link", { name: "Open Classification" }).getAttribute("href")).toBe("/compose/b1");
  });
});
