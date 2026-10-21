import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { differenceSentence, matchSteps, totalsOf, totalsRows, type CompareSide } from "@/lib/build/compare";
import type { Step } from "@/lib/build/graph";

import { CompareView } from "./CompareView";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => cleanup());

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: `${kind} ${id}`, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const sides = (): [CompareSide, CompareSide] => [
  { title: "Original", steps: [step("1", "prompt", { buildCost: { tokensIn: 2_000_000, source: "maker" } }), step("2", "agent")], groups: [], models: ["Opus 5.5"] },
  { title: "Rebuild", steps: [step("1", "prompt", { buildCost: { tokensIn: 1_200_000, source: "maker" } }), step("2", "decision"), step("3", "agent", { runsWhen: { decision: "2", question: "t", is: ["a"] } })], groups: [], models: ["Sonnet 5.5"] },
];

function mount() {
  const [a, b] = sides();
  const ta = totalsOf(a);
  const tb = totalsOf(b);
  render(
    <MemoryRouter>
      <CompareView a={{ title: a.title, to: "/b2/orig" }} b={{ title: b.title, to: "/b2/copy" }} rows={matchSteps(a.steps, b.steps)} totals={totalsRows(ta, tb)} sentence={differenceSentence(tb, ta)} />
    </MemoryRouter>,
  );
}

describe("Compare (CA-13 P9)", () => {
  it("sets the totals at the top, to build and to run in separate rows, and says what differs in words", () => {
    mount();
    const cells = screen.getAllByTestId("compare-total-row").map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
    expect(cells[1]).toEqual(["2M tokens", "1.2M tokens"]);
    const labels = screen.getAllByTestId("compare-total-row").map((row) => within(row).getByRole("rowheader").textContent);
    expect(labels).toEqual(["To build · time", "To build · tokens", "To build · cost", "To run", "Steps", "Models used"]);
    expect(screen.getByTestId("compare-sentence").textContent).toMatch(/^This one used a router/);
    expect(screen.getByTestId("compare-sentence").textContent).toContain("40% fewer tokens");
    expect(screen.getByRole("link", { name: "Original" }).getAttribute("href")).toBe("/b2/orig");
  });

  it("draws matched steps side by side and a gap where one has no match", () => {
    mount();
    expect(screen.getAllByTestId("compare-row")).toHaveLength(3);
    expect(screen.getAllByTestId("compare-gap")).toHaveLength(1);
    expect(screen.getAllByTestId("compare-step")).toHaveLength(5);
  });

  it("on a phone shows one build's steps at a time under a switch, with the totals still there", () => {
    phone = true;
    mount();
    expect(screen.getByTestId("compare-totals")).toBeTruthy();
    expect(screen.getAllByTestId("compare-step")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "The other" }));
    expect(screen.getAllByTestId("compare-step").length).toBe(3);
    expect(screen.getByTestId("compare-totals")).toBeTruthy();
  });
});
