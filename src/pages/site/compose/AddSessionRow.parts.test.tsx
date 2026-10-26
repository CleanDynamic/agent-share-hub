// CA-17 P3 — adding a session into a part: "Add to" in the picker, and the Sources panel's "Add this session to" menu.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxSourcesProps } from "@/dev/fixtures/sandbox";

import { AddSessionRow, ADD_SESSION_COPY, type AddSessionRowProps, type AddToPart } from "./AddSessionRow";
import { SourcesPanel, SOURCES_COPY, type SourcesPanelProps } from "./SourcesPanel";
import type { SourceLibraryItem } from "./sourcesModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PARTS: AddToPart[] = [
  { key: "ws-a", label: "Part A", title: "Part A · Tenant portal", colour: "#8FBFB8" },
  { key: "ws-b", label: "Part B", title: "Part B · Support agent" },
  { key: "ws-c", label: "Part C", title: "Part C" },
];

const item = (id: string): SourceLibraryItem => ({
  id,
  label: "Claude",
  line: "",
  adding: false,
  inThisDraft: false,
  alsoIn: null,
  firstPrompt: "Plan the launch email",
  date: "22 Oct",
  promptCount: 3,
  app: "Claude",
  appKnown: true,
  model: null,
  createdAt: "2026-10-22T09:00:00Z",
  draftCount: 0,
});

function row(over: Partial<AddSessionRowProps> = {}) {
  const props: AddSessionRowProps = { phone: false, library: [item("chat-1")], adding: false, onAdd: vi.fn(), onStartNew: vi.fn(), now: new Date("2026-10-22T12:00:00Z").getTime(), ...over };
  const view = render(<AddSessionRow {...props} />);
  return { props, view };
}

describe("Add to", () => {
  it("is not shown with one part, or none: the picker is as it was", () => {
    row();
    fireEvent.click(screen.getByTestId("add-session-row"));
    expect(screen.queryByTestId("add-to")).toBeNull();
    expect(screen.getByText(ADD_SESSION_COPY.startNewLine)).toBeTruthy();
    cleanup();
    row({ parts: [PARTS[0]] });
    fireEvent.click(screen.getByTestId("add-session-row"));
    expect(screen.queryByTestId("add-to")).toBeNull();
  });

  it("starts the picker on the last part, with its colour dot and title, and says where a new session goes", () => {
    row({ parts: PARTS });
    fireEvent.click(screen.getByTestId("add-session-row"));
    const field = within(screen.getByTestId("add-to")).getByTestId("add-to-button");
    expect(field.textContent).toContain("Add to");
    expect(field.textContent).toContain("Part C");
    expect(field.querySelector("[data-colour-dot]")).toBeTruthy();
    expect(screen.getByText("An empty one at the end of Part C. Pick its app later.")).toBeTruthy();
  });

  it("starts on the part whose '+ Add a session to this part' opened it, and on the last again when opened by the row", () => {
    const { view, props } = row({ parts: PARTS, openFor: { part: "ws-a", n: 1 } });
    expect(within(screen.getByTestId("add-to")).getByTestId("add-to-button").textContent).toContain("Part A · Tenant portal");
    expect(screen.getByText("An empty one at the end of Part A. Pick its app later.")).toBeTruthy();
    expect(within(screen.getByTestId("add-to")).getByTestId("add-to-button").querySelector("[data-colour-dot='#8FBFB8']")).toBeTruthy();
    // SV-07 P6: it opens under the row and takes the focus; Escape there closes it.
    fireEvent.keyDown(within(screen.getByTestId("open-below")).getByTestId("add-to-button"), { key: "Escape" });
    expect(screen.queryByTestId("open-below")).toBeNull();
    view.rerender(<AddSessionRow {...props} parts={PARTS} openFor={{ part: "ws-a", n: 1 }} />);
    fireEvent.click(screen.getByTestId("add-session-row"));
    expect(within(screen.getByTestId("add-to")).getByTestId("add-to-button").textContent).toContain("Part C");
  });

  it("changes where both choices add: a new session and a connected chat each land in the chosen part", async () => {
    const { props } = row({ parts: PARTS });
    fireEvent.click(screen.getByTestId("add-session-row"));
    const button = screen.getByTestId("add-to-button");
    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Part B · Support agent/ }));
    expect(screen.getByText("An empty one at the end of Part B. Pick its app later.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start a new session/ }));
    expect(props.onStartNew).toHaveBeenCalledWith("ws-b");
    cleanup();

    const second = row({ parts: PARTS }).props;
    fireEvent.click(screen.getByTestId("add-session-row"));
    fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
    fireEvent.click(within(screen.getByTestId("add-session-picker")).getByRole("listitem"));
    expect(second.onAdd).toHaveBeenCalledWith("chat-1", "ws-c");
  });

  it("is a sheet on a phone, with the same field", () => {
    row({ parts: PARTS, phone: true });
    fireEvent.click(screen.getByTestId("add-session-row"));
    expect(screen.getByTestId("add-to")).toBeTruthy();
  });
});

describe("the Sources panel", () => {
  function panel(over: Partial<SourcesPanelProps> = {}) {
    const props: SourcesPanelProps = { ...sandboxSourcesProps("bakery"), library: [item("chat-1")], sessions: [], files: [], onSelect: vi.fn(), onAddSession: vi.fn(), onDropFiles: vi.fn(), onPick: vi.fn(), ...over };
    render(
      <MemoryRouter>
        <SourcesPanel {...props} />
      </MemoryRouter>,
    );
    return props;
  }

  it("adds at once with one part, as it did", () => {
    const props = panel({ parts: [PARTS[0]] });
    fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    expect(props.onAddSession).toHaveBeenCalledWith("chat-1");
    expect(screen.queryByText(SOURCES_COPY.addThisTo)).toBeNull();
  });

  it("opens a small menu with two or more: Add this session to, one row for each part by colour dot and title", async () => {
    const props = panel({ parts: PARTS });
    const button = screen.getByRole("button", { name: "Add session" });
    fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
    fireEvent.keyDown(button, { key: "Enter" });
    expect(await screen.findByText("Add this session to")).toBeTruthy();
    const rows = screen.getAllByRole("menuitem");
    expect(rows.map((entry) => entry.textContent)).toEqual(["Part A · Tenant portal", "Part B · Support agent", "Part C"]);
    expect(rows[0].querySelector("[data-colour-dot='#8FBFB8']")).toBeTruthy();
    fireEvent.click(rows[1]);
    expect(props.onAddSession).toHaveBeenCalledWith("chat-1", "ws-b");
  });
});
