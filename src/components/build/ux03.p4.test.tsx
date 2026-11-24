// UX-03 P4: the build page's Classification: provenance named on each value, and nothing empty for a reader.

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

/* UX-03 follow-up P17 replaced the two provenance groups with one list of rows: a derived value names its provenance itself
   ("Derived from the build", as its group's name and tooltip) and a stated value carries nothing. The three claims stay. */
const derivedValues = () => screen.queryAllByRole("group").filter((node) => (node.getAttribute("aria-label") ?? "").endsWith("Derived from the build"));
const row = (facet: string) => screen.getByRole("region", { name: "Classification" }).querySelector(`[data-facet='${facet}']`)?.closest('[data-ui="row"]') as HTMLElement | null;

describe("UX-03 P4: provenance, on each value", () => {
  it("shows a reader with only derived values those values as derived, and no Not stated", () => {
    draw(DERIVED_ONLY);
    expect(derivedValues().length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Classification" }).textContent).not.toContain("Not stated");
    expect(row("built")).not.toBeNull();
  });

  it("names a derived value's provenance and leaves a stated one plain", () => {
    draw(BOTH);
    expect(within(row("field") as HTMLElement).getByText("Hybrid search")).toBeTruthy();
    expect(within(row("field") as HTMLElement).queryByRole("group")).toBeNull();
    expect(within(row("built") as HTMLElement).getByRole("group").getAttribute("title")).toBe("Derived from the build");
  });

  it("shows the maker, on their own build, Not stated for each empty facet they set, and where to fill it", () => {
    draw(DERIVED_ONLY, { editHref: "/compose/b1" });
    for (const facet of ["field", "task", "setting", "data", "age"]) {
      expect((row(facet) as HTMLElement).textContent).toContain("Not stated");
    }
    expect(screen.getByTestId("classification-open").getAttribute("href")).toBe("/compose/b1");
  });
});
