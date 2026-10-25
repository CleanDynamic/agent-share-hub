import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGE_READY_ATTRIBUTE, usePageReady } from "./pageReady";

const root = () => document.documentElement.getAttribute(PAGE_READY_ATTRIBUTE);

afterEach(() => {
  document.documentElement.removeAttribute(PAGE_READY_ATTRIBUTE);
  vi.restoreAllMocks();
});

describe("usePageReady", () => {
  it("marks the page once its first screen is ready, and not before", () => {
    const mark = vi.spyOn(performance, "mark");
    const { rerender } = renderHook(({ ready }) => usePageReady("drafts", ready), { initialProps: { ready: false } });
    expect(root()).toBeNull();
    expect(mark).not.toHaveBeenCalled();

    rerender({ ready: true });
    expect(root()).toBe("drafts");
    expect(mark).toHaveBeenCalledWith("page-ready:drafts");
  });

  it("marks only once while the page stays ready", () => {
    const mark = vi.spyOn(performance, "mark");
    const { rerender } = renderHook(({ ready }) => usePageReady("home", ready), { initialProps: { ready: true } });
    rerender({ ready: true });
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it("clears the attribute when the page goes away", () => {
    const { unmount } = renderHook(() => usePageReady("library", true));
    expect(root()).toBe("library");
    act(() => unmount());
    expect(root()).toBeNull();
  });

  it("does not clear the mark of a different page", () => {
    const { unmount } = renderHook(() => usePageReady("library", true));
    document.documentElement.setAttribute(PAGE_READY_ATTRIBUTE, "drafts");
    unmount();
    expect(root()).toBe("drafts");
  });
});
