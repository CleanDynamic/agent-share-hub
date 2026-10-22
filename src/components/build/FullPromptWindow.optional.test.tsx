// CA-15 P2 — the prompt window's Optional section: Model settings and Variables, for the maker and for a reader.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { FullPromptWindow, type FullPromptWindowProps } from "./FullPromptWindow";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TEXT = "Write a welcome email for {customer} at {shop}.";
const node = (payload: Record<string, unknown>): NodeTree =>
  ({ id: "p1", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

function open(payload: Record<string, unknown>, over: Partial<FullPromptWindowProps> = {}) {
  const props: FullPromptWindowProps = { steps: buildSteps([node({ text: TEXT, ...payload })]), openId: "p1", mode: "maker", onTitle: vi.fn(), onExtras: vi.fn(), onText: vi.fn(), onClose: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <FullPromptWindow {...props} />
    </MemoryRouter>,
  );
  return props;
}

const row = (name: string) => screen.getAllByTestId("optional-field").find((el) => within(el).queryByText(name)) as HTMLElement;
const head = (name: string) => within(row(name)).getByRole("button", { name: new RegExp(name) });

function select(word: string) {
  const box = screen.getByTestId("full-prompt-text");
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const index = (current.textContent ?? "").indexOf(word);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(current, index);
      range.setEnd(current, index + word.length);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      fireEvent.mouseUp(box);
      return;
    }
  }
  throw new Error(`not found: ${word}`);
}

describe("the prompt window's Optional section (maker)", () => {
  it("has Model settings and Variables, both closed", () => {
    open({});
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields");
    expect(head("Model settings").getAttribute("aria-expanded")).toBe("false");
    expect(head("Variables").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("radiogroup", { name: "Reasoning effort" })).toBeNull();
  });

  it("saves the reasoning effort in payload.settings, leaving payload.model alone", () => {
    const props = open({ model: "Fable 5.1" });
    fireEvent.click(head("Model settings"));
    const group = screen.getByRole("radiogroup", { name: "Reasoning effort" });
    fireEvent.click(within(group).getByRole("radio", { name: "Low" }));
    expect(props.onExtras).toHaveBeenCalledWith("p1", { settings: { model: "", effort: "low", instructions: "" } });
  });

  it("falls back to payload.model while settings.model is empty, and prefers settings.model when it is given", () => {
    open({ model: "Fable 5.1", settings: { model: "", effort: "default", instructions: "" } });
    expect(within(row("Model settings")).getByTestId("optional-line").textContent).toMatch(/Fable/);
    cleanup();
    open({ model: "Fable 5.1", settings: { model: "Opus 5.5", effort: "high", instructions: "" } });
    const line = within(row("Model settings")).getByTestId("optional-line").textContent ?? "";
    expect(line).toMatch(/Opus/);
    expect(line).toMatch(/High effort/);
    expect(line).not.toMatch(/Fable/);
  });

  it("saves the custom instructions when the box is left", () => {
    const props = open({});
    fireEvent.click(head("Model settings"));
    const box = screen.getByLabelText("Custom instructions or project knowledge that applied");
    fireEvent.change(box, { target: { value: "  Always British spelling  " } });
    fireEvent.blur(box);
    expect(props.onExtras).toHaveBeenCalledWith("p1", { settings: { model: "", effort: "default", instructions: "Always British spelling" } });
  });

  it("lists the variables written in the prompt, and saves a description for one", () => {
    const props = open({});
    expect(within(row("Variables")).getByTestId("optional-line").textContent).toBe("{customer}, {shop}");
    fireEvent.click(head("Variables"));
    const field = screen.getByLabelText("{customer}");
    fireEvent.change(field, { target: { value: " The customer's first name " } });
    fireEvent.blur(field);
    expect(props.onExtras).toHaveBeenCalledWith("p1", {
      variables: [
        { name: "customer", description: "The customer's first name" },
        { name: "shop", description: "" },
      ],
    });
  });

  it("wraps the selected text in braces with Mark selection as a variable", () => {
    const props = open({ text: "Write a welcome email for Ada at the bakery." });
    fireEvent.click(head("Variables"));
    const mark = screen.getByRole("button", { name: "Mark selection as a variable" }) as HTMLButtonElement;
    expect(mark.disabled).toBe(true);
    select("Ada");
    expect(mark.disabled).toBe(false);
    fireEvent.click(mark);
    expect(props.onText).toHaveBeenCalledWith("p1", "Write a welcome email for {Ada} at the bakery.");
  });
});

describe("the prompt window's Optional section (reader)", () => {
  it("shows only the rows that hold a value, closed, read-only", () => {
    open({ model: "Fable 5.1", settings: { model: "", effort: "high", instructions: "Plain words only" } }, { mode: "reader", onTitle: undefined, onExtras: undefined });
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields");
    expect(head("Model settings").getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(head("Model settings"));
    expect(screen.getByText("Plain words only")).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Reasoning effort" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark selection as a variable" })).toBeNull();
  });

  it("draws no Optional section when nothing in it is held", () => {
    open({ text: "Write a welcome email." }, { mode: "reader", onTitle: undefined, onExtras: undefined });
    expect(screen.queryByTestId("optional-section")).toBeNull();
  });
});
