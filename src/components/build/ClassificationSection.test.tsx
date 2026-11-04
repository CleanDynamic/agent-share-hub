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

  const rowOf = (section: HTMLElement, facet: string) => section.querySelector(`[data-facet='${facet}']`)?.closest('[data-ui="row"]') as HTMLElement | null;

  it("keeps the three lines' order, drawn as one module of rows, and counts the facts it draws", () => {
    const rows = classificationRows(FULL);
    expect(rows.map((line) => line.map((entry) => entry.key))).toEqual([
      ["field", "task", "setting"],
      ["built", "role", "technique", "modality", "method", "autonomy", "stack"],
      ["data", "age", "oversight", "skill", "cost"],
    ]);
    render(<ClassificationSection classification={FULL} />);
    const section = screen.getByRole("region", { name: "Classification" });
    expect(within(section).getByRole("heading", { level: 2, name: "Classification" })).toBeTruthy();
    const drawn = section.querySelectorAll('[data-ui="row"]').length;
    expect(within(section).getByText(`${drawn} facts about this build`)).toBeTruthy();
    expect(section.querySelectorAll("[data-ui='section-head']")).toHaveLength(1);
    expect(within(section).getByText("Hybrid search")).toBeTruthy();
    expect(within(section).getByText("Sorting socks")).toBeTruthy();
    expect(within(section).getByText("Prompt chain")).toBeTruthy();
    expect(within(section).getByText("Python")).toBeTruthy();
    expect(within(section).getByText("Stata")).toBeTruthy();
    expect(within(section).getByText("Acme")).toBeTruthy();
  });

  it("draws no provenance dot; a derived value's name and tooltip say Derived from the build, a stated one carries nothing", () => {
    render(<ClassificationSection classification={FULL} />);
    const section = screen.getByRole("region", { name: "Classification" });
    expect(section.querySelector("[data-provenance]")).toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    const derived = within(rowOf(section, "built") as HTMLElement).getByRole("group");
    expect(derived.getAttribute("aria-label")).toContain("Derived from the build");
    expect(derived.getAttribute("title")).toBe("Derived from the build");
    expect(within(rowOf(section, "field") as HTMLElement).queryByRole("group")).toBeNull();
    expect(rowOf(section, "skill")?.textContent).toContain("No coding");
    expect(rowOf(section, "skill")?.textContent).not.toContain("Some setup");
  });

  it("shows a reader no Not stated; the maker sees the empty maker-set facets after the ones with values", () => {
    const sparse = make({ derived: { built: { values: ["dataset"], from: [] } } });
    const { unmount } = render(<ClassificationSection classification={sparse} />);
    expect(screen.queryByText("Not stated")).toBeNull();
    unmount();
    render(<ClassificationSection classification={sparse} own />);
    const section = screen.getByRole("region", { name: "Classification" });
    for (const facet of ["field", "task", "setting", "data", "age"]) expect(rowOf(section, facet)?.textContent).toContain("Not stated");
    expect(section.querySelector("[data-facet='technique']")).toBeNull();
    const order = Array.from(section.querySelectorAll("[data-facet]")).map((node) => node.getAttribute("data-facet"));
    expect(order[0]).toBe("built");
    // The meta counts the facets that have values, not the Not stated rows.
    expect(within(section).getByText("1 fact about this build")).toBeTruthy();
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
