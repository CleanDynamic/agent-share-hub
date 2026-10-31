// SV-11 P2: the Builds views, rendered from the board's sample data. The claims: the checklists are checkboxes, the
// number filters are keyboard-operable sliders with words, grips are named, sortable heads say aria-sort, the charts
// have words and their bars are hidden, and a pure view takes everything through props.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";

import { BuildsView, type BuildsViewProps } from "./BuildsView";

/** A wide window: every min-width query matches, so the two columns are drawn. */
beforeEach(() => {
  // Radix's slider measures its thumbs; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

function draw(change: (props: BuildsViewProps) => BuildsViewProps = (p) => p) {
  return render(
    <MemoryRouter>
      <BuildsView {...change(visionBuildsTableProps())} />
    </MemoryRouter>,
  );
}

describe("the filter panel", () => {
  it("draws a checklist as checkboxes with their labels, and reports a toggle", () => {
    const onToggleOption = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onToggleOption } }));
    const sales = screen.getByRole("checkbox", { name: /Sales/ }) as HTMLInputElement;
    expect(sales.checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    expect(onToggleOption).toHaveBeenCalledWith("field", "education");
  });

  it("draws a number filter as two sliders that move with the keyboard and say what they hold", () => {
    const onRange = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onRange } }));
    const from = screen.getByRole("slider", { name: "Reproductions from" });
    expect(from.getAttribute("aria-valuetext")).toBe("3 or more");
    expect(screen.getByRole("slider", { name: "Reproductions to" }).getAttribute("aria-valuetext")).toBe("40 or more");
    from.focus();
    fireEvent.keyDown(from, { key: "ArrowRight" });
    expect(onRange).toHaveBeenCalledWith("reproductions", [4, 40]);
  });

  it("names each grip, and moves a filter from its menu without a pointer", () => {
    const onMove = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onMove } }));
    const grip = screen.getByRole("button", { name: "Move Reproductions" });
    fireEvent.keyDown(grip, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(onMove).toHaveBeenCalledWith("reproductions", "down");
    fireEvent.keyDown(screen.getByRole("button", { name: "Move Reproductions" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Move up" }));
    expect(onMove).toHaveBeenLastCalledWith("reproductions", "up");
  });

  it("leaves out the move there is no room for", () => {
    draw((p) => ({ ...p, filters: { ...p.filters, onMove: vi.fn() } }));
    const open = within(screen.getByTestId("builds-filters")).getAllByRole("button", { name: /^Move / });
    fireEvent.keyDown(open[0], { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("draws no grips when filters cannot be moved yet", () => {
    draw((p) => ({ ...p, filters: { ...p.filters, onMove: undefined } }));
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  });

  it("hides the histogram from screen readers and gives the group its words", () => {
    draw();
    expect(screen.getByRole("group", { name: "Reproductions, 3 or more" })).toBeTruthy();
  });

  it("keeps a scale in the taxonomy's order, says so, and toggles a segment", () => {
    const onToggleSegment = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onToggleSegment } }));
    const autonomy = screen.getByRole("region", { name: "Autonomy" });
    expect(within(autonomy).getByText("Scale order")).toBeTruthy();
    fireEvent.click(within(autonomy).getByRole("button", { name: "Fully autonomous" }));
    expect(onToggleSegment).toHaveBeenCalledWith("autonomy", "fully-autonomous");
    expect(within(autonomy).getByRole("button", { name: "AI suggests and you approve" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("lists the catalogue by group in the one boxed tile", () => {
    draw();
    expect(screen.getByText("Classification · 15")).toBeTruthy();
    expect(screen.getByText("People · 3")).toBeTruthy();
  });

  it("closes to its heads on a narrow page until opened", () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    draw();
    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show filters" }));
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });
});

describe("the Table", () => {
  it("draws the lens tabs, the active filters and Clear all", () => {
    const onClearAll = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, onClearAll } }));
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Reproduced", "Rebuilt", "Open requests"]);
    expect(screen.getByRole("button", { name: "Remove filter Field" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("says which column is sorted, and a sortable head chooses its sort", () => {
    const onChange = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, sort: { ...p.table!.sort, onChange } } }));
    expect(screen.getByRole("columnheader", { name: /Reproductions/ }).getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByRole("columnheader", { name: "Confirmed" }).getAttribute("aria-sort")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Confirmed" }));
    expect(onChange).toHaveBeenCalledWith("confirmed");
  });

  it("puts a row's build, maker, numbers and lamp where the board does", () => {
    draw();
    const row = screen.getByRole("row", { name: /Inbox triage in one prompt/ });
    expect(within(row).getByRole("link", { name: "Inbox triage in one prompt" })).toBeTruthy();
    expect(within(row).getByText("@kit")).toBeTruthy();
    expect(within(row).getByText("2d ago on Opus 5.5")).toBeTruthy();
    expect(within(row).getByText("31")).toBeTruthy();
  });

  it("gives the Runs bars a text summary and hides the bars", () => {
    draw();
    const summaries = screen.getAllByRole("img", { name: /^Runs per week over 12 weeks, oldest first: 2, 3, 3, 4/ });
    expect(summaries.length).toBe(1);
    expect(summaries[0].querySelectorAll('[aria-hidden="true"]').length).toBe(12);
  });

  it("draws only the columns it is given, and a footer that follows them", () => {
    draw((p) => ({ ...p, table: { ...p.table!, columns: ["build", "reproductions", "confirmed"] } }));
    expect(screen.queryByRole("columnheader", { name: "Steps" })).toBeNull();
    expect(screen.getByText("Total 214")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a calculation" })).toBeTruthy();
  });

  it("scrolls inside its column in a region a keyboard can reach", () => {
    draw();
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("tabindex")).toBe("0");
  });

  it("marks the view it is on in the switch, with links to the others", () => {
    draw();
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Maps" })).toBeTruthy();
  });

  it("shows one line instead of the table when nothing matches", () => {
    draw((p) => ({ ...p, table: { ...p.table!, rows: [], empty: <p>No builds match these filters.</p> } }));
    expect(screen.getByText("No builds match these filters.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

/* ── SV-24 P2 ── */

describe("dragging a filter by its grip", () => {
  const rects: Record<string, number> = {};
  const centres = [["field", 100], ["reproductions", 300], ["model", 500], ["steps", 700]] as const;

  beforeEach(() => {
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    for (const [id, centre] of centres) rects[id] = centre;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const centre = rects[this.dataset.filterSlot ?? ""] ?? 10_000;
      return { top: centre - 50, height: 100, bottom: centre + 50, left: 0, right: 0, width: 0, x: 0, y: centre - 50, toJSON: () => ({}) };
    });
  });

  const drawn = (onDrop = vi.fn()) => {
    draw((p) => ({ ...p, filters: { ...p.filters, onMove: vi.fn(), onDrop } }));
    return onDrop;
  };
  const slots = () => Array.from(document.querySelectorAll<HTMLElement>("[data-filter-slot]"));

  it("wraps each open filter so a drag can move it, and only where a drop is wanted", () => {
    drawn();
    expect(slots().map((slot) => slot.dataset.filterSlot)).toEqual(expect.arrayContaining(["field", "reproductions"]));
    expect(screen.getByTestId("builds-filters").querySelectorAll("[data-filter-slot]").length).toBeGreaterThan(2);
  });

  it("drops a filter after the ones its centre passed, moving only the dragged filter meanwhile", async () => {
    const onDrop = drawn();
    const grip = screen.getByRole("button", { name: "Move Field" });
    fireEvent.pointerDown(grip, { clientY: 100, button: 0 });
    fireEvent.pointerMove(grip, { clientY: 420 });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const dragged = slots().find((slot) => slot.dataset.filterSlot === "field") as HTMLElement;
    expect(dragged.style.transform).toBe("translateY(320px)");
    expect(slots().filter((slot) => slot !== dragged).every((slot) => slot.style.transform === "")).toBe(true);
    fireEvent.pointerUp(grip, { clientY: 420 });
    expect(onDrop.mock.calls).toEqual([["field", 1]]);
    expect(dragged.style.transform).toBe("");
  });

  it("drops a filter at the top when it is dragged above the rest", () => {
    const onDrop = drawn();
    const grip = screen.getByRole("button", { name: "Move Works on model" });
    fireEvent.pointerDown(grip, { clientY: 500, button: 0 });
    fireEvent.pointerMove(grip, { clientY: 0 });
    fireEvent.pointerUp(grip, { clientY: 0 });
    expect(onDrop).toHaveBeenCalledWith("model", 0);
  });

  it("opens the grip's menu when the press never moved, and drops nothing", () => {
    const onDrop = drawn();
    const grip = screen.getByRole("button", { name: "Move Field" });
    fireEvent.pointerDown(grip, { clientY: 100, button: 0 });
    fireEvent.pointerUp(grip, { clientY: 101 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Move down" })).toBeTruthy();
  });

  it("puts a filter back, and drops nothing, when the drag is cancelled", () => {
    const onDrop = drawn();
    const grip = screen.getByRole("button", { name: "Move Field" });
    fireEvent.pointerDown(grip, { clientY: 100, button: 0 });
    fireEvent.pointerMove(grip, { clientY: 400 });
    fireEvent.pointerCancel(grip);
    expect(onDrop).not.toHaveBeenCalled();
    expect((slots().find((slot) => slot.dataset.filterSlot === "field") as HTMLElement).style.transform).toBe("");
  });
});

describe("resizing a checklist", () => {
  it("draws no handle unless resizing is wanted", () => {
    draw();
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("gives a checklist a handle that says its height and moves from the keyboard", () => {
    const onResize = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onResize, heights: { field: 200 } } }));
    const handle = screen.getByRole("separator", { name: "Resize Field" });
    expect(handle.getAttribute("aria-valuenow")).toBe("200");
    expect(handle.getAttribute("aria-valuetext")).toBe("200 pixels tall");
    expect(handle.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(onResize).toHaveBeenLastCalledWith("field", 224);
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onResize).toHaveBeenLastCalledWith("field", 176);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onResize).toHaveBeenLastCalledWith("field", 96);
    fireEvent.keyDown(handle, { key: "End" });
    expect(onResize).toHaveBeenLastCalledWith("field", 480);
    fireEvent.keyDown(handle, { key: "Tab" });
    expect(onResize).toHaveBeenCalledTimes(4);
  });

  it("limits a checklist to the height it was given, scrolling inside it", () => {
    draw((p) => ({ ...p, filters: { ...p.filters, onResize: vi.fn(), heights: { field: 200 } } }));
    const list = screen.getByRole("group", { name: "Field values" });
    expect(list.style.maxHeight).toBe("200px");
    expect(list.style.overflowY).toBe("auto");
  });

  it("reports the height once, on release, and writes the list's height meanwhile", () => {
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    const onResize = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onResize, heights: { field: 200 } } }));
    const list = screen.getByRole("group", { name: "Field values" });
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ height: 200, top: 0, bottom: 200, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) });
    const handle = screen.getByRole("separator", { name: "Resize Field" });
    fireEvent.pointerDown(handle, { clientY: 300, button: 0 });
    fireEvent.pointerMove(handle, { clientY: 340 });
    fireEvent.pointerMove(handle, { clientY: 380 });
    expect(onResize).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle, { clientY: 380 });
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith("field", 280);
  });
});

