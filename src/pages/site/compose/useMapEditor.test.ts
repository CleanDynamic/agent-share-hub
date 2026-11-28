// MS-06 Part 7 — the editor's state: apply, refusal, undo and redo, the 100-step cap, and saving.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";
import { boxes, splitBox, type MapLayout } from "@/lib/build/mapLayout";
import { startFromBuild } from "@/lib/build/mapStart";

import { MAP_EDITOR_COPY, MAP_SAVE_DEBOUNCE_MS, MAP_UNDO_LIMIT, useMapEditor, type MapEditorInput } from "./useMapEditor";

const fixture = mapSandboxFixture("supportInbox");
const plain = startFromBuild(fixture.steps, fixture.groups, fixture.making, fixture.results);
let ids = 0;
const newId = () => `n${++ids}`;
/** A step that changes the layout: the first box split side by side. */
const split = (layout: MapLayout) => splitBox(layout, boxes(layout)[0].id, "across", 0.5, [], { newId });

function setup(over: Partial<MapEditorInput> = {}) {
  const save = vi.fn((_layout: MapLayout) => Promise.resolve({}));
  const announce = vi.fn();
  const onSaveError = vi.fn();
  const hook = renderHook((props: MapEditorInput) => useMapEditor(props), { initialProps: { stored: null, plain, save, announce, onSaveError, ...over } });
  return { ...hook, save: (over.save as typeof save | undefined) ?? save, announce, onSaveError };
}

beforeEach(() => {
  vi.useFakeTimers();
  ids = 0;
});
afterEach(() => vi.useRealTimers());

describe("useMapEditor", () => {
  it("draws the plain arrangement until the first change", () => {
    const { result } = setup();
    expect(result.current.layout).toBe(plain);
    expect(result.current.stored).toBe(false);
  });

  it("apply: on ok sets the layout, announces the sentence and is one step", () => {
    const { result, announce } = setup();
    const next = split(plain);
    act(() => void result.current.apply(next, "Box split"));
    expect(next.ok && result.current.layout).toBe(next.ok ? next.layout : null);
    expect(announce).toHaveBeenLastCalledWith("Box split");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.refusal).toBeNull();
  });

  it("a refusal changes nothing, announces the reason and shows it under the selection", () => {
    const { result, announce } = setup();
    act(() => void result.current.apply({ ok: false, reason: "These boxes hold different sessions." }, "unused"));
    expect(result.current.layout).toBe(plain);
    expect(result.current.canUndo).toBe(false);
    expect(announce).toHaveBeenLastCalledWith("These boxes hold different sessions.");
    expect(result.current.refusal).toMatchObject({ reason: "These boxes hold different sessions.", at: "selection" });
    // It clears on the next action.
    act(() => result.current.select(boxes(plain)[0].id));
    expect(result.current.refusal).toBeNull();
  });

  it("undo and redo walk the steps and announce them", () => {
    const { result, announce } = setup();
    const one = split(plain);
    act(() => void result.current.apply(one, "Box split"));
    const after = result.current.layout;
    act(() => result.current.undo());
    expect(result.current.layout).toBe(plain);
    expect(announce).toHaveBeenLastCalledWith(MAP_EDITOR_COPY.undone("Box split"));
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.layout).toBe(after);
    expect(announce).toHaveBeenLastCalledWith(MAP_EDITOR_COPY.redone("Box split"));
    act(() => result.current.redo());
    expect(announce).toHaveBeenLastCalledWith(MAP_EDITOR_COPY.nothingToRedo);
  });

  it("keeps 100 steps", () => {
    const { result } = setup();
    for (let at = 0; at < MAP_UNDO_LIMIT + 5; at += 1) act(() => void result.current.apply({ ok: true, layout: { ...result.current.layout, width: 700 + at }, changed: [] }, `Step ${at}`));
    let undone = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undone += 1;
    }
    expect(undone).toBe(MAP_UNDO_LIMIT);
    // Back to the layout before step 5: step 4 made it.
    expect(result.current.layout.width).toBe(704);
  });

  it("the first change writes the full plain arrangement at once", () => {
    const { result, save } = setup();
    const next = split(plain);
    act(() => void result.current.apply(next, "Box split"));
    expect(save).toHaveBeenCalledTimes(1);
    const written = save.mock.calls[0][0];
    expect(written).toBe(next.ok ? next.layout : null);
    // The whole tree: every tile the plain arrangement placed.
    expect(boxes(written).flatMap((box) => box.tiles).sort()).toEqual(boxes(plain).flatMap((box) => box.tiles).sort());
  });

  it("three quick changes are one save, 400 ms after the last", async () => {
    const { result, save } = setup({ stored: plain });
    for (const width of [700, 720, 740]) act(() => void result.current.apply({ ok: true, layout: { ...result.current.layout, width }, changed: [] }, "Wider"));
    expect(save).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(MAP_SAVE_DEBOUNCE_MS - 1));
    expect(save).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].width).toBe(740);
  });

  it("a failed save keeps the layout on screen, says so, and the next change saves again", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({});
    const { result, onSaveError } = setup({ save });
    const next = split(plain);
    await act(async () => void result.current.apply(next, "Box split"));
    expect(onSaveError).toHaveBeenCalledTimes(1);
    expect(result.current.layout).toBe(next.ok ? next.layout : null);
    // Still not written: the next change goes at once again, with the whole layout.
    await act(async () => void result.current.apply({ ok: true, layout: { ...result.current.layout, width: 720 }, changed: [] }, "Wider"));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].width).toBe(720);
  });

  it("selection: shift adds boxes, a tile selects alone, a box and a tile are never together", () => {
    const { result } = setup();
    const [a, b] = boxes(plain);
    act(() => result.current.select(a.id));
    act(() => result.current.select(b.id, true));
    expect(result.current.selected).toEqual([a.id, b.id]);
    act(() => result.current.select(a.tiles[0], true));
    expect(result.current.selected).toEqual([a.tiles[0]]);
    act(() => result.current.select(b.id, true));
    expect(result.current.selected).toEqual([b.id]);
    act(() => result.current.select(null));
    expect(result.current.selected).toEqual([]);
  });
});
