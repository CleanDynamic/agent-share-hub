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

const section = () => screen.getByRole("region", { name: "Classification" });

describe("UX-03 P4, as UX-03 follow-up P17 draws it: one module of rows", () => {
  it("shows a reader with only derived values rows, and no Not stated and no group", () => {
    draw(DERIVED_ONLY);
    expect(screen.queryByRole("group", { name: "Stated by the maker" })).toBeNull();
    expect(section().textContent).not.toContain("Not stated");
    expect(within(section()).getByText("What was built")).toBeTruthy();
    expect(within(section()).getByText("Techniques")).toBeTruthy();
    expect(within(section()).getByText("2 facts about this build")).toBeTruthy();
  });

  it("draws each facet as a row, label at the left and values at the right, with no dot", () => {
    draw(BOTH);
    expect(within(section()).getByText("Hybrid search")).toBeTruthy();
    expect(within(section()).getByText("Web app")).toBeTruthy();
    expect(section().querySelector("[data-provenance]")).toBeNull();
    expect(section().querySelectorAll('[data-ui="row"]')).toHaveLength(2);
  });

  it("shows the maker, on their own build, Not stated for each empty facet they set, and where to fill it", () => {
    draw(DERIVED_ONLY, { editHref: "/compose/b1" });
    for (const facet of ["field", "task", "setting", "data", "age"]) {
      expect((section().querySelector(`[data-facet='${facet}']`)?.closest('[data-ui="row"]') as HTMLElement).textContent).toContain("Not stated");
    }
    expect(within(section()).getByRole("link", { name: "Open Classification" }).getAttribute("href")).toBe("/compose/b1");
  });
});
