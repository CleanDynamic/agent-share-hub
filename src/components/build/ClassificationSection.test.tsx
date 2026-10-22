import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { emptyClassification } from "@/lib/classify/facets";
import { REGULATED_NOTICE } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";

import { ClassificationSection, classificationRows } from "./ClassificationSection";

afterEach(cleanup);

const make = (over: Partial<Classification> = {}, declared: Partial<Classification["declared"]> = {}): Classification => ({ ...emptyClassification(), ...over, declared: { ...emptyClassification().declared, ...declared } });

const FULL = make(
  {
    derived: {
      built: { values: ["web-app"], from: ["n1"] },
      role: { values: ["both"], from: [] },
      technique: { values: ["prompt-chain", "evaluations"], from: [] },
      stack: { values: ["languages.python", "custom:Acme"], from: [] },
      skill: { values: ["some-setup"], from: [] },
      oversight: { values: ["every-output-reviewed"], from: [] },
      cost: { values: ["cost-not-stated"], from: [] },
    },
    disputes: { skill: { values: ["no-coding"], reason: "Wrote none", at: "2026-10-22T00:00:00Z" } },
  },
  { field: [{ id: "ai-ml.retrieval.hybrid-search" }], task: [{ id: "create.writing", primary: true }, { custom: "Sorting socks" }], setting: [{ id: "personal.hobby" }], data: [{ id: "personal-data" }], age: "13-and-over", stack: [{ id: "applications.stata" }] },
);

describe("ClassificationSection", () => {
  it("draws nothing for a build with no classification", () => {
    const { container, rerender } = render(<ClassificationSection classification={null} />);
    expect(container.textContent).toBe("");
    rerender(<ClassificationSection classification={emptyClassification()} />);
    expect(container.textContent).toBe("");
  });

  it("has three lines: Field, Task, Setting; the AI build; Data and oversight with the practicalities", () => {
    const rows = classificationRows(FULL);
    expect(rows.map((line) => line.map((entry) => entry.key))).toEqual([
      ["field", "task", "setting"],
      ["built", "role", "technique", "modality", "method", "autonomy", "stack"],
      ["data", "age", "oversight", "skill", "cost"],
    ]);
    render(<ClassificationSection classification={FULL} />);
    const section = screen.getByRole("region", { name: "Classification" });
    expect(within(section).getAllByRole("list")).toHaveLength(3);
    expect(within(section).getByText("Hybrid search")).toBeTruthy();
    expect(within(section).getByText("Sorting socks")).toBeTruthy();
    expect(within(section).getByText("Prompt chain")).toBeTruthy();
    expect(within(section).getByText("Python")).toBeTruthy();
    expect(within(section).getByText("Stata")).toBeTruthy();
    expect(within(section).getByText("Acme")).toBeTruthy();
  });

  it("gives every value a provenance dot: Derived, Stated by the maker, or Not stated", () => {
    render(<ClassificationSection classification={FULL} />);
    const section = screen.getByRole("region", { name: "Classification" });
    const dotIn = (facet: string) => within(section.querySelector(`[data-facet='${facet}']`) as HTMLElement).getAllByRole("img").map((dot) => dot.getAttribute("aria-label"));
    expect(dotIn("built")).toEqual(["Derived"]);
    expect(dotIn("field")).toEqual(["Stated by the maker"]);
    expect(dotIn("skill")).toEqual(["Stated by the maker"]);
    expect(section.querySelector("[data-facet='skill']")?.textContent).toContain("No coding");
    expect(section.querySelector("[data-facet='skill']")?.textContent).not.toContain("Some setup");
    const dot = section.querySelector("[data-facet='built'] [data-provenance]") as HTMLElement;
    expect(dot.getAttribute("title")).toBe("Derived");
  });

  it("says Not stated for what the maker sets and left empty, and leaves a derived gap out", () => {
    render(<ClassificationSection classification={make({ derived: { built: { values: ["dataset"], from: [] } } })} />);
    const section = screen.getByRole("region", { name: "Classification" });
    for (const facet of ["field", "task", "setting", "data", "age"]) {
      const item = section.querySelector(`[data-facet='${facet}']`) as HTMLElement;
      expect(item.textContent).toContain("Not stated");
      expect(within(item).getByRole("img").getAttribute("aria-label")).toBe("Not stated");
    }
    expect(section.querySelector("[data-facet='technique']")).toBeNull();
  });

  it("shows the Regulated area notice when the flag is true, and only then", () => {
    const { rerender } = render(<ClassificationSection classification={make({}, { field: [{ id: "law.contracts" }] })} />);
    expect(screen.getByTestId("regulated-notice").textContent).toBe(REGULATED_NOTICE);
    expect(REGULATED_NOTICE).toBe("This build works in a regulated area. Check the rules that apply to you before using it.");
    rerender(<ClassificationSection classification={make({}, { data: [{ id: "student-or-child-data" }] })} />);
    expect(screen.getByTestId("regulated-notice")).toBeTruthy();
    rerender(<ClassificationSection classification={make({}, { field: [{ id: "ai-ml.nlp" }] })} />);
    expect(screen.queryByTestId("regulated-notice")).toBeNull();
  });
});
