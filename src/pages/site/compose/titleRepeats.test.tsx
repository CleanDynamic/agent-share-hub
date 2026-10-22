// CA-14 P8 — a tile's automatic title that only repeats the start of its text is not drawn; a title the maker typed always is.

import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { Step } from "@/lib/build/graph";

import { BuildList, LIST_COPY } from "./BuildList";
import { titleRepeatsText } from "./buildListModel";
import { listHint, LIST_HINT, LIST_HINT_PHONE } from "./SandboxView";

afterEach(cleanup);

describe("titleRepeatsText", () => {
  it("is true for a title that is the text, or the start of it, with or without its ellipsis", () => {
    expect(titleRepeatsText("ccc", "ccc")).toBe(true);
    expect(titleRepeatsText("keep the table of routes in one place and more", "keep the table of routes in one place…")).toBe(true);
    expect(titleRepeatsText("  Keep   the TABLE", "keep the table")).toBe(true);
  });
  it("is false when the title says something the text does not start with, and for an empty title", () => {
    expect(titleRepeatsText("Plan the router", "Homepage copy")).toBe(false);
    expect(titleRepeatsText("Plan the router", "")).toBe(false);
    expect(titleRepeatsText("", "Plan")).toBe(false);
  });
});

describe("the List", () => {
  const step = (over: Partial<Step>): Step => ({ ...sandboxListProps("bakery").steps[0], ...over });
  const list = (steps: Step[]) => {
    const base = sandboxListProps("bakery");
    render(
      <MemoryRouter>
        <BuildList {...base} steps={steps} dividers={new Map()} costGroups={[]} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} promptIn={null} onAddPrompt={vi.fn(() => Promise.resolve(true))} />
      </MemoryRouter>,
    );
  };

  it("hides an automatic title that repeats its text, keeping the row, and always shows a typed one", () => {
    list([
      step({ id: "a", number: "1", title: null, defaultTitle: "ccc", text: "ccc" }),
      step({ id: "b", number: "2", title: "ccc", defaultTitle: "ccc", text: "ccc" }),
      step({ id: "c", number: "3", title: null, defaultTitle: "Fix the layout", text: "A different opening" }),
    ]);
    const first = screen.getByRole("group", { name: /^Prompt 1:/ });
    expect(within(first).queryByRole("heading", { level: 3 })).toBeNull();
    expect(within(first).getByTestId("title-hidden")).toBeTruthy();
    expect(within(first).getByText("ccc")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: /^Prompt 2:/ })).getByRole("heading", { level: 3 }).textContent).toBe("ccc");
    expect(within(screen.getByRole("group", { name: /^Prompt 3:/ })).getByRole("heading", { level: 3 }).textContent).toBe("Fix the layout");
  });
});

describe("the hint", () => {
  it("says tile, on a computer and on a phone, and never click on a phone", () => {
    expect(LIST_COPY.hint).toBe("Click a tile to see its details · double-click to read all of it");
    expect(LIST_COPY.hintPhone).toBe("Tap a tile to see its details");
    expect(LIST_HINT).toBe(LIST_COPY.hint);
    expect(LIST_HINT_PHONE).toBe(LIST_COPY.hintPhone);
    expect(listHint(true)).toBe("Tap a tile to see its details");
  });
});
