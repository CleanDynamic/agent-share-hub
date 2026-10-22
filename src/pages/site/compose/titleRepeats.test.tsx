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

  it("calls a prompt by its place, with a typed title next to it (CA-14 P8 is replaced: nothing is hidden)", () => {
    list([
      step({ id: "a", number: "1", title: null, defaultTitle: "Prompt 1", text: "ccc" }),
      step({ id: "b", number: "2", title: "ccc", defaultTitle: "Prompt 2", text: "ccc" }),
      step({ id: "c", number: "3", title: null, defaultTitle: "Prompt 3", text: "A different opening" }),
    ]);
    const first = screen.getByRole("group", { name: /^Prompt 1:/ });
    expect(within(first).queryByTestId("title-hidden")).toBeNull();
    expect(within(first).getByTestId("prompt-place").textContent).toMatch(/^Prompt 1/);
    expect(within(first).queryByTestId("prompt-own-title")).toBeNull();
    const second = screen.getByRole("group", { name: /^Prompt 2:/ });
    expect(within(second).getByTestId("prompt-place").textContent).toMatch(/^Prompt 2/);
    expect(within(second).getByTestId("prompt-own-title").textContent).toBe("ccc");
    expect(within(screen.getByRole("group", { name: /^Prompt 3:/ })).queryByTestId("prompt-own-title")).toBeNull();
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
