import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { questionTypeLabel } from "@/lib/build/decision";

import { AddDecisionDialog, DECISION_DIALOG_COPY, type AddDecisionDialogProps } from "./AddDecisionDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
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

const rowOf = (name: string) => screen.getAllByTestId("optional-field").find((el) => el.querySelector("button span span")?.textContent === name) as HTMLElement;
/** The Optional rows are closed when the window opens; a press on the row opens it (and leaves it open). */
const openRow = (name: string) => {
  const head = rowOf(name).querySelector("button") as HTMLButtonElement;
  if (head.getAttribute("aria-expanded") !== "true") fireEvent.click(head);
};
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const status = () => screen.getByTestId("modal-status").textContent;
const type = (name: string) => fireEvent.click(within(screen.getByRole("group", { name: "Type of question 1" })).getByRole("button", { name }));

/** A complete single choice: a key and two options, on the default model or service. */
function fillChoice(option = "Option") {
  fireEvent.change(screen.getByLabelText("Key"), { target: { value: "team" } });
  fireEvent.change(screen.getByLabelText(`${option} 1`), { target: { value: "billing" } });
  fireEvent.change(screen.getByLabelText(`${option} 2`), { target: { value: "support" } });
}

describe("Add › Decision (CA-13 P2, CA-15 P8)", () => {
  it("is the shared frame: a Model block, the Questions block, then seven optional rows, all closed", () => {
    open();
    expect(screen.getByRole("dialog", { name: DECISION_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("A structured classification your application requests from a model");
    expect(screen.getByRole("heading", { name: "Model" })).toBeTruthy();
    for (const name of ["Model or service", "Version", "Invocation", "Questions"]) expect(screen.getAllByText(name).length, name).toBeGreaterThan(0);
    expect(within(screen.getByRole("radiogroup", { name: "Invocation" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Direct", "Through an adapter"]);
    expect(screen.getByTestId("optional-count").textContent).toBe("7 fields");
    expect(screen.getAllByTestId("optional-field").map((el) => el.querySelector("button span span")?.textContent)).toEqual([
      "Import from a logged request and response",
      "Calling code",
      "Input",
      "Recorded answer",
      "Installation command",
      "Examples",
      "Low-confidence handling",
    ]);
    expect(screen.getAllByTestId("optional-field").every((el) => el.querySelector("button")?.getAttribute("aria-expanded") === "false")).toBe(true);
    // The old words are gone.
    expect(document.body.textContent).not.toMatch(/Called directly|Called from|What it reads|One real answer|How to install|Paste a logged|Read it\b|Pick a/);
  });

  it("offers six question types, with the new names, and Yes or no without '(0 to 1)' (TypeSafe's own word, Noul, only for TypeSafe)", () => {
    open();
    const grid = within(screen.getByRole("group", { name: "Type of question 1" }));
    expect(grid.getAllByRole("button").map((button) => button.textContent)).toEqual(["Single choice", "Multiple choice", "Score", "Ranking", "Yes or no (Noul)", "Extraction"]);
    expect(questionTypeLabel("yesno")).toBe("Yes or no");
    expect(document.body.textContent).not.toMatch(/0 to 1\)/);
  });

  it("says what is required, in order, and Add waits", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Model or service" }));
    fireEvent.click(screen.getByRole("option", { name: /Not sure|TypeSafe Jev/ }));
    expect(status()).toBe("Required: a key for every question");
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "team" } });
    expect(status()).toBe("Required: at least two options for team");
    expect(add().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "billing" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "support" } });
    expect(status()).toBe("All required fields complete");
    expect(add().disabled).toBe(false);
  });

  it("without code says so and offers Add code, and the lack of it does not stop Add", () => {
    const onAddCode = vi.fn();
    open({ onAddCode });
    fillChoice();
    expect(add().disabled).toBe(false);
    openRow("Calling code");
    expect(screen.getByText("Add the code that calls it as a Code tile, so people copying this get the real thing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add code" }));
    expect(onAddCode).toHaveBeenCalled();
  });

  it("with code lists each Code tile to pick as the calling code", () => {
    const props = open({ codeTiles: [{ id: "c1", label: "router.py", source: "x" }] });
    openRow("Calling code");
    fireEvent.click(screen.getByRole("checkbox", { name: /router\.py/ }));
    fillChoice();
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ calledFrom: ["c1"] });
  });

  it("adds by hand: a named single choice with its options", () => {
    const props = open();
    fillChoice();
    fireEvent.click(add());
    const input = (props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.provider).toBe("typesafe-jev");
    expect(input.questions).toEqual([{ id: "team", type: "choice", instructions: "", options: [{ key: "billing" }, { key: "support" }] }]);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("an option's description reads 'Description (optional)', and an option can be dragged above another", () => {
    const props = open();
    fillChoice();
    expect((screen.getByLabelText("Description of option 1") as HTMLInputElement).placeholder).toBe("Description (optional)");
    const rows = screen.getAllByTestId("option-row");
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (key: string, value: string) => (data[key] = value), getData: (key: string) => data[key] ?? "" };
    fireEvent.dragStart(within(rows[1]).getByRole("button", { name: /^Move option 2/ }), { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    expect((screen.getByLabelText("Option 1") as HTMLInputElement).value).toBe("support");
    expect((screen.getByLabelText("Option 2") as HTMLInputElement).value).toBe("billing");
    // The arrow keys move it too.
    fireEvent.keyDown(within(screen.getAllByTestId("option-row")[0]).getByRole("button", { name: /^Move option 1/ }), { key: "ArrowDown" });
    expect((screen.getByLabelText("Option 1") as HTMLInputElement).value).toBe("billing");
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].questions[0].options.map((o: { key: string }) => o.key)).toEqual(["billing", "support"]);
  });

  it("a multiple choice and a ranking take options like a single choice, and read back as their own type", () => {
    const props = open();
    type("Multiple choice");
    fillChoice();
    expect(status()).toBe("All required fields complete");
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].questions[0]).toEqual({ id: "team", type: "multi", instructions: "", options: [{ key: "billing" }, { key: "support" }] });
    cleanup();
    const again = open();
    type("Ranking");
    fillChoice("Ranked option");
    fireEvent.click(add());
    expect((again.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].questions[0].type).toBe("rank");
  });

  it("an extraction asks for a field type, Text to begin with, and needs no options", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "amount" } });
    type("Extraction");
    expect(screen.queryByLabelText("Option 1")).toBeNull();
    const field = within(screen.getByRole("group", { name: "Field type" }));
    expect(field.getAllByRole("button").map((button) => button.textContent)).toEqual(["Text", "Number", "Date", "Amount"]);
    expect(field.getByRole("button", { name: "Text" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(field.getByRole("button", { name: "Amount" }));
    expect(status()).toBe("All required fields complete");
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].questions[0]).toEqual({ id: "amount", type: "extract", instructions: "", field: "amount" });
  });

  it("a question key is a Key, not a Name", () => {
    open();
    expect(screen.getByLabelText("Key")).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("keeps examples and low-confidence handling for the writer, and refuses an example with only one side", () => {
    const props = open();
    fillChoice();
    openRow("Examples");
    fireEvent.click(screen.getByRole("button", { name: "Add an example" }));
    fireEvent.change(screen.getByLabelText("Input of example 1"), { target: { value: "I was charged twice" } });
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("Each example needs an input and an expected output.");
    fireEvent.change(screen.getByLabelText("Expected output of example 1"), { target: { value: "team = billing" } });
    openRow("Low-confidence handling");
    fireEvent.click(screen.getByRole("button", { name: "Confidence threshold" }));
    fireEvent.change(screen.getByLabelText("Confidence threshold"), { target: { value: "0.6" } });
    fireEvent.click(add());
    const input = (props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.examples).toEqual([{ input: "I was charged twice", output: "team = billing" }]);
    expect(input.lowConfidence).toEqual({ threshold: 0.6 });
  });

  it("can escalate to a person instead of a threshold, and refuses a threshold above 1", () => {
    const props = open();
    fillChoice();
    openRow("Low-confidence handling");
    fireEvent.click(screen.getByRole("button", { name: "Confidence threshold" }));
    fireEvent.change(screen.getByLabelText("Confidence threshold"), { target: { value: "1.5" } });
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("The confidence threshold is a number from 0 to 1.");
    fireEvent.click(screen.getByRole("button", { name: "Escalate to a person" }));
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].lowConfidence).toEqual({ escalate: true });
  });

  it("adds a second question and a score's levels", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add a question" }));
    expect(screen.getAllByRole("group", { name: /^Question \d$/ })).toHaveLength(2);
    fireEvent.click(within(screen.getByRole("group", { name: "Type of question 2" })).getByRole("button", { name: "Score" }));
    expect(screen.getByRole("group", { name: "Levels of question 2, lowest to highest" })).toBeTruthy();
  });

  it("fills everything from a pasted request and response, shows 'Yes or no (Noul)' for TypeSafe, and adds with the real answer", () => {
    const props = open();
    openRow("Import from a logged request and response");
    fireEvent.change(screen.getByLabelText("Import from a logged request and response"), { target: { value: `${JSON.stringify(request)}\n${JSON.stringify(response)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(within(rowOf("Import from a logged request and response")).getByRole("status").textContent).toMatch(/Read 2 questions and an answer/);
    expect((screen.getByLabelText("Version") as HTMLInputElement).value).toBe("jev-1.13.0");
    expect(screen.getAllByRole("button", { name: "Yes or no (Noul)" }).length).toBeGreaterThan(0);
    fireEvent.click(add());
    const input = (props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(input.questions.map((q: { id: string }) => q.id)).toEqual(["team", "escalation"]);
    expect(input.answer.team).toEqual({ value: "billing", probabilities: { billing: 0.92, support: 0.05, kitchen: 0.03 }, confidence: undefined });
    expect(input.answer.escalation.value).toBe(0.18);
    expect(input.source).toBe("run");
    expect(input.stateSample).toBe("I was charged twice.");
  });

  it("removes a pasted key and says so", () => {
    open();
    openRow("Import from a logged request and response");
    const curl = `curl -H "Authorization: Bearer abcdef123456789" --data '${JSON.stringify(request)}'`;
    fireEvent.change(screen.getByLabelText("Import from a logged request and response"), { target: { value: curl } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(within(rowOf("Import from a logged request and response")).getByRole("status").textContent).toContain("Your key was removed; it is never stored.");
  });

  it("says plainly when Python is built from variables", () => {
    open({ codeTiles: [{ id: "c1", label: "router.py", source: `questions={"team": Choice(instructions=PROMPT, options=TEAMS)}` }] });
    openRow("Import from a logged request and response");
    fireEvent.change(screen.getByLabelText("Import from a logged request and response"), { target: { value: `questions = {"team": Choice(instructions=PROMPT, options=TEAMS)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(within(rowOf("Import from a logged request and response")).getByRole("status").textContent).toContain("These questions are built in code, so they can't be read safely.");
  });

  it("a recorded answer to a multiple choice must be made of its options, and the row opens on its own to say so", () => {
    const props = open();
    type("Multiple choice");
    fillChoice();
    openRow("Recorded answer");
    fireEvent.change(screen.getByLabelText("Answer to team"), { target: { value: "billing, kitchen" } });
    fireEvent.click(rowOf("Recorded answer").querySelector("button") as HTMLButtonElement);
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("'team' was answered with something that is not made of its options.");
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(rowOf("Recorded answer").querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Answer to team"), { target: { value: "billing, support" } });
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].answer.team).toEqual({ value: "billing, support" });
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
  });
});
