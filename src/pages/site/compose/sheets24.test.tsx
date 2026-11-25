// Prompt 24: the editor's sheets on a phone. The pick list pushed inside a sheet, the footer's action that takes a tap while a
// field is missing, the notepad's Cancel that asks before dropping words, and the step sheet's Back and Next.

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Notepad } from "@/components/brand/Notepad";
import { PhonePickList } from "@/components/phone/PhonePickList";

import { ModalForm, ModalShell, PHONE_NOT_READY_OPACITY } from "./ModalFrame";
import { FieldInput, Row } from "./modalRecipes";
import { PickMenu } from "./PickMenu";

const phoneMedia = (query: string) => ({ matches: /max-width: 767px/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined });

beforeEach(() => {
  vi.stubGlobal("matchMedia", phoneMedia);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the pick list on a phone", () => {
  it("filters by the search, marks the chosen row, and picking closes it", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<PhonePickList open onClose={onClose} title="Model" value="Sonnet 5.5" onPick={onPick} groups={[{ head: "Anthropic", items: [{ value: "Sonnet 5.5", label: "Sonnet 5.5" }, { value: "Opus 5.5", label: "Opus 5.5" }] }, { head: "Other", items: [{ value: "Gemma", label: "Gemma" }] }]} />);
    const list = screen.getByTestId("pick-list");
    expect(within(list).getByRole("button", { name: "Back" })).toBeTruthy();
    expect(within(list).getByRole("option", { name: "Sonnet 5.5" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.change(within(list).getByRole("combobox", { name: "Find" }), { target: { value: "opus" } });
    expect(within(list).queryByRole("option", { name: "Gemma" })).toBeNull();
    fireEvent.click(within(list).getByRole("option", { name: "Opus 5.5" }));
    expect(onPick).toHaveBeenCalledWith("Opus 5.5");
    expect(onClose).toHaveBeenCalled();
  });

  it("is what a PickMenu field opens on a phone", () => {
    function Host() {
      const [value, setValue] = useState<string | null>(null);
      return <PickMenu label="Connection method" options={[{ value: "mcp", label: "MCP server" }, { value: "api", label: "API key" }]} value={value} onChange={setValue} phone field />;
    }
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "Connection method" }));
    fireEvent.click(within(screen.getByTestId("pick-list")).getByRole("option", { name: "API key" }));
    expect(screen.queryByTestId("pick-list")).toBeNull();
    expect(screen.getByRole("button", { name: "Connection method" }).textContent).toContain("API key");
  });
});

describe("the form sheet's footer on a phone", () => {
  it("leaves the action answering a tap while a field is missing: it goes to the field instead of sending", async () => {
    const onSubmit = vi.fn();
    function Host() {
      const [app, setApp] = useState("");
      return (
        <ModalShell open onOpenChange={() => undefined} title="Add a tool" subtitle="External app the model used" testId="t">
          <ModalForm phone missing={app ? null : "Application"} status={app ? null : "Required: an application"} onSubmit={onSubmit} onCancel={() => undefined}>
            <Row id="app" label="Application" phone>
              <FieldInput id="app" phone value={app} onChange={(event) => setApp(event.target.value)} />
            </Row>
          </ModalForm>
        </ModalShell>
      );
    }
    render(<Host />);
    const sheet = await screen.findByRole("dialog", { name: "Add a tool" });
    expect(sheet.getAttribute("data-height")).toBe("full");
    const add = within(sheet).getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    expect(add.getAttribute("aria-disabled")).toBe("true");
    expect(add.style.opacity).toBe(String(PHONE_NOT_READY_OPACITY));
    expect(within(sheet).getByTestId("modal-status").textContent).toBe("Required: an application");
    act(() => add.click());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(within(sheet).getByLabelText("Application"));
    fireEvent.change(within(sheet).getByLabelText("Application"), { target: { value: "Gmail" } });
    act(() => add.click());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

describe("the notepad on a phone", () => {
  it("is full screen with Cancel, the field's name and Done; Cancel with changes asks first", async () => {
    const onClose = vi.fn();
    const onDone = vi.fn();
    render(<Notepad open field="Instructions" value="" onClose={onClose} onDone={onDone} onTitleChange={() => undefined} />);
    const pad = screen.getByTestId("notepad");
    expect(pad.hasAttribute("data-phone")).toBe(true);
    expect(within(pad).getByRole("heading", { name: "Instructions" })).toBeTruthy();
    expect(within(pad).getByText("Title · optional")).toBeTruthy();
    expect(within(pad).getByTestId("notepad-count").textContent).toBe("0 characters");
    fireEvent.change(within(pad).getByRole("textbox", { name: "Instructions" }), { target: { value: "Read the inbox" } });
    fireEvent.click(within(pad).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alertdialog", { name: "Discard changes?" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.click(within(screen.getByTestId("notepad")).getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith("Read the inbox");
  });
});
