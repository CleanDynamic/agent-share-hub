// CA-27 P3: a build of hundreds of tiles. Under WINDOW_FROM tiles everything is drawn as it was; from there on only the tiles near the
// view are, each undrawn one stands in a box that keeps its place, and what the page needs (the selected tile, Find's match) is drawn
// whatever its place. jsdom has no layout and no IntersectionObserver: a stub says which boxes are near. The measures (first render,
// frame rate, pick-up, find) are in scripts/ca27-measure.mjs; the browser tests are in e2e/audit/composer-ca27.spec.ts.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import MotionDemo from "@/pages/dev/MotionDemo";

import { done } from "./ca21Harness";
import { WINDOW_FROM, settle, tileElement } from "./largeBuild";

/** An IntersectionObserver that nothing intersects until the test says so. */
const watched = new Set<Element>();
/* The page keeps one observer for every tile, made when the first tile mounts: the first one the stub makes is the one that is told. */
let report: ((entries: { target: Element; isIntersecting: boolean }[]) => void) | null = null;
class FakeObserver {
  constructor(callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    report ??= callback;
  }
  observe(element: Element) {
    watched.add(element);
  }
  unobserve(element: Element) {
    watched.delete(element);
  }
  disconnect() {
    watched.clear();
  }
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Element.prototype.scrollIntoView = () => undefined;
  window.scrollTo = () => undefined;
  watched.clear();
});
afterEach(done);

async function mount(tiles: number, extra = "") {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/dev/kit/pages/sandbox?build=ca27&bar=hide&tiles=${tiles}${extra}`]}>
        <MotionDemo viewport="desktop" />
      </MemoryRouter>
    </ThemeProvider>,
  );
  await screen.findByTestId("build-list");
}

const boxes = () => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')];
const cards = () => document.querySelectorAll('[data-testid="step-card"]').length;

describe("windowing", () => {
  it("starts at 60 tiles", () => expect(WINDOW_FROM).toBe(60));

  it("draws every tile of a smaller build, as it always did", async () => {
    await mount(40);
    expect(boxes()).toHaveLength(40);
    expect(boxes().every((box) => box.dataset.drawn === undefined)).toBe(true);
    expect(cards()).toBe(40);
  });

  it("keeps a box for every tile of a large one and draws the first screens, and what the page needs", async () => {
    await mount(300, "&select=c27-250");
    expect(boxes()).toHaveLength(300);
    const drawn = boxes().filter((box) => box.dataset.drawn === "true").map((box) => box.dataset.skelId);
    // The first 16, and the selected tile wherever it is.
    expect(drawn).toHaveLength(17);
    expect(drawn).toContain("c27-250");
    expect(drawn).toContain("c27-16");
    expect(drawn).not.toContain("c27-17");
    expect(cards()).toBe(17);
    // Every undrawn box has its skeleton attributes and a height.
    const far = document.querySelector<HTMLElement>('[data-skel-id="c27-100"]')!;
    expect(far.dataset.skelKind).toBe("tile");
    expect(far.dataset.skelContainer).not.toBe("");
    expect(parseFloat(far.style.height)).toBeGreaterThan(40);
    expect(far.childElementCount).toBe(0);
  });

  it("draws a tile when its box comes near the view, and not before", async () => {
    await mount(300);
    const far = document.querySelector<HTMLElement>('[data-skel-id="c27-120"]')!;
    expect(far.dataset.drawn).toBe("false");
    act(() => report?.([{ target: far, isIntersecting: true }]));
    await waitFor(() => expect(far.dataset.drawn).toBe("true"));
    expect(far.querySelector('[data-testid="step-card"]')).toBeTruthy();
    act(() => report?.([{ target: far, isIntersecting: false }]));
    await waitFor(() => expect(far.dataset.drawn).toBe("false"));
    expect(far.querySelector('[data-testid="step-card"]')).toBeNull();
  });

  it("finds a tile's box when its card is not drawn, and its card when it is", async () => {
    await mount(300);
    expect(tileElement("c27-120")?.dataset.skelKind).toBe("tile");
    expect(tileElement("c27-3")?.dataset.nodeId).toBe("c27-3");
    expect(tileElement("c27-nothing")).toBeNull();
  });

  it("Find draws the tile it is on", async () => {
    await mount(300);
    fireEvent.click(screen.getByRole("button", { name: "Find in build" }));
    fireEvent.change(await screen.findByTestId("find-input"), { target: { value: "sourdough" } });
    await waitFor(() => expect(screen.getByTestId("find-count").textContent).toBe("1 of 5"), { timeout: 2000 });
    // The fifth match is Prompt 244.
    expect(document.querySelector('[data-skel-id="c27-244"]')?.getAttribute("data-drawn")).toBe("false");
    for (let n = 0; n < 4; n += 1) fireEvent.keyDown(screen.getByTestId("find-input"), { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("find-count").textContent).toBe("5 of 5"));
    await waitFor(() => expect(document.querySelector('[data-node-id="c27-244"]')).toBeTruthy());
    // And lets go of it again when Find moves on: it is only drawn while it is the match.
    fireEvent.keyDown(screen.getByTestId("find-input"), { key: "Enter" });
    await waitFor(() => expect(document.querySelector('[data-skel-id="c27-244"]')?.getAttribute("data-drawn")).toBe("false"));
  });
});

describe("settle", () => {
  it("puts a tile back while it is not where it was sent, and stops when it is, after its time, and on a scroll", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    let there = false;
    const put = vi.fn(() => {
      there = true;
    });
    settle(() => there, put, 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(put).toHaveBeenCalledTimes(1);
    there = false;
    await vi.advanceTimersByTimeAsync(40);
    expect(put).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(400);
    const calls = put.mock.calls.length;
    there = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(put.mock.calls.length).toBe(calls);

    const again = vi.fn();
    settle(() => false, again, 1000);
    await vi.advanceTimersByTimeAsync(40);
    const before = again.mock.calls.length;
    window.dispatchEvent(new Event("wheel"));
    await vi.advanceTimersByTimeAsync(200);
    expect(again.mock.calls.length).toBe(before);
    vi.useRealTimers();
  });
});
