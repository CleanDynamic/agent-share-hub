import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("trims the name and passes the chosen model", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Order checker " } });
    const model = screen.getByLabelText("Model") as HTMLSelectElement;
    const other = [...model.options].find((option) => option.value !== DEFAULT_AGENT_MODEL)!;
    fireEvent.change(model, { target: { value: other.value } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: "Order checker", model: other.value });
  });

  it("changes the placeholder to Team {n} for a team, and asks for the model of its first agent", () => {
    const props = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).placeholder).toBe("Team 4");
    expect(screen.getByLabelText("Model of its first agent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "team", name: null, model: DEFAULT_AGENT_MODEL });
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
