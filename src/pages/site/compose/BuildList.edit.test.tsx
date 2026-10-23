// CA-18 P2: a double click opens a tile's own window, for every kind, on a computer. A phone has no double click.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { Step } from "@/lib/build/graph";

import { BuildList, type BuildListProps } from "./BuildList";
import { dividers } from "./buildListModel";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const make = (over: Partial<Step> & Pick<Step, "id" | "number" | "text" | "kind">): Step => ({
  title: null,
  defaultTitle: `${over.kind} ${over.number}`,
  words: 3,
  model: null,
  sessionId: null,
  tool: null,
  runs: null,
  uses: [],
  children: [],
  ...over,
});

function list(steps: Step[], over: Partial<BuildListProps> = {}) {
  const base = sandboxListProps("bakery");
  const props: BuildListProps = {
    ...base,
    phone,
    steps,
    dividers: dividers(steps, []),
    onSelect: vi.fn(),
    onOpenPrompt: vi.fn(),
    onEditTile: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    onAddPrompt: vi.fn(() => Promise.resolve(true)),
    onAddAgentPrompt: vi.fn(() => Promise.resolve(true)),
    onAddAgentTo: vi.fn(),
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

const KINDS: [Step["kind"], string][] = [
  ["agent", "Agent"],
  ["team", "Team"],
  ["manual", "Manual step"],
  ["code", "Code"],
  ["check", "Check"],
  ["decision", "Decision"],
  ["tool", "Tool"],
  ["system_prompt", "System prompt"],
  ["dataset", "Dataset"],
  ["repo", "GitHub repository"],
];

describe("a double click on a tile (CA-18)", () => {
  it.each(KINDS)("%s: opens its own window", (kind) => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: "A thing" })]);
    const card = screen.getAllByTestId("step-card")[0];
    fireEvent.doubleClick(card);
    expect(props.onEditTile).toHaveBeenCalledWith("x1");
  });

  it("a prompt opens its prompt window, as it did", () => {
    const props = list([make({ id: "p1", number: "1", kind: "prompt", text: "Write it", sessionId: "s1" })]);
    fireEvent.doubleClick(screen.getAllByTestId("step-card")[0]);
    expect(props.onOpenPrompt).toHaveBeenCalledWith("p1");
  });

  it("a result opens its window", () => {
    const props = list([make({ id: "p1", number: "1", kind: "prompt", text: "Write it", sessionId: "s1" })], { results: [{ id: "r1", title: "Done", holds: "a link", facts: { link: null, mediaIds: [], file: null, model: null }, from: "1" }] });
    fireEvent.doubleClick(screen.getByTestId("result-card"));
    expect(props.onEditTile).toHaveBeenCalledWith("r1");
  });

  it("a click selects and opens nothing", () => {
    const props = list([make({ id: "x1", number: "1", kind: "tool", text: "Gmail", title: "Gmail" })]);
    fireEvent.click(screen.getAllByTestId("step-card")[0]);
    expect(props.onSelect).toHaveBeenCalledWith("x1");
    expect(props.onEditTile).not.toHaveBeenCalled();
  });

  it("a phone has no double click", () => {
    phone = true;
    const props = list([make({ id: "x1", number: "1", kind: "code", text: "x", title: "Code" })]);
    fireEvent.doubleClick(screen.getAllByTestId("step-card")[0]);
    expect(props.onEditTile).not.toHaveBeenCalled();
  });

  it("a session's head opens its window on a double click, and by Edit session… in its menu", () => {
    const base = sandboxListProps("bakery");
    const props: BuildListProps = {
      ...base,
      onSelect: vi.fn(),
      onEditTile: vi.fn(),
      onRename: vi.fn(),
      onMove: vi.fn(),
      onRemove: vi.fn(),
      onAccept: vi.fn(),
      onDismiss: vi.fn(),
      onAddPrompt: vi.fn(() => Promise.resolve(true)),
      onAddAgentPrompt: vi.fn(() => Promise.resolve(true)),
      onAddAgentTo: vi.fn(),
      sessionOps: { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() },
    };
    render(
      <MemoryRouter>
        <BuildList {...props} />
      </MemoryRouter>,
    );
    const head = screen.getAllByTestId("session-head")[0];
    fireEvent.doubleClick(head);
    expect(props.onEditTile).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(within(head).getByRole("button", { name: /options/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit session…" }));
    expect(props.onEditTile).toHaveBeenCalledTimes(2);
  });
});
