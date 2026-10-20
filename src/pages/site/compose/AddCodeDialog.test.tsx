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
const filename = () => screen.getByLabelText("File name") as HTMLInputElement;
const title = () => screen.getByLabelText("Title") as HTMLInputElement;
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const upload = (...files: File[]) => fireEvent.change(screen.getByTestId("code-files"), { target: { files } });

describe("Add › Code (CA-02 P7)", () => {
  it("is a 600-wide dialog: a title, then a code block with a file name field, a gutter and a monospace editor", () => {
    open();
    expect(screen.getByRole("dialog", { name: CODE_DIALOG_COPY.title })).toBeTruthy();
    expect(screen.getByTestId("add-code-dialog").style.width).toBe("600px");
    expect(title().getAttribute("aria-required")).toBe("true");
    expect(filename().placeholder).toBe("app.ts");
    expect(well().getAttribute("spellcheck")).toBe("false");
    expect(well().style.fontFamily).toContain("--font-data");
    expect(well().style.lineHeight).toBe("20px");
    expect(screen.getByTestId("code-block-count").textContent).toBe("+0");
    expect(add().disabled).toBe(true);
  });

  it("counts the lines live, numbers them in the gutter and grows with the text", () => {
    open();
    fireEvent.change(well(), { target: { value: Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") } });
    expect(screen.getByTestId("code-block-count").textContent).toBe("+12");
    expect(screen.getByTestId("code-block-gutter").textContent?.split("\n")).toHaveLength(12);
    fireEvent.change(well(), { target: { value: Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n") } });
    expect(screen.getByTestId("code-block-count").textContent).toBe("+200");
    expect(screen.getByTestId("code-block-gutter").textContent?.split("\n")).toHaveLength(200);
  });

  it("keeps Add off until there is a title and code", () => {
    open();
    fireEvent.change(well(), { target: { value: "const a = 1;" } });
    expect(add().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Add a title.");
    fireEvent.change(title(), { target: { value: "  " } });
    expect(add().disabled).toBe(true);
    fireEvent.change(title(), { target: { value: "Setup" } });
    expect(add().disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(well(), { target: { value: "" } });
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

  it("adds the typed code as one step, written with a tool and model by the Typed here rules", () => {
    const props = open();
    fireEvent.change(title(), { target: { value: " Frames page " } });
    fireEvent.change(well(), { target: { value: "export const a = 1;\nexport const b = 2;\n" } });
    fireEvent.change(filename(), { target: { value: " app.ts " } });
    fireEvent.click(screen.getByRole("button", { name: "Written with" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: "cursor" } });
    fireEvent.click(screen.getByRole("option", { name: "Cursor" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "model" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({
      steps: [{ title: "Frames page", source: "export const a = 1;\nexport const b = 2;\n", language: "ts", filename: "app.ts" }],
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

  it("makes each uploaded text file its own step with its own block, titled by its file, and refuses the rest by name", async () => {
    const props = open();
    upload(
      new File(["select 1;\n"], "schema.sql", { type: "application/sql" }),
      new File(["export {};\n"], "app.ts", { type: "video/mp2t" }),
      new File([new Uint8Array([1, 0, 2])], "blob.ts", { type: "video/mp2t" }),
      new File(["x"], "photo.png", { type: "image/png" }),
      new File(["x".repeat(100_001)], "huge.js", { type: "text/javascript" }),
    );
    await waitFor(() => expect(screen.getByRole("list", { name: "Upload files" })).toBeTruthy());
    expect(screen.getAllByTestId("uploaded-step")).toHaveLength(2);
    expect((screen.getByLabelText("Title of schema.sql") as HTMLInputElement).value).toBe("schema.sql");
    expect((screen.getByLabelText("Title of app.ts") as HTMLInputElement).value).toBe("app.ts");
    expect(screen.getAllByTestId("code-block-count").map((item) => item.textContent)).toEqual(["+0", "+1", "+1"]);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("blob.ts: That file isn't text.");
    expect(alert.textContent).toContain("photo.png: That file isn't text.");
    expect(alert.textContent).toContain("huge.js: Code is at most 100,000 characters. Upload it as a file instead.");
    fireEvent.change(screen.getByLabelText("Title of schema.sql"), { target: { value: "Schema" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove app.ts" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ steps: [{ title: "Schema", source: "select 1;\n", language: "sql", filename: "schema.sql" }], tool: null, model: null });
  });

  it("keeps Add off while an uploaded file has no title", async () => {
    open();
    upload(new File(["select 1;\n"], "schema.sql", { type: "application/sql" }));
    await waitFor(() => expect(screen.getByLabelText("Title of schema.sql")).toBeTruthy());
    expect(add().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Title of schema.sql"), { target: { value: "" } });
    expect(add().disabled).toBe(true);
  });

  it("refuses typed code over 100,000 characters", () => {
    open();
    fireEvent.change(title(), { target: { value: "Big" } });
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
    fireEvent.change(title(), { target: { value: "Query" } });
    fireEvent.change(well(), { target: { value: "select 1;" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ steps: [{ title: "Query", source: "select 1;", language: "sql", filename: null }], tool: null, model: null });
  });
});
