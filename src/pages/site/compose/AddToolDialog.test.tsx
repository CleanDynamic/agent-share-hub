import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddToolDialog, TOOL_DIALOG_COPY, type AddToolDialogProps } from "./AddToolDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddToolDialogProps> = {}) {
  const props: AddToolDialogProps = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), ...over };
  render(<AddToolDialog {...props} />);
  return props;
}

const toolButton = () => screen.getByRole("button", { name: "Tool" });
const find = () => screen.getByRole("combobox", { name: "Find a tool" });
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;

describe("Add › Tool (CA-02 P6)", () => {
  it("is a dialog with one tool picker and no default", () => {
    open();
    expect(screen.getByRole("dialog", { name: TOOL_DIALOG_COPY.title })).toBeTruthy();
    expect(toolButton().textContent).toBe("Pick a tool");
    expect(add().disabled).toBe(true);
  });

  it("lists only tools an agent or a step can call", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(["Gmail", "Vercel", "n8n", "Zapier", "Make", "ElevenLabs", "Notion"]));
    expect(names).not.toContain("Claude");
    expect(names).not.toContain("Hermes Agent");
  });

  it("shows a tool that does not fit, unavailable, with where it goes", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "claude" } });
    const claude = screen.getByRole("option", { name: /^Claude Add it with Add › Prompt/ });
    expect(claude.getAttribute("aria-disabled")).toBe("true");
  });

  it("names a listed tool by its name, and takes a typed one as typed", () => {
    const props = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "gmail" } });
    fireEvent.keyDown(find(), { key: "Enter" });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith("Gmail");
    cleanup();

    const typed = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "  My CRM " } });
    fireEvent.keyDown(find(), { key: "Enter" });
    fireEvent.click(add());
    expect(typed.onAdd).toHaveBeenCalledWith("My CRM");
    expect(typed.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-tool-dialog")).toBeNull();
  });
});
