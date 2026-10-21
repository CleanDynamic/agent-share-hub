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
const find = () => screen.getByRole("combobox", { name: "Find an app" });
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;

describe("Add › Tool (CA-02 P6, CA-12 P7)", () => {
  it("is a dialog asking the app, how it was connected and what it did, with no default app", () => {
    open();
    expect(screen.getByRole("dialog", { name: TOOL_DIALOG_COPY.title })).toBeTruthy();
    expect(toolButton().textContent).toBe("Pick an app");
    expect(screen.getAllByRole("group", { name: "How was it connected?" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("What did it do?")).toBeTruthy();
    expect(add().disabled).toBe(true);
  });

  it("labels the field in sentence case, never in capitals", () => {
    open();
    expect(document.body.innerHTML).not.toMatch(/text-transform:\s*uppercase/);
  });

  it("lists apps and services, not AI tools", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(["GitHub", "Stripe", "Supabase", "Gmail", "Vercel", "n8n"]));
    expect(names).not.toContain("Claude");
    expect(names).not.toContain("ChatGPT");
  });

  it("says GitHub Copilot is an AI tool when GitHub is typed", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "github" } });
    expect(screen.getByText("GitHub Copilot is an AI tool. Add it to a session or a prompt.")).toBeTruthy();
  });

  it("hands back the app, how it was connected and what it did", () => {
    const props = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "github" } });
    fireEvent.keyDown(find(), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "MCP server" }));
    fireEvent.change(screen.getByLabelText("What did it do?"), { target: { value: " read issues " } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ service: "GitHub", connection: "mcp", scopes: "read issues" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("takes a typed app as typed, with no connection when none is chosen", () => {
    const typed = open();
    fireEvent.click(toolButton());
    fireEvent.change(find(), { target: { value: "  My CRM " } });
    fireEvent.keyDown(find(), { key: "Enter" });
    fireEvent.click(add());
    expect(typed.onAdd).toHaveBeenCalledWith({ service: "My CRM", connection: null, scopes: "" });
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-tool-dialog")).toBeNull();
  });
});
