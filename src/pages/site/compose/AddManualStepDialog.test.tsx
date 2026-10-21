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
const pickApp = (name: string) => {
  fireEvent.click(toolButton());
  fireEvent.change(screen.getByRole("combobox", { name: "Find an app" }), { target: { value: name } });
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Find an app" }), { key: "Enter" });
};
const where = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const line = (n = 1) => screen.getByLabelText(`Line ${n}`) as HTMLInputElement;
const picture = (type: string, size = 100, name = "hero.png") => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByTestId("manual-picture"), { target: { files: [file] } });
  return file;
};

describe("the Add manual step dialog (CA-12 P10)", () => {
  it("is a 420-wide dialog saying where the step will go, and asks 'Where was it done?'", () => {
    open();
    expect(screen.getByRole("dialog", { name: MANUAL_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-manual-dialog").style.width).toBe("420px");
    expect(screen.getByText("Goes after 3 · Fix the mobile layout")).toBeTruthy();
    expect(screen.getAllByText("Where was it done?").length).toBeGreaterThan(0);
    for (const name of ["An app or website", "A terminal", "On a phone", "Offline, in person", "Another website"]) expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("an app comes from the apps list, with no AI tool in it, and no default", () => {
    open({ inBuild: ["GitHub"] });
    expect(toolButton().textContent).toBe("Pick an app");
    expect(add().disabled).toBe(true);
    fireEvent.click(toolButton());
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((o) => o.textContent);
    expect(names).toContain("GitHub");
    expect(names).not.toContain("Claude");
    expect(names).not.toContain("ChatGPT");
  });

  it("keeps an app as picked, with its lines trimmed", () => {
    const props = open();
    pickApp("Figma");
    fireEvent.change(line(), { target: { value: "  Laid out the hero " } });
    expect(add().disabled).toBe(false);
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ where: { kind: "app", name: "Figma", url: null }, lines: ["Laid out the hero"], file: null });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a terminal, a phone and offline need no app", () => {
    for (const [name, kind] of [["A terminal", "terminal"], ["On a phone", "phone"], ["Offline, in person", "offline"]] as const) {
      const props = open();
      where(name);
      expect(screen.queryByRole("button", { name: "Tool" })).toBeNull();
      fireEvent.change(line(), { target: { value: "Did it" } });
      fireEvent.click(add());
      expect(props.onAdd).toHaveBeenCalledWith({ where: { kind, name: null, url: null }, lines: ["Did it"], file: null });
      cleanup();
    }
  });

  it("another website asks for a link", () => {
    const props = open();
    where("Another website");
    fireEvent.change(line(), { target: { value: "Signed up" } });
    expect(add().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Link to the website"), { target: { value: "https://example.org/x" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ where: { kind: "site", name: null, url: "https://example.org/x" }, lines: ["Signed up"], file: null });
  });

  it("What was done is numbered lines: Enter adds the next, up to 12, each up to 140, empty ones dropped", () => {
    const props = open();
    where("A terminal");
    fireEvent.change(line(1), { target: { value: "cd app" } });
    fireEvent.keyDown(line(1), { key: "Enter" });
    fireEvent.change(line(2), { target: { value: "npm test" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a line" }));
    expect(screen.getByLabelText("Line 3")).toBeTruthy();
    expect(line(1).maxLength).toBe(140);
    expect(screen.getByTestId("manual-counter").textContent).toBe("3 / 12 lines");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ where: { kind: "terminal", name: null, url: null }, lines: ["cd app", "npm test"], file: null });
    cleanup();
    open();
    for (let at = 1; at < 12; at += 1) {
      fireEvent.change(line(at), { target: { value: `line ${at}` } });
      fireEvent.keyDown(line(at), { key: "Enter" });
    }
    expect(screen.getByLabelText("Line 12")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add a line" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("takes one picture, refuses what is not a picture, and lets it go again", () => {
    const props = open();
    where("On a phone");
    picture("application/pdf", 100, "spec.pdf");
    expect(screen.getByRole("alert").textContent).toBe("spec.pdf is not a picture.");
    const file = picture("image/png");
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(line(), { target: { value: "Laid out the hero" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ where: { kind: "phone", name: null, url: null }, lines: ["Laid out the hero"], file });
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
    where("A terminal");
    fireEvent.change(line(), { target: { value: "Did it" } });
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