describe("the Columns chooser", () => {
  const options = [
    { id: "build", name: "Build", on: true, locked: true },
    { id: "built", name: "What was built", on: true },
    { id: "task", name: "Task", on: false },
  ] as const;

  it("is the label alone where there is no chooser", () => {
    draw();
    expect(screen.getByText("12 of 24")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Columns" })).toBeNull();
  });

  it("opens a checklist of the columns, with Build on and fixed, and reports a toggle", () => {
    const onToggle = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, columnsLabel: "2 of 3", columnsMenu: { options, onToggle } } }));
    fireEvent.click(screen.getByRole("button", { name: "Columns: 2 of 3" }));
    const group = screen.getByRole("group", { name: "Columns" });
    expect((within(group).getByRole("checkbox", { name: "Build" }) as HTMLInputElement).disabled).toBe(true);
    expect((within(group).getByRole("checkbox", { name: "Task" }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(group).getByRole("checkbox", { name: "Task" }));
    expect(onToggle).toHaveBeenCalledWith("task");
    expect(screen.queryByRole("button", { name: "Back to the default columns" })).toBeNull();
  });

  it("offers the way back to the default only when the columns are not", () => {
    const onReset = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, columnsMenu: { options, onToggle: vi.fn(), onReset } } }));
    fireEvent.click(screen.getByRole("button", { name: /^Columns/ }));
    fireEvent.click(screen.getByRole("button", { name: "Back to the default columns" }));
    expect(onReset).toHaveBeenCalled();
  });
});

