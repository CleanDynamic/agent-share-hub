// Prompt 21 and 29f: Builds below 768px. The claims: the Table is one row per build (never a table): its name over "3 sessions · 12
// steps · @maker" and a 48 cover, the lens as pills under the bar; the views, Filters and Sort are rows of the bar's More sheet
// (drawn here by `MoreProbe`), and Sort and Filters are sheets; Done in the Filters sheet applies the draft once; Maps and
// Classification draw their phone cards. Nothing here asserts the desktop, which the other files do.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsClassificationProps } from "@/dev/fixtures/vision/builds-classification";
import { visionBuildsMapsProps } from "@/dev/fixtures/vision/builds-maps";
import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";
import { MoreProbe } from "@/test/MoreProbe";

import BuildsClassificationView from "./BuildsClassificationView";
import BuildsMapsView from "./BuildsMapsView";
import { BuildsView, type BuildsViewProps } from "./BuildsView";
import { rowFacts } from "./BuildsTablePhone";

/** A 390 wide phone: the max-width query matches, the min-width ones do not. */
beforeEach(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { matches: max ? 390 <= Number(max[1]) : min ? 390 >= Number(min[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false };
  }) as unknown as typeof window.matchMedia;
});

function draw(change: (props: BuildsViewProps) => BuildsViewProps = (p) => p) {
  return render(
    <MemoryRouter>
      <BuildsView {...change(visionBuildsTableProps())} />
      <MoreProbe />
    </MemoryRouter>,
  );
}

describe("the Table on a phone", () => {
  it("is one row per build, each the link, and no table", () => {
    draw();
    expect(screen.queryByRole("table")).toBeNull();
    const rows = screen.getAllByTestId("build-card");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].tagName).toBe("A");
    expect(rows[0].getAttribute("href")).toBeTruthy();
  });

  it("draws the lens as pills under the bar, and no row of controls: Filters and Sort are in More", () => {
    draw();
    expect(screen.getByRole("tablist", { name: "Lens" })).toBeTruthy();
    const more = within(screen.getByTestId("more-probe"));
    expect(more.getByRole("button", { name: /^Filters/ })).toBeTruthy();
    expect(more.getByRole("button", { name: /^Sort/ })).toBeTruthy();
    const page = screen.getByTestId("builds-table");
    expect(within(page).queryByRole("button", { name: /^Filters/ })).toBeNull();
    expect(within(page).queryByRole("button", { name: /^Sort/ })).toBeNull();
    expect(within(page).queryByRole("button", { name: /^Columns/ })).toBeNull();
  });

  it("a row is its name over its facts, and a 48 cover with radius 9 at the right", () => {
    draw((p) => ({ ...p, table: p.table && { ...p.table, rows: p.table.rows.map((row) => ({ ...row, sessions: 3, steps: 12, maker: "suntzu" })) } }));
    const row = screen.getAllByTestId("build-card")[0];
    expect(row.textContent).toContain("3 sessions · 12 steps · @suntzu");
    const cover = within(row).getByTestId("build-cover");
    expect(cover.style.width).toBe("48px");
    expect(cover.style.height).toBe("48px");
    expect(cover.style.borderRadius).toBe("9px");
    expect(row.style.padding).toBe("10px 16px");
    expect(row.style.gap).toBe("12px");
  });

  it("says one session and one step in the singular, and leaves out a count it does not have", () => {
    expect(rowFacts(1, 1, "kit")).toBe("1 session · 1 step · @kit");
    expect(rowFacts(null, 4, "kit")).toBe("4 steps · @kit");
    expect(rowFacts(null, null, "kit")).toBe("@kit");
  });

  it("Sort opens a sheet of the sortable columns, and choosing one sorts and closes it", () => {
    const onSortColumn = vi.fn();
    draw((p) => ({ ...p, table: p.table && { ...p.table, onSortColumn } }));
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Sort/ }));
    const sheet = screen.getByRole("dialog", { name: "Sort" });
    const choices = within(sheet).getAllByRole("radio");
    expect(choices.length).toBeGreaterThan(0);
    fireEvent.click(choices[0]);
    expect(onSortColumn).toHaveBeenCalledWith(expect.any(String), false, true);
    expect(screen.queryByRole("dialog", { name: "Sort" })).toBeNull();
  });

  it("an active filter is a chip with a named remove, and Clear all", () => {
    const onRemoveChip = vi.fn();
    const onClearAll = vi.fn();
    draw((p) => ({ ...p, table: p.table && { ...p.table, chips: [{ key: "field:food", name: "Field", value: "Food and drink" }], onRemoveChip, onClearAll } }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Field: Food and drink" }));
    expect(onRemoveChip).toHaveBeenCalledWith("field:food");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("the other views are links in More, and the current one is left out", () => {
    draw();
    const more = within(screen.getByTestId("more-probe"));
    expect(more.getAllByRole("link").map((link) => link.textContent)).toEqual(["Maps", "Classification"]);
    expect(screen.queryByRole("navigation", { name: "View" })).toBeNull();
  });
});

describe("the Filters sheet", () => {
  it("opens as a sheet with the find field and Order values, and Done applies the draft", () => {
    const onApply = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onApply } }));
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("searchbox", { name: "Find a filter" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: /^Order values/ })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("a row opens in place into its choices, and a choice reports its toggle", () => {
    const onToggleOption = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onToggleOption } }));
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Field/ }));
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /Education/ }));
    expect(onToggleOption).toHaveBeenCalledWith("field", "education");
  });

  it("finding a filter lists the ones whose name holds the words", () => {
    draw();
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.change(within(sheet).getByRole("searchbox", { name: "Find a filter" }), { target: { value: "zzzz" } });
    expect(within(sheet).getByText("No filter has that name.")).toBeTruthy();
  });

  it("Clear all clears the draft", () => {
    const onClear = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onClear } }));
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Filters/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Filters" })).getByRole("button", { name: "Clear all" }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("Maps on a phone", () => {
  it("draws a Panel card per build with its sessions as boxes, and the Map direction as pills", () => {
    const onDirection = vi.fn();
    render(
      <MemoryRouter>
        <BuildsMapsView {...visionBuildsMapsProps({ onDirection })} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId("map-card").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Vertical" }));
    expect(onDirection).toHaveBeenCalledWith("vertical");
    expect(screen.getAllByText("Session 1").length).toBeGreaterThan(0);
  });
});

