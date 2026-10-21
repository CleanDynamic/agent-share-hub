import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddDecisionDialog, DECISION_DIALOG_COPY, type AddDecisionDialogProps } from "./AddDecisionDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddDecisionDialogProps> = {}) {
  const props: AddDecisionDialogProps = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), codeTiles: [], stepChoices: [], ...over };
  render(<AddDecisionDialog {...props} />);
  return props;
}

const request = {
  model: "jev-1.13.0",
  state: "I was charged twice.",
  questions: {
    team: { type: "choice", instructions: "Which team?", options: { billing: "", support: "", kitchen: "" } },
    escalation: { type: "noul", instructions: "Escalate?" },
  },
};
const response = { answers: { team: { answer: "billing", probabilities: { billing: 0.92, support: 0.05, kitchen: 0.03 } }, escalation: { answer: 0.18 } } };

describe("Add › Decision (CA-13 P2)", () => {
  it("is a dialog with the model, called from, what it reads, questions, one real answer and the fast route", () => {
    open();
    expect(screen.getByRole("dialog", { name: DECISION_DIALOG_COPY.title })).toBeTruthy();
    for (const name of ["Model or service", "Called from", "What it reads", "Questions", "One real answer", "Paste a logged request and response"]) {
      expect(screen.getAllByText(name).length, name).toBeGreaterThan(0);
    }
    expect(screen.getByRole("button", { name: "Called directly" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Through an adapter" })).toBeTruthy();
  });

  it("without code says so and offers Add code; it does not stop Add", () => {
    const onAddCode = vi.fn();
    open({ onAddCode });
    expect(screen.getByText("Add the code that calls it as a Code tile, so people copying this get the real thing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add code" }));
    expect(onAddCode).toHaveBeenCalled();
  });

  it("with code lists each Code tile to pick as what calls it", () => {
    const props = open({ codeTiles: [{ id: "c1", label: "router.py", source: "x" }] });
    fireEvent.click(screen.getByRole("checkbox", { name: /router\.py/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "team" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "billing" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "support" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ calledFrom: ["c1"] });
  });

  it("adds by hand: a named choice with its options", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "team" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "billing" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "support" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const input = (props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.provider).toBe("typesafe-jev");
    expect(input.questions).toEqual([{ id: "team", type: "choice", instructions: "", options: [{ key: "billing" }, { key: "support" }] }]);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("will not add a decision with an unnamed question or too few options, and says why", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert").textContent).toMatch(/question with no name/);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("adds a second question and a score's levels", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add a question" }));
    expect(screen.getAllByRole("group", { name: /^Question \d$/ })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Score" })[1]);
    expect(screen.getByRole("group", { name: "Levels of question 2, lowest to highest" })).toBeTruthy();
  });

  it("fills everything from a pasted request and response, shows 'Yes or no (Noul)' for TypeSafe, and adds with the real answer", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Paste a logged request and response"), { target: { value: `${JSON.stringify(request)}\n${JSON.stringify(response)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Read it" }));
    expect(screen.getByRole("status").textContent).toMatch(/Read 2 questions and an answer/);
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("jev-1.13.0");
    expect(screen.getAllByRole("button", { name: "Yes or no (Noul)" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const input = (props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.questions.map((q: { id: string }) => q.id)).toEqual(["team", "escalation"]);
    expect(input.answer.team).toEqual({ value: "billing", probabilities: { billing: 0.92, support: 0.05, kitchen: 0.03 }, confidence: undefined });
    expect(input.answer.escalation.value).toBe(0.18);
    expect(input.source).toBe("run");
    expect(input.stateSample).toBe("I was charged twice.");
  });

  it("removes a pasted key and says so", () => {
    open();
    const curl = `curl -H "Authorization: Bearer abcdef123456789" --data '${JSON.stringify(request)}'`;
    fireEvent.change(screen.getByLabelText("Paste a logged request and response"), { target: { value: curl } });
    fireEvent.click(screen.getByRole("button", { name: "Read it" }));
    expect(screen.getByRole("status").textContent).toContain("Your key was removed; it is never stored.");
  });

  it("says plainly when Python is built from variables, and reads a Code tile with literal Python", () => {
    open({ codeTiles: [{ id: "c1", label: "router.py", source: `questions={"team": Choice(instructions=PROMPT, options=TEAMS)}` }] });
    fireEvent.change(screen.getByLabelText("Paste a logged request and response"), { target: { value: `questions = {"team": Choice(instructions=PROMPT, options=TEAMS)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Read it" }));
    expect(screen.getByRole("status").textContent).toContain("These questions are built in code, so they can't be read safely.");
  });
});
