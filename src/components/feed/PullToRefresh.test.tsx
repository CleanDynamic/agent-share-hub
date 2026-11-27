// Prompt 29a Part D: the pull to refresh, with the refetch and the canvas mocked. Nothing unless at the top; the offset follows the
// formula; it arms at 80 and returns below it; it refreshes, stays under at least 350ms and returns; the failed path and the 10
// second limit; the live region; the Refresh button; reduced motion.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: (...args: unknown[]) => toastError(...args) }) }));

import { pullOffset } from "./beaverFrames";
import { PTR_COPY, PullToRefresh, REFRESH_TIMEOUT } from "./PullToRefresh";

const FRAME = 16;
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/lib/theme/motion", async (original) => ({ ...(await original<typeof import("@/lib/theme/motion")>()), prefersReducedMotion: () => motion.reduced }));

beforeEach(() => {
  motion.reduced = false;
  toastError.mockReset();
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout", "Date"] });
  // The canvas: a context that draws nothing.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), globalAlpha: 1, globalCompositeOperation: "source-over" } as unknown as CanvasRenderingContext2D);
  // The atlas loads at once.
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(onRefresh: () => Promise<number> = () => Promise.resolve(2), props: { disabled?: boolean } = {}) {
  const view = render(
    <>
      <header data-testid="phone-top-bar">
        <a data-phone-logo="">
          <img alt="" data-testid="logo" />
        </a>
      </header>
      <PullToRefresh onRefresh={onRefresh} doneLine={(count) => `${count} new since you looked`} {...props}>
        <div data-testid="feed">posts</div>
      </PullToRefresh>
    </>,
  );
  // The idle callback (a 1ms timeout here) and the atlas's load.
  await act(async () => {
    vi.advanceTimersByTime(5);
    await Promise.resolve();
  });
  return view;
}

const content = () => screen.getByTestId("ptr-content");
const offsetOf = () => {
  const match = /translate3d\(0(?:px)?, ([\d.]+)px/.exec(content().style.transform);
  return match ? Number(match[1]) : 0;
};

function start(y = 100) {
  fireEvent.touchStart(window, { touches: [{ clientX: 100, clientY: y }] });
}
function move(dy: number, y = 100) {
  fireEvent.touchMove(window, { touches: [{ clientX: 100, clientY: y + dy }] });
}
function end() {
  fireEvent.touchEnd(window, { touches: [] });
}
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("PullToRefresh", () => {
  it("does nothing unless the page is at the very top", async () => {
    const onRefresh = vi.fn(() => Promise.resolve(0));
    await mount(onRefresh);
    window.scrollY = 200;
    start();
    move(300);
    await tick(FRAME);
    end();
    await tick(1000);
    expect(offsetOf()).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does nothing while a sheet is open", async () => {
    const onRefresh = vi.fn(() => Promise.resolve(0));
    await mount(onRefresh, { disabled: true });
    start();
    move(300);
    await tick(FRAME);
    expect(offsetOf()).toBe(0);
  });

  it("moves the feed by 125 × (1 − e^(−drag / 170)) while pulling", async () => {
    await mount();
    start();
    move(10);
    move(170);
    await tick(FRAME);
    expect(offsetOf()).toBeCloseTo(pullOffset(170), 1);
    expect(screen.getByTestId("logo").style.opacity).not.toBe("1");
  });

  it("returns over 200ms without refreshing when released before 80", async () => {
    const onRefresh = vi.fn(() => Promise.resolve(0));
    await mount(onRefresh);
    start();
    move(100);
    await tick(FRAME);
    expect(offsetOf()).toBeLessThan(80);
    end();
    await tick(250);
    expect(offsetOf()).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("logo").style.opacity).toBe("1");
  });

  it("arms at 80: refreshes, says Refreshing, stays under at least 350ms, returns and says the count", async () => {
    const onRefresh = vi.fn(() => Promise.resolve(3));
    await mount(onRefresh);
    start();
    move(400);
    await tick(FRAME);
    end();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ptr-live").textContent).toBe(PTR_COPY.refreshing);
    await tick(380 + 340);
    expect(offsetOf()).toBe(112);
    await tick(2000);
    expect(offsetOf()).toBe(0);
    expect(content().style.transform).toBe("");
    expect(screen.getByTestId("ptr-live").textContent).toBe("3 new since you looked");
    expect(screen.getByTestId("logo").style.opacity).toBe("1");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("returns anyway when the refetch fails, then shows the failed toast with Try again", async () => {
    await mount(() => Promise.reject(new Error("offline")));
    start();
    move(400);
    await tick(FRAME);
    end();
    await tick(500);
    expect(toastError).not.toHaveBeenCalled();
    await tick(2000);
    expect(offsetOf()).toBe(0);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [line, options] = toastError.mock.calls[0] as [string, { action: { label: string } }];
    expect(line).toBe("Couldn't load the feed.");
    expect(options.action.label).toBe("Try again");
  });

  it("lets go of a refetch that takes more than 10 seconds", async () => {
    await mount(() => new Promise<number>(() => undefined));
    start();
    move(400);
    await tick(FRAME);
    end();
    await tick(REFRESH_TIMEOUT - 100);
    expect(offsetOf()).toBe(112);
    await tick(2000);
    expect(offsetOf()).toBe(0);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("offers a Refresh button first in the feed, hidden until focused", async () => {
    const onRefresh = vi.fn(() => Promise.resolve(1));
    await mount(onRefresh);
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(content().firstElementChild).toBe(button);
    expect(button.className).toBe("sr-only");
    fireEvent.focus(button);
    expect(button.className).toBe("");
    fireEvent.click(button);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await tick(10);
    expect(screen.getByTestId("ptr-live").textContent).toBe("1 new since you looked");
  });

  it("with reduced motion: no canvas, the feed does not follow, and a pull past 150 still refreshes", async () => {
    motion.reduced = true;
    const onRefresh = vi.fn(() => Promise.resolve(0));
    await mount(onRefresh);
    expect(screen.queryByTestId("ptr-canvas")).toBeNull();
    start();
    move(120);
    await tick(FRAME);
    expect(offsetOf()).toBe(0);
    end();
    expect(onRefresh).not.toHaveBeenCalled();
    start();
    move(160);
    end();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
