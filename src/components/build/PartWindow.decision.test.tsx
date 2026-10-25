import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import { refTo } from "@/lib/build/thread";
import type { NodeTree } from "@/lib/build/types";

import { PartWindow } from "./PartWindow";

const BUILD = "33333333-0000-4000-8000-000000000003";
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const questions = [
  { id: "team", type: "choice", instructions: "Which team owns this?", options: [{ key: "billing" }, { key: "support" }] },
  { id: "escalation", type: "yesno", instructions: "Escalate?" },
];
const tree = (calledFrom: string[]) => [
  node({ id: "code1", position: 1, type: "code", payload: { source: "client.decide(questions)", language: "python", filename: "router.py" } }),
  node({
    id: "dec",
    position: 2,
    type: "decision",
    payload: {
      provider: "typesafe-jev",
      model: "jev-1.13.0",
      called_from: calledFrom,
      questions,
      answer: { team: { value: "billing", probabilities: { billing: 0.92, support: 0.08 } }, escalation: { value: 0.18 } },
      source: "run",
      state_sample: "I was charged twice.",
    },
  }),
];

let written = "";
beforeEach(() => {
  written = "";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (words: string) => void (written = words) } });
});
afterEach(() => cleanup());

function open(calledFrom: string[]) {
  const onGo = vi.fn();
  render(<PartWindow steps={buildSteps(tree(calledFrom))} groups={[]} open={refTo({ kind: "node", id: "dec" })} onClose={vi.fn()} onGo={onGo} />);
  return { onGo };
}

describe("a Decision's window (CA-13 P2)", () => {
  it("shows each question in full, the answer with its bars, the state and where the figures came from", () => {
    open([]);
    expect(screen.getByText("Decision · Jev 1.13")).toBeTruthy();
    expect(screen.getByText("Which team owns this?")).toBeTruthy();
    expect(screen.getAllByTestId("certainty")).toHaveLength(1);
    expect(screen.getByTestId("certainty-words").textContent).toBe("92% confidence");
    expect(screen.getByText("From the run")).toBeTruthy();
    expect(screen.getByText("escalation")).toBeTruthy();
    expect(screen.getByText("Yes or no")).toBeTruthy();
    expect(screen.getByTestId("decision-state").textContent).toContain("I was charged twice.");
  });

  it("with no code, 'Copy as a request' is the only button, and says it was written from the page", async () => {
    open([]);
    expect(screen.queryByRole("button", { name: "Copy the code" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy as a request" }));
    await waitFor(() => expect(written).toContain("TYPESAFE_API_KEY"));
    expect(written).toContain("curl");
    expect(screen.getByText(/not the maker's own code/)).toBeTruthy();
  });

  it("with a Code tile that calls it, 'Copy the code' is the main button and copies that tile's real code", async () => {
    const { onGo } = open(["code1"]);
    expect(screen.getByRole("button", { name: "Copy as a request" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy the code" }));
    await waitFor(() => expect(written).toBe("client.decide(questions)"));
    fireEvent.click(screen.getByRole("button", { name: /router\.py/ }));
    expect(onGo).toHaveBeenCalledWith(refTo({ kind: "node", id: "code1" }));
  });
});
