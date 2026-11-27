// Prompt 23: the build editor on a phone. The claims: More registers the editor's rows in the prompt's order with no Copy link or
// Share; the footer holds the ready line and Publish, and Publish asks in an action sheet (or opens the ready sheet while anything
// required is open); a ready row with a step opens that step; choosing swaps the footer for the choosing bar and its buttons call the
// page's actions; Map is read only and a node opens its step; Find turns the bar into the field. Nothing here asserts the desktop.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { __resetPageBar, usePageBar } from "@/components/shell/phoneBarRegistry";
import type { Checklist, ChecklistItem } from "@/lib/build/publishChecklist";

import { BuildActionsContext, type BuildActions } from "../useBuildActions";
import { BuildHistoryContext, type BuildHistoryApi } from "../useBuildHistory";
import { BuildSelectionContext, type BuildSelection } from "../useBuildSelection";
import type { BuildFind } from "../useBuildFind";

import { PhoneEditor, type PhoneEditorExtras, type PhoneEditorProps } from "./PhoneEditor";

beforeEach(() => {
  __resetPageBar();
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { matches: max ? 390 <= Number(max[1]) : min ? 390 >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
});

const item = (key: string, done: boolean, stepId: string | null = null, words = key, detail: string | null = null): ChecklistItem => ({ key, section: "required", done, words, detail, stepId, action: { id: "go_to", label: "Go to it" } });

const checklist = (open: boolean): Checklist => {
  const required = [item("title", true), item("blocker-0", !open, "s5", "Required: instructions", "Not set: Response, Variables, Time it took.")];
  return { required, recommended: [], openRequired: open ? 1 : 0, openRecommended: 0, line: "", note: null, canPublish: !open, needed: open, opens: 0 };
};

const extras = (over: Partial<PhoneEditorExtras> = {}): PhoneEditorExtras => ({
  onOpenStep: vi.fn(),
  numberOf: (id) => (id === "s5" ? "5" : null),
  stepOf: (id) => (id === "s5" ? { kind: "prompt", title: "Write the order page" } : null),
  map: { sessions: [{ key: "a", number: 1, steps: [{ id: "s5", number: "5", kind: "prompt", title: "Write the order page" }] }] },
  sources: { sessions: [{ key: "a", number: 1, line: "Plan the order page / 3 Mar", colour: null }], files: [], onAddTo: vi.fn(), onPick: vi.fn(), importHref: "/import" },
  moveTo: [{ key: "a", label: "Session 1" }, { key: "b", label: "Session 2" }],
  onMoveTiles: vi.fn(),
  canGroup: true,
  onColours: vi.fn(),
  stillOpen: null,
  ...over,
});

const props = (over: Partial<PhoneEditorProps> = {}): PhoneEditorProps => ({
  title: "Order page",
  onTitle: vi.fn(),
  save: "saved",
  onRetrySave: vi.fn(),
  counts: { sessions: 2, prompts: 4, files: 1 },
  published: false,
  publishedSlug: null,
  publishedWords: "Published",
  publishing: false,
  checklist: checklist(false),
  onPublish: vi.fn(),
  onChecklistAction: vi.fn(),
  previewTo: "/b2/order-page",
  publishedOptions: null,
  hint: null,
  banner: null,
  strips: null,
  list: <div data-node-id="s5" role="group" aria-label="Prompt 5: Write the order page" tabIndex={0}>Write the order page</div>,
  emptyBuild: null,
  post: null,
  sessionList: null,
  detailsBody: <p>Details of the step</p>,
  selectedKey: null,
  addMenu: null,
  card: null,
  onCard: vi.fn(),
  extras: extras(),
  ...over,
});

const history = (over: Partial<BuildHistoryApi> = {}) => ({ canUndo: false, canRedo: false, undoSentence: null, redoSentence: null, undo: vi.fn(), redo: vi.fn(), ...over }) as unknown as BuildHistoryApi;
const actions = () => ({ duplicate: vi.fn(), removeTile: vi.fn(), removeSelection: vi.fn(), group: vi.fn(), clear: { counts: { sessions: 1, tiles: 1, files: 0, parts: 0 }, ask: vi.fn() }, recentlyRemoved: { count: 0, open: vi.fn() } }) as unknown as BuildActions;
const selection = (size = 0) => ({ items: size ? [{ kind: "tile", id: "s5" }] : [], size, tiles: new Set(size ? ["s5"] : []), sessions: new Set(), choosing: size > 0, clear: vi.fn() }) as unknown as BuildSelection;

function Bar() {
  const bar = usePageBar();
  return <ul data-testid="bar" data-skip={bar.skip ? bar.skipLabel : undefined}>{(bar.more ?? []).map((row) => <li key={row.label} data-disabled={row.disabled ? "true" : undefined}>{row.label}</li>)}{bar.bare ? <li>bare</li> : null}</ul>;
}

function draw(over: Partial<PhoneEditorProps> = {}, ctx: { history?: BuildHistoryApi; actions?: BuildActions; selection?: BuildSelection } = {}) {
  const a = ctx.actions ?? actions();
  const s = ctx.selection ?? selection();
  const view = render(
    <MemoryRouter>
      <BuildHistoryContext.Provider value={ctx.history ?? history()}>
        <BuildActionsContext.Provider value={a}>
          <BuildSelectionContext.Provider value={s}>
            <PhoneEditor {...props(over)} />
            <Bar />
          </BuildSelectionContext.Provider>
        </BuildActionsContext.Provider>
      </BuildHistoryContext.Provider>
    </MemoryRouter>,
  );
  return { ...view, actions: a, selection: s };
}

describe("the editor on a phone", () => {
  it("registers More in the prompt's order, Undo and Redo named by the repo when there is nothing, and no Copy link", () => {
    draw();
    const rows = within(screen.getByTestId("bar")).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["Nothing to undo", "Nothing to redo", "Find", "Preview", "Colours", "Recently removed…", "Mark still open", "Classification", "Clear the build…", "bare"]);
    expect(within(screen.getByTestId("bar")).getByText("Nothing to undo").dataset.disabled).toBe("true");
  });

  it("draws the title as an editable line and writes it on Enter", () => {
    const onTitle = vi.fn();
    draw({ onTitle });
    const field = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    expect(field.value).toBe("Order page");
    expect(field.style.fontSize).toBe("24px");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "Order form" } });
    fireEvent.blur(field);
    expect(onTitle).toHaveBeenCalledWith("Order form");
  });

  it("shows List, Map and Sources, and Sources opens its sheet without being chosen", () => {
    draw();
    const views = screen.getByRole("group", { name: "Build view" });
    fireEvent.click(within(views).getByRole("button", { name: "Sources" }));
    expect(within(views).getByRole("button", { name: "Sources", hidden: true }).getAttribute("aria-pressed")).toBe("false");
    expect(within(views).getByRole("button", { name: "List", hidden: true }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Sources" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Session 1 at the end" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a file" })).toBeTruthy();
  });

  it("asks before publishing, in an action sheet", async () => {
    const onPublish = vi.fn();
    draw({ onPublish });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    });
    const sheet = screen.getByRole("alertdialog");
    expect(within(sheet).getByText("Publish Order page?")).toBeTruthy();
    expect(within(sheet).getByText("Visible to anyone with the link.")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Publish" }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("opens the ready sheet while anything required is open, and a step's row opens that step", async () => {
    const x = extras();
    draw({ checklist: checklist(true), extras: x });
    expect(screen.getByTestId("sandbox-ready").textContent).toBe("1 of 2 ready to publish");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    });
    const sheet = screen.getByRole("dialog", { name: "1 of 2 ready to publish" });
    const row = within(sheet).getByTestId("ready-row");
    expect(row.textContent).toContain("Write the order page");
    expect(row.textContent).toContain("Not set: Response, Variables, Time it took.");
    vi.useFakeTimers();
    fireEvent.click(row);
    expect(x.onOpenStep).toHaveBeenCalledWith("s5");
    vi.useRealTimers();
  });

  it("swaps the footer for the choosing bar, whose buttons are the page's actions", () => {
    const { actions: a, selection: s } = draw({}, { selection: selection(1) });
    const bar = screen.getByRole("toolbar", { name: "Selection" });
    expect(within(bar).getByTestId("selection-count").textContent).toBe("1 chosen");
    expect(within(bar).getByRole("status").textContent).toBe("1 chosen");
    expect(screen.queryByTestId("phone-editor-footer")).toBeNull();
    fireEvent.click(within(bar).getByRole("button", { name: "Duplicate" }));
    expect(a.duplicate).toHaveBeenCalledWith(["s5"]);
    fireEvent.click(within(bar).getByRole("button", { name: "Remove" }));
    expect(a.removeSelection).toHaveBeenCalledWith(s.items);
    expect((within(bar).getByRole("button", { name: "Group" }) as HTMLButtonElement).disabled).toBe(true);
    for (const name of ["Move", "Group", "Colour", "Duplicate", "Remove"]) {
      const button = within(bar).getByRole("button", { name });
      // 29g: at least 52 wide, so the 13/16 label of "Duplicate" fits.
      expect(button.style.minWidth).toBe("52px");
      expect(button.style.height).toBe("52px");
      expect(button.style.fontSize).toBe("13px");
    }
  });

  it("draws the Map read only, and a node opens its step", () => {
    const x = extras();
    draw({ extras: x });
    fireEvent.click(within(screen.getByRole("group", { name: "Build view" })).getByRole("button", { name: "Map" }));
    expect(screen.getByText("Pinch to zoom, drag to move around. Reorder steps in List.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prompt 5: Write the order page" }));
    expect(x.onOpenStep).toHaveBeenCalledWith("s5");
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit the map" })).toBeTruthy();
  });

  it("turns the top bar into the find field while the find is open", () => {
    const find = { open: true, input: "order", query: "order", count: 2, at: 0, words: "1 of 2", inputRef: { current: null }, view: {}, forced: new Set(), release: vi.fn(), show: vi.fn(), close: vi.fn(), setInput: vi.fn(), move: vi.fn(), onFieldKey: vi.fn() } as unknown as BuildFind;
    draw({ find });
    const bar = screen.getByRole("search");
    expect(within(bar).getByRole("searchbox", { name: "Find in build" })).toBeTruthy();
    expect(within(bar).getByText("1 of 2")).toBeTruthy();
    fireEvent.click(within(bar).getByRole("button", { name: "Next match" }));
    expect(find.move).toHaveBeenCalledWith(1);
    fireEvent.click(within(bar).getByRole("button", { name: "Cancel" }));
    expect(find.close).toHaveBeenCalled();
  });

  it("opens the step's sheet on a tap on its tile", async () => {
    draw();
    fireEvent.click(screen.getByRole("group", { name: "Prompt 5: Write the order page" }));
    expect(await screen.findByRole("dialog", { name: "Details" })).toBeTruthy();
  });
});

