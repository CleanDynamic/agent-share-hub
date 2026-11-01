// SV-29 P8: the build page draws the pipeline fixtures: each Decision's label set, candidates, selection, adaptation, known limits and
// accuracy ceiling; the Retrieval tile; the comparison's table and chart; and the Check's eval harness. No request round is added:
// everything is drawn from the steps already read.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";

import { StepsList } from "./BuildSteps";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function page(which: "pipeline-product-categories" | "pipeline-support-bot-evals") {
  const view = buildStepsFixture(which);
  render(
    <MemoryRouter>
      <StepsList view={view} phone={false} announce={() => undefined} />
    </MemoryRouter>,
  );
  return view;
}

describe("the product categories pipeline", () => {
  it("draws the decision's label set, candidates, selection, adaptation, known limit and ceiling", () => {
    page("pipeline-product-categories");
    const decision = screen.getByTestId("decision-tile");
    const text = decision.textContent ?? "";
    expect(text).toContain("Label set: Shopify product taxonomy, Sept 2026 · 6,000 labels · hierarchical");
    expect(text).toContain("Candidates: top 30 from Step 2");
    expect(text).toContain("One call over the candidates");
    expect(text).toContain("Zero-shot: no examples");
    expect(text).toContain("Accuracy ceiling: 99% (Recall@30 of Step 2) · From the run");
    expect(within(decision).getByTestId("decision-limit").textContent).toBe("Known limit: Sequential narrowing over large label sets degrades accuracy");
  });

  it("draws the Retrieval tile as one line", () => {
    page("pipeline-product-categories");
    expect(screen.getByTestId("retrieval-line").textContent).toBe("Retrieval · text-embedding-3-small · 6,000 categories · top 30 · Recall@1 38%, Recall@30 99.2%");
  });

  it("draws the comparison's table with the chosen row first, every value with its source, and the chart with a text summary", () => {
    page("pipeline-product-categories");
    const rows = screen.getAllByTestId("comparison-row");
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain("Retrieval, then the decision model picks");
    expect(rows[0].textContent).toContain("0.972");
    expect(rows[0].textContent).toContain("about $0.0005 per item");
    expect(rows[0].textContent).toContain("From the run");
    expect(rows[0].textContent).toContain("Maker's figure");
    expect(screen.getAllByTestId("comparison-reason").map((node) => node.textContent)).toContain("Over 2,000 times the cost");
    expect(screen.getByTestId("comparison-test-set").textContent).toBe("1,000 test items, labelled by annotators in Sep 2026");
    expect(screen.getByTestId("comparison-chart").getAttribute("aria-label")).toMatch(/Accuracy against cost per item/);
    expect(screen.getByTestId("comparison-chart").querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the cost per item with its noun and pricing, and the daily line", () => {
    page("pipeline-product-categories");
    expect(screen.getByTestId("cost-run").textContent).toBe("about $0.0005 per product (batch pricing)");
    expect(screen.getByTestId("cost-daily").textContent).toMatch(/^About \$5,000 a day at 10,000,000 items/);
  });
});

describe("the support bot's eval harness", () => {
  it("draws the test set, the example case, failure types, graders, runs, the history and the gate", () => {
    page("pipeline-support-bot-evals");
    const harness = screen.getByTestId("eval-harness");
    expect(within(harness).getByTestId("harness-source").textContent).toBe("20 test cases from real users' questions (tag customer), in harness/goldens.json");
    expect(within(harness).getByTestId("harness-example").textContent).toContain("Bought running shoes 5 weeks ago, can I return them?");
    expect(within(harness).getByTestId("harness-example").textContent).toContain("Rule: Returns within 30 days of purchase");
    const types = within(harness).getAllByTestId("harness-failure-type").map((node) => node.textContent);
    expect(types[0]).toContain("Made-up answers · 6 of 20");
    expect(types[2]).toContain("Needs a decision: No help-centre page covers damaged items");
    const graders = within(harness).getAllByTestId("harness-grader").map((node) => node.textContent);
    expect(graders).toHaveLength(4);
    expect(graders.join("\n")).toContain("Policy correct · LLM judge · sees the question, the answer, the expected answer and the full reference · 0.7 · covers Wrong policy decision");
    expect(graders.join("\n")).toContain("Tested on 3 good and 3 bad cases before use");
    expect(within(harness).getByTestId("harness-runs-per-case").textContent).toBe("Each case run 3 times");
    expect(within(harness).getByTestId("harness-stability").textContent).toContain("11 always pass");
    const runs = within(harness).getAllByTestId("harness-run").map((node) => node.textContent);
    expect(runs[0]).toContain("main-embedding-search · Search by meaning · 54 of 60 · fixed 4 · regressions 0 · now flaky 1 · still failing 4");
    expect(runs[2]).toContain("main-prompt-v2 · 33 of 60");
    expect(within(harness).getByTestId("harness-gate").textContent).toContain("CI gate: on every pull request in GitHub Actions · fails when a case goes from always pass to always fail, over 3 runs · a missing result fails · about 8 minutes");
    expect(within(harness).getByTestId("harness-dropped").textContent).toBe("Tried and dropped: Fail on any regression, one run. A correct answer failed on judge noise.");
  });

  it("reads passed of total with its cases and runs, never alone", () => {
    page("pipeline-support-bot-evals");
    expect(document.body.textContent).toContain("Passed 54 of 60 runs (20 cases × 3)");
  });
});
