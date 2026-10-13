import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddManualStepDialog, MANUAL_DIALOG_COPY, MANUAL_TOOLS, type AddManualStepDialogProps } from "./AddManualStepDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddManualStepDialogProps> = {}) {
  const props: AddManualStepDialogProps = { open: true, onOpenChange: vi.fn(), after: "3 · Fix the mobile layout", available: true, onAdd: vi.fn(), ...over };
  render(<AddManualStepDialog {...props} />);
  return props;
}

const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const line = () => screen.getByLabelText("What was done") as HTMLInputElement;
const picture = (type: string, size = 100, name = "hero.png") => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByTestId("manual-picture"), { target: { files: [file] } });
  return file;
};

describe("the Add manual step dialog", () => {
  it("is a 420-wide dialog saying where the step will go", () => {
    open();
    expect(screen.getByRole("dialog", { name: MANUAL_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-manual-dialog").style.width).toBe("420px");
    expect(screen.getByText("Goes after 3 · Fix the mobile layout")).toBeTruthy();
  });

  it("offers the tools toolLabel knows, then Figma, Lovable and Vercel, then Other…", () => {
    open();
    const options = [...(screen.getByLabelText("Tool") as HTMLSelectElement).options].map((option) => option.textContent);
    expect(options).toEqual([...MANUAL_TOOLS, "Other…"]);
    expect(MANUAL_TOOLS).toEqual(["Claude", "Claude Code", "ChatGPT", "Cursor", "Figma", "Lovable", "Vercel"]);
  });

  it("needs a line before Add is enabled, and counts it out of 140 in DM Mono", () => {
    open();
    expect(add().disabled).toBe(true);
    expect(screen.getByTestId("manual-counter").textContent).toBe("0 / 140");
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    expect(screen.getByTestId("manual-counter").textContent).toBe("17 / 140");
    expect(add().disabled).toBe(false);
    expect(line().maxLength).toBe(140);
  });

  it("adds with Figma by default and the line trimmed", () => {
    const props = open();
    fireEvent.change(line(), { target: { value: "  Laid out the hero " } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "Figma", text: "Laid out the hero", file: null });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("turns Other… into a text field of at most 40, and needs it filled", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Tool"), { target: { value: "__other__" } });
    const other = screen.getByLabelText("Other tool") as HTMLInputElement;
    expect(other.maxLength).toBe(40);
    fireEvent.change(line(), { target: { value: "Exported the video" } });
    expect(add().disabled).toBe(true);
    fireEvent.change(other, { target: { value: " DaVinci Resolve " } });
    expect(add().disabled).toBe(false);
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "DaVinci Resolve", text: "Exported the video", file: null });
  });

  it("takes one picture, refuses what is not a picture, and lets it go again", () => {
    const props = open();
    picture("application/pdf", 100, "spec.pdf");
    expect(screen.getByRole("alert").textContent).toBe("spec.pdf is not a picture.");
    const file = picture("image/png");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("hero.png")).toBeTruthy();
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "Figma", text: "Laid out the hero", file });
  });

  it("refuses a picture over the size limit and removes a chosen one", () => {
    open();
    picture("image/png", 26 * 1024 * 1024);
    expect(screen.getByRole("alert").textContent).toMatch(/too big/);
    picture("image/png");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("hero.png")).toBeNull();
  });

  it("is disabled, with its reason, while the node type is not live", () => {
    open({ available: false });
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    expect(add().disabled).toBe(true);
    expect(screen.getByText(MANUAL_DIALOG_COPY.missing)).toBeTruthy();
  });

  it("closes on Cancel without adding, and is a bottom sheet on a phone", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    cleanup();
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-manual-dialog")).toBeNull();
  });
});
