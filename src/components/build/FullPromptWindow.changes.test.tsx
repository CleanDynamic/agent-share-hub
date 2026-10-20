// CA-05 P1 — the full prompt window marks the words a reader changes, and takes the mark off again.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const TEXT = "Write a welcome email for Ada's Bakery.";
const node = (payload: Record<string, unknown>): NodeTree =>
  ({ id: "p1", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

function open(payload: Record<string, unknown>, over: Partial<FullPromptWindowProps> = {}) {
  const props: FullPromptWindowProps = { steps: buildSteps([node({ text: TEXT, ...payload })]), openId: "p1", mode: "maker", onTitle: vi.fn(), onChanges: vi.fn(), onClose: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <FullPromptWindow {...props} />
    </MemoryRouter>,
  );
  return props;
}

/** Select `word` inside the text box, the way a mouse would. */
function select(word: string) {
  const box = screen.getByTestId("full-prompt-text");
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  let at = 0;
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const index = (current.textContent ?? "").indexOf(word);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(current, index);
      range.setEnd(current, index + word.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      fireEvent.mouseUp(box);
      return at + index;
    }
    at += (current.textContent ?? "").length;
  }
  throw new Error(`not found: ${word}`);
}

describe("words a reader changes, in the window", () => {
  it("shows nothing at all for a prompt without any", () => {
    open({});
    expect(screen.queryByTestId("changes-line")).toBeNull();
    expect(screen.queryByTestId("changed-words")).toBeNull();
    expect(screen.queryByRole("button", { name: "A reader changes this" })).toBeNull();
  });

  it("offers one action on a selection and saves the range", () => {
    const props = open({});
    const start = select("Ada's Bakery");
    fireEvent.click(screen.getByRole("button", { name: "A reader changes this" }));
    expect(props.onChanges).toHaveBeenCalledWith("p1", [{ start, end: start + "Ada's Bakery".length }]);
  });

  it("draws the words outlined, says how many, and offers Keep as written", () => {
    const start = TEXT.indexOf("Ada's Bakery");
    const props = open({ changes: [{ start, end: start + 12 }, { start: 8, end: 15 }] });
    expect(screen.getAllByTestId("changed-words").map((el) => el.textContent)).toEqual(["welcome", "Ada's Bakery"]);
    expect(screen.getByTestId("changes-line").textContent).toBe("2 words to change before you send it");
    select("Ada's Bakery");
    fireEvent.click(screen.getByRole("button", { name: "Keep as written" }));
    expect(props.onChanges).toHaveBeenCalledWith("p1", [{ start: 8, end: 15 }]);
  });

  it("is not offered to a reader", () => {
    open({ changes: [{ start: 8, end: 15 }] }, { mode: "reader", onChanges: undefined });
    select("welcome");
    expect(screen.queryByRole("button", { name: "Keep as written" })).toBeNull();
    expect(screen.getByTestId("changes-line")).toBeTruthy();
  });
});
