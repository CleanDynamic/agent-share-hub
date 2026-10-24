// CA-21 P3 - dragging tiles: the held copy, the live order, the lines, the drop, Esc, and the two half-second holds.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { moveModelOf } from "@/lib/build/moveRules";

import { done, keys, mountList, pickUp, press, said, stubLayout, stubMedia } from "./ca21Harness";
import { placeAt, heldOf } from "./useBuildSorting";

beforeEach(stubMedia);
afterEach(() => {
  vi.useRealTimers();
  done();
});

const tileIds = () => [...document.querySelectorAll('[data-skel-kind="tile"]')].map((el) => el.getAttribute("data-skel-id") as string);
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`) as HTMLElement;
const grip = (id: string) => within(tile(id)).getAllByTestId("drag-handle")[0];

describe("picking a tile up", () => {
  it("draws the held copy as the tile itself at its own size, with a shadow and nothing else", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    await pickUp(grip(first));
    const copy = screen.getByTestId("held-copy");
    expect(copy.getAttribute("data-held")).toBe("tile");
    expect(copy.style.width).toBe("400px");
    expect(copy.style.cursor).toBe("grabbing");
    // The tile's own words are in it, and nothing that must stay unique on the page.
    expect(copy.textContent).toContain(tile(first).textContent?.slice(0, 20));
    expect(copy.querySelector("[data-testid]")).toBeNull();
    // No scale, no turn, no fade.
    expect(copy.getAttribute("style")).not.toMatch(/scale|rotate|opacity/);
    expect(copy.style.boxShadow).toContain("var(--seg-on-border)");
  });

  it("folds nothing, and the 2px lines are gone", async () => {
    stubLayout();
    mountList();
    const cards = screen.getAllByTestId("step-card").length;
    const [first] = tileIds();
    await pickUp(grip(first));
    expect(screen.getAllByTestId("step-card")).toHaveLength(cards);
    expect(screen.queryAllByTestId("session-head").some((head) => head.getAttribute("data-collapsed") === "true")).toBe(false);
    expect(screen.queryByTestId("nest-line")).toBeNull();
    expect(screen.queryByTestId("session-drop-line")).toBeNull();
    // Its own element stays in the layout, hidden: that is its place.
    expect(tile(first).style.visibility).toBe("hidden");
  });

  it("says what was picked up and where it stands", async () => {
    stubLayout();
    mountList();
    const [first] = tileIds();
    await pickUp(grip(first));
    expect(said()).toMatch(/^Picked up Prompt 1\. Session 1, 1 of \d+\.$/);
    expect(screen.getByTestId("nest-said").getAttribute("aria-live")).toBeNull();
  });
});

describe("holding a tile over another session", () => {
  async function toSecondSession() {
    const [first] = tileIds();
    await pickUp(grip(first));
    const here = tile(first).getAttribute("data-skel-container");
    for (let n = 0; n < 12 && tile(first).getAttribute("data-skel-container") === here; n += 1) await press("ArrowDown");
    return first;
  }

  it("moves its place into that session, and says so", async () => {
    stubLayout();
    mountList();
    const first = await toSecondSession();
    expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[1]);
    expect(said()).toMatch(/^Over Session 2, 1 of \d+\.$/);
    expect(screen.getByTestId("skeleton-target").textContent).toMatch(/Lands here\s*Session 2 · 1 of/);
  });

  it("drops: hands the new order to the page as one step, says what moved, and slides nothing back", async () => {
    stubLayout();
    const { props } = mountList();
    const first = await toSecondSession();
    await press("Space");
    expect(props.onMoveToSession).toHaveBeenCalledTimes(1);
    const [id, session, options] = (props.onMoveToSession as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe(first);
    expect(session).toBe(keys()[1]);
    expect(options).toMatchObject({ sentence: "Moved Prompt 1 to Session 2", notice: true });
    expect(options.order[0]).toBe(first);
    expect(said()).toBe("Moved Prompt 1 to Session 2.");
    // The new order shows at once, before the write is back.
    expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[1]);
  });

  it("slides everything back and says so when the write does not land", async () => {
    stubLayout();
    const { props } = mountList({ onMoveToSession: vi.fn(() => Promise.resolve(false)) });
    const first = await toSecondSession();
    await press("Space");
    await waitFor(() => expect(said()).toBe("Couldn't move that. Try again."));
    expect(props.onMoveToSession).toHaveBeenCalled();
    await waitFor(() => expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[0]));
  });

  it("puts everything back on Esc, writes nothing, and says where it went back to", async () => {
    stubLayout();
    const { props } = mountList();
    const first = await toSecondSession();
    await press("Escape");
    await waitFor(() => expect(said()).toBe("Put back in Session 1."));
    expect(props.onMoveToSession).not.toHaveBeenCalled();
    await waitFor(() => expect(tile(first).getAttribute("data-skel-container")).toBe(keys()[0]));
  });
});

describe("where the pointer puts it", () => {
  function place(x: number, y: number, collapsed: string[] = []) {
    const props = mountList({ collapsed: new Set(collapsed) }).props;
    const model = moveModelOf({ steps: props.steps, heads: props.dividers, empties: props.emptySessions });
    const root = screen.getByTestId("build-list");
    const [first] = tileIds();
    return { model, root, first, held: heldOf(first, model)!, canTake: () => true, collapsed: new Set(collapsed) };
  }

  it("takes the session under the pointer and the index by the others' middles", () => {
    stubLayout();
    const ctx = place(0, 0);
    const second = document.querySelectorAll('[data-skel-kind="session"]')[1] as HTMLElement;
    const inside = [...second.querySelectorAll('[data-skel-kind="tile"]')];
    // Just below the middle of the first tile of Session 2: after one tile.
    const first = inside[0].getBoundingClientRect();
    const out = placeAt(ctx.root, ctx.held, ctx.model, { x: 10, y: first.y + first.height / 2 + 5 }, { canTake: ctx.canTake });
    expect(out.model.tiles[keys()[1]][1]).toBe(ctx.first);
    // Above it: first.
    const above = placeAt(ctx.root, ctx.held, ctx.model, { x: 10, y: first.y }, { canTake: ctx.canTake });
    expect(above.model.tiles[keys()[1]][0]).toBe(ctx.first);
  });

  it("offers a tile that can take it only in its middle third", () => {
    stubLayout();
    const ctx = place(0, 0);
    const other = tileIds()[1];
    const box = tile(other).getBoundingClientRect();
    expect(placeAt(ctx.root, ctx.held, ctx.model, { x: 150, y: box.y + box.height / 2 }, { canTake: ctx.canTake }).sendCandidate).toBe(other);
    expect(placeAt(ctx.root, ctx.held, ctx.model, { x: 150, y: box.y + 5 }, { canTake: ctx.canTake }).sendCandidate).toBeNull();
    expect(placeAt(ctx.root, ctx.held, ctx.model, { x: 150, y: box.y + box.height / 2 }, { canTake: () => false }).sendCandidate).toBeNull();
  });

  it("puts a tile at the end of a folded session", () => {
    stubLayout();
    const ctx = place(0, 0, [keys()[1]]);
    const second = document.querySelectorAll('[data-skel-kind="session"]')[1] as HTMLElement;
    const box = second.getBoundingClientRect();
    const out = placeAt(ctx.root, ctx.held, ctx.model, { x: 10, y: box.y + 5 }, { canTake: ctx.canTake, collapsed: ctx.collapsed });
    expect(out.model.tiles[keys()[1]].at(-1)).toBe(ctx.first);
    expect(out.folded).toBe(keys()[1]);
  });
});

describe("the two half-second holds, by the pointer", () => {
  const move = (x: number, y: number) =>
    act(() => {
      fireEvent(window, new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
    });

  it("opens a folded session held over its head for 500 ms, not before", async () => {
    stubLayout();
    const { props } = mountList({ collapsed: new Set([keys()[1]]) });
    const [first] = tileIds();
    await pickUp(grip(first));
    vi.useFakeTimers();
    const second = document.querySelectorAll('[data-skel-kind="session"]')[1] as HTMLElement;
    const box = second.getBoundingClientRect();
    move(120, box.y + 5);
    act(() => void vi.advanceTimersByTime(450));
    expect(props.onToggleCollapsed).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(100));
    expect(props.onToggleCollapsed).toHaveBeenCalledWith(keys()[1], false);
  });

  it("turns a tile into the target after 500 ms in its middle third, the place leaves, and the drop sends it with", async () => {
    stubLayout();
    const { props } = mountList();
    const ids = tileIds();
    await pickUp(grip(ids[0]));
    vi.useFakeTimers();
    const target = tile(ids[2]);
    const box = target.getBoundingClientRect();
    move(150, box.y + box.height / 2);
    act(() => void vi.advanceTimersByTime(499));
    expect(said()).not.toMatch(/^Send with/);
    act(() => void vi.advanceTimersByTime(10));
    expect(said()).toMatch(/^Send with Prompt/);
    // The place leaves while it is the target: the held tile is out of every session.
    expect(target.getAttribute("data-skel-id")).toBe(ids[2]);
    vi.useRealTimers();
    await press("Space");
    expect(props.onNest).toHaveBeenCalledWith(ids[0], ids[2], Number.MAX_SAFE_INTEGER);
  });

  it("does not, held over its edge", async () => {
    stubLayout();
    mountList();
    const ids = tileIds();
    await pickUp(grip(ids[0]));
    vi.useFakeTimers();
    const box = tile(ids[2]).getBoundingClientRect();
    move(150, box.y + 4);
    act(() => void vi.advanceTimersByTime(1000));
    expect(said()).not.toMatch(/^Send with/);
  });
});
