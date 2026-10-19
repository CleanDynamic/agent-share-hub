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
const language = () => screen.getByLabelText("Language") as HTMLSelectElement;
const filename = () => screen.getByLabelText("File name, optional") as HTMLInputElement;
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const upload = (...files: File[]) => fireEvent.change(screen.getByTestId("code-files"), { target: { files } });

describe("Add › Code (CA-02 P7)", () => {
  it("is a 420-wide dialog with a monospace well of 12 rows and no spell check", () => {
    open();
    expect(screen.getByRole("dialog", { name: CODE_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-code-dialog").style.width).toBe("420px");
    expect(well().rows).toBe(12);
    expect(well().getAttribute("spellcheck")).toBe("false");
    expect(well().style.fontFamily).toContain("--font-data");
    expect(well().style.lineHeight).toBe("1.55");
    expect(add().disabled).toBe(true);
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
    expect(language().value).toBe("python");
    fireEvent.change(filename(), { target: { value: "App.tsx" } });
    expect(language().value).toBe("tsx");
    fireEvent.change(language(), { target: { value: "other" } });
    fireEvent.change(filename(), { target: { value: "main.py" } });
    expect(language().value).toBe("other");
    expect([...language().options].map((o) => o.value)).toEqual(["ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"]);
    expect(filename().maxLength).toBe(120);
  });

  it("adds the typed code as one step, written with a tool and model by the Typed here rules", () => {
    const props = open();
    fireEvent.change(well(), { target: { value: "export const a = 1;\nexport const b = 2;\n" } });
    fireEvent.change(filename(), { target: { value: " app.ts " } });
    fireEvent.click(screen.getByRole("button", { name: "Written with" }));
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

  it("names code tools only in Written with", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Written with" }));
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
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["schema.sqlsql · 1 lines", "app.tsts · 1 lines"]);
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
    expect(language().value).toBe("js");
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
