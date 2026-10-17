import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddAgentDialog, AGENT_DIALOG_COPY, DEFAULT_AGENT_MODEL, type AddAgentDialogProps } from "./AddAgentDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone && /max-width/.test(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddAgentDialogProps> = {}) {
  const props: AddAgentDialogProps = { open: true, onOpenChange: vi.fn(), nextNumber: 4, teamsAvailable: true, onAdd: vi.fn(), ...over };
  render(<AddAgentDialog {...props} />);
  return props;
}

describe("the Add dialog", () => {
  it("is a dialog with a real radio group: one agent, or a team of agents, one agent chosen to start", () => {
    open();
    expect(screen.getByRole("dialog", { name: AGENT_DIALOG_COPY.title })).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "What to add" });
    expect(group).toBeTruthy();
    const one = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.one) }) as HTMLInputElement;
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }) as HTMLInputElement;
    expect(one.checked).toBe(true);
    expect(team.checked).toBe(false);
  });

  it("is 420 wide", () => {
    open();
    expect(screen.getByTestId("add-agent-dialog").style.width).toBe("420px");
  });

  it("puts the default title in the name's placeholder, and saves an empty name as null", () => {
    const props = open();
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.placeholder).toBe("Agent 4");
    expect(name.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, tool: null });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("trims the name and passes the chosen model", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Order checker " } });
    const model = screen.getByLabelText("Model") as HTMLSelectElement;
    const other = [...model.options].find((option) => option.value !== DEFAULT_AGENT_MODEL)!;
    fireEvent.change(model, { target: { value: other.value } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: "Order checker", model: other.value, tool: null });
  });

  it("changes the placeholder to Team {n} for a team, and asks for the model of its first agent", () => {
    const props = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).placeholder).toBe("Team 4");
    expect(screen.getByLabelText("Model of its first agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "team", name: null, model: DEFAULT_AGENT_MODEL, tool: null });
  });

  it("asks what an agent runs in, optional, with no tool to start and the build's tools first (TF-04)", () => {
    const props = open({ inBuild: ["Midjourney"] });
    const trigger = screen.getByRole("button", { name: "Runs in" });
    expect(trigger.textContent).toBe("Pick a tool");
    fireEvent.click(trigger);
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0].textContent).toBe("No tool");
    expect(options[1].textContent).toBe("Midjourney");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Find a tool" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ kind: "agent", tool: null }));
  });

  it("passes the tool picked, between the name and the model (TF-04)", () => {
    const props = open();
    const picker = screen.getByRole("button", { name: "Runs in" });
    const order = [screen.getByLabelText("Name"), picker, screen.getByLabelText("Model")];
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(picker);
    const find = screen.getByRole("combobox", { name: "Find a tool" });
    fireEvent.change(find, { target: { value: "OpenClaw" } });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "OpenClaw" }));
    expect(picker.textContent).toBe("OpenClaw");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, tool: "openclaw" });
  });

  it("gives a team no tool: no picker, and none passed even after one was picked (TF-04)", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Runs in" }));
    const find = screen.getByRole("combobox", { name: "Find a tool" });
    fireEvent.change(find, { target: { value: "OpenClaw" } });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "OpenClaw" }));
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect(screen.queryByRole("button", { name: "Runs in" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "team", name: null, model: DEFAULT_AGENT_MODEL, tool: null });
  });

  it("disables the team and says why while the team type is not live", () => {
    open({ teamsAvailable: false });
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }) as HTMLInputElement;
    expect(team.disabled).toBe(true);
    expect(screen.getByText("Teams need the Deploy queue item from UI-P61.")).toBeTruthy();
  });

  it("closes on Cancel without adding", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a bottom sheet on a phone, with 44-tall buttons", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-agent-dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("draws nothing while closed", () => {
    open({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
