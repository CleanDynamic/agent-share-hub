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

// UX-02 P5: a double click is no longer a command (CA-18's double click is retired); every tile shows a way to open it and to change it.
describe("a tile's own window, from its visible controls (CA-18, UX-02 P5)", () => {
  it.each(KINDS)("%s: its footer's Open link opens its own window, and so does Edit… in its menu", (kind) => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: "A thing" })]);
    const card = screen.getAllByTestId("step-card")[0];
    fireEvent.click(within(card).getByRole("button", { name: /^Open / }));
    expect(props.onEditTile).toHaveBeenCalledWith("x1");
    expect(props.onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(within(card).getByRole("button", { name: /options$/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit…" }));
    expect(props.onEditTile).toHaveBeenCalledTimes(2);
  });

  it("a prompt opens its prompt window from a double click (F17: no Open prompt link)", () => {
    const props = list([make({ id: "p1", number: "1", kind: "prompt", text: "Write it", sessionId: "s1" })]);
    expect(within(screen.getAllByTestId("step-card")[0]).queryByRole("button", { name: "Open prompt" })).toBeNull();
    fireEvent.doubleClick(screen.getAllByTestId("step-card")[0]);
    expect(props.onOpenPrompt).toHaveBeenCalledWith("p1");
  });

  it("a result opens its window from Open result", () => {
    const props = list([make({ id: "p1", number: "1", kind: "prompt", text: "Write it", sessionId: "s1" })], { results: [{ id: "r1", title: "Done", holds: "a link", facts: { link: null, mediaIds: [], file: null, model: null }, from: "1" }] });
    fireEvent.click(within(screen.getByTestId("result-card")).getByRole("button", { name: "Open result" }));
    expect(props.onEditTile).toHaveBeenCalledWith("r1");
  });

  it("a click selects and opens nothing; a double click does nothing more", () => {
    const props = list([make({ id: "x1", number: "1", kind: "tool", text: "Gmail", title: "Gmail" })]);
    fireEvent.click(screen.getAllByTestId("step-card")[0]);
    fireEvent.doubleClick(screen.getAllByTestId("step-card")[0]);
    expect(props.onSelect).toHaveBeenCalledWith("x1");
    expect(props.onEditTile).not.toHaveBeenCalled();
  });

  it("a phone opens a tile from the same visible link", () => {
    phone = true;
    const props = list([make({ id: "x1", number: "1", kind: "code", text: "x", title: "Code" })]);
    fireEvent.click(within(screen.getAllByTestId("step-card")[0]).getByRole("button", { name: "Open code" }));
    expect(props.onEditTile).toHaveBeenCalledWith("x1");
  });

  it("a session's head opens its window by Edit session… in its menu, and not on a double click", () => {
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
    expect(props.onEditTile).not.toHaveBeenCalled();
    fireEvent.keyDown(within(head).getByRole("button", { name: /options/ }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit session…" }));
    expect(props.onEditTile).toHaveBeenCalledTimes(1);
  });
});
