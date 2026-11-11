// BF-09 P4 (F2): the window that names a filter set. The claims: with no name it says why Save is off, and the field and the
// button are described by that line; with a name the line goes and Save is on; the field has focus when the window opens.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SetNameDialog } from "./SetDialogs";

function draw(initialName = "") {
  render(<SetNameDialog open onOpenChange={vi.fn()} title="Save these filters" description="Keep the filters you have chosen under a name." submitLabel="Save" initialName={initialName} askPublic onSubmit={vi.fn(async () => undefined)} />);
}

describe("SetNameDialog", () => {
  it('with no name, a hint reads "Give it a name to save." and both the field and the Save button are described by it', () => {
    draw();
    const hint = screen.getByText("Give it a name to save.");
    expect(hint.id).toBe("set-name-hint");
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBe("set-name-hint");
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute("aria-describedby")).toBe("set-name-hint");
  });

  it("with a name, the hint is not drawn and Save is enabled", () => {
    draw();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Law, newest" } });
    expect(screen.queryByText("Give it a name to save.")).toBeNull();
    expect(screen.getByLabelText("Name").getAttribute("aria-describedby")).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("the name field has focus when the dialog opens", () => {
    draw();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });
});
