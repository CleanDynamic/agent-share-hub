// CA-24 P4 - a slow import: the tag, the blocks in the empty sockets, the bar and count, Stop, and the notice.

import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { ArrivingBlock, type Arriving } from "./arrival";
import { ImportProgress, ImportingTag, SLOW_IMPORT_MS, SocketBlocks, IMPORTING_COPY, stoppedNotice, useSlow } from "./ImportingPieces";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

const arriving = (over: Partial<Arriving> = {}): Arriving => ({
  key: "imp-1",
  kind: "chat",
  head: { key: "imp-1", number: 2, tool: "Claude", detail: "", prompts: [], date: "22 Oct" },
  count: 3,
  status: "writing",
  ...over,
});

const block = (over: Partial<Arriving> = {}) => render(<ArrivingBlock arriving={arriving(over)} rootRef={{ current: null }} first={false} />);

describe("the words", () => {
  it("says Importing, '6 of 18 prompts', Stop, and after Stop 'Stopped. 6 of 18 prompts added.'", () => {
    expect(IMPORTING_COPY.tag).toBe("Importing");
    expect(IMPORTING_COPY.count(6, 18)).toBe("6 of 18 prompts");
    expect(IMPORTING_COPY.stop).toBe("Stop");
    expect(stoppedNotice(6, 18)).toBe("Stopped. 6 of 18 prompts added.");
  });
});

describe("the tag", () => {
  it("is 20 tall, padding 0 7, radius 5, the control recipe, the data face 10.5 in --text2", () => {
    const html = renderToStaticMarkup(<ImportingTag />);
    expect(html).toContain("height:20px");
    expect(html).toContain("padding:0 7px");
    expect(html).toContain("border-radius:5px");
    expect(html).toContain("background:var(--control);border:1px solid var(--control-border)");
    expect(html).toContain("font-size:10.5px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("var(--font-data");
  });
});

describe("only an import that takes longer than a second", () => {
  it("shows nothing extra before a second, and the tag and the blocks at a second", () => {
    block();
    expect(screen.queryByTestId("importing-tag")).toBeNull();
    expect(screen.queryByTestId("socket-blocks")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS - 1);
    });
    expect(screen.queryByTestId("importing-tag")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("importing-tag").textContent).toBe("Importing");
    expect(within(screen.getByTestId("arriving-head")).getByTestId("importing-tag")).toBeTruthy();
  });

  it("SV-05 P4: puts building blocks over the whole inner area of every empty socket, inset 10 from every edge", () => {
    block({ count: 3 });
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS);
    });
    const places = screen.getAllByTestId("arriving-place");
    expect(places).toHaveLength(3);
    for (const place of places) {
      const inset = within(place).getByTestId("socket-blocks");
      expect(inset.style.inset).toBe("10px");
      expect(within(inset).getByTestId("loading-blocks").style.height).toBe("100%");
    }
  });

  it("is not shown for an empty session the maker started, nor once the write has finished", () => {
    const { rerender } = block({ kind: "empty", count: 0 });
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS * 2);
    });
    expect(screen.queryByTestId("importing-tag")).toBeNull();
    rerender(<ArrivingBlock arriving={arriving({ status: "written" })} rootRef={{ current: null }} first={false} />);
    expect(screen.queryByTestId("importing-tag")).toBeNull();
  });

  it("uses one timer for the whole import and takes it away if the import ends first", () => {
    const set = vi.spyOn(window, "setTimeout");
    const clear = vi.spyOn(window, "clearTimeout");
    const { result, rerender } = renderHook(({ on }) => useSlow(on), { initialProps: { on: true } });
    expect(result.current).toBe(false);
    rerender({ on: false });
    expect(clear).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS * 2);
    });
    expect(result.current).toBe(false);
    expect(set.mock.calls.filter(([, ms]) => ms === SLOW_IMPORT_MS)).toHaveLength(1);
  });
});

