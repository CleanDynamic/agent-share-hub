// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CodeLines } from "./CodeLines";

beforeEach(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join("\n");
const code = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");
const numbers = () => screen.getByTestId("code-gutter-numbers").textContent;

describe("CodeLines (CA-11)", () => {
  it.each([
    ["empty text", "", 1],
    ["one line", "a", 1],
    ["many lines", code(12), 12],
    ["a trailing newline", "a\nb\n", 3],
    ["\\r\\n", "a\r\nb", 2],
  ])("numbers %s", (_name, text, lines) => {
    render(<CodeLines text={text} />);
    expect(numbers()).toBe(seq(lines));
  });

  it("keeps the code in a <pre><code>, and the numbers out of it", () => {
    render(<CodeLines text={"const a = 1;\nconst b = 2;"} />);
    const pre = screen.getByTestId("code-lines");
    expect(pre.tagName).toBe("PRE");
    expect(pre.firstElementChild?.tagName).toBe("CODE");
    expect(pre.textContent).toBe("const a = 1;\nconst b = 2;");
    expect(pre.contains(screen.getByTestId("code-gutter"))).toBe(false);
    expect(screen.getByTestId("code-gutter").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("code-gutter").style.userSelect).toBe("none");
  });

  it("gives the code without the numbers when the selection is copied", () => {
    render(<CodeLines text={"alpha\nbeta"} />);
    const range = document.createRange();
    range.selectNodeContents(screen.getByTestId("code-lines"));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(selection?.toString()).toBe("alpha\nbeta");
  });

  it("scrolls long lines sideways and does not wrap", () => {
    render(<CodeLines text={"x".repeat(500)} />);
    expect(screen.getByTestId("code-lines").style.whiteSpace).toBe("pre");
    expect(screen.getByTestId("code-lines").parentElement?.style.overflowX).toBe("auto");
  });

  it("has no height cap in full", () => {
    render(<CodeLines text={code(300)} />);
    expect(numbers()).toBe(seq(300));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows 8 lines in a compact place, with Show all N lines under them", () => {
    render(<CodeLines text={code(30)} compact />);
    expect(numbers()).toBe(seq(8));
    expect(screen.getByTestId("code-lines").textContent).toBe(code(8));
    fireEvent.click(screen.getByRole("button", { name: "Show all 30 lines" }));
    expect(numbers()).toBe(seq(30));
    expect(screen.getByTestId("code-lines").textContent).toBe(code(30));
    expect(screen.getByRole("button", { name: "Show fewer lines" })).toBeTruthy();
  });

  it("has no button in a compact place when the code fits", () => {
    render(<CodeLines text={code(8)} compact />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes its own cap, and shows the empty words when there is no text", () => {
    render(<CodeLines text={code(25)} maxLines={20} />);
    expect(numbers()).toBe(seq(20));
    cleanup();
    render(<CodeLines text="" empty="Nothing here yet" />);
    expect(screen.getByTestId("code-lines").textContent).toBe("Nothing here yet");
  });
});
