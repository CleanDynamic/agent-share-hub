// CA-27 P1: Find in build. The fields it reads, the case, the 120 ms wait, the count, Enter and Shift+Enter, folded sessions and
// parts opening for the match and folding again, Esc, `/` while typing, and the row in the shortcuts window.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ca27Build, ca27SessionOf, ca27Worded, CA27_P, CA27_S, CA27_WORD } from "@/dev/fixtures/ca27";
import { sessionFacts } from "@/dev/fixtures/shapes";
import { FOUND_WORD } from "@/components/build/FindHit";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FIND_COPY, FIND_DELAY, countWords, findMatches, findRanges, stepMatch } from "@/lib/build/findInBuild";
import { SHORTCUTS, shortcutLabel, shortcutOf } from "@/lib/build/shortcuts";
import MotionDemo from "@/pages/dev/MotionDemo";

import { done } from "./ca21Harness";
import { dividers } from "./buildListModel";
import { findTargetsOf } from "./findIndex";
import { listPartsOf } from "./partsModel";

/* The page is mounted on 60 tiles (3 to a session): jsdom has no layout to save it work, and the 300 are for the browser. */
const SMALL = 60;
const W = ca27Worded(SMALL).map((n) => `c27-${n}`);
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Element.prototype.scrollIntoView = () => undefined;
  window.scrollTo = () => undefined;
});
afterEach(done);

/** The fixture's targets, as the page reads them. */
function targets() {
  const { tree, steps, groups, making } = ca27Build();
  const heads = dividers(steps, groups, sessionFacts(tree).counts, {});
  const parts = listPartsOf(making, groups, "dusk");
  return findTargetsOf({ steps, dividers: heads, parts: parts ? { parts: parts.list } : undefined });
}

describe("the search", () => {
  it("ignores case, and reads what is typed as plain text", () => {
    expect(findRanges("Sourdough, sourdough and SOURDOUGH", "sourDough")).toEqual([[0, 9], [11, 20], [25, 34]]);
    expect(findRanges("a (b) c", "(b)")).toEqual([[2, 5]]);
    expect(findRanges("anything", "   ")).toEqual([]);
  });

  it("says 2 of 5, or No matches", () => {
    expect(countWords(1, 5)).toBe("2 of 5");
    expect(countWords(0, 0)).toBe("No matches");
    expect(stepMatch(4, 5, 1)).toBe(0);
    expect(stepMatch(0, 5, -1)).toBe(4);
  });

  it("reads tile titles and prompt text", () => {
    const all = targets();
    expect(all.filter((target) => target.kind === "tile")).toHaveLength(300);
    expect(findMatches(all, CA27_WORD).map((target) => target.id)).toEqual(ca27Worded().map((n) => `c27-${n}`));
    // A title: the long one every third prompt has.
    expect(findMatches(all, "rota for the bakery").length).toBeGreaterThan(50);
  });

  it("reads file names", () => {
    const hits = findMatches(targets(), "menu-week-3-");
    expect(hits.map((target) => target.id)).toEqual(["c27-30"]);
    expect(targets().find((target) => target.id === "c27-30")?.fields.some((field) => field.field === "file")).toBe(true);
  });

  it("reads session titles and app names", () => {
    const all = targets();
    expect(findMatches(all, "cinnamon morning").map((target) => target.id)).toEqual([CA27_S[5]]);
    const app = findMatches(all, "claude code").length + findMatches(all, "claude-code").length;
    expect(app).toBeGreaterThan(0);
    expect(findMatches(all, "claude").filter((target) => target.kind === "session")).toHaveLength(20);
  });

  it("reads part names", () => {
    expect(findMatches(targets(), "cinnamon rolls").map((target) => target.id)).toEqual([CA27_P[0]]);
  });

  it("reads the values Details shows", () => {
    // The model of a prompt is not in its title or its text.
    const hits = findMatches(targets(), "Opus 5.5").filter((target) => target.kind === "tile");
    expect(hits.length).toBeGreaterThan(100);
    expect(hits.every((target) => target.fields.some((field) => field.field === "details"))).toBe(true);
  });
});

const field = () => screen.getByTestId("find-input") as HTMLInputElement;

