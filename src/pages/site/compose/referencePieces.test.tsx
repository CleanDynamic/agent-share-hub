// CA-19: the pieces only colour and references use: rows ordered by dragging their grip.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SortableRows } from "./referencePieces";

afterEach(cleanup);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom lays nothing out: each row is 40 tall, one under the other, so the drag has somewhere to land.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const row = this.closest("[data-sortable]");
    const at = row ? [...(row.parentElement?.children ?? [])].indexOf(row) : 0;
    return { x: 0, y: at * 40, top: at * 40, left: 0, right: 400, bottom: at * 40 + 40, width: 400, height: 40, toJSON: () => ({}) } as DOMRect;
  });
});

describe("SortableRows", () => {
  it("moves a row with its grip, from the keyboard, and says the new order", async () => {
    const onOrder = vi.fn();
    render(<SortableRows label="Components" onOrder={onOrder} rows={["a", "b", "c"].map((key) => ({ key, name: key.toUpperCase(), render: (grip) => <span>{grip}{key}</span> }))} />);
    const grip = screen.getByRole("button", { name: "Move C" });
    grip.focus();
    const settle = () => new Promise((done) => setTimeout(done, 20));
    await act(async () => {
      fireEvent.keyDown(grip, { key: " ", code: "Space" });
      await settle();
    });
    await act(async () => {
      fireEvent.keyDown(grip, { key: "ArrowUp", code: "ArrowUp" });
      await settle();
    });
    await act(async () => {
      fireEvent.keyDown(grip, { key: " ", code: "Space" });
      await settle();
    });
    expect(onOrder).toHaveBeenCalledWith(["a", "c", "b"]);
  });
});
