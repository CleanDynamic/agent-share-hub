// UX-08 P1: a step tile's ··· menu gains Mark still open (the window titled Still open: <step tile label>, one field What's missing);
// a marked tile says Still open under its title and the menu offers Edit what's missing and Not still open.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import type { Step } from "@/lib/build/graph";

import { BuildList, type BuildListProps } from "./BuildList";
import { dividers } from "./buildListModel";
import { OPEN_REQUEST_COPY } from "./openRequestCopy";

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
    onStillOpen: vi.fn(),
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

const openMenu = (card: HTMLElement) => {
  const trigger = within(card).getByRole("button", { name: /options$/ });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.keyDown(trigger, { key: "Enter" });
};

describe.each([
  ["prompt", "Prompt 1"],
  ["manual", "Weigh the flour"],
  ["code", "Dough script"],
] as const)("UX-08 P1 · a %s step tile", (kind, label) => {
  it("Mark still open asks What's missing in a window titled Still open: <label>, and passes the words with the tile's id", async () => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: kind === "prompt" ? null : label, defaultTitle: label, sessionId: "s1" })]);
    openMenu(screen.getAllByTestId("step-card")[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mark still open" }));
    const dialog = await screen.findByTestId("open-request-dialog");
    expect(within(dialog).getByRole("heading", { name: OPEN_REQUEST_COPY.titleTile(label) })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Say what's missing.");
    expect(props.onStillOpen).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "What's missing" }), { target: { value: "  The retry logic  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(props.onStillOpen).toHaveBeenCalledWith("x1", "The retry logic");
    await waitFor(() => expect(screen.queryByTestId("open-request-dialog")).toBeNull());
  });

  it("a marked tile says Still open under its title, and the menu offers Edit what's missing and Not still open", async () => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: "Named", sessionId: "s1", stillOpen: "The retry logic" })]);
    const card = screen.getAllByTestId("step-card")[0];
    expect(within(card).getByTestId("tile-still-open").textContent).toBe("Still open");
    openMenu(card);
    expect(screen.queryByRole("menuitem", { name: "Mark still open" })).toBeNull();
    expect(await screen.findByRole("menuitem", { name: "Edit what's missing" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Not still open" }));
    expect(props.onStillOpen).toHaveBeenCalledWith("x1", null);
  });

  it("Edit what's missing opens the window with the words already written", async () => {
    const props = list([make({ id: "x1", number: "1", kind, text: "A thing", title: "Named", sessionId: "s1", stillOpen: "The retry logic" })]);
    openMenu(screen.getAllByTestId("step-card")[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit what's missing" }));
    const dialog = await screen.findByTestId("open-request-dialog");
    expect((within(dialog).getByRole("textbox", { name: "What's missing" }) as HTMLTextAreaElement).value).toBe("The retry logic");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "What's missing" }), { target: { value: "The retry logic and the timeout" } });
    fireEvent.click(within(dialog).getByRole("button", { name: OPEN_REQUEST_COPY.submit }));
    expect(props.onStillOpen).toHaveBeenCalledWith("x1", "The retry logic and the timeout");
  });
});

describe("UX-08 P1 · a tile that is not marked", () => {
  it("shows no Still open line, and without a handler the menu offers neither item", async () => {
    list([make({ id: "x1", number: "1", kind: "prompt", text: "A thing", sessionId: "s1" })], { onStillOpen: undefined });
    const card = screen.getAllByTestId("step-card")[0];
    expect(within(card).queryByTestId("tile-still-open")).toBeNull();
    openMenu(card);
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(screen.queryByRole("menuitem", { name: "Mark still open" })).toBeNull();
  });
});
