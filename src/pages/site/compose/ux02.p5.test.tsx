// UX-02 P5: double-click is not a command. Every step type shows a way to open it and a way to change it, by role and name, and
// nothing in the List or a session's head answers a double click: read from the props React rendered on each element.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { Step } from "@/lib/build/graph";

import { BuildList, type BuildListProps } from "./BuildList";
import { dividers } from "./buildListModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const make = (over: Partial<Step> & Pick<Step, "id" | "number" | "text" | "kind">): Step => ({ title: null, defaultTitle: `${over.kind} ${over.number}`, words: 3, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...over });

function list(steps: Step[], over: Partial<BuildListProps> = {}) {
  const props: BuildListProps = {
    ...sandboxListProps("bakery"),
    steps,
    dividers: dividers(steps, []),
    onSelect: vi.fn(),
    onOpenPrompt: vi.fn(),
    onEditTile: vi.fn(),
    results: [],
    intoResult: new Set(),
    ...over,
  };
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

/** Every step type, with the name its footer's open link carries. */
const TYPES: [Step["kind"], string][] = [
  ["prompt", "Open prompt"],
  ["agent", "Open agent"],
  ["team", "Open team"],
  ["manual", "Open manual step"],
  ["code", "Open code"],
  ["check", "Open check"],
  ["decision", "Open decision"],
  ["tool", "Open tool"],
  ["retrieval", "Open retrieval"],
  ["system_prompt", "Open system prompt"],
  ["dataset", "Open dataset"],
  ["repo", "Open GitHub repository"],
  ["file", "Open file"],
];

/** The props React rendered on an element. */
const reactProps = (element: Element): Record<string, unknown> => {
  const key = Object.keys(element).find((name) => name.startsWith("__reactProps$"));
  return key ? ((element as unknown as Record<string, Record<string, unknown>>)[key] ?? {}) : {};
};

describe("UX-02 P5 · every step type has a visible open control and a visible edit control", () => {
  it.each(TYPES)("%s", (kind, open) => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: "A thing", sessionId: "s1" })]);
    const card = screen.getAllByTestId("step-card")[0];
    // Open: a visible link in its footer; F17 (D8): a prompt opens from a double click, or Edit in the right panel.
    if (kind === "prompt") fireEvent.doubleClick(card);
    else fireEvent.click(within(card).getByRole("button", { name: open }));
    expect(kind === "prompt" ? props.onOpenPrompt : props.onEditTile).toHaveBeenCalledWith("x1");
    // Edit: its ··· menu's Edit.
    fireEvent.keyDown(within(card).getByRole("button", { name: /options$/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit…" }));
    expect(props.onEditTile).toHaveBeenCalledWith("x1");
  });

  it("a result: its link opens its window, where it is read and changed (it has no menu)", () => {
    const props = list([], { results: [{ id: "r1", title: "Done", holds: "a link", facts: { link: null, mediaIds: [], file: null, model: null }, from: null }] });
    fireEvent.click(within(screen.getByTestId("result-card")).getByRole("button", { name: "Open result" }));
    expect(props.onEditTile).toHaveBeenCalledWith("r1");
  });

  it("a session: Edit session… in its menu", () => {
    const props = list(sandboxListProps("bakery").steps as Step[], { dividers: sandboxListProps("bakery").dividers, sessionOps: { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMergeUp: vi.fn() } });
    const head = screen.getAllByTestId("session-head")[0];
    fireEvent.keyDown(within(head).getByRole("button", { name: /options/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit session…" }));
    expect(props.onEditTile).toHaveBeenCalledTimes(1);
  });
});

describe("UX-02 P5 · nothing answers a double click but a prompt tile (F17, D8)", () => {
  it("no element in the List or a session's head has an onDoubleClick, but the prompt tiles", () => {
    const base = sandboxListProps("bakery");
    const kinds = TYPES.map(([kind], at) => make({ id: `t${at}`, number: String(at + 1), kind, text: "A thing", title: "A thing", sessionId: "s1" }));
    list([...(base.steps as Step[]), ...kinds], { dividers: base.dividers, sessionOps: { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMergeUp: vi.fn() }, results: [{ id: "r1", title: "Done", holds: "a link", facts: { link: null, mediaIds: [], file: null, model: null }, from: null }] });
    const all = [...screen.getByTestId("build-list").querySelectorAll("*")];
    expect(screen.getAllByTestId("session-head").length).toBeGreaterThan(0);
    expect(all.filter((element) => typeof reactProps(element).onDoubleClick === "function" && element.getAttribute("data-kind") !== "prompt").map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
  });

  it("the computer's hint line is gone; the phone's says step", () => {
    list([make({ id: "x1", number: "1", kind: "tool", text: "Gmail", title: "Gmail" })]);
    expect(screen.queryByText(/double-click/)).toBeNull();
    cleanup();
    list([make({ id: "x1", number: "1", kind: "tool", text: "Gmail", title: "Gmail" })], { phone: true });
    expect(screen.getByText("Tap a step to see its details")).toBeTruthy();
  });
});
