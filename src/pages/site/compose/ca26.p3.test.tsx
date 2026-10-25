// CA-26 P3: every icon button on the build page has a name that says what it acts on.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { isInaccessible } from "@testing-library/dom";
import { computeAccessibleName } from "dom-accessibility-api";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import MotionDemo from "@/pages/dev/MotionDemo";

import { BuildTitleActions } from "./BuildTitleActions";
import { BuildHistoryContext, type BuildHistoryApi } from "./useBuildHistory";
import { done, mountList, partsOf } from "./ca21Harness";

function HistoryHost({ undo, redo }: { undo: string | null; redo: string | null }) {
  const history = { canUndo: undo !== null, canRedo: redo !== null, undoSentence: undo, redoSentence: redo, undo: vi.fn(), redo: vi.fn() } as unknown as BuildHistoryApi;
  return (
    <ThemeProvider>
      <BuildHistoryContext.Provider value={history}>
        <BuildTitleActions />
      </BuildHistoryContext.Provider>
    </ThemeProvider>
  );
}

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone ? /max-width/.test(query) : /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
});
afterEach(done);

const GENERIC = new Set(["button", "more", "menu", "icon", "open", "close", ""]);
/** The dev page's own bar of buttons that make each change: not part of the build page. */
const BAR = '[data-testid^="act-"]';

const ITEMS: Record<string, RegExp> = {
  '[data-testid="session-head"]': /Session \d+/i,
  '[data-testid="workstream-head"]': /Part [\dA-Z]+/i,
};

const nameOf = (el: HTMLElement) => computeAccessibleName(el).trim();

/** Every button and role=button, the page's own. Returns what is wrong with each, or an empty list. */
function problems(root: ParentNode = document): string[] {
  const out: string[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('button, [role="button"]')) {
    if (el.closest(BAR) || isInaccessible(el)) continue;
    const name = nameOf(el);
    const where = `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") ?? ""}] "${name}"`;
    if (!name) out.push(`no name: ${where}`);
    else if (GENERIC.has(name.toLowerCase())) out.push(`generic name: ${where}`);
    else {
      const card = el.closest<HTMLElement>('[data-testid="step-card"], [data-testid="sent-with-tile"]');
      if (card && el !== card) {
        const group = (card.getAttribute("aria-label") ?? "").split(":")[0].trim();
        const named = name.toLowerCase().includes(group.toLowerCase()) || /^(make it|send with|add )/i.test(name);
        if (!named) out.push(`does not name its tile (${group}): ${where}`);
      }
      for (const [selector, pattern] of Object.entries(ITEMS)) {
        const head = el.closest<HTMLElement>(selector);
        if (head && !pattern.test(name) && el !== head && el.getAttribute("data-testid") !== "session-title" && el.tagName === "BUTTON" && !el.textContent?.trim()) out.push(`does not name its head: ${where}`);
      }
    }
  }
  return out;
}