/* 29f, `12-editor.jpg`. */
describe("the editor on a phone (29f)", () => {
  it("registers \"Skip to build\" for the bar's right slot", () => {
    draw();
    expect(screen.getByTestId("bar").getAttribute("data-skip")).toBe("Skip to build");
  });

  it("keeps View as a More row (after Redo) that opens its sheet, and draws no View button beside the pills", () => {
    draw({ viewSheet: ({ open }) => (open ? <div role="dialog" aria-label="View sheet">rows</div> : null) });
    const rows = within(screen.getByTestId("bar")).getAllByRole("listitem").map((row) => row.textContent);
    expect(rows.slice(0, 3)).toEqual(["Nothing to undo", "Nothing to redo", "View"]);
    expect(screen.queryByTestId("sandbox-view")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "View sheet" })).toBeNull();
  });

  it("pins its footer to the bottom on the Page shade, 50 and the inset, the ready line at the left and a 44 tall Mint Publish", () => {
    draw();
    const footer = screen.getByTestId("phone-editor-footer");
    expect(footer.style.position).toBe("fixed");
    expect(footer.style.bottom).toBe("0px");
    expect(footer.style.minHeight).toContain("50px");
    const publish = within(footer).getByRole("button", { name: "Publish" });
    expect([publish.style.height, publish.style.borderRadius, publish.style.fontSize, publish.style.fontWeight]).toEqual(["44px", "22px", "16px", "650"]);
    expect(publish.getAttribute("data-variant")).toBe("main");
    expect(footer.querySelector("svg")).toBeTruthy();
  });
});

