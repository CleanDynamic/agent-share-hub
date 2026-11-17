// G22: before the editor shows that the session ended, what is still waiting to be written (the 800 ms debounce, an open
// tile's buffer) is written, into the write guard's line, which holds it under the pending key.
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setSessionPhase } from "@/lib/query/sessionSignal";

import { useFlushWhenSessionInQuestion } from "./useFlushWhenSessionInQuestion";

function Flusher({ flush }: { flush: () => void }) {
  useFlushWhenSessionInQuestion(flush);
  return null;
}

afterEach(() => setSessionPhase("live"));

describe("useFlushWhenSessionInQuestion", () => {
  it("flushes once when the session goes into question, and not while it is live", () => {
    const flush = vi.fn();
    render(<Flusher flush={flush} />);
    expect(flush).not.toHaveBeenCalled();
    act(() => setSessionPhase("checking"));
    expect(flush).toHaveBeenCalledTimes(1);
    act(() => setSessionPhase("ended"));
    expect(flush).toHaveBeenCalledTimes(1);
    act(() => setSessionPhase("live"));
    act(() => setSessionPhase("checking"));
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("calls the flush of the latest render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Flusher flush={first} />);
    rerender(<Flusher flush={second} />);
    act(() => setSessionPhase("checking"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