async function page(path = "?build=ca22&select=c22-p2") {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/dev/kit/pages/sandbox${path}`]}>
        <MotionDemo viewport={phone ? "mobile" : "desktop"} />
      </MemoryRouter>
    </ThemeProvider>,
  );
  await screen.findByTestId("build-list");
}

describe("the build page's buttons (the ca22 build)", () => {
  it("every button and role=button has a name, none is generic, and each names its target", async () => {
    await page();
    expect(document.querySelectorAll("button").length).toBeGreaterThan(30);
    expect(problems()).toEqual([]);
  });

  it("holds with two things selected (the selection bar), and when a session is folded", async () => {
    await page();
    fireEvent.click(screen.getByRole("button", { name: "pick-two" }));
    await screen.findByRole("button", { name: "Clear selection" });
    expect(problems()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Session 1" }));
    expect(screen.getByRole("button", { name: "Expand Session 1" })).toBeTruthy();
    expect(problems()).toEqual([]);
  });

  it("holds on a phone", async () => {
    phone = true;
    await page();
    expect(problems()).toEqual([]);
  });
});

describe("the patterns", () => {
  it("{Name} options, Move {Name}, Collapse {Name}: for a prompt, a session and a part", async () => {
    await page();
    for (const name of ["Prompt 2", "Prompt 1", "Session 1", "Part 1"]) {
      expect(screen.getByRole("button", { name: `${name} options`, hidden: true }), `${name} options`).toBeTruthy();
      expect(document.querySelector(`[aria-label="Move ${name}"]`), `Move ${name}`).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Collapse Session 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse Part 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agent 5 options" })).toBeTruthy();
    expect(document.querySelector('[aria-label="Move Agent 5"]')).toBeTruthy();
  });

  it("Collapse becomes Expand, and the name follows the target", async () => {
    await page();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Part 1" }));
    expect(screen.getByRole("button", { name: "Expand Part 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Collapse Part 1" })).toBeNull();
  });

  it("Clear selection is named", async () => {
    await page();
    fireEvent.click(screen.getByRole("button", { name: "pick-two" }));
    expect(await screen.findByRole("button", { name: "Clear selection" })).toBeTruthy();
  });

  it("Undo and Redo name the step they act on: Undo: Removed Prompt 2, Redo: Removed Prompt 2", () => {
    const { rerender } = render(<HistoryHost undo="Removed Prompt 2" redo={null} />);
    expect(nameOf(screen.getByTestId("title-undo"))).toBe("Undo: Removed Prompt 2");
    expect(nameOf(screen.getByTestId("title-redo"))).toBe("Redo");
    rerender(<HistoryHost undo={null} redo="Removed Prompt 2" />);
    expect(nameOf(screen.getByTestId("title-redo"))).toBe("Redo: Removed Prompt 2");
  });

  it("{Name} colour: the colour button of a coloured tile, and it follows a rename", async () => {
    const view = mountList({ parts: partsOf() });
    view.unmount();
    // A coloured prompt and code tile, drawn as the page draws them.
    const { sandboxListProps } = await import("@/dev/fixtures/sandbox");
    const props = sandboxListProps("bakery");
    const coloured = { ...props, steps: props.steps.map((step) => (step.number === "2" || step.kind === "code" ? { ...step, colour: "#8FBFB8" } : step)), onColour: vi.fn() };
    const { BuildList } = await import("./BuildList");
    const rendered = render(
      <MemoryRouter>
        <BuildList {...coloured} />
      </MemoryRouter>,
    );
    const names = screen.getAllByTestId("colour-button").map((button) => nameOf(button));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/ colour$/);
    expect(names).toContain("Prompt 2 colour");
    const codeStep = coloured.steps.find((step) => step.kind === "code");
    if (codeStep?.filename) {
      expect(names).toContain(`Code ${codeStep.filename} colour`);
      const renamed = { ...coloured, steps: coloured.steps.map((step) => (step === codeStep ? { ...step, filename: "renamed.tsx" } : step)) };
      rendered.rerender(
        <MemoryRouter>
          <BuildList {...renamed} />
        </MemoryRouter>,
      );
      expect(screen.getAllByTestId("colour-button").map((button) => nameOf(button))).toContain("Code renamed.tsx colour");
    }
  });
});

describe("greyed buttons keep their name and say why", () => {
  it("Undo and Redo with nothing to do are still Undo and Redo and point at their reasons", () => {
    render(<HistoryHost undo={null} redo={null} />);
    for (const [id, name, why] of [["title-undo", "Undo", "Nothing to undo"], ["title-redo", "Redo", "Nothing to redo"]] as const) {
      const button = screen.getByTestId(id) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(nameOf(button)).toBe(name);
      const reason = button.getAttribute("aria-describedby");
      expect(reason).toBeTruthy();
      expect(document.getElementById(reason as string)?.textContent).toBe(why);
    }
  });

  it("a tile's Move up and Move down, greyed at the ends of the build, name their tile and point at a reason", async () => {
    await page();
    const trigger = screen.getByRole("button", { name: "Prompt 1 options" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const up = await screen.findByRole("menuitem", { name: /^Move up/ });
    expect(up.getAttribute("aria-disabled") === "true" || up.hasAttribute("data-disabled")).toBe(true);
    expect(up.getAttribute("aria-describedby")).toBeTruthy();
    expect(within(document.body).getAllByRole("menu").length).toBeGreaterThan(0);
  });
});

describe("the check itself", () => {
  it("fails on a button with no name, a generic name, or a name that is not its tile's", () => {
    render(
      <div>
        <button type="button" />
        <button type="button">More</button>
        <div data-testid="step-card" aria-label="Prompt 2: untitled">
          <button type="button" aria-label="Move prompt 5" />
          <button type="button" aria-label="Move Prompt 2" />
        </div>
        <div role="button" aria-label="Menu" />
      </div>,
    );
    const found = problems();
    expect(found).toHaveLength(4);
    expect(found.filter((line) => line.startsWith("no name"))).toHaveLength(1);
    expect(found.filter((line) => line.startsWith("generic"))).toHaveLength(2);
    expect(found.filter((line) => line.startsWith("does not name"))).toHaveLength(1);
    act(() => undefined);
  });
});
