// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeEditorField } from "./CodeEditorField";

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes("max-width: 767px"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function Host({ start = "", onValue }: { start?: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(start);
  return (
    <CodeEditorField
      id="c"
      value={value}
      placeholder="Paste or type the code"
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

const box = () => screen.getByTestId("code-well") as HTMLTextAreaElement;
const numbers = () => screen.getByTestId("code-gutter-numbers").textContent;
const gutter = () => screen.getByTestId("code-gutter");
const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join("\n");

beforeEach(() => setPhone(false));
afterEach(cleanup);

describe("CodeEditorField (CA-11)", () => {
  it.each([
    ["empty text", "", 1],
    ["one line", "let a = 1;", 1],
    ["many lines", "a\nb\nc", 3],
    ["a trailing newline", "a\nb\n", 3],
    ["\\r\\n", "a\r\nb\r\nc", 3],
    ["\\r", "a\rb\rc", 3],
    ["1,000 lines", Array.from({ length: 1000 }, () => "x").join("\n"), 1000],
  ])("numbers %s", (_name, text, lines) => {
    render(<Host start={text} />);
    expect(numbers()).toBe(seq(lines));
  });

  it("shows 1 beside the placeholder when empty", () => {
    render(<Host />);
    expect(numbers()).toBe("1");
    expect(box().placeholder).toBe("Paste or type the code");
  });

  it("widens the gutter at 10 and 100 lines", () => {
    render(<Host start={seq(9)} />);
    expect(gutter().getAttribute("data-digits")).toBe("2");
    expect(gutter().style.width).toBe("2ch");
    fireEvent.change(box(), { target: { value: seq(10) } });
    expect(gutter().getAttribute("data-digits")).toBe("2");
    fireEvent.change(box(), { target: { value: seq(99) } });
    expect(gutter().getAttribute("data-digits")).toBe("2");
    fireEvent.change(box(), { target: { value: seq(100) } });
    expect(gutter().getAttribute("data-digits")).toBe("3");
    expect(gutter().style.width).toBe("3ch");
  });

  it("is hidden from a reader, cannot be selected, and pads 12 before and 8 after", () => {
    render(<Host start="a" />);
    expect(gutter().getAttribute("aria-hidden")).toBe("true");
    expect(gutter().style.userSelect).toBe("none");
    expect(gutter().style.paddingLeft).toBe("12px");
    expect(gutter().style.paddingRight).toBe("8px");
  });

  it("follows the textarea's vertical scroll", () => {
    render(<Host start={seq(60)} />);
    const el = box();
    el.scrollTop = 140;
    fireEvent.scroll(el);
    expect(screen.getByTestId("code-gutter").firstElementChild?.getAttribute("style")).toContain("translateY(-140px)");
  });

  it("follows after a paste that scrolls the box", () => {
    render(<Host start="a" />);
    const el = box();
    Object.defineProperty(el, "scrollTop", { value: 60, writable: true, configurable: true });
    fireEvent.change(el, { target: { value: seq(80) } });
    expect(screen.getByTestId("code-gutter").firstElementChild?.getAttribute("style")).toContain("translateY(-60px)");
  });

  it("puts two spaces in for Tab", () => {
    render(<Host start="ab" />);
    box().setSelectionRange(1, 1);
    fireEvent.keyDown(box(), { key: "Tab" });
    expect(box().value).toBe("a  b");
    expect(box().selectionStart).toBe(3);
  });

  it("takes up to two spaces from each selected line for Shift+Tab", () => {
    render(<Host start={"    a\n b\nc\n  d"} />);
    box().setSelectionRange(2, 10);
    fireEvent.keyDown(box(), { key: "Tab", shiftKey: true });
    expect(box().value).toBe("  a\nb\nc\n  d");
  });

  it("leaves text alone for Shift+Tab when no selected line starts with spaces", () => {
    const seen = vi.fn();
    render(<Host start={"a\nb"} onValue={seen} />);
    box().setSelectionRange(0, 3);
    fireEvent.keyDown(box(), { key: "Tab", shiftKey: true });
    expect(seen).not.toHaveBeenCalled();
    expect(box().value).toBe("a\nb");
  });

  it("keeps the previous line's leading spaces for Enter", () => {
    render(<Host start={"    foo"} />);
    box().setSelectionRange(7, 7);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(box().value).toBe("    foo\n    ");
    expect(box().selectionStart).toBe(12);
    expect(numbers()).toBe("1\n2");
  });

  it("splits a line at the caret for Enter and keeps only the spaces before it", () => {
    render(<Host start={"  ab"} />);
    box().setSelectionRange(3, 3);
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(box().value).toBe("  a\n  b");
  });

  it("highlights the caret's line number", () => {
    render(<Host start={"a\nb\nc"} />);
    expect(screen.queryByTestId("code-gutter-active")).toBeNull();
    fireEvent.focus(box());
    box().setSelectionRange(2, 2);
    fireEvent.select(box());
    const active = screen.getByTestId("code-gutter-active");
    expect(active.getAttribute("data-line")).toBe("2");
    // jsdom drops colours written as var(--token); lookRules.test.ts reads the tokens from the source instead.
    expect(active.textContent).toBe("2");
    expect(active.style.top).toBe("26px");
  });

  it("moves the caret to the start of a line when its number is clicked", () => {
    render(<Host start={"one\ntwo\nthree"} />);
    // 6px padding, 20px lines: the middle of line 2 is 6 + 30.
    fireEvent.mouseDown(gutter(), { clientY: 36 });
    expect(box().selectionStart).toBe(4);
    expect(box().selectionEnd).toBe(4);
    fireEvent.mouseDown(gutter(), { clientY: 500 });
    expect(box().selectionStart).toBe(8);
  });

  it("is 16px with a 24px line on a phone, 13 and 20 on a computer", () => {
    setPhone(true);
    render(<Host start="a" />);
    expect(box().style.fontSize).toBe("16px");
    expect(box().style.lineHeight).toBe("24px");
    expect(screen.getByTestId("code-gutter-numbers").style.fontSize).toBe("16px");
    cleanup();
    setPhone(false);
    render(<Host start="a" />);
    expect(box().style.fontSize).toBe("13px");
    expect(box().style.lineHeight).toBe("20px");
  });

  it("is 12 to 24 lines tall on a computer and 8 to 14 on a phone", () => {
    const tall = () => screen.getByTestId("code-well-box").style.height;
    render(<Host />);
    expect(tall()).toBe("254px");
    fireEvent.change(box(), { target: { value: seq(40) } });
    expect(tall()).toBe("494px");
    cleanup();
    setPhone(true);
    render(<Host />);
    expect(tall()).toBe("206px");
    fireEvent.change(box(), { target: { value: seq(40) } });
    expect(tall()).toBe("350px");
  });

  it("keeps wrapping and typing aids off", () => {
    render(<Host />);
    expect(box().getAttribute("wrap")).toBe("off");
    expect(box().style.whiteSpace).toBe("pre");
    expect(box().getAttribute("spellcheck")).toBe("false");
    expect(box().getAttribute("autocorrect")).toBe("off");
    expect(box().getAttribute("autocapitalize")).toBe("off");
    expect(box().getAttribute("inputmode")).toBe("text");
    expect(box().getAttribute("enterkeyhint")).toBe("enter");
  });

  it("shows the focus ring on the well while the textarea has focus", () => {
    render(<Host />);
    const well = screen.getByTestId("code-well-box");
    expect(well.style.outlineStyle).toBe("");
    fireEvent.focus(box());
    expect(well.style.outlineStyle).toBe("solid");
    fireEvent.blur(box());
    expect(well.style.outlineStyle).toBe("");
  });

  it("rebuilds the gutter only when the line count changes, in 5,000 lines", () => {
    const text = Array.from({ length: 5000 }, () => "x").join("\n");
    render(<Host start={text} />);
    const block = screen.getByTestId("code-gutter-numbers");
    const node = block.firstChild as Text;
    const original = node.data;
    expect(original.split("\n")).toHaveLength(5000);
    // Typing in a line: the very same text node, never replaced or rewritten.
    const setData = vi.spyOn(node, "data", "set");
    for (let i = 1; i <= 5; i += 1) fireEvent.change(box(), { target: { value: `${text}${"y".repeat(i)}` } });
    expect(block.firstChild).toBe(node);
    expect(setData).not.toHaveBeenCalled();
    // A new line: the numbers are rebuilt, once.
    fireEvent.change(box(), { target: { value: `${text}\n` } });
    expect(numbers()).toBe(seq(5001));
  });
});