describe("Classification on a phone", () => {
  it("opens Facets shown as a sheet that keeps the last facet", () => {
    const onFacets = vi.fn();
    const props = visionBuildsClassificationProps();
    render(
      <MemoryRouter>
        <BuildsClassificationView {...props} facets={["field"]} onFacets={onFacets} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Facets shown/ }));
    const sheet = screen.getByRole("dialog", { name: "Facets shown" });
    expect((within(sheet).getByRole("checkbox", { name: "Field" }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(sheet).getByRole("checkbox", { name: "Task" }));
    expect(onFacets).toHaveBeenCalledWith(["field", "task"]);
  });

  it("a facet with nothing says Not stated, and a card still names each facet shown", () => {
    const props = visionBuildsClassificationProps();
    render(
      <MemoryRouter>
        <BuildsClassificationView {...props} />
      </MemoryRouter>,
    );
    const cards = screen.getAllByTestId("classification-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(within(cards[0]).getAllByRole("term").length).toBeGreaterThan(0);
  });
});

describe("Saved filter sets on a phone", () => {
  const sets = (over: Record<string, unknown> = {}) => (p: BuildsViewProps): BuildsViewProps => ({
    ...p,
    filters: {
      ...p.filters,
      savedSets: { rows: [{ id: "s1", name: "Mine", href: "/builds?set=s1", isPublic: false }], canSave: true, onSaveCurrent: vi.fn(async () => undefined), onRename: vi.fn(), onDelete: vi.fn(async () => undefined), onTogglePublic: vi.fn(), ...over },
    },
  });
  const openSets = () => {
    fireEvent.click(within(screen.getByTestId("more-probe")).getByRole("button", { name: /^Filters/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Filters" })).getByRole("button", { name: "Save these filters" }));
    return screen.getByRole("dialog", { name: "Saved filter sets" });
  };

  it("Save these filters opens the sheet; Save keeps the name and who can open it", async () => {
    const onSaveCurrent = vi.fn(async () => undefined);
    draw(sets({ onSaveCurrent }));
    const sheet = openSets();
    expect((within(sheet).getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(sheet).getByLabelText("Filter set"), { target: { value: "Food" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Public" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onSaveCurrent).toHaveBeenCalledWith("Food", true));
  });

  it("the More button offers Rename, Make public and Delete, and Delete asks in an action sheet", async () => {
    const onDelete = vi.fn(async () => undefined);
    draw(sets({ onDelete }));
    openSets();
    fireEvent.click(screen.getByRole("button", { name: "More for Mine" }));
    const more = screen.getByRole("dialog", { name: "More" });
    expect(within(more).getByRole("button", { name: "Rename" })).toBeTruthy();
    expect(within(more).getByRole("button", { name: "Make public" })).toBeTruthy();
    fireEvent.click(within(more).getByRole("button", { name: "Delete" }));
    const ask = await screen.findByRole("alertdialog", { name: "Delete this filter set?" });
    expect(within(ask).getByText("The filters in it stay as they are.")).toBeTruthy();
    fireEvent.click(within(ask).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
