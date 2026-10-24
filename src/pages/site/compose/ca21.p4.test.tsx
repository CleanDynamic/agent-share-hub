// CA-21 P4 - dragging sessions and parts: lifted whole, nothing folds, an empty part is a place to drop, the counts follow.

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { done, keys, mountList, partsOf, pickUp, press, said, stubLayout, stubMedia } from "./ca21Harness";

beforeEach(stubMedia);
afterEach(done);

const sessionGrip = (n: number) => screen.getAllByTestId("session-drag-handle")[n - 1];
const partCount = (n: number) => within(screen.getAllByTestId("workstream-head")[n - 1]).getByText(/sessions?$/).textContent;

describe("a session", () => {
  it("lifts whole, with its head and every tile, at its own size, on a block of its own", async () => {
    stubLayout();
    mountList({ parts: partsOf() });
    const run = document.querySelector(`[data-skel-kind="session"][data-skel-id="${keys()[0]}"]`) as HTMLElement;
    const tiles = within(run).getAllByTestId("step-card").length;
    await pickUp(sessionGrip(1));
    const copy = screen.getByTestId("held-copy");
    expect(copy.getAttribute("data-held")).toBe("session");
    expect(copy.style.width).toBe("400px");
    expect(copy.textContent).toContain("Session 1");
    expect(copy.querySelectorAll('[role="group"]').length).toBeGreaterThanOrEqual(tiles);
    // The block it sits on, and the outline 6 outside it.
    expect(copy.getAttribute("data-ground")).toBe("surface");
    expect(copy.style.borderRadius).toBe("12px");
    expect((copy.firstElementChild as HTMLElement).style.inset).toBe("-6px");
    expect((copy.firstElementChild as HTMLElement).style.borderRadius).toBe("14px");
  });

  it("folds nothing, says what was picked up, and numbers the sessions in their part", async () => {
    stubLayout();
    mountList({ parts: partsOf() });
    const cards = screen.getAllByTestId("step-card").length;
    await pickUp(sessionGrip(1));
    expect(screen.getAllByTestId("step-card")).toHaveLength(cards);
    expect(said()).toMatch(/^Picked up Session 1 and its \d+ tiles?\. Part 1, 1 of 2\.$/);
    const numbers = screen.getAllByTestId("skeleton-rail").map((rail) => within(rail).getAllByTestId("skeleton-number").map((n) => n.textContent));
    expect(numbers).toEqual([["1", "2"], ["1"]]);
  });

  it("shows 'Drop a session here' in an empty part, and over it grows to the session's place with the part's count following", async () => {
    stubLayout();
    mountList({ parts: partsOf(true) });
    expect(partCount(2)).toBe("0 sessions");
    expect(screen.queryByTestId("skeleton-empty")).toBeNull();
    await pickUp(sessionGrip(3));
    expect(screen.getByTestId("skeleton-empty").textContent).toBe("Drop a session here");
    await press("ArrowDown");
    expect(said()).toBe("Over Part 2, 1 of 1.");
    expect(partCount(2)).toBe("1 session");
    expect(partCount(1)).toBe("2 sessions");
    expect(screen.queryByTestId("skeleton-empty")).toBeNull();
    expect(screen.getByTestId("skeleton-target").textContent).toMatch(/Lands here\s*Part 2 · 1 of 1/);
  });

  it("drops into another part: written once, and said", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf(true) });
    await pickUp(sessionGrip(3));
    await press("ArrowDown");
    await press("Space");
    expect(props.onDropOnWorkstream).toHaveBeenCalledTimes(1);
    expect(props.onDropOnWorkstream).toHaveBeenCalledWith(keys()[2], "ws-b");
    expect(props.onDropSession).not.toHaveBeenCalled();
    expect(said()).toBe("Moved Session 3 to Part 2.");
  });

  it("drops within its part on the session whose place it takes", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf() });
    await pickUp(sessionGrip(1));
    await press("ArrowDown");
    await press("Space");
    expect(props.onDropSession).toHaveBeenCalledWith(keys()[0], keys()[1]);
    expect(said()).toBe("Moved Session 1 to 2 of 2.");
  });

  it("goes back on Esc, with nothing written", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf() });
    await pickUp(sessionGrip(1));
    await press("ArrowDown");
    await press("Escape");
    await waitFor(() => expect(said()).toBe("Put back in Part 1."));
    expect(props.onDropSession).not.toHaveBeenCalled();
    expect(props.onDropOnWorkstream).not.toHaveBeenCalled();
  });

  it("puts everything back when the write does not land", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf(true), onDropOnWorkstream: vi.fn(() => Promise.resolve()) });
    await pickUp(sessionGrip(3));
    await press("ArrowDown");
    await press("Space");
    expect(props.onDropOnWorkstream).toHaveBeenCalled();
    expect(partCount(2)).toBe("1 session");
  });
});

describe("a part", () => {
  it("lifts whole on a block, moves among the parts, and is written once", async () => {
    stubLayout();
    const { props } = mountList({ parts: partsOf() });
    await pickUp(screen.getAllByTestId("workstream-drag-handle")[0]);
    const copy = screen.getByTestId("held-copy");
    expect(copy.getAttribute("data-held")).toBe("part");
    expect(copy.getAttribute("data-ground")).toBe("surface");
    expect(said()).toMatch(/^Picked up Part 1 and its 2 sessions\. The build, 1 of 2\.$/);
    // The numbers count the parts in the build.
    expect(screen.getAllByTestId("skeleton-number").map((n) => n.textContent)).toEqual(["1", "2"]);
    await press("ArrowDown");
    expect(said()).toBe("Over the build, 2 of 2.");
    expect(screen.getByTestId("skeleton-target").textContent).toMatch(/Lands here\s*Build · 2 of 2/);
    await press("Space");
    expect(props.onDropWorkstream).toHaveBeenCalledWith("ws-a", "ws-b");
    expect(said()).toBe("Moved Part 1 to 2 of 2.");
  });
});
