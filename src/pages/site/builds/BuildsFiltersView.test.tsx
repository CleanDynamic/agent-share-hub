// BF-07: the filter dialog's contents, drawn from the board's sample filters through the dialog the page uses
// (`BuildsFilters`). The claims: the filters are listed by group, a group says how many of its filters hold a value, a name
// search finds a filter in any group, and nothing is left of the old rail's catalogue tile.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { visionBuildsTableProps } from "@/dev/fixtures/vision/builds-table";

import { BuildsFilters, type BuildsFiltersViewProps } from "./BuildsFiltersView";

beforeEach(() => {
  // Radix's slider measures its thumbs; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

function draw(change: (props: BuildsFiltersViewProps) => BuildsFiltersViewProps = (p) => p, onOpenChange = vi.fn()) {
  const props = change(visionBuildsTableProps().filters);
  const drawn = render(
    <MemoryRouter>
      <BuildsFilters {...props} open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return { ...drawn, props, onOpenChange };
}

const groups = () => within(screen.getByRole("group", { name: "Filter groups" })).getAllByRole("button");
const shownNames = () => Array.from(screen.getByTestId("builds-filters").querySelectorAll("section[aria-label]")).map((node) => node.getAttribute("aria-label")).filter((name) => name !== "Saved filter sets");

/* ── BF-07 P1 (A3) ── */

describe("groups and a name search", () => {
  it("the groups are buttons; Classification is current at first; each shows how many filters it holds", () => {
    draw((p) => ({ ...p, sections: p.sections.map((section) => (section.kind === "word" ? { ...section, options: section.options.map((option) => ({ ...option, checked: false })) } : section.kind === "scale" ? { ...section, segments: section.segments.map((segment) => ({ ...segment, on: false })) } : { ...section, value: [section.min, section.max] })) }));
    expect(groups().map((button) => button.textContent)).toEqual(["Classification7", "Proof3", "Structure1", "OpenBuilds1"]);
    expect(screen.getByRole("button", { name: /^Classification/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /^Proof/ }).getAttribute("aria-current")).toBeNull();
  });

  it('a group with two filters holding a value shows "2 on"', () => {
    draw();
    expect(screen.getByRole("button", { name: /^Proof/ }).textContent).toBe("Proof2 on");
  });

  it("choosing Proof shows Proof's filters and none of Classification's", () => {
    draw();
    expect(shownNames()).toContain("Field");
    fireEvent.click(screen.getByRole("button", { name: /^Proof/ }));
    expect(shownNames()).toEqual(["Reproductions", "Works on model", "Last confirmed"]);
    expect(screen.getByRole("button", { name: /^Proof/ }).getAttribute("aria-current")).toBe("true");
  });

  it('typing "conf" in Find a filter shows Last confirmed and Confirmed or stale only, each labelled with its group, and no group is current', () => {
    draw((p) => ({ ...p, sections: [...p.sections, { kind: "word", id: "state", name: "Confirmed or stale", group: "Proof", order: "scale", options: [] }] }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a filter" }), { target: { value: "conf" } });
    expect(shownNames()).toEqual(["Last confirmed", "Confirmed or stale"]);
    for (const name of ["Last confirmed", "Confirmed or stale"]) expect(within(screen.getByRole("region", { name })).getByText("Proof")).toBeTruthy();
    expect(groups().some((button) => button.getAttribute("aria-current") === "true")).toBe(false);
  });

  it('a search that matches nothing says "No filter has that name."', () => {
    draw();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a filter" }), { target: { value: "zzz" } });
    expect(screen.getByText("No filter has that name.")).toBeTruthy();
    expect(shownNames()).toEqual([]);
  });

  it("clearing the search returns to the group that was current", () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: /^Structure/ }));
    const field = screen.getByRole("searchbox", { name: "Find a filter" });
    fireEvent.change(field, { target: { value: "auto" } });
    expect(shownNames()).toEqual(["Autonomy"]);
    fireEvent.change(field, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /^Structure/ }).getAttribute("aria-current")).toBe("true");
    expect(shownNames()).toEqual(["Steps"]);
  });

  it("the Add a filter tile is gone", () => {
    draw();
    expect(screen.queryByText("Add a filter")).toBeNull();
    expect(screen.queryByRole("region", { name: "More filters" })).toBeNull();
  });

  it("the search clears when the dialog closes", () => {
    const { rerender, props, onOpenChange } = draw();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a filter" }), { target: { value: "conf" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(
      <MemoryRouter>
        <BuildsFilters {...props} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    expect((screen.getByRole("searchbox", { name: "Find a filter" }) as HTMLInputElement).value).toBe("");
  });
});

/* ── BF-07 P2 (A4, A5) ── */

describe("fixed places, and nothing empty", () => {
  it('a checklist with no values shows "No builds have a value yet." and no checkboxes', () => {
    draw();
    const techniques = screen.getByRole("region", { name: "Techniques" });
    expect(within(techniques).getByText("No builds have a value yet.")).toBeTruthy();
    expect(within(techniques).queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("toggling a value never changes the order of the filters in its group", () => {
    const { rerender, props, onOpenChange } = draw();
    const before = shownNames();
    const third = props.sections.find((section) => section.name === before[2]);
    expect(third?.kind).toBe("word");
    const toggledSections = props.sections.map((section) =>
      section === third && section.kind === "word" ? { ...section, options: section.options.map((option, at) => (at === 0 ? { ...option, checked: !option.checked } : option)) } : section,
    );
    rerender(
      <MemoryRouter>
        <BuildsFilters {...props} sections={toggledSections} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    expect(shownNames()).toEqual(before);
  });
});

/* ── BF-07 P3 (A6) ── */

describe("no reordering", () => {
  it('no filter has a Move button, and the head says "<n> active" with no mention of dragging', () => {
    draw();
    expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
    expect(screen.queryByRole("separator")).toBeNull();
    const panel = screen.getByTestId("builds-filters");
    expect(within(panel).getByText("6 active")).toBeTruthy();
    expect(panel.textContent).not.toMatch(/drag|reorder/i);
    expect(panel.querySelector("[data-filter-slot]")).toBeNull();
  });
});
