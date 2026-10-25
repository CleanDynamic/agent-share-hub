// CA-18 P2: the prompt window has the sections Details had for a prompt: its model, how it was run, what it uses and what it makes.
// It saves as it goes, as it always did (Done closes it), through the same handlers.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { tileView } from "@/dev/fixtures/detailsKinds";
import type { PromptView } from "@/pages/site/compose/DetailsPanel";

import { FullPromptWindow } from "./FullPromptWindow";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const handlers = () => ({ onModel: vi.fn(), onModelRun: vi.fn(), onAddUse: vi.fn(), onAttach: vi.fn(), onRemoveUse: vi.fn(), onAddMade: vi.fn(), onRemoveMade: vi.fn(), onFields: vi.fn() });

function open(mode: "maker" | "reader", over: Partial<PromptView> = {}) {
  const base = sandboxListProps("bakery");
  const view = { ...(tileView("prompt", "full") as PromptView), id: "p3", ...over };
  const h = handlers();
  render(<FullPromptWindow steps={base.steps} openId="p3" mode={mode} onClose={vi.fn()} onTitle={vi.fn()} details={() => view} handlers={h} />);
  return h;
}

describe("the prompt window's own sections (CA-18)", () => {
  it("shows the model of a prompt typed here, what it uses and what it makes", () => {
    open("maker");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Model")).toBeTruthy();
    expect(within(dialog).getByTestId("edit-uses")).toBeTruthy();
    expect(within(dialog).getByTestId("edit-makes")).toBeTruthy();
    expect(within(dialog).getByTestId("edit-goes-into")).toBeTruthy();
  });

  it("removes an input at once, through onRemoveUse", () => {
    const h = open("maker");
    fireEvent.click(within(screen.getByTestId("edit-uses")).getByRole("button", { name: "Remove menu.pdf" }));
    expect(h.onRemoveUse).toHaveBeenCalledWith("p3", { kind: "file", node_id: "f1" });
  });

  it("names a file it makes through onAddMade, and renames one through onFields", () => {
    const h = open("maker");
    const makes = within(screen.getByTestId("edit-makes"));
    fireEvent.click(makes.getByRole("button", { name: "Add file name" }));
    fireEvent.change(makes.getByRole("textbox", { name: "Add file name" }), { target: { value: "brand-guide.md" } });
    fireEvent.keyDown(makes.getByRole("textbox", { name: "Add file name" }), { key: "Enter" });
    expect(h.onAddMade).toHaveBeenCalledWith("p3", "brand-guide.md");
    fireEvent.blur(makes.getByRole("textbox", { name: "Name of menu.css" }), { target: { value: "menu.min.css" } });
    expect(h.onFields).toHaveBeenCalledWith("m1", { title: "menu.min.css" });
  });

  it("is the maker's: a reader sees none of them", () => {
    open("reader");
    expect(screen.queryByTestId("edit-uses")).toBeNull();
    expect(screen.queryByTestId("edit-makes")).toBeNull();
  });
});
