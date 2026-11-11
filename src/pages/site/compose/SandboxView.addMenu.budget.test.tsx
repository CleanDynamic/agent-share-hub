// The Add step tile menu's choice budgets, counted in the rendered menu (UX-02 P6), as solvers.budget.test.tsx counts its page
// ⟦hicks-law › Enforcing It in the Code⟧. With every entry live: Prompt first, at most 7 group heads, at most 5 entries in any group.

import { cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { everyEntry, openAddMenu } from "./addMenuTestSupport";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UX-02 P6 · the Add step tile menu's budgets", () => {
  it("puts Prompt first", () => {
    const menu = openAddMenu(everyEntry());
    expect(within(menu).getAllByRole("menuitem")[0].textContent).toMatch(/^Prompt/);
  });

  it("F40: shows five entries, then More types and From Library, on the first screen", () => {
    const menu = openAddMenu(everyEntry());
    expect(within(menu).getAllByRole("menuitem").map((item) => item.firstChild?.textContent)).toEqual(["Prompt", "Agent", "Tool", "File", "Dataset", "More types", "From Library"]);
  });

  it("has at most 7 group heads and at most 5 entries in any group, once More types is opened", () => {
    const menu = openAddMenu(everyEntry());
    fireEvent.click(within(menu).getByTestId("add-more-types"));
    expect(within(menu).getAllByTestId("add-group-head").length).toBeLessThanOrEqual(7);
    for (const group of within(menu).getAllByTestId("add-group")) expect(within(group).getAllByRole("menuitem").length).toBeLessThanOrEqual(5);
  });
});
