// RC-P27 — the progress bar is light, never type, and still when asked to be.
//
// The claims: the fill is --lit and the track --recess, both at --r-control;
// nothing is written on the bar; it says its value to assistive technology as
// the text beside it does; and it moves only by transform, which
// prefers-reduced-motion turns off (the fill is drawn at its length at once).

import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { LitBar } from "./LitBar";

const originalMatchMedia = window.matchMedia;

function stubReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  __resetMotionMediaCache();
}

/**
 * The bar as static markup, parsed back into a DOM. jsdom drops var() from a
 * style object but keeps the attribute text, so colours are read from here.
 */
function staticBar(value: number, max: number) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<LitBar value={value} max={max} label="Run three builds" valueText={`${value} of ${max}`} />);
  const styleOf = (element: Element | null) =>
    Object.fromEntries(
      (element?.getAttribute("style") ?? "")
        .split(";")
        .map((part) => part.split(/:(.*)/s).map((half) => half.trim()))
        .filter(([key]) => key),
    ) as Record<string, string>;
  const bar = host.querySelector('[role="progressbar"]');
  const fill = host.querySelector('[data-testid="lit-bar-fill"]');
  return { bar: bar as HTMLElement, fill: fill as HTMLElement, barStyle: styleOf(bar), fillStyle: styleOf(fill) };
}

/** Let the bar's first frame run. */
async function nextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

beforeEach(() => stubReducedMotion(false));
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  __resetMotionMediaCache();
  vi.restoreAllMocks();
});

describe("the bar's paint", () => {
  it("fills with --lit on a --recess track, both at --r-control, and writes nothing on it", () => {
    const { bar, fill, barStyle, fillStyle } = staticBar(2, 3);

    expect(barStyle["background"]).toBe("var(--recess)");
    expect(barStyle["border-radius"]).toBe("var(--r-control)");
    expect(fillStyle["background"]).toBe("var(--lit)");
    expect(fillStyle["border-radius"]).toBe("var(--r-control)");
    expect(bar.textContent).toBe("");
    expect(fill.children).toHaveLength(0);
    expect(barStyle["color"]).toBeUndefined();
    expect(fillStyle["color"]).toBeUndefined();
  });

  it("gives its value as the text beside it does, and fills that share of the track", () => {
    render(<LitBar value={169} max={242} label="Progress to level 4" valueText="169 of 242 XP" />);

    const bar = screen.getByRole("progressbar", { name: "Progress to level 4" });
    expect(bar.getAttribute("aria-valuenow")).toBe("169");
    expect(bar.getAttribute("aria-valuemax")).toBe("242");
    expect(bar.getAttribute("aria-valuetext")).toBe("169 of 242 XP");
    expect(screen.getByTestId("lit-bar-fill").style.inlineSize).toBe("69.8%");
  });

  it("never fills past its track or below nothing", () => {
    const { rerender } = render(<LitBar value={5} max={3} label="Done" valueText="3 of 3" />);
    expect(screen.getByTestId("lit-bar-fill").style.inlineSize).toBe("100%");
    rerender(<LitBar value={-2} max={3} label="Done" valueText="0 of 3" />);
    expect(screen.getByTestId("lit-bar-fill").style.inlineSize).toBe("0%");
  });
});

describe("the bar's motion", () => {
  it("grows in from nothing by transform alone, at the 200ms ceiling", async () => {
    render(<LitBar value={1} max={3} label="Solve a gap" valueText="1 of 3" />);

    const fill = screen.getByTestId("lit-bar-fill");
    expect(fill.style.transform).toBe("scaleX(0)");
    expect(fill.style.transition).toMatch(/^transform 200ms /);
    await nextFrame();
    expect(fill.style.transform).toBe("none");
    expect(fill.style.transformOrigin).toBe("left center");
  });

  it("is still under prefers-reduced-motion: drawn at its length at once, with no transition", () => {
    stubReducedMotion(true);
    render(<LitBar value={1} max={3} label="Solve a gap" valueText="1 of 3" />);

    const fill = screen.getByTestId("lit-bar-fill");
    expect(fill.style.transform).toBe("none");
    expect(fill.style.transition).toBe("none");
  });
});
