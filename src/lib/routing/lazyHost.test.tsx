// SV-26 P2: a window that draws nothing until it opens is mounted on its first open and stays mounted, and an idle mount
// draws its child only once the browser is idle.

import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdleMount } from "./IdleMount";
import { useEverOpened, useLoadAtIdle } from "./lazyHost";

describe("useEverOpened", () => {
  it("is false until the first open, then stays true after it closes", () => {
    const { result, rerender } = renderHook(({ open }) => useEverOpened(open), { initialProps: { open: false } });
    expect(result.current).toBe(false);
    rerender({ open: true });
    expect(result.current).toBe(true);
    rerender({ open: false });
    expect(result.current).toBe(true);
  });
});

describe("idle loading", () => {
  let idle: (() => void) | null = null;
  beforeEach(() => {
    idle = null;
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idle = callback;
      return 1;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws an IdleMount child only after the browser is idle", () => {
    render(
      <IdleMount>
        <p>toaster</p>
      </IdleMount>,
    );
    expect(screen.queryByText("toaster")).toBeNull();
    act(() => idle?.());
    expect(screen.getByText("toaster")).toBeTruthy();
  });

  it("asks for a window's code at idle and not before", () => {
    const loader = vi.fn(() => Promise.resolve({}));
    renderHook(() => useLoadAtIdle(loader));
    expect(loader).not.toHaveBeenCalled();
    act(() => idle?.());
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
