import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { unsentBuildKey, useUnsentPrompts } from "./useUnsentPrompts";

beforeEach(() => window.sessionStorage.clear());

describe("UX-01 P1: useUnsentPrompts", () => {
  it("keeps text under ux-unsent:<build>:<session> and reads it back after a remount", () => {
    const first = renderHook(() => useUnsentPrompts("b1"));
    act(() => first.result.current.set("s1", "hello"));
    expect(window.sessionStorage.getItem("ux-unsent:b1:s1")).toBe("hello");
    first.unmount();
    const again = renderHook(() => useUnsentPrompts("b1"));
    expect(again.result.current.get("s1")).toBe("hello");
    expect(again.result.current.entries()).toEqual([{ key: "s1", text: "hello" }]);
  });

  it("moves new:<token> entries to the real id the moment it arrives", () => {
    const hook = renderHook(({ id }: { id: string | null }) => useUnsentPrompts(id), { initialProps: { id: null as string | null } });
    act(() => hook.result.current.set("s1", "typed before the build existed"));
    expect(window.sessionStorage.getItem(`ux-unsent:${unsentBuildKey(null)}:s1`)).toBe("typed before the build existed");
    hook.rerender({ id: "real-id" });
    expect(hook.result.current.get("s1")).toBe("typed before the build existed");
    expect(window.sessionStorage.getItem("ux-unsent:real-id:s1")).toBe("typed before the build existed");
    expect(window.sessionStorage.getItem(`ux-unsent:${unsentBuildKey(null)}:s1`)).toBeNull();
  });

  it("clearing removes the stored entry", () => {
    const hook = renderHook(() => useUnsentPrompts("b1"));
    act(() => hook.result.current.set("s1", "x"));
    act(() => hook.result.current.clear("s1"));
    expect(window.sessionStorage.getItem("ux-unsent:b1:s1")).toBeNull();
    expect(hook.result.current.entries()).toEqual([]);
  });

  it("works in memory when storage throws", () => {
    const broken = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const hook = renderHook(() => useUnsentPrompts("b1"));
    act(() => hook.result.current.set("s1", "kept in memory"));
    expect(hook.result.current.get("s1")).toBe("kept in memory");
    broken.mockRestore();
  });
});
