// Prompt 23: "Link to a step" stands by the words selected in the post while they are selected, and opens the link panel.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";

import { LinkSelection } from "./LinkSelection";

function fakeEditor() {
  const handlers = new Map<string, Set<() => void>>();
  const editor = {
    isDestroyed: false,
    isFocused: true,
    state: { selection: { from: 2, to: 7, empty: false } },
    view: { coordsAtPos: () => ({ top: 100, bottom: 120, left: 40, right: 60 }) },
    on: (name: string, run: () => void) => handlers.set(name, (handlers.get(name) ?? new Set()).add(run)),
    off: (name: string, run: () => void) => handlers.get(name)?.delete(run),
    emit: (name: string) => handlers.get(name)?.forEach((run) => run()),
  };
  return editor;
}

describe("Link to a step", () => {
  it("shows under a selection, keeps it on press, and opens the link panel", () => {
    const editor = fakeEditor();
    const onLink = vi.fn();
    render(<LinkSelection editor={editor as unknown as Editor} onLink={onLink} />);
    expect(screen.queryByTestId("link-selection")).toBeNull();
    act(() => editor.emit("selectionUpdate"));
    const item = screen.getByRole("button", { name: "Link to a step" });
    expect(item.style.top).toBe("148px");
    const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    item.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    fireEvent.click(item);
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("link-selection")).toBeNull();
  });

  it("goes when the selection is empty or the editor lets go", () => {
    const editor = fakeEditor();
    render(<LinkSelection editor={editor as unknown as Editor} onLink={() => undefined} />);
    act(() => editor.emit("selectionUpdate"));
    expect(screen.getByTestId("link-selection")).toBeTruthy();
    act(() => editor.emit("blur"));
    expect(screen.queryByTestId("link-selection")).toBeNull();
    editor.state.selection = { from: 3, to: 3, empty: true };
    act(() => editor.emit("selectionUpdate"));
    expect(screen.queryByTestId("link-selection")).toBeNull();
  });
});