describe("a write in one go has no bar, no count and no Stop", () => {
  it("shows the tag and the sockets and nothing under them", () => {
    block();
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS);
    });
    expect(screen.getByTestId("importing-tag")).toBeTruthy();
    expect(screen.queryByTestId("import-progress")).toBeNull();
    expect(screen.queryByTestId("import-stop")).toBeNull();
  });
});

describe("the bar, the count and Stop", () => {
  it("fills to done divided by total, with the count beside it, 8 under the sockets", () => {
    block({ progress: { done: 6, total: 18 } });
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS);
    });
    const row = screen.getByTestId("import-progress");
    expect(screen.getByTestId("import-count").textContent).toBe("6 of 18 prompts");
    expect(Number.parseFloat(screen.getByTestId("import-bar-fill").style.width)).toBeCloseTo(33.33, 1);
    const bar = within(row).getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("6");
    expect(bar.getAttribute("aria-valuemax")).toBe("18");
    const html = renderToStaticMarkup(<ImportProgress progress={{ done: 6, total: 18 }} onStop={() => undefined} />);
    expect(html).toContain("height:4px;border-radius:2px;background:var(--hairline)");
    expect(html).toContain("background:var(--text2)");
    expect(html).toContain("gap:12px");
    expect(html).toContain("text-decoration:underline");
    expect(html).toContain("font-size:12.5px;font-weight:500");
    expect(html).toContain("font-size:11px");
  });

  it("has Stop only when the import can be stopped, and Stop calls it", () => {
    const onStop = vi.fn();
    const { rerender } = render(<ImportProgress progress={{ done: 6, total: 18 }} />);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    rerender(<ImportProgress progress={{ done: 6, total: 18 }} onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("is not drawn without progress, and keeps its fill between 0 and all", () => {
    const { container, rerender } = render(<ImportProgress onStop={() => undefined} />);
    expect(container.firstChild).toBeNull();
    rerender(<ImportProgress progress={{ done: 30, total: 18 }} />);
    expect(screen.getByTestId("import-bar-fill").style.width).toBe("100%");
    rerender(<ImportProgress progress={{ done: 0, total: 0 }} />);
    expect(screen.getByTestId("import-bar-fill").style.width).toBe("0%");
  });

  it("Stop keeps what is in: the page's notice for 6 of 18 is the one CA-20 says", () => {
    // The row only calls onStop; the one that stops the write says what was kept, in CA-20's notice.
    const notices: string[] = [];
    render(<ImportProgress progress={{ done: 6, total: 18 }} onStop={() => notices.push(stoppedNotice(6, 18))} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(notices).toEqual(["Stopped. 6 of 18 prompts added."]);
  });
});

describe("prompts already in", () => {
  it("stand in their sockets; their blocks fade out over them, and the sockets still empty keep theirs", () => {
    block({ count: 3, written: ["First prompt", "Second prompt"], progress: { done: 2, total: 3 } });
    act(() => {
      vi.advanceTimersByTime(SLOW_IMPORT_MS);
    });
    const places = screen.getAllByTestId("arriving-place");
    expect(within(places[0]).getByText("First prompt")).toBeTruthy();
    expect(within(places[1]).getByText("Second prompt")).toBeTruthy();
    // SV-05 P4: the blocks and the prompt overlap in the slot while the blocks fade, so the socket is never empty for a frame.
    expect(within(within(places[0]).getByTestId("socket-blocks")).getByTestId("loading-blocks").style.opacity).toBe("0");
    expect(within(within(places[2]).getByTestId("socket-blocks")).getByTestId("loading-blocks").style.opacity).toBe("1");
  });
});

describe("the blocks wave with the rest of the page", () => {
  it("are plain building blocks, hidden from a screen reader", () => {
    render(<SocketBlocks />);
    expect(screen.getByTestId("loading-blocks").getAttribute("aria-hidden")).toBe("true");
  });
});
