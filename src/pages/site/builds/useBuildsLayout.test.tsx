// SV-24 P2: where the layout is kept. In this browser with no set open or someone else's, in the viewer's own open set otherwise,
// written once a moment after the last change and once more when the page is left.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_LAYOUT, LAYOUT_KEY, withColumns } from "@/lib/build/buildsLayout";

import { LAYOUT_SAVE_MS, useBuildsLayout, type KeptSet } from "./useBuildsLayout";

const save = vi.fn();
const kept = (layout: KeptSet["layout"] = null, id = "set-1"): KeptSet => ({ id, search: "shape=agent", layout });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("useBuildsLayout", () => {
  it("starts from this browser's copy and writes changes back to it when no set is open", () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(withColumns(EMPTY_LAYOUT, ["build", "task"])));
    const { result } = renderHook(() => useBuildsLayout(null, save));
    expect(result.current.layout.columns).toEqual(["build", "task"]);
    act(() => result.current.update((layout) => withColumns(layout, ["build", "field"])));
    expect(result.current.layout.columns).toEqual(["build", "field"]);
    expect(JSON.parse(localStorage.getItem(LAYOUT_KEY) as string).columns).toEqual(["build", "field"]);
    vi.advanceTimersByTime(LAYOUT_SAVE_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("shows a change in the viewer's own set at once and writes the set once, after the changes stop", () => {
    const set = kept();
    const { result } = renderHook(() => useBuildsLayout(set, save));
    act(() => result.current.update((layout) => withColumns(layout, ["build", "field"])));
    act(() => result.current.update((layout) => withColumns(layout, ["build", "field", "task"])));
    expect(result.current.layout.columns).toEqual(["build", "field", "task"]);
    expect(save).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(LAYOUT_SAVE_MS));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(set, { ...EMPTY_LAYOUT, columns: ["build", "field", "task"] });
    expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
  });

  it("shows the set's own layout when it has one, and the browser's when it has none", () => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(withColumns(EMPTY_LAYOUT, ["build", "task"])));
    const own = renderHook(() => useBuildsLayout(kept(withColumns(EMPTY_LAYOUT, ["build", "setting"])), save));
    expect(own.result.current.layout.columns).toEqual(["build", "setting"]);
    const none = renderHook(() => useBuildsLayout(kept(null), save));
    expect(none.result.current.layout.columns).toEqual(["build", "task"]);
  });

  it("writes what is waiting when the page is left", () => {
    const { result, unmount } = renderHook(() => useBuildsLayout(kept(), save));
    act(() => result.current.update((layout) => withColumns(layout, ["build", "field"])));
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("writes what is waiting to the set it was made in when another set is opened", () => {
    let set = kept(null, "set-1");
    const { result, rerender } = renderHook(() => useBuildsLayout(set, save));
    act(() => result.current.update((layout) => withColumns(layout, ["build", "field"])));
    set = kept(null, "set-2");
    rerender();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: "set-1" }), expect.anything());
    expect(result.current.layout.columns).toBeNull();
  });
});
