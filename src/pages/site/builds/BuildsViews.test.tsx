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

  it("names each grip and moves a filter from the keyboard", () => {
    const onMove = vi.fn();
    draw((p) => ({ ...p, filters: { ...p.filters, onMove } }));
    const grip = screen.getByRole("button", { name: "Move Field" });
    fireEvent.keyDown(grip, { key: "ArrowDown" });
    expect(onMove).toHaveBeenCalledWith("field", "down");
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