async function mount(build = "ca27") {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/dev/kit/pages/sandbox?build=${build}&bar=hide&tiles=${SMALL}`]}>
        <MotionDemo viewport="desktop" />
      </MemoryRouter>
    </ThemeProvider>,
  );
  await screen.findByTestId("build-list");
}
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const settled = () => waitFor(() => expect(screen.getByTestId("find-count")).toBeTruthy(), { timeout: 2000 });
const count = () => screen.getByTestId("find-count").textContent;

describe("the field", () => {
  it("is a button named Find in build just before View, and opens the field on a click", async () => {
    await mount();
    const button = screen.getByRole("button", { name: FIND_COPY.button });
    const view = screen.getByTestId("sandbox-view");
    expect(button.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId("find-field")).toBeNull();
    fireEvent.click(button);
    const box = await screen.findByTestId("find-field");
    expect(box.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("sandbox-counts").compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field().placeholder).toBe("Find in build");
    for (const name of [FIND_COPY.previous, FIND_COPY.next, FIND_COPY.close]) expect(screen.getByRole("button", { name })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it("waits 120 ms after typing stops", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    expect(FIND_DELAY).toBe(120);
    type("sourdough");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(screen.queryByTestId("find-count")).toBeNull();
    expect(screen.queryAllByTestId("find-hit")).toHaveLength(0);
    await settled();
    expect(count()).toBe("1 of 5");
  });

  it("goes to the next match on Enter and the previous on Shift+Enter, wrapping, and the buttons do the same", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("SOURDOUGH");
    await settled();
    expect(count()).toBe("1 of 5");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(count()).toBe("2 of 5");
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(count()).toBe("1 of 5");
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(count()).toBe("5 of 5");
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.next }));
    expect(count()).toBe("1 of 5");
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.previous }));
    expect(count()).toBe("5 of 5");
  });

  it("marks the found words and rings the current tile", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("sourdough");
    await settled();
    const marks = screen.getAllByTestId("find-hit");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent?.toLowerCase()).toBe("sourdough");
    // jsdom drops a var() colour from an element; the style itself is held here.
    expect(FOUND_WORD).toMatchObject({ backgroundColor: "var(--find-fill)", borderRadius: 3 });
    expect(String(FOUND_WORD.boxShadow)).toBe("inset 0 -1.5px 0 var(--text2)");
    const first = document.querySelector(`[data-node-id="${W[0]}"]`) as HTMLElement;
    expect(first.style.boxShadow).toContain("--selected-edge");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(first.style.boxShadow).not.toContain("--selected-edge");
    expect((document.querySelector(`[data-node-id="${W[1]}"]`) as HTMLElement).style.boxShadow).toContain("--selected-edge");
  });

  it("says No matches", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("qqqqqqq");
    await settled();
    expect(count()).toBe("No matches");
  });

  it("announces the count", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("sourdough");
    await settled();
    await waitFor(() => expect(screen.getByTestId("build-announcer").textContent).toBe("1 of 5"));
  });

  it("Esc closes it, clears the marks and gives focus back to where it was", async () => {
    await mount();
    const button = screen.getByRole("button", { name: FIND_COPY.button });
    button.focus();
    fireEvent.click(button);
    await screen.findByTestId("find-field");
    type("sourdough");
    await settled();
    expect(screen.getAllByTestId("find-hit").length).toBeGreaterThan(0);
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(screen.queryByTestId("find-field")).toBeNull();
    expect(screen.queryAllByTestId("find-hit")).toHaveLength(0);
    expect((document.querySelector(`[data-node-id="${W[0]}"]`) as HTMLElement).style.boxShadow).not.toContain("--selected-edge");
    expect(document.activeElement).toBe(button);
  });

  it("Close find does the same", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.close }));
    expect(screen.queryByTestId("find-field")).toBeNull();
  });
});

describe("the key", () => {
  it("/ opens the field; it is the find shortcut, in the Build group", async () => {
    const k = { key: "/", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    expect(shortcutOf(k, false)).toBe("find");
    expect(shortcutOf({ ...k, ctrlKey: true }, false)).toBeNull();
    expect(SHORTCUTS.find((shortcut) => shortcut.id === "find")).toMatchObject({ group: "Build", label: "Find in build", mac: "/", other: "/" });
    expect(shortcutLabel("find")).toBe("/");
    await mount();
    fireEvent.keyDown(document.body, { key: "/" });
    await screen.findByTestId("find-field");
    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it("/ is ignored while typing in a field", async () => {
    await mount();
    const probe = document.createElement("input");
    document.body.appendChild(probe);
    probe.focus();
    fireEvent.keyDown(probe, { key: "/" });
    expect(screen.queryByTestId("find-field")).toBeNull();
    probe.remove();
    // And inside the find field itself, a slash is a character: the field stays and keeps the focus.
    fireEvent.keyDown(document.body, { key: "/" });
    await screen.findByTestId("find-field");
    fireEvent.keyDown(field(), { key: "/" });
    expect(screen.getAllByTestId("find-field")).toHaveLength(1);
  });
});

describe("folded sessions and parts", () => {
  const stateOf = (key: string) => document.querySelector(`[data-session-key="${key}"] [data-testid="session-tiles"]`)?.hasAttribute("hidden");

  it("a folded session opens for the match and folds again when the match moves out of it, unless the maker opened it", async () => {
    await mount();
    // The first two matches stand in Session 2 and Session 6. Fold both.
    const [one, two] = [CA27_S.indexOf(ca27SessionOf(ca27Worded(SMALL)[0], SMALL)), CA27_S.indexOf(ca27SessionOf(ca27Worded(SMALL)[1], SMALL))];
    expect([one, two]).toEqual([1, 5]);
    fireEvent.click(screen.getByLabelText(/Collapse Session 2\b/));
    fireEvent.click(screen.getByLabelText(/Collapse Session 6\b/));
    await waitFor(() => expect(stateOf(CA27_S[1])).toBe(true));
    expect(stateOf(CA27_S[5])).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("sourdough");
    await settled();
    expect(count()).toBe("1 of 5");
    await waitFor(() => expect(stateOf(CA27_S[1])).toBe(false));
    expect(document.querySelector(`[data-node-id="${W[0]}"]`)).toBeTruthy();
    // Next: Session 2 folds again, Session 6 opens.
    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(stateOf(CA27_S[1])).toBe(true));
    await waitFor(() => expect(stateOf(CA27_S[5])).toBe(false));
    // Back to the first, and the maker opens Session 2 themselves: the match moves on and it stays open.
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    await waitFor(() => expect(stateOf(CA27_S[1])).toBe(false));
    fireEvent.click(screen.getByLabelText(/Collapse Session 2\b/));
    fireEvent.click(screen.getByLabelText(/Expand Session 2\b/));
    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(stateOf(CA27_S[5])).toBe(false));
    expect(stateOf(CA27_S[1])).toBe(false);
    // Closing find folds nothing the maker opened.
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(stateOf(CA27_S[1])).toBe(false);
    expect(stateOf(CA27_S[5])).toBe(true);
  });

  it("a folded part opens for the match and folds again", async () => {
    await mount();
    const partBody = (key: string) => document.querySelector(`[data-workstream-group="${key}"] [data-testid="workstream-body"]`)?.hasAttribute("hidden");
    fireEvent.click(screen.getAllByLabelText(/Collapse Part 1/)[0]);
    await waitFor(() => expect(partBody(CA27_P[0])).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: FIND_COPY.button }));
    await screen.findByTestId("find-field");
    type("sourdough");
    await settled();
    await waitFor(() => expect(partBody(CA27_P[0])).toBe(false));
    // Match 3 (Prompt 122) is in Part 2: Part 1 folds again.
    fireEvent.keyDown(field(), { key: "Enter" });
    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(partBody(CA27_P[0])).toBe(true));
  });
});

describe("the shortcuts window", () => {
  it("lists Find in build with its key", async () => {
    const { ShortcutsDialog } = await import("./ShortcutsDialog");
    render(<ShortcutsDialog open onClose={() => undefined} />);
    const window_ = await screen.findByTestId("shortcuts-window");
    const row = within(window_).getAllByTestId("shortcut-row").find((entry) => entry.textContent?.includes("Find in build"));
    expect(row?.textContent).toContain("/");
  });
});

void act;
void cleanup;
