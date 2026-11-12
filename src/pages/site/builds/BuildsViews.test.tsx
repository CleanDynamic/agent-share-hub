// SV-11 P2: the Builds views, rendered from the board's sample data. The claims: the checklists are checkboxes, the
// number filters are keyboard-operable sliders with words, grips are named, sortable heads say aria-sort, the charts
// have words and their bars are hidden, and a pure view takes everything through props.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsTableProps, visionBuildsTableViewProps } from "@/dev/fixtures/vision/builds-table";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";

import { ALL_COLUMNS, BuildsTableView, COLUMN_ORDER, type ColumnId, type TableRowView } from "./BuildsTableView";
import { BuildsView, type BuildsViewProps } from "./BuildsView";
import { FiltersButton } from "./BuildsFrame";
import { chosenColumns, columnsLabel, columnsMenu, tableRow } from "./buildsModel";

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

/** BF-06: the page with its Filters dialog open, where the panel now is. BF-07: on the group named, Classification first. */
function drawFilters(change?: (props: BuildsViewProps) => BuildsViewProps, group?: string) {
  const drawn = draw(change);
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  if (group) fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${group}`) }));
  return drawn;
}

describe("the filter panel", () => {
  it("draws a checklist as checkboxes with their labels, and reports a toggle", () => {
    const onToggleOption = vi.fn();
    drawFilters((p) => ({ ...p, filters: { ...p.filters, onToggleOption } }));
    const sales = screen.getByRole("checkbox", { name: /Sales/ }) as HTMLInputElement;
    expect(sales.checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Education/ }));
    expect(onToggleOption).toHaveBeenCalledWith("field", "education");
  });

  it("draws a number filter as two sliders that move with the keyboard and say what they hold", () => {
    const onRange = vi.fn();
    drawFilters((p) => ({ ...p, filters: { ...p.filters, onRange } }), "Proof");
    const from = screen.getByRole("slider", { name: "Reproductions from" });
    expect(from.getAttribute("aria-valuetext")).toBe("3 or more");
    expect(screen.getByRole("slider", { name: "Reproductions to" }).getAttribute("aria-valuetext")).toBe("40 or more");
    from.focus();
    fireEvent.keyDown(from, { key: "ArrowRight" });
    expect(onRange).toHaveBeenCalledWith("reproductions", [4, 40]);
  });

  it("hides the histogram from screen readers and gives the group its words", () => {
    drawFilters(undefined, "Proof");
    expect(screen.getByRole("group", { name: "Reproductions, 3 or more" })).toBeTruthy();
  });

  it("keeps a scale in the taxonomy's order, says so, and toggles a segment", () => {
    const onToggleSegment = vi.fn();
    drawFilters((p) => ({ ...p, filters: { ...p.filters, onToggleSegment } }));
    const autonomy = screen.getByRole("region", { name: "Autonomy" });
    expect(within(autonomy).getByText("Scale order")).toBeTruthy();
    fireEvent.click(within(autonomy).getByRole("button", { name: "Fully autonomous" }));
    expect(onToggleSegment).toHaveBeenCalledWith("autonomy", "fully-autonomous");
    expect(within(autonomy).getByRole("button", { name: "AI suggests and you approve" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the Table", () => {
  it("draws the lens tabs, the active filters and Clear all", () => {
    const onClearAll = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, onClearAll } }));
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Reproduced", "Rebuilt", "Still open"]);
    expect(screen.getByRole("button", { name: "Remove filter Field" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("says which column is sorted, and a sortable head chooses its sort", () => {
    const onSortColumn = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, onSortColumn } }));
    expect(screen.getByRole("columnheader", { name: /Reproductions/ }).getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByRole("columnheader", { name: "Confirmed" }).getAttribute("aria-sort")).toBe("none");
    expect(screen.getByRole("columnheader", { name: "Field" }).getAttribute("aria-sort")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmed" }));
    expect(onSortColumn).toHaveBeenCalledWith("confirmed", false);
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

/* ── BF-02 P1 (C2) ── */

describe("the updating state", () => {
  function table(updating: boolean) {
    return render(
      <MemoryRouter>
        <BuildsTableView {...visionBuildsTableViewProps()} updating={updating} />
      </MemoryRouter>,
    );
  }

  it("updating: the table region is aria-busy, its body is at half opacity, and a status says Updating", () => {
    const { container } = table(true);
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("true");
    const body = container.querySelector("tbody") as HTMLElement;
    expect(body.style.opacity).toBe("0.5");
    expect(body.style.transition).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Updating");
  });

  it("not updating: aria-busy is false, opacity is not set, and the status is present and empty", () => {
    const { container } = table(false);
    expect(screen.getByRole("region", { name: "Builds table" }).getAttribute("aria-busy")).toBe("false");
    expect((container.querySelector("tbody") as HTMLElement).style.opacity).toBe("");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("updating: the head's number is drawn at half opacity, as old as the rows", () => {
    draw((p) => ({ ...p, updating: true }));
    expect((screen.getByRole("heading", { level: 1 }) as HTMLElement).style.opacity).toBe("0.5");
  });
});

/* ── SV-24 P2 ── */

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
    draw((p) => ({ ...p, table: { ...p.table!, footer: { ...p.table!.footer, calculations: [{ key: "steps:sum", column: "steps", text: "Sum, Steps 214", onRemove }] } } }));
    expect(screen.getByText("Sum, Steps 214")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Sum, Steps 214" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("keeps the button when the Confirmed column it sits in is off", () => {
    draw((p) => ({ ...p, table: { ...p.table!, columns: ["build", "reproductions"], footer: { ...p.table!.footer, calculate } } }));
    expect(screen.getByRole("button", { name: "Add a calculation" })).toBeTruthy();
  });
});

/** BF-12 (B4): a narrow window, where the Sort menu is drawn. */
const asPhone = () => {
  window.matchMedia = ((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
};

describe("the Sort menu", () => {
  it("opens on a mouse press, not only from the keyboard (phone)", () => {
    asPhone();
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    draw();
    fireEvent.pointerDown(screen.getByRole("button", { name: /^Sort:/ }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("menuitemradio", { name: "Steps" })).toBeTruthy();
  });

  it("desktop: there is no Sort menu in the lens row", () => {
    draw();
    expect(screen.queryByRole("button", { name: /^Sort/ })).toBeNull();
  });

  it("phone: the Sort menu lists the drawn columns that can be sorted, by their column names, and choosing one sorts descending", () => {
    asPhone();
    (window as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
    const onSortColumn = vi.fn();
    draw((p) => ({ ...p, table: { ...p.table!, onSortColumn } }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Sort: Reproductions" }), { button: 0, ctrlKey: false });
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Steps", "Sessions", "Reproductions", "Confirmed", "Rebuilds"]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Steps" }));
    expect(onSortColumn).toHaveBeenCalledWith("steps", false, true);
  });
});

/* ── BF-01 ── */

/** A row with nothing set: no counts, no words, no runs, no tools. */
const blankRow: TableRowView = {
  id: "blank", href: "#", title: "Blank build", maker: "kit", built: "", field: "", tools: [], steps: null, sessions: null,
  reproductions: 0, lit: false, confirmed: "", runs: [], rebuilds: 0, open: "", cost: "",
};

function drawTable(rows: readonly TableRowView[], columns?: readonly ColumnId[]) {
  const table = visionBuildsTableViewProps();
  return render(
    <MemoryRouter>
      <BuildsTableView {...table} rows={rows} columns={columns ?? table.columns} />
    </MemoryRouter>,
  );
}

/** The cell of a column in the first body row. */
function cellIn(column: string): HTMLElement {
  const heads = screen.getAllByRole("columnheader");
  const at = heads.findIndex((head) => head.textContent?.replace(/[↑↓]/g, "").trim() === column);
  const row = screen.getAllByRole("row").find((tr) => tr.closest("tbody"))!;
  return within(row).getAllByRole("cell")[at];
}

describe("BF-01 empty values", () => {
  it("a row with no steps, sessions, field, what was built, confirmed, open and cost shows the empty mark in each of those cells", () => {
    drawTable([blankRow]);
    for (const column of ["Steps", "Sessions", "Field", "What was built", "Confirmed", "Open", "Cost to run"]) {
      const mark = within(cellIn(column)).getByTestId("empty-value");
      expect(mark.querySelector('[aria-hidden="true"]')?.textContent).toBe("\u2013");
      expect(within(mark).getByText("no value")).toBeTruthy();
    }
  });

  it("a real zero is a zero", () => {
    drawTable([blankRow]);
    for (const column of ["Reproductions", "Rebuilds"]) {
      const cell = cellIn(column);
      expect(cell.textContent).toContain("0");
      expect(within(cell).queryByTestId("empty-value")).toBeNull();
    }
  });

  it("no cell in the table is blank", () => {
    const table = visionBuildsTableProps().table!;
    drawTable([{ ...blankRow, extra: {} }], [...table.columns, "shape", "task"]);
    const row = screen.getAllByRole("row").find((tr) => tr.closest("tbody"))!;
    for (const cell of within(row).getAllByRole("cell")) expect(cell.textContent?.trim()).not.toBe("");
  });
});

describe("BF-01 headers on one line", () => {
  it("every column head has white-space nowrap", () => {
    drawTable([blankRow], ALL_COLUMNS);
    const heads = screen.getAllByRole("columnheader");
    expect(heads).toHaveLength(28);
    for (const head of heads) expect(head.style.whiteSpace).toBe("nowrap");
  });

  it("the sort arrow is inside the same inline-flex as the name", () => {
    drawTable([blankRow]);
    const button = within(screen.getByRole("columnheader", { name: /Reproductions/ })).getByRole("button");
    expect(button.style.display).toBe("inline-flex");
    expect(button.textContent).toBe("Reproductions↓");
  });
});

describe("BF-01 the lamp", () => {
  const lit = `Confirmed in the last ${STALE_AFTER_DAYS} days`;
  const dim = `Stale: not confirmed in ${STALE_AFTER_DAYS} days`;
  const bodyRow = () => screen.getAllByRole("row").find((tr) => tr.closest("tbody"))!;

  it("a build with no reproductions shows 0 and no lamp", () => {
    drawTable([blankRow]);
    expect(cellIn("Reproductions").textContent).toBe("0");
    expect(within(bodyRow()).queryByRole("img", { name: lit })).toBeNull();
    expect(within(bodyRow()).queryByRole("img", { name: dim })).toBeNull();
  });

  it(`a lit lamp is named "Confirmed in the last 120 days"`, () => {
    drawTable([{ ...blankRow, reproductions: 5, lit: true }]);
    const lamp = within(bodyRow()).getByRole("img", { name: lit });
    expect(lamp.getAttribute("title")).toBe(lit);
  });

  it(`a dim lamp is named "Stale: not confirmed in 120 days"`, () => {
    drawTable([{ ...blankRow, reproductions: 5, lit: false }]);
    expect(within(bodyRow()).getByRole("img", { name: dim })).toBeTruthy();
  });

  it("the key sits on its own line under the table (BF-13): a lit lamp with its words and a dim lamp with its words", () => {
    drawTable([blankRow]);
    const key = screen.getByTestId("lamp-key");
    expect(key.closest("table")).toBeNull();
    expect(within(key).getByRole("img", { name: lit })).toBeTruthy();
    expect(within(key).getByRole("img", { name: dim })).toBeTruthy();
    expect(within(key).getByText(`confirmed in the last ${STALE_AFTER_DAYS} days`)).toBeTruthy();
    expect(within(key).getByText("stale")).toBeTruthy();
  });
});

describe("BF-01 tools and runs", () => {
  it("a build with no runs in twelve weeks shows the empty mark in Runs", () => {
    for (const runs of [[], Array.from({ length: 12 }, () => 0)]) {
      const { unmount } = drawTable([{ ...blankRow, runs }]);
      expect(within(cellIn("Runs, 12 weeks")).getByTestId("empty-value")).toBeTruthy();
      expect(screen.queryByRole("img", { name: /^Runs per week/ })).toBeNull();
      unmount();
    }
  });

  it("a build with runs still draws twelve bars with their summary", () => {
    drawTable([{ ...blankRow, runs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2] }]);
    const summary = screen.getByRole("img", { name: "Runs per week over 12 weeks, oldest first: 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2" });
    expect(summary.querySelectorAll('[aria-hidden="true"]').length).toBe(12);
  });

  it("each tool mark can be focused and names its tool", () => {
    const tools = [{ id: "claude-code", name: "Claude Code" }, { id: "cursor", name: "Cursor" }];
    drawTable([{ ...blankRow, tools }]);
    for (const tool of tools) {
      const mark = within(cellIn("Tools")).getByRole("img", { name: tool.name });
      expect(mark.tabIndex).toBe(0);
      mark.focus();
      expect(document.activeElement).toBe(mark);
    }
  });
});

/* ── BF-03 P1 (D1) ── */

describe("the head", () => {
  it('the head is the shared head: an h1 that reads "<n> builds", aligned to the top, with the view switch', () => {
    draw();
    const head = screen.getByTestId("builds-head");
    expect(head.style.alignItems).toBe("flex-start");
    expect(within(head).getByRole("heading", { level: 1 }).textContent).toMatch(/^\d+( of \d+)? builds?$/);
    expect(within(head).getByRole("heading", { level: 1, name: /^\d+( of \d+)? builds?$/ })).toBeTruthy();
    expect(within(head).getByRole("navigation", { name: "View" })).toBeTruthy();
  });
});

/* ── BF-03 P3 (D3) ── */

describe("the stored counts", () => {
  it("a build never counted shows the empty mark in both Steps and Sessions", () => {
    // What the list reads for a build the SV-23 writer has not saved: no step count, so no session count either (gallery.ts).
    const never = { id: "n", slug: "n", title: "Never counted", shape: "", madeWith: [], reproductionCount: 0, lastConfirmedAt: null, lastConfirmedModel: null, publishedAt: null, rebuildCount: 0, maker: null, open: { count: 0 }, stepCount: null, sessionCount: null };
    drawTable([tableRow(never, Date.parse("2026-11-10T12:00:00Z"))]);
    for (const column of ["Steps", "Sessions"]) expect(within(cellIn(column)).getByTestId("empty-value")).toBeTruthy();
  });
});

/* ── BF-06 P1 (A1, G4) ── */

describe("the Filters button", () => {
  it('FiltersButton: with no filter on it reads "Filters" in the control look', () => {
    render(<FiltersButton activeCount={0} />);
    const button = screen.getByRole("button", { name: "Filters" });
    expect(button.textContent).toBe("Filters");
    expect(button.getAttribute("aria-pressed")).toBeNull();
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    // jsdom drops a `var()` from background and border, so the look is read from the markup React writes.
    expect(renderToStaticMarkup(<FiltersButton activeCount={0} />)).not.toContain("var(--selected-fill)");
  });

  it('FiltersButton: with three on it reads "Filters 3", is drawn in the selected look, and its name is "Filters, 3 on"', () => {
    render(<FiltersButton activeCount={3} />);
    const button = screen.getByRole("button", { name: "Filters, 3 on" });
    expect(button.textContent).toBe("Filters3");
    const markup = renderToStaticMarkup(<FiltersButton activeCount={3} />);
    expect(markup).toContain("background:var(--selected-fill)");
    expect(markup).toContain("border:1px solid var(--selected-edge)");
  });
});

/* ── BF-06 P2 (A1, C5a, C13) ── */

describe("the Table without the rail", () => {
  it("the Table page has no Filters aside", () => {
    draw();
    expect(screen.queryByRole("complementary", { name: "Filters" })).toBeNull();
    expect(screen.queryByTestId("builds-filters")).toBeNull();
  });

  it("the lens row holds Filters, then Columns (Sort is on a phone only, BF-12)", () => {
    draw();
    const filters = screen.getByRole("button", { name: /^Filters/ });
    const row = filters.parentElement as HTMLElement;
    const names = within(row).getAllByRole("button").map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/\s+/g, " ").trim());
    expect(names).toEqual(["Filters, 6 on", "Columns 12 of 24"]);
  });

  it("pressing Filters opens the dialog with the filter panel in it; closing it returns focus to the button", async () => {
    draw();
    const button = screen.getByRole("button", { name: /^Filters/ });
    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(within(dialog).getByTestId("builds-filters")).toBeTruthy();
    expect(within(dialog).getByRole("checkbox", { name: /Sales/ })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("the table region has a thin scrollbar", () => {
    // jsdom drops scrollbar-width from an inline style, so it is read from the markup React writes.
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <BuildsTableView {...visionBuildsTableViewProps()} />
      </MemoryRouter>,
    );
    expect(markup).toMatch(/aria-label="Builds table"[^>]*style="[^"]*scrollbar-width:thin/);
  });
});

/* ── BF-09 P3 (A8) ── */

describe("the open set on the Filters button", () => {
  it('with a set open, the Filters button on the page reads "Filters 2 · <set name>"', () => {
    draw((p) => ({ ...p, filters: { ...p.filters, activeCount: 2 }, table: { ...p.table!, setName: "Sales on Claude Code" } }));
    const button = screen.getByRole("button", { name: "Filters, 2 on, set Sales on Claude Code" });
    expect(Array.from(button.children).map((child) => child.textContent)).toEqual(["Filters", "2", "· Sales on Claude Code"]);
  });
});

/* ── BF-10 P2 ── */

describe("the four new columns in the chooser", () => {
  it("the chooser offers 28 columns when the counts are live", () => {
    const columns = chosenColumns(null, true);
    draw((p) => ({ ...p, table: { ...p.table!, columnsLabel: columnsLabel(columns, true), columnsMenu: columnsMenu(columns, true, vi.fn()) } }));
    fireEvent.click(screen.getByRole("button", { name: "Columns: 12 of 28" }));
    const group = screen.getByRole("group", { name: "Columns" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(28);
    for (const name of ["Works on model", "Likes", "Patterns", "Published"]) expect(within(group).getByRole("checkbox", { name })).toBeTruthy();
  });
});

/* ── BF-10 P3 (C9) ── */

describe("the grouped chooser", () => {
  const openChooser = (onReset?: () => void) => {
    const columns = chosenColumns(null, true);
    draw((p) => ({ ...p, table: { ...p.table!, columnsLabel: columnsLabel(columns, true), columnsMenu: columnsMenu(columns, true, vi.fn(), onReset) } }));
    fireEvent.click(screen.getByRole("button", { name: /^Columns:/ }));
    return within(screen.getByRole("group", { name: "Columns" }));
  };
  const namesIn = (group: string) => within(screen.getByRole("group", { name: group })).getAllByRole("checkbox").map((box) => box.closest("label")?.textContent);

  /* BF-13 (C6): the reader's columns come first, in their order, under "Shown, in order"; each group lists the rest. */
  it("the chooser lists the shown columns first, then the rest under Identity, Classification, Proof and Structure, in that order", () => {
    const chooser = openChooser();
    expect(chooser.getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual(["Shown, in order", "Identity", "Classification", "Proof", "Structure"]);
  });

  it("Shown holds the default twelve in order, Build locked; Identity holds Published; Proof holds Works on model and Likes; Structure holds Shape and Patterns; Classification holds the other eleven facets", () => {
    openChooser();
    expect(namesIn("Shown, in order")).toEqual(["Build", "What was built", "Field", "Tools", "Steps", "Sessions", "Reproductions", "Confirmed", "Runs, 12 weeks", "Rebuilds", "Open", "Cost to run"]);
    expect((within(screen.getByRole("group", { name: "Shown, in order" })).getByRole("checkbox", { name: "Build" }) as HTMLInputElement).disabled).toBe(true);
    expect(namesIn("Identity")).toEqual(["Published"]);
    expect(namesIn("Proof")).toEqual(["Works on model", "Likes"]);
    expect(namesIn("Structure")).toEqual(["Shape", "Patterns"]);
    expect(namesIn("Classification")).toHaveLength(11);
    expect(namesIn("Classification")).toEqual(expect.arrayContaining(["Autonomy", "Skill"]));
  });

  it("the popover opens to the left of its button", () => {
    openChooser();
    const content = screen.getByRole("dialog");
    expect(content.getAttribute("data-side")).toBe("left");
    expect(content.getAttribute("data-align")).toBe("start");
  });

  it("Back to the default columns is still offered once the columns differ", () => {
    const onReset = vi.fn();
    openChooser(onReset);
    fireEvent.click(screen.getByRole("button", { name: "Back to the default columns" }));
    expect(onReset).toHaveBeenCalled();
  });
});

/* ── BF-11 P2 (B2) ── */

describe("BF-11 filtered heads", () => {
  /** The head's own markup, as React writes it (jsdom drops a `var()` from an inline style). */
  const headMarkup = (props: ReturnType<typeof visionBuildsTableViewProps>, name: string) => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BuildsTableView {...props} />
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("th")].find((th) => th.textContent?.startsWith(name))!.outerHTML;
  };
  const withAutonomy = (filtered: ColumnId[]) => ({ ...visionBuildsTableViewProps(), columns: [...COLUMN_ORDER, "autonomy"] as ColumnId[], filtered: new Set(filtered) });

  it('a filtered column\'s head is in --text at weight 500 with a 1px --selected-edge underline, and its name ends ", filtered" for a screen reader', () => {
    render(
      <MemoryRouter>
        <BuildsTableView {...withAutonomy(["autonomy"])} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("columnheader", { name: /Autonomy, filtered/ })).toBeTruthy();
    const markup = headMarkup(withAutonomy(["autonomy"]), "Autonomy");
    expect(markup).toContain("color:var(--text)");
    expect(markup).toContain("font-weight:500");
    expect(markup).toContain("border-bottom:1px solid var(--selected-edge)");
  });

  it("a column that is not filtered has no underline and no such text", () => {
    const markup = headMarkup(withAutonomy(["autonomy"]), "Field");
    expect(markup).not.toContain("selected-edge");
    expect(markup).not.toContain("filtered");
  });

  it("a column that is both sorted and filtered shows the arrow and the underline", () => {
    const props = { ...withAutonomy(["reproductions"]) };
    render(
      <MemoryRouter>
        <BuildsTableView {...props} />
      </MemoryRouter>,
    );
    const head = screen.getByRole("columnheader", { name: /Reproductions, filtered/ });
    expect(head.getAttribute("aria-sort")).toBe("descending");
    expect(head.textContent).toContain("↓");
    expect(headMarkup(props, "Reproductions")).toContain("border-bottom:1px solid var(--selected-edge)");
  });

  it("the mark is drawn with the setting off too", () => {
    /* With "Add a column for each filter" off, a column the reader ticked is still drawn, and still says it is filtered: the
       mark follows the filter, not the setting. */
    const props = { ...visionBuildsTableViewProps(), columns: ["build", "field"] as ColumnId[], filtered: new Set<ColumnId>(["field"]) };
    render(
      <MemoryRouter>
        <BuildsTableView {...props} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("columnheader", { name: /Field, filtered/ })).toBeTruthy();
  });
});

/* ── BF-13 P1 (C6): the footer, one cell per column ── */

describe("BF-13 footer", () => {
  const drawTable = (change: (props: ReturnType<typeof visionBuildsTableViewProps>) => ReturnType<typeof visionBuildsTableViewProps> = (p) => p) =>
    render(
      <MemoryRouter>
        <BuildsTableView {...change(visionBuildsTableViewProps())} />
      </MemoryRouter>,
    );
  /** The footer's cells, by the column above each. */
  const footerCells = () => {
    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    const heads = screen.getAllByRole("columnheader").map((head) => head.textContent?.replace(/[↑↓2]/g, "") ?? "");
    const cells = within(footer).getAllByRole("cell");
    return { heads, cells, under: (name: string) => cells[heads.indexOf(name)] };
  };

  it("with the default columns the footer reads as it did", () => {
    drawTable();
    const { under } = footerCells();
    expect(under("Build").textContent).toContain("18 builds");
    expect(under("Field").textContent).toBe("Sales");
    expect(under("Tools").textContent).toBe("Claude Code");
    expect(under("Steps").textContent).toBe("Median 11");
    expect(under("Reproductions").textContent).toBe("Total 214");
  });

  it("the footer has exactly one cell per drawn column, and none has a colSpan", () => {
    drawTable();
    const { heads, cells } = footerCells();
    expect(cells).toHaveLength(heads.length);
    for (const cell of cells) expect(cell.getAttribute("colspan")).toBeNull();
    expect(screen.getAllByRole("rowgroup").at(-1)!.querySelectorAll("tr")).toHaveLength(1);
  });

  it("moving Field after Reproductions moves its footer value with it", () => {
    drawTable((p) => ({ ...p, columns: ["build", "built", "tools", "steps", "reproductions", "field", "confirmed"] }));
    const { heads, cells } = footerCells();
    expect(heads.indexOf("Field")).toBe(5);
    expect(cells[5].textContent).toBe("Sales");
    expect(cells[4].textContent).toBe("Total 214");
  });

  it("a calculation the reader added is drawn under its own column, with its Remove button", () => {
    const onRemove = vi.fn();
    drawTable((p) => ({ ...p, footer: { ...p.footer, calculations: [{ key: "steps:sum", column: "steps", text: "Sum, Steps 214", onRemove }] } }));
    const cell = footerCells().under("Steps");
    expect(within(cell).getByText("Sum, Steps 214")).toBeTruthy();
    fireEvent.click(within(cell).getByRole("button", { name: "Remove Sum, Steps 214" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("Add a calculation is in the Build column's footer cell, under the count", () => {
    drawTable();
    const cell = footerCells().under("Build");
    const button = within(cell).getByRole("button", { name: "Add a calculation" });
    expect(cell.textContent?.indexOf("18 builds")).toBeLessThan(cell.textContent!.indexOf("Add a calculation"));
    expect(button).toBeTruthy();
  });

  it("with Last confirmed not drawn, Add a calculation is still there", () => {
    drawTable((p) => ({ ...p, columns: ["build", "reproductions"] }));
    expect(within(footerCells().under("Build")).getByRole("button", { name: "Add a calculation" })).toBeTruthy();
  });
});

/* ── BF-13 P2 (C6): the reader's order ── */

describe("BF-13 column order", () => {
  const menuOf = (onMove = vi.fn()) => columnsMenu(["build", "field", "tools", "steps"], true, vi.fn(), undefined, [], onMove);
  const openChooser = (menu: ReturnType<typeof menuOf>) => {
    render(
      <MemoryRouter>
        <BuildsTableView {...visionBuildsTableViewProps()} columnsLabel="4 of 28" columnsMenu={menu} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Columns: 4 of 28" }));
  };

  it('in the chooser every chosen column but Build has "Move <name> left" and "Move <name> right" buttons; the first movable one\'s Left and the last one\'s Right are disabled', () => {
    openChooser(menuOf());
    const shown = screen.getByRole("group", { name: "Shown, in order" });
    expect(within(shown).queryByRole("button", { name: /^Move Build/ })).toBeNull();
    for (const name of ["Field", "Tools", "Steps"]) {
      expect(within(shown).getByRole("button", { name: `Move ${name} left` })).toBeTruthy();
      expect(within(shown).getByRole("button", { name: `Move ${name} right` })).toBeTruthy();
    }
    expect((within(shown).getByRole("button", { name: "Move Field left" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(shown).getByRole("button", { name: "Move Steps right" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(shown).getByRole("button", { name: "Move Tools left" }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(shown).getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual(["Build", "Field", "Tools", "Steps"]);
  });

  it('pressing Move right calls onMove with the id and "right"', () => {
    const onMove = vi.fn();
    openChooser(menuOf(onMove));
    fireEvent.click(screen.getByRole("button", { name: "Move Tools right" }));
    expect(onMove).toHaveBeenCalledWith("tools", "right");
  });

  it("a head has user-select none and touch-action none while it can be dragged", () => {
    const props = { ...visionBuildsTableViewProps(), onDropColumn: vi.fn(), movable: new Set<ColumnId>(["field"]) };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BuildsTableView {...props} />
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const head = (name: string) => [...doc.querySelectorAll("th")].find((th) => th.textContent?.startsWith(name))!.getAttribute("style") ?? "";
    expect(head("Field")).toContain("user-select:none");
    expect(head("Field")).toContain("touch-action:none");
    expect(head("Tools")).not.toContain("touch-action:none");
  });
});

/* ── BF-13 P3 (C5b): the Build column stays in view ── */

describe("BF-13 pinned Build column", () => {
  it("the Build head and every Build cell are position sticky at left 0 with the surface colour behind them", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BuildsTableView {...visionBuildsTableViewProps()} />
      </MemoryRouter>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const firstCells = [...doc.querySelectorAll("tr")].map((row) => row.children[0] as HTMLElement);
    expect(firstCells.length).toBeGreaterThan(3);
    for (const cell of firstCells) {
      const style = cell.getAttribute("style") ?? "";
      expect(style).toContain("position:sticky");
      expect(style).toContain("left:0");
      expect(style).toContain("background:var(--surface)");
    }
    const second = (doc.querySelector("tbody tr")!.children[1] as HTMLElement).getAttribute("style") ?? "";
    expect(second).not.toContain("sticky");
  });

  it("the pinned cells take a hairline edge only once the table is scrolled", () => {
    render(
      <MemoryRouter>
        <BuildsTableView {...visionBuildsTableViewProps()} />
      </MemoryRouter>,
    );
    const region = screen.getByRole("region", { name: "Builds table" });
    expect(region.getAttribute("data-scrolled")).toBeNull();
    region.scrollLeft = 40;
    fireEvent.scroll(region);
    expect(region.getAttribute("data-scrolled")).toBe("true");
    region.scrollLeft = 0;
    fireEvent.scroll(region);
    expect(region.getAttribute("data-scrolled")).toBeNull();
  });
});
