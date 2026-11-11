// UX-02 P4: a session's title is drawn as the app's text field at rest, and behaves as one: one press places the cursor (nothing on
// the head takes it), Enter saves, Escape puts back the last saved title. jsdom moves no focus on a click, so the press is checked
// for what would stop it (a prevented default) and the field is then focused as the browser does.

import { act, cleanup, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps } from "./BuildList";
import type { SessionOps } from "./SessionHead";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function list() {
  const sessionOps: SessionOps = { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMergeUp: vi.fn() };
  const props: BuildListProps = { ...sandboxListProps("bakery"), onToggleCollapsed: vi.fn(), sessionOps };
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return sessionOps;
}

const field = (n: number) => within(screen.getAllByTestId("session-head")[n - 1]).getByRole("textbox", { name: `Title of Session ${n}` }) as HTMLInputElement;

describe("UX-02 P4 · the session title is a field", () => {
  it("is drawn as the text field once focused (F50: with no title, quiet words at rest): the field fill, a 1px well border, the control radius", () => {
    // jsdom's style parser drops var() in these properties, so they are read as React writes them: the server markup, and the fill
    // the field sets over the global field rule's own.
    const set = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    list();
    expect(set).toHaveBeenCalledWith("background-color", "transparent", "important");
    act(() => field(1).focus());
    expect(set).toHaveBeenCalledWith("background-color", "var(--field)", "important");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BuildList {...sandboxListProps("bakery")} sessionOps={{ onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMergeUp: vi.fn() }} />
      </MemoryRouter>,
    );
    const input = html.match(/<input[^>]*data-testid="session-title"[^>]*>/)?.[0] ?? "";
    // F50: at rest with no title its border is there but clear, so nothing moves when it becomes the field.
    expect(input).toContain("border:1px solid transparent");
    expect(input).toContain("border-radius:var(--r-control)");
  });

  it("the same on hover: nothing about it changes", () => {
    list();
    const input = field(1);
    const before = input.getAttribute("style");
    fireEvent.mouseEnter(input);
    fireEvent.mouseOver(input);
    expect(input.getAttribute("style")).toBe(before);
  });

  it("one press places the cursor: nothing on the head prevents it", () => {
    list();
    for (const n of [1, 2]) {
      const input = field(n);
      const press = createEvent.mouseDown(input);
      fireEvent(input, press);
      expect(press.defaultPrevented).toBe(false);
      input.focus();
      expect(document.activeElement).toBe(input);
    }
  });

  it("Enter saves", () => {
    const ops = list();
    const input = field(1);
    input.focus();
    fireEvent.change(input, { target: { value: "Poster copy" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(ops.onTitle).toHaveBeenCalledWith(expect.any(String), "Poster copy");
  });

  it("Escape puts back the last saved title, and saves nothing", () => {
    const ops = list();
    const input = field(1);
    const saved = input.value;
    input.focus();
    fireEvent.change(input, { target: { value: "Something else" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe(saved);
    expect(ops.onTitle).not.toHaveBeenCalled();
  });
});
