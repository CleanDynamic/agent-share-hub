import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddManualStepDialog, MANUAL_DIALOG_COPY, type AddManualStepDialogProps } from "./AddManualStepDialog";

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

const toolButton = () => screen.getByRole("button", { name: "Tool" });
const pickTool = (name: string) => {
  fireEvent.click(toolButton());
  fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: name } });
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Find a tool" }), { key: "Enter" });
};
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

  it("has one tool picker with no default tool, and the build's tools first", () => {
    open({ inBuild: ["Midjourney"] });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(toolButton().textContent).toBe("Pick a tool");
    fireEvent.click(toolButton());
    expect(screen.getAllByRole("option")[0].textContent).toBe("Midjourney");
  });

  it("keeps Add disabled until a tool is picked", () => {
    open();
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    expect(add().disabled).toBe(true);
    pickTool("Midjourney");
    expect(toolButton().textContent).toBe("Midjourney");
    expect(add().disabled).toBe(false);
  });

  it("needs a line before Add is enabled, and counts it out of 140 in DM Mono", () => {
    open();
    pickTool("Midjourney");
    expect(add().disabled).toBe(true);
    expect(screen.getByTestId("manual-counter").textContent).toBe("0 / 140");
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    expect(screen.getByTestId("manual-counter").textContent).toBe("17 / 140");
    expect(add().disabled).toBe(false);
    expect(line().maxLength).toBe(140);
  });

  it("adds a listed tool by its id and the line trimmed", () => {
    const props = open();
    pickTool("Midjourney");
    fireEvent.change(line(), { target: { value: "  Laid out the hero " } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "midjourney", text: "Laid out the hero", file: null });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("adds a name that is not listed as typed, trimmed", () => {
    const props = open();
    pickTool(" DaVinci Resolve ");
    fireEvent.change(line(), { target: { value: "Exported the video" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "DaVinci Resolve", text: "Exported the video", file: null });
  });

  it("takes one picture, refuses what is not a picture, and lets it go again", () => {
    const props = open();
    pickTool("Figma");
    picture("application/pdf", 100, "spec.pdf");
    expect(screen.getByRole("alert").textContent).toBe("spec.pdf is not a picture.");
    const file = picture("image/png");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("hero.png")).toBeTruthy();
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "figma", text: "Laid out the hero", file });
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
    pickTool("Figma");
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

describe("the manual step's tool picker fits a manual step (CA-02 P6)", () => {
  it("offers every tool but a retired one, and never asks for a model", () => {
    open();
    fireEvent.click(toolButton());
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toContain("Hermes Agent");
    expect(names).toContain("Gmail");
    expect(names).toContain("Claude");
    expect(names).not.toContain("Sora");
    expect(names.every((name) => !name?.includes("Add it with"))).toBe(true);
    expect(screen.queryByRole("button", { name: /^model/ })).toBeNull();
  });

  it("keeps the tool as picked: a listed one by its id, a typed one as typed", () => {
    const props = open();
    pickTool("Figma");
    fireEvent.change(line(), { target: { value: "Exported the frames" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ tool: "figma", text: "Exported the frames", file: null });
  });
});
