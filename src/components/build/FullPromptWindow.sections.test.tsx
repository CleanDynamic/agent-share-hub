// CA-18 P2: the prompt window has the sections Details had for a prompt: its model, how it was run, what it uses and what it makes.
// It saves as it goes, as it always did (Done closes it), through the same handlers.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxGroups, sandboxListProps } from "@/dev/fixtures/sandbox";
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

function open(mode: "maker" | "reader", over: Partial<PromptView> = {}, extra: { groups?: boolean; openId?: string } = {}) {
  const base = sandboxListProps("bakery");
  const view = { ...(tileView("prompt", "full") as PromptView), id: "p3", ...over };
  const h = handlers();
  const onExtras = vi.fn();
  render(<FullPromptWindow steps={base.steps} groups={extra.groups ? sandboxGroups("bakery") : undefined} openId={extra.openId ?? "p3"} mode={mode} onClose={vi.fn()} onTitle={vi.fn()} onReply={vi.fn()} onExtras={onExtras} details={() => view} handlers={h} />);
  return { ...h, onExtras };
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

describe("F30, F36 and F37 · one Model, one way of saving, the same sections", () => {
  it("F30: writes as it goes, so the footer's button is Close and Saved stands beside it after a write", () => {
    const h = open("maker");
    expect(screen.getByTestId("prompt-close").textContent).toBe("Close");
    expect(screen.getByTestId("prompt-saved").textContent).toBe("");
    fireEvent.click(within(screen.getByTestId("edit-uses")).getByRole("button", { name: "Remove menu.pdf" }));
    expect(h.onRemoveUse).toHaveBeenCalled();
    expect(screen.getByTestId("prompt-saved").textContent).toBe("Saved");
  });

  it("F36: Model appears once, Used by stays with an empty line, and the sections keep one order for a prompt with and without content", () => {
    open("maker", { goesInto: [] });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("group", { name: "Model" })).toHaveLength(1);
    expect(within(dialog).getAllByRole("button", { name: /^Model( |$)/ })).toHaveLength(1);
    expect(within(screen.getByTestId("edit-goes-into")).getByTestId("edit-goes-into-empty").textContent).toBe("Not used by any step yet");
    const order = (root: HTMLElement) => ["edit-uses", "edit-makes", "edit-goes-into"].map((id) => within(root).getByTestId(id)).map((el) => el.compareDocumentPosition(within(root).getByRole("group", { name: "Model" })) & Node.DOCUMENT_POSITION_PRECEDING ? "after" : "before");
    expect(order(dialog)).toEqual(["after", "after", "after"]);
    // Model settings no longer draws the model: effort and instructions only.
    fireEvent.click(within(dialog).getByRole("button", { name: /^Optional/ }));
    expect(within(dialog).getByText("Model settings")).toBeTruthy();
    expect(within(dialog).getAllByRole("button", { name: /^Model( |$)/ })).toHaveLength(1);
  });

  it("F37: a prompt in a session with no model of its own reads the session's, as From session; no session at all says so", () => {
    // p3 sits in Session 2 (Claude Code · Sonnet 5.5) in the bakery fixture.
    open("maker", { typed: false, model: null, tool: null }, { groups: true });
    expect(screen.getByTestId("model-from-session").textContent).toBe("From session: Sonnet 5.5");
    expect(screen.queryByText("No session to read the model from")).toBeNull();
    cleanup();
    // p4 was typed here, into no session: the line says so.
    open("maker", { id: "p4", typed: true, model: null, tool: "ChatGPT" }, { groups: true, openId: "p4" });
    expect(screen.getByText("No session to read the model from")).toBeTruthy();
    expect(screen.queryByTestId("model-from-session")).toBeNull();
  });
});
