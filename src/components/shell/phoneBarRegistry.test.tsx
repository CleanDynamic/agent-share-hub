import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetPageBar, usePageBar, useRegisterPageBar } from "./phoneBarRegistry";

afterEach(() => __resetPageBar());

function Page({ run, disabled }: { run: () => void; disabled: boolean }) {
  useRegisterPageBar({ markAll: { run, disabled }, title: "Mine" });
  return null;
}

describe("phoneBarRegistry", () => {
  it("shows a mounted page's state to the bar and takes it away when the page goes", () => {
    const bar = renderHook(() => usePageBar());
    expect(bar.result.current).toEqual({});
    const run = vi.fn();
    const page = render(<Page run={run} disabled={false} />);
    expect(bar.result.current.title).toBe("Mine");
    expect(bar.result.current.markAll?.disabled).toBe(false);
    act(() => bar.result.current.markAll?.run());
    expect(run).toHaveBeenCalledTimes(1);
    page.unmount();
    expect(bar.result.current).toEqual({});
  });

  it("follows a change of state and always calls the page's latest function", () => {
    const bar = renderHook(() => usePageBar());
    const first = vi.fn();
    const second = vi.fn();
    const page = render(<Page run={first} disabled />);
    expect(bar.result.current.markAll?.disabled).toBe(true);
    page.rerender(<Page run={second} disabled={false} />);
    expect(bar.result.current.markAll?.disabled).toBe(false);
    act(() => bar.result.current.markAll?.run());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps a page's More rows and calls the latest function of the row that was chosen", () => {
    const bar = renderHook(() => usePageBar());
    const first = vi.fn();
    const second = vi.fn();
    function More({ run }: { run: () => void }) {
      useRegisterPageBar({ more: [{ label: "Rebuild", onSelect: run }, { label: "Lineage", to: "/x" }], settings: run });
      return null;
    }
    const page = render(<More run={first} />);
    expect(bar.result.current.more?.map((item) => item.label)).toEqual(["Rebuild", "Lineage"]);
    page.rerender(<More run={second} />);
    act(() => bar.result.current.more?.[0].onSelect?.());
    act(() => bar.result.current.settings?.());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(2);
  });
});
