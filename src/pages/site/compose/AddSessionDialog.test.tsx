import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddSessionDialog, SESSION_DIALOG_COPY, type AddSessionDialogProps } from "./AddSessionDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddSessionDialogProps> = {}) {
  const props: AddSessionDialogProps = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), ...over };
  render(<AddSessionDialog {...props} />);
  return props;
}

const toolButton = () => screen.getByRole("button", { name: "Tool" });
const find = () => screen.getByRole("combobox", { name: "Find a tool" });
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;

describe("Add › New session (CA-04 P1)", () => {
  it("asks only for the tool, Typed here until one is picked", () => {
    const props = open();
    expect(screen.getByRole("dialog", { name: SESSION_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Typed here", "Cancel", "Add"]);
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(null);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hands back the tool picked", () => {
    const props = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "claude code" } });
    fireEvent.click(screen.getByRole("option", { name: /^Claude Code/ }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith("claude-code");
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-session-dialog")).toBeNull();
  });
});
