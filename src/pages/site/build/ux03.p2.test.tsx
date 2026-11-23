// UX-03 P2: the build page reads top to bottom. Proof lists only the facts the record states, and the maker and the reader each
// get the note that says what their press records.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";

import { BuildView, type BuildViewProps } from "./BuildView";
import { MISSING, proofDetails, stepTabs } from "./buildModel";

function props(over: Partial<BuildViewProps["hero"]> = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture("desktop");
  return {
    ...base,
    hero: { ...base.hero, title, outcome, ...over },
    viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" },
    steps,
  };
}

const mount = (view: BuildViewProps) =>
  render(
    <MemoryRouter>
      <BuildView {...view} />
    </MemoryRouter>,
  );

describe("UX-03 P2: Proof shows only rows with values", () => {
  it("leaves out each fact the record does not state", () => {
    const details = proofDetails(
      { made_for: null, made_with: ["sonnet-4.5"], cost_setup: null, cost_monthly: 12, currency: "GBP", time_to_first_result: null },
      [],
    );
    expect(details).toEqual([
      { label: "Made with", value: "sonnet-4.5" },
      { label: "Monthly", value: "£12" },
    ]);
    expect(details.some((detail) => detail.value === MISSING)).toBe(false);
  });

  it("is empty when the record states none of them, so Proof draws no table", () => {
    expect(proofDetails({ made_for: null, made_with: [], cost_setup: null, cost_monthly: null, currency: null, time_to_first_result: null }, [])).toEqual([]);
  });
});

describe("Synth 08: no run notes", () => {
  it("says nothing about what a run records, to a reader or to the maker", () => {
    mount(props());
    expect(document.body.textContent).not.toMatch(/Records the date|Re-confirm|I ran this/);
    expect(screen.queryByTestId("build-proof")).toBeNull();
  });
});

describe("UX-03 P2: no picture area without a cover", () => {
  it("draws the title block only, with the actions in its row", () => {
    mount(props({ hasCover: false }));
    const hero = screen.getByTestId("build-hero");
    expect(hero.querySelector("[data-testid='build-hero-picture']")).toBeNull();
    expect(hero.querySelector("[data-testid='build-hero-picture'] [data-testid='build-shape-tag']")).toBeNull();
    // Synth 08: the title and the actions are the head of the main panel, inside the hero.
    expect(within(hero).getByRole("heading", { level: 1 })).toBeTruthy();
    expect(within(hero).getByTestId("build-action-dock")).toBeTruthy();
  });

  it("keeps the picture when the build has a cover", () => {
    mount(props({ hasCover: true }));
    expect(screen.getByTestId("build-hero").querySelector("[data-testid='build-hero-picture']")).not.toBeNull();
  });

  it("puts the steps after the title block and the classification after the steps", () => {
    mount({ ...props({ hasCover: false }), classification: <section data-testid="build-classification" /> });
    const order = [screen.getByTestId("build-hero"), screen.getByTestId("build-steps-panel"), screen.getByTestId("build-classification")];
    for (let at = 1; at < order.length; at += 1) {
      expect(order[at - 1].compareDocumentPosition(order[at]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
