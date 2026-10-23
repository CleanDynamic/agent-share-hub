import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddCodeDialog, CODE_DIALOG_COPY, type AddCodeDialogProps } from "./AddCodeDialog";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddCodeDialogProps> = {}) {
  const props: AddCodeDialogProps = { open: true, onOpenChange: vi.fn(), onAdd: vi.fn(), ...over };
  render(<AddCodeDialog {...props} />);
  return props;
}

const well = () => screen.getByLabelText("Code") as HTMLTextAreaElement;
/** CA-03: the language is a menu showing the language's name; the value it saves is the enum, as before. */
const language = () => screen.getByRole("button", { name: "Language" });
const shown = () => language().textContent;
const pickLanguage = (name: string) => {
  fireEvent.keyDown(language(), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitemradio", { name }));
};
const row = (name: string) => screen.getAllByTestId("optional-field").find((el) => el.querySelector("button span span")?.textContent === name) as HTMLElement;
const openRow = (name: string) => {
  const head = row(name).querySelector("button") as HTMLButtonElement;
  if (head.getAttribute("aria-expanded") !== "true") fireEvent.click(head);
};
/** File path lives in the Optional section: opening its row is part of reaching it. */
const filename = () => {
  openRow("File path");
  return screen.getByLabelText("File path") as HTMLInputElement;
};
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const upload = (...files: File[]) => fireEvent.change(screen.getByTestId("code-files"), { target: { files } });

describe("Add › Code (CA-02 P7)", () => {
  // CA-11: the well is now a numbered code box. It is 12 lines tall (20 each, 6 padding top and bottom, a 1px border
  // each side), the line height is 20px not 1.55, and the gutter starts at 1.
  it("is a 640-wide dialog in the shared frame with a monospace well of 12 lines, a numbered gutter and no spell check", () => {
    open();
    expect(screen.getByRole("dialog", { name: CODE_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-code-dialog").style.width).toBe("640px");
    expect(screen.getByTestId("code-well-box").style.height).toBe("254px");
    expect(screen.getByTestId("code-gutter-numbers").textContent).toBe("1");
    expect(well().getAttribute("spellcheck")).toBe("false");
    expect(well().style.fontFamily).toContain("--font-data");
    expect(well().style.lineHeight).toBe("20px");
    expect(add().disabled).toBe(true);
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Source code produced in this step, as it was used");
    expect(screen.getByTestId("modal-status").textContent).toBe("Required: code");
  });

  it("shows the code, Upload files and Language in that order, then File path and Generated with closed in Optional", () => {
    open();
    const body = screen.getByTestId("modal-body");
    const order = [screen.getByLabelText("Code"), screen.getByRole("button", { name: "Upload files" }), screen.getByRole("button", { name: "Language" }), screen.getByTestId("optional-section")];
    for (let i = 1; i < order.length; i += 1) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.contains(order[3])).toBe(true);
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields");
    expect(screen.getAllByTestId("optional-field").map((el) => el.querySelector("button span span")?.textContent)).toEqual(["File path", "Generated with"]);
    expect(screen.queryByLabelText("File path")).toBeNull();
    expect(screen.getByText("Or upload text files. Each file is added as a separate step.")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/File name|Written with|optional/);
  });

  it("says All required fields complete once there is code", () => {
    open();
    fireEvent.change(well(), { target: { value: "x = 1" } });
    expect(screen.getByTestId("modal-status").textContent).toBe("All required fields complete");
  });

  it("puts two spaces in for a tab", () => {
    open();
    fireEvent.change(well(), { target: { value: "ab" } });
    well().setSelectionRange(1, 1);
    fireEvent.keyDown(well(), { key: "Tab" });
    expect(well().value).toBe("a  b");
  });

  it("prefills the language from the text, lets a .tsx name override it, and keeps a hand-picked one", () => {
    open();
    fireEvent.change(well(), { target: { value: "def main():\n    print('hi')\n" } });
    expect(shown()).toBe("Python");
    fireEvent.change(filename(), { target: { value: "App.tsx" } });
    expect(shown()).toBe("TypeScript (TSX)");
    pickLanguage("Other");
    fireEvent.change(filename(), { target: { value: "main.py" } });
    expect(shown()).toBe("Other");
    fireEvent.keyDown(language(), { key: "Enter" });
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(
      ["ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"].map((value) => CODE_DIALOG_COPY.languages[value as keyof typeof CODE_DIALOG_COPY.languages]),
    );
    expect(filename().maxLength).toBe(120);
  });

  it("adds the typed code as one step, generated with a tool and model by the Typed here rules", () => {
    const props = open();
    fireEvent.change(well(), { target: { value: "export const a = 1;\nexport const b = 2;\n" } });
    fireEvent.change(filename(), { target: { value: " app.ts " } });
    openRow("Generated with");
    fireEvent.click(screen.getByRole("button", { name: "Generated with" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: "cursor" } });
    fireEvent.click(screen.getByRole("option", { name: "Cursor" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "model" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({
      steps: [{ source: "export const a = 1;\nexport const b = 2;\n", language: "ts", filename: "app.ts" }],
      tool: "cursor",
      model: "Opus 5",
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("names code tools only in Generated with", () => {
    open();
    openRow("Generated with");
    fireEvent.click(screen.getByRole("button", { name: "Generated with" }));
    fireEvent.click(screen.getByRole("option", { name: /^Show all/ }));
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names).toContain("Claude Code");
    expect(names).not.toContain("Midjourney");
  });

  it("makes each uploaded text file its own step, named by its file, and refuses the rest by name", async () => {
    const props = open();
    upload(
      new File(["select 1;\n"], "schema.sql", { type: "application/sql" }),
      new File(["export {};\n"], "app.ts", { type: "video/mp2t" }),
      new File([new Uint8Array([1, 0, 2])], "blob.ts", { type: "video/mp2t" }),
      new File(["x"], "photo.png", { type: "image/png" }),
      new File(["x".repeat(100_001)], "huge.js", { type: "text/javascript" }),
    );
    await waitFor(() => expect(screen.getByRole("list", { name: "Upload files" })).toBeTruthy());
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["schema.sql · SQL · 1 lineRemove", "app.ts · TypeScript · 1 lineRemove"]);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("blob.ts: That file isn't text.");
    expect(alert.textContent).toContain("photo.png: That file isn't text.");
    expect(alert.textContent).toContain("huge.js: Code is at most 100,000 characters. Upload it as a file instead.");
    fireEvent.click(screen.getByRole("button", { name: "Remove app.ts" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ steps: [{ source: "select 1;\n", language: "sql", filename: "schema.sql" }], tool: null, model: null });
  });

  it("refuses typed code over 100,000 characters", () => {
    open();
    fireEvent.change(well(), { target: { value: "x".repeat(100_001) } });
    expect(screen.getByRole("alert").textContent).toBe("Code is at most 100,000 characters. Upload it as a file instead.");
    expect(add().disabled).toBe(true);
  });

  it("starts with the text Keep it as code hands it", () => {
    open({ seed: "const a = 1;\nconst b = 2;\nconst c = 3;" });
    expect(well().value).toBe("const a = 1;\nconst b = 2;\nconst c = 3;");
    expect(shown()).toBe("JavaScript");
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    const props = open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    fireEvent.change(well(), { target: { value: "select 1;" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ steps: [{ source: "select 1;", language: "sql", filename: null }], tool: null, model: null });
  });
});
