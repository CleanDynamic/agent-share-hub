// CA-26 P5: on a coarse pointer every grip, ⋯ button, fold arrow, Undo, Redo, selection-bar button and window close button
// answers a 44 by 44 touch. The browser measures it (e2e/audit/composer-ca26-touch.spec.ts); this holds the markup the rule reads.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import MotionDemo from "@/pages/dev/MotionDemo";

import { AddToolDialog } from "./AddToolDialog";
import { done } from "./ca21Harness";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
});
afterEach(done);

const css = fs.readFileSync(path.resolve(__dirname, "../../../index.css"), "utf8");

/** Answered by the UI-P38 rule: a primitive that says what it is, or anything marked `data-hit`. */
const answered = (el: Element) => el.hasAttribute("data-hit") || ["icon-button", "button", "filter-chip"].includes(el.getAttribute("data-ui") ?? "");

describe("the rule", () => {
  it("answers a coarse pointer at any width, as well as a phone's", () => {
    expect(css).toMatch(/@media \(max-width: 767px\), \(pointer: coarse\) \{\s*:where\(/);
    const block = css.slice(css.indexOf("@media (max-width: 767px), (pointer: coarse)"));
    expect(block.slice(0, 1400)).toContain("[data-hit]");
    expect(block.slice(0, 1400)).toMatch(/width: max\(100%, 44px\)/);
    expect(block.slice(0, 1400)).toMatch(/height: max\(100%, 44px\)/);
  });
});

describe("the controls it reads", () => {
  it("the grips, ⋯ buttons, fold arrows, Undo, Redo and the selection bar's buttons are all marked", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?build=ca22&bar=hide&history=1&select=c22-p2"]}>
          <MotionDemo viewport="desktop" />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByTestId("build-list");
    fireEvent.click(screen.getByTestId("act-pick-two"));
    await screen.findByTestId("selection-bar");

    const groups: Record<string, string> = {
      grips: '[data-testid="drag-handle"], [data-testid="session-drag-handle"], [data-testid="workstream-drag-handle"]',
      options: 'button[aria-label$=" options"]',
      folds: 'button[aria-label^="Collapse "], button[aria-label^="Expand "]',
      history: '[data-testid="title-undo"], [data-testid="title-redo"]',
      selection: '[data-testid="selection-bar"] button',
    };
    for (const [name, selector] of Object.entries(groups)) {
      const found = [...document.querySelectorAll(selector)];
      expect(found.length, name).toBeGreaterThan(0);
      expect(found.filter((el) => !answered(el)).map((el) => el.getAttribute("aria-label") ?? el.textContent), name).toEqual([]);
    }
  });

  it("a window's close button is marked, on a computer and on a phone", () => {
    render(<AddToolDialog open onOpenChange={() => undefined} onAdd={() => undefined} />);
    const close = screen.getByRole("button", { name: /^Close/ });
    expect(answered(close)).toBe(true);
  });
});
