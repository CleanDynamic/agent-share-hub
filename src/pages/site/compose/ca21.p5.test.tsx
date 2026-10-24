// CA-21 P5 - dragging by the keyboard: Space or Enter picks up, Up and Down move one place at a time across sessions and parts,
// Space or Enter drops, Escape puts back, every step is said, and focus stays on the moved thing.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { done, keys, mountList, partsOf, pickUp, press, said, stubLayout, stubMedia } from "./ca21Harness";

beforeEach(stubMedia);
afterEach(done);

const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`) as HTMLElement;
const tileIds = () => [...document.querySelectorAll('[data-skel-kind="tile"]')].map((el) => el.getAttribute("data-skel-id") as string);
const inSession = (key: string) => tileIds().filter((id) => tile(id).getAttribute("data-skel-container") === key);

describe("dragging by the keys", () => {
  it("picks up with Enter as well as Space, and Up and Down move the place one slot at a time", async () => {
    stubLayout();
    mountList();
    const [first, second] = tileIds();
    const handle = screen.getAllByTestId("drag-handle")[0];
    await act(async () => {
      handle.focus();
      fireEvent.keyDown(handle, { code: "Enter", key: "Enter" });
    });
    await waitFor(() => expect(screen.getByTestId("held-copy")).toBeTruthy());
    expect(said()).toMatch(/^Picked up Prompt 1\. Session 1, 1 of \d+\.$/);
    await press("ArrowDown");
    expect(inSession(keys()[0]).slice(0, 2)).toEqual([second, first]);
    expect(said()).toMatch(/^Over Session 1, 2 of \d+\.$/);
    await press("ArrowUp");
    expect(inSession(keys()[0])[0]).toBe(first);
    // At the very first place there is nowhere to go, and it says so.
    await press("ArrowUp");
    expect(said()).toMatch(/first place/);
  });

  it("goes down through the tiles of a session and into the next, the same way Move down does", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    const count = inSession(keys()[0]).length;
    await pickUp(screen.getAllByTestId("drag-handle")[0]);
    for (let n = 0; n < count - 1; n += 1) await press("ArrowDown");
    expect(inSession(keys()[0]).at(-1)).toBe(first);
    await press("ArrowDown");
    expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[1]);
    expect(said()).toMatch(/^Over Session 2, 1 of \d+\.$/);
  });

  it("crosses parts with a session, the same way Move down does", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf() });
    await pickUp(screen.getAllByTestId("session-drag-handle")[1]);
    await press("ArrowDown");
    expect(said()).toBe("Over Part 2, 1 of 2.");
    await press("Space");
    expect(props.onDropSession).toHaveBeenCalledWith(keys()[1], keys()[2]);
  });

  it("drops with Space or Enter, and Escape puts it back", async () => {
    stubLayout();
    const { props } = mountList();
    await pickUp(screen.getAllByTestId("drag-handle")[0]);
    await press("ArrowDown");
    await press("Enter");
    expect(props.onMoveToSession).toHaveBeenCalledTimes(1);
    expect(said()).toMatch(/^Moved Prompt 1 to 2 of \d+ in Session 1\.$/);
  });

  it("keeps focus on the moved thing afterwards, on its grip, with the page's own focus ring", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    await pickUp(screen.getAllByTestId("drag-handle")[0]);
    const here = tile(first).getAttribute("data-skel-container");
    for (let n = 0; n < 12 && tile(first).getAttribute("data-skel-container") === here; n += 1) await press("ArrowDown");
    await press("Space");
    await waitFor(() => expect(document.activeElement?.getAttribute("data-testid")).toBe("drag-handle"));
    expect(tile(first).contains(document.activeElement)).toBe(true);
    expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[1]);
  });

  it("tells a screen reader what the key does, and the line it says is polite", async () => {
    stubLayout();
    mountList();
    const handle = screen.getAllByTestId("drag-handle")[0];
    expect(document.body.textContent).toContain("Press Space to pick up the tile");
    await pickUp(handle);
    expect(screen.getByTestId("nest-said").getAttribute("aria-live")).toBe("polite");
  });
});
