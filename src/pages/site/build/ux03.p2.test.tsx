// UX-03 P2: the build page reads top to bottom. Proof lists only the facts the record states, and the maker and the reader each
// get the note that says what their press records.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { buildFixture } from "@/dev/fixtures/build";
import { buildStepsFixture } from "@/dev/fixtures/buildSteps";

import { BuildView, MAKER_NOTE, READER_NOTE, type BuildViewProps } from "./BuildView";
import { MISSING, proofDetails, stepTabs } from "./buildModel";

function props(kind: BuildViewProps["proof"]["action"]["kind"], over: Partial<BuildViewProps["hero"]> = {}): BuildViewProps {
  const { title, outcome, ...steps } = buildStepsFixture("list");
  const base = buildFixture("desktop");
  return {
    ...base,
    hero: { ...base.hero, title, outcome, ...over },
    proof: { ...base.proof, action: { ...base.proof.action, kind } },
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

describe("UX-03 P2: the two notes", () => {
  it("tells a reader what their run records", () => {
    mount(props("reproduce"));
    const proof = screen.getByTestId("build-proof");
    expect(within(proof).getByText(READER_NOTE)).toBeTruthy();
    expect(READER_NOTE).toBe("Records the date, whether it worked and the model you used.");
    expect(within(proof).queryByText(MAKER_NOTE)).toBeNull();
  });

  it("tells the maker what Re-confirm records", () => {
    mount(props("reconfirm"));
    const proof = screen.getByTestId("build-proof");
    expect(within(proof).getByRole("button", { name: "Re-confirm it still works" })).toBeTruthy();
    expect(within(proof).getByText(MAKER_NOTE)).toBeTruthy();
    expect(MAKER_NOTE).toBe("Records the date and the model you used.");
    expect(within(proof).queryByText(READER_NOTE)).toBeNull();
  });
});

describe("UX-03 P2: no picture area without a cover", () => {
  it("draws the title block only, with the action dock in its row", () => {
    mount(props("reproduce", { hasCover: false }));
    const hero = screen.getByTestId("build-hero");
    expect(hero.querySelector("[data-testid='build-hero-picture']")).toBeNull();
    expect(hero.querySelector("[data-testid='build-hero-picture'] [data-testid='build-shape-tag']")).toBeNull();
    // Page shell: the title and the dock are the page's PageHeader on a desktop.
    expect(within(screen.getByRole("heading", { level: 1 }).closest("header")!).getByTestId("build-action-dock")).toBeTruthy();
    expect(within(hero).queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("keeps the picture when the build has a cover", () => {
    mount(props("reproduce", { hasCover: true }));
    expect(screen.getByTestId("build-hero").querySelector("[data-testid='build-hero-picture']")).not.toBeNull();
  });

  it("puts the steps after the title block and the classification after the steps", () => {
    mount({ ...props("reproduce", { hasCover: false }), classification: <section data-testid="build-classification" /> });
    const order = [screen.getByTestId("build-hero"), screen.getByTestId("build-steps-panel"), screen.getByTestId("build-classification")];
    for (let at = 1; at < order.length; at += 1) {
      expect(order[at - 1].compareDocumentPosition(order[at]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
