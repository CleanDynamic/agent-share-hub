import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeFileBlock, countLines } from "./CodeFileBlock";
import { loadHighlighter, renderTree } from "./highlighter";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const lines = (n: number) => Array.from({ length: n }, (_, i) => `const n${i + 1} = ${i + 1};`).join("\n");

describe("CodeFileBlock", () => {
  it("counts lines the way the header says: none for empty, a last empty line not counted", () => {
    expect([countLines(""), countLines("a"), countLines("a\n"), countLines("a\nb"), countLines("a\r\nb\r\n")]).toEqual([0, 1, 1, 2, 2]);
  });

  it("draws the header, the +N in the success green, a gutter and an added-line body on theme tokens", () => {
    render(<CodeFileBlock filename="app/frames/page.tsx" source={lines(10)} language="tsx" />);
    expect(screen.getByTestId("code-block-name").textContent).toBe("app/frames/page.tsx");
    expect(screen.getByTestId("code-block-count").textContent).toBe("+10");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    /* jsdom drops var() from a style, so the tokens are read from the markup. */
    const markup = renderToStaticMarkup(<CodeFileBlock filename="a.ts" source={lines(3)} language="ts" />);
    expect(markup).toMatch(/data-testid="code-block-count" style="[^"]*color:var\(--evidence\)/);
    expect(markup).toMatch(/data-testid="code-block-body" style="[^"]*background:var\(--evidence-fill\)[^"]*border-left:3px solid var\(--evidence\)/);
    expect(screen.getByTestId("code-block-gutter").textContent).toBe("1\n2\n3\n4\n5\n6\n7\n8\n9\n10");
    expect(screen.queryByRole("button", { name: /^Show all/ })).toBeNull();
  });

  it("is flat: a thin border, the control radius, no shadow, no gradient", () => {
    const markup = renderToStaticMarkup(<CodeFileBlock filename="a.ts" source="x" language="ts" />);
    expect(markup).toMatch(/^<div[^>]*style="border:1px solid var\(--module-border\);border-radius:var\(--r-control\)/);
    expect(markup).not.toMatch(/box-shadow|gradient|backdrop-filter|blur/);
  });

  it("shows the first 30 lines of a longer file, then all of them on request", () => {
    render(<CodeFileBlock filename="big.ts" source={lines(200)} language="ts" />);
    expect(screen.getByTestId("code-block-count").textContent).toBe("+200");
    expect(screen.getByTestId("code-block-gutter").textContent?.split("\n")).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Show all 200 lines" }));
    expect(screen.getByTestId("code-block-gutter").textContent?.split("\n")).toHaveLength(200);
    expect(screen.queryByRole("button", { name: /^Show all/ })).toBeNull();
  });

  it("shows 30 lines with no row at exactly 30", () => {
    render(<CodeFileBlock filename="a.ts" source={lines(30)} language="ts" />);
    expect(screen.queryByRole("button", { name: /^Show all/ })).toBeNull();
  });

  it("collapses and expands", () => {
    render(<CodeFileBlock filename="a.ts" source={lines(3)} language="ts" />);
    const chevron = screen.getByRole("button", { name: "Collapse file" });
    expect(chevron.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(chevron);
    expect(screen.queryByTestId("code-block-body")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand file" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand file" }));
    expect(screen.getByTestId("code-block-body")).toBeTruthy();
  });

  it("copies the full file, not the 30 lines shown, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const source = lines(100);
    render(<CodeFileBlock filename="a.ts" source={source} language="ts" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(source));
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  });

  it("highlights after the highlighter loads, with the same characters and only token colours", async () => {
    const source = 'export const a = "hi"; // note';
    render(<CodeFileBlock filename="a.ts" source={source} language="ts" />);
    expect(screen.getByTestId("code-block-code").textContent).toBe(source);
    await waitFor(() => expect(screen.getByTestId("code-block-code").querySelector("span")).toBeTruthy());
    expect(screen.getByTestId("code-block-code").textContent).toBe(source);
    const highlight = await loadHighlighter();
    const markup = renderToStaticMarkup(<>{renderTree(highlight(source, "ts") ?? [])}</>);
    expect(markup).toContain("color:var(--code-keyword)");
    expect(markup).toContain("color:var(--code-string)");
    expect(markup).toContain("color:var(--text2)");
    expect(markup).not.toMatch(/#[0-9a-f]{3,6}|rgb/i);
  });

  it("draws language 'other' plain", async () => {
    render(<CodeFileBlock filename="notes" source="export const a = 1;" language="other" />);
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.getByTestId("code-block-code").querySelector("span")).toBeNull();
  });

  it("is an editor when given onSourceChange: a transparent textarea over the code, the gutter and +N follow it", () => {
    function Harness() {
      const [source, setSource] = useState("");
      const [name, setName] = useState("");
      return <CodeFileBlock filename={name} onFilenameChange={setName} filenamePlaceholder="app.ts" source={source} onSourceChange={setSource} language="ts" />;
    }
    render(<Harness />);
    const well = screen.getByLabelText("Code") as HTMLTextAreaElement;
    expect(well.style.getPropertyValue("color")).toBe("transparent");
    expect(well.style.getPropertyPriority("color")).toBe("important");
    expect((screen.getByLabelText("File name") as HTMLInputElement).placeholder).toBe("app.ts");
    fireEvent.change(well, { target: { value: "a\nb\nc" } });
    expect(screen.getByTestId("code-block-count").textContent).toBe("+3");
    expect(screen.getByTestId("code-block-code").textContent).toBe("a\nb\nc\n");
    well.setSelectionRange(1, 1);
    fireEvent.keyDown(well, { key: "Tab" });
    expect(well.value).toBe("a  \nb\nc");
  });
});
