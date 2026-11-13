// D4: a read that never answers stops being a skeleton after STALL_MS; Retry gives it another STALL_MS.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STALL_MS, useStalled } from "./useStalled";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useStalled", () => {
  it("is false while the read is young, and true once it has waited STALL_MS", () => {
    const { result } = renderHook(() => useStalled(true));
    act(() => vi.advanceTimersByTime(STALL_MS - 1));
    expect(result.current.stalled).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.stalled).toBe(true);
  });

  it("is false the moment the read answers", () => {
    const { result, rerender } = renderHook(({ waiting }) => useStalled(waiting), { initialProps: { waiting: true } });
    act(() => vi.advanceTimersByTime(STALL_MS));
    expect(result.current.stalled).toBe(true);
    rerender({ waiting: false });
    expect(result.current.stalled).toBe(false);
  });

  it("gives a retried read another STALL_MS", () => {
    const { result } = renderHook(() => useStalled(true));
    act(() => vi.advanceTimersByTime(STALL_MS));
    act(() => result.current.restart());
    expect(result.current.stalled).toBe(false);
    act(() => vi.advanceTimersByTime(STALL_MS));
    expect(result.current.stalled).toBe(true);
  });

  it("never stalls a read that is not waiting", () => {
    const { result } = renderHook(() => useStalled(false));
    act(() => vi.advanceTimersByTime(STALL_MS * 3));
    expect(result.current.stalled).toBe(false);
  });
});
