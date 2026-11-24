// Prompt 21: Builds below 768px. The claims: the Table is one card per build (never a table) whose three numbers are the first
// three number columns the reader chose; Sort, Columns, Filters and Facets shown are sheets; Done in the Filters sheet applies the
// draft once; Maps and Classification draw their phone cards. Nothing here asserts the desktop, which the other files do.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsClassificationProps } from "@/dev/fixtures/vision/builds-classification";
import { visionBuildsMapsProps } from "@/dev/fixtures/vision/builds-maps";
import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";

import BuildsClassificationView from "./BuildsClassificationView";
import BuildsMapsView from "./BuildsMapsView";
import { BuildsView, type BuildsViewProps } from "./BuildsView";
import { chosenColumns, columnsLabel, columnsMenu } from "./buildsModel";
import type { ColumnId } from "./BuildsTableView";

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
    </MemoryRouter>,
  );
}

const withMenu = (columns: readonly ColumnId[], onToggle = vi.fn()) => (p: BuildsViewProps): BuildsViewProps => ({
  ...p,
  table: p.table && { ...p.table, columns, columnsLabel: columnsLabel(chosenColumns(null, true), true), columnsMenu: { ...columnsMenu(chosenColumns(null, true), true, onToggle, () => undefined), groups: undefined } },
});

describe("the Table on a phone", () => {
  it("is one card per build, each the link, and no table", () => {
    draw();
    expect(screen.queryByRole("table")).toBeNull();
    const cards = screen.getAllByTestId("build-card");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].tagName).toBe("A");
    expect(cards[0].getAttribute("href")).toBeTruthy();
  });

  it("draws the lens as tabs and the three controls", () => {
    draw(withMenu(chosenColumns(null, true)));
    expect(screen.getByRole("tablist", { name: "Lens" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Filters/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sort/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Columns/ })).toBeTruthy();
  });

  it("shows the first three number columns the reader chose, in their order", () => {
    draw((p) => ({ ...p, table: p.table && { ...p.table, columns: ["build", "built", "field", "steps", "sessions", "rebuilds", "open", "cost"] } }));
    const names = (card: HTMLElement) => ["Steps", "Rebuilds", "Likes", "Cost to run"].filter((name) => within(card).queryByText(name));
    expect(names(screen.getAllByTestId("build-card")[0])).toEqual(["Steps", "Rebuilds", "Cost to run"]);
  });

  it("changes the three numbers when the columns change", () => {
    draw((p) => ({ ...p, table: p.table && { ...p.table, columns: ["build", "likes", "rebuilds"] } }));
    const card = screen.getAllByTestId("build-card")[0];
    expect(within(card).getByText("Likes")).toBeTruthy();
    expect(within(card).getByText("Rebuilds")).toBeTruthy();
    expect(within(card).queryByText("Steps")).toBeNull();
  });

  it("writes an empty number as 0 and an unmeasured cost as Not measured", () => {
    draw((p) => ({ ...p, table: p.table && { ...p.table, columns: ["build", "steps", "cost"], rows: p.table.rows.map((row) => ({ ...row, steps: null, cost: "" })) } }));
    const card = screen.getAllByTestId("build-card")[0];
    expect(within(card).getByText("0")).toBeTruthy();
    expect(within(card).getByText("Not measured")).toBeTruthy();
  });

  it("Sort opens a sheet of the sortable columns, and choosing one sorts and closes it", () => {
    const onSortColumn = vi.fn();
    draw((p) => ({ ...p, table: p.table && { ...p.table, onSortColumn } }));
    fireEvent.click(screen.getByRole("button", { name: /^Sort/ }));
    const sheet = screen.getByRole("dialog", { name: "Sort" });
    const choices = within(sheet).getAllByRole("radio");
    expect(choices.length).toBeGreaterThan(0);
    fireEvent.click(choices[0]);
    expect(onSortColumn).toHaveBeenCalledWith(expect.any(String), false, true);
    expect(screen.queryByRole("dialog", { name: "Sort" })).toBeNull();
  });

  it("Columns opens a full sheet with the phone's one line, Build locked, and a reset", () => {
    const onToggle = vi.fn();
    draw(withMenu(chosenColumns(null, true), onToggle));
    fireEvent.click(screen.getByRole("button", { name: /^Columns/ }));
    const sheet = screen.getByRole("dialog", { name: "Columns" });
    expect(within(sheet).getByText("On a phone, the first three numbers you choose show on each card.")).toBeTruthy();
    expect((within(sheet).getByRole("checkbox", { name: "Build" }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(sheet).getByRole("checkbox", { name: "Likes" }));
    expect(onToggle).toHaveBeenCalledWith("likes");
    expect(within(sheet).getByRole("button", { name: "Back to the default columns" })).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: /Move .* left/ })).toBeNull();
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

  it("the view switch is three links, the current one marked", () => {
    draw();
    const nav = screen.getByRole("navigation", { name: "View" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Table", "Maps", "Classification"]);
    expect(within(nav).getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("the Filters sheet", () => {
  it("opens as a sheet with the find field and Order values, and Done applies the draft", () => {
    const onApply = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onApply } }));
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("searchbox", { name: "Find a filter" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: /^Order values/ })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("a row opens in place into its choices, and a choice reports its toggle", () => {
    const onToggleOption = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onToggleOption } }));
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Field/ }));
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /Education/ }));
    expect(onToggleOption).toHaveBeenCalledWith("field", "education");
  });

  it("finding a filter lists the ones whose name holds the words", () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    fireEvent.change(within(sheet).getByRole("searchbox", { name: "Find a filter" }), { target: { value: "zzzz" } });
    expect(within(sheet).getByText("No filter has that name.")).toBeTruthy();
  });

  it("Clear all clears the draft", () => {
    const onClear = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onClear } }));
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
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