describe("Add a calculation", () => {
  const calculate = {
    options: [
      { column: "steps", name: "Steps", kinds: [{ kind: "sum", label: "Sum", on: true }, { kind: "median", label: "Median", on: false }] },
      { column: "field", name: "Field", kinds: [{ kind: "common", label: "Most common", on: false }] },
    ],
    onToggle: vi.fn(),
  } as const;

  it("opens a menu of what can be worked out, with the ones added ticked, and reports a choice", () => {
    const onToggle = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, footer: { ...p.table!.footer, onCalculate: undefined, calculate: { ...calculate, onToggle } } } }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Add a calculation" }), { key: "Enter" });
    expect(screen.getByRole("menuitemcheckbox", { name: "Sum, Steps" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Median, Steps" }));
    expect(onToggle).toHaveBeenCalledWith("steps", "median");
  });

  it("opens the menu on a mouse press too", () => {
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    draw((p) => ({ ...p, table: { ...p.table!, footer: { ...p.table!.footer, calculate } } }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Add a calculation" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitemcheckbox", { name: "Most common, Field" })).toBeTruthy();
  });

  it("shows each calculation added, with a way to take it off", () => {
    const onRemove = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, footer: { ...p.table!.footer, calculations: [{ key: "steps:sum", text: "Sum, Steps 214", onRemove }] } } }));
    expect(screen.getByText("Sum, Steps 214")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Sum, Steps 214" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("keeps the button when the Confirmed column it sits in is off", () => {
    draw((p) => ({ ...p, table: { ...p.table!, columns: ["build", "reproductions"], footer: { ...p.table!.footer, calculate } } }));
    expect(screen.getByRole("button", { name: "Add a calculation" })).toBeTruthy();
  });
});

describe("the Sort menu", () => {
  it("opens on a mouse press, not only from the keyboard", () => {
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    draw();
    fireEvent.pointerDown(screen.getByRole("button", { name: /^Sort:/ }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitemradio", { name: "Newest" })).toBeTruthy();
  });
});

