import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";

import { CostStrip, TileCostLines } from "./CostLines";

afterEach(() => cleanup());

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const group = (extras: SessionGroup["extras"]): SessionGroup => ({ sessionId: "s", number: 1, tool: "Claude Code", model: null, startedAt: "2026-10-01T10:00:00", stepNumbers: ["1"], extras });

const steps = [
  step("1", "prompt", { buildCost: { ms: 1200, tokensIn: 3400, cost: 0.01, currency: "GBP", source: "maker" } }),
  step("2", "decision", { runCost: { per: "call", ms: 120, cost: 0.0001, currency: "GBP", source: "maker" } }),
];

describe("cost lines (CA-13 P8)", () => {
  it("shows a tile's lines only when it has a figure", () => {
    const { container } = render(<TileCostLines step={step("9", "prompt")} audience="maker" groups={[]} />);
    expect(container.innerHTML).toBe("");
    render(<TileCostLines step={steps[0]} audience="maker" groups={[]} />);
    expect(screen.getByTestId("cost-build").textContent).toBe("Made in 1.2 s · 3,400 tokens · £0.01");
  });

  it("a decision says what each call costs, and never what it took to make", () => {
    render(<TileCostLines step={steps[1]} audience="maker" groups={[]} />);
    expect(screen.getByTestId("cost-run").textContent).toBe("Each call: 120 ms · £0.0001");
    expect(screen.queryByTestId("cost-build")).toBeNull();
  });

  it("hides money from a reader unless the maker showed costs, and keeps time and tokens", () => {
    render(<TileCostLines step={steps[0]} audience="reader" groups={[group({ cost: 5, currency: "GBP" })]} />);
    expect(screen.getByTestId("cost-build").textContent).toBe("Made in 1.2 s · 3,400 tokens");
    cleanup();
    render(<TileCostLines step={steps[0]} audience="reader" groups={[group({ showCost: true })]} />);
    expect(screen.getByTestId("cost-build").textContent).toContain("£0.01");
  });

  it("the strip keeps to build and to run on their own lines, and draws nothing for a build with no figure", () => {
    render(<CostStrip steps={steps} groups={[group({ ms: 600_000, showCost: true, cost: 2, currency: "GBP" })]} audience="reader" />);
    expect(screen.getByTestId("cost-total-build").textContent).toBe("To build: 10 min · 3,400 tokens · £2.01 · from 2 of 3 steps");
    expect(screen.getByTestId("cost-total-run").textContent).toBe("To run: about £0.0001 a call · 120 ms");
    cleanup();
    const { container } = render(<CostStrip steps={[step("1", "prompt")]} groups={[]} audience="reader" />);
    expect(container.innerHTML).toBe("");
  });
});
