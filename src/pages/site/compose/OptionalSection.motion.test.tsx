// CA-28 P4: the Optional section's motion, with recorded animations and a frame whose height depends on what is drawn in it.
// The window is centred (top 50%, translate -50%), so a frame that changes height keeps its centre by itself; what the section animates
// is the old height to the new, with transforms and clip-path only: growing 200 ms, the fields falling in from 100 ms, closing in reverse.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DROP, DROP_FALL, LIFT_RISE, OPTIONAL_DROP_AFTER, OPTIONAL_LIFT, OPTIONAL_LIFT_STAGGER, STAGGER } from "@/lib/build/buildMotion";
import { BASE, STANDARD, __resetMotionMediaCache } from "@/lib/theme/motion";

import { ModalInset } from "./modalRecipes";
import { OptionalField, OptionalSection } from "./OptionalSection";

interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  state: "running" | "finished" | "cancelled";
  settle: () => void;
}
let played: Played[] = [];
let reduced = false;
/** Where the scripted frame is centred, and how tall it is with nothing, and per field drawn. */
const CENTRE = 450;
const EMPTY = 300;
const PER_FIELD = 100;

const LAYOUT = /^(width|height|top|left|right|bottom|margin|padding|inset|boxShadow|box-shadow)/;

beforeEach(() => {
  reduced = false;
  played = [];
  window.matchMedia = ((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  __resetMotionMediaCache();
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    let resolve: () => void = () => undefined;
    const done = new Promise<void>((res) => (resolve = res));
    const entry: Played = {
      element: this,
      keyframes,
      options,
      state: "running",
      settle: () => {
        if (entry.state === "running") entry.state = "finished";
        resolve();
      },
    };
    played.push(entry);
    return {
      id: options.id ?? "",
      finished: done,
      finish: () => entry.settle(),
      cancel: () => {
        entry.state = "cancelled";
        resolve();
      },
    } as unknown as Animation;
  }) as never;
  Element.prototype.getAnimations = function (this: Element) {
    return played.filter((entry) => entry.element === this && entry.state === "running").map((entry) => ({ id: entry.options.id ?? "", finish: () => entry.settle(), cancel: () => (entry.state = "cancelled") }) as unknown as Animation);
  } as never;
  // The frame is as tall as what is drawn in it: EMPTY, and PER_FIELD for each field in a region that is not taken out of the layout.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute("role") !== "dialog") return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
    const region = this.querySelector<HTMLElement>('[data-testid="optional-region"]');
    const fields = region && region.style.display !== "none" ? region.querySelectorAll('[data-testid="optional-field"]').length : 0;
    const height = EMPTY + PER_FIELD * fields;
    return { x: 0, y: CENTRE - height / 2, top: CENTRE - height / 2, left: 0, right: 560, bottom: CENTRE + height / 2, width: 560, height, toJSON: () => ({}) } as DOMRect;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (Element.prototype as { animate?: unknown }).animate;
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  __resetMotionMediaCache();
});

function window_(count = 3, over: { forceAt?: number } = {}) {
  const tree = (extra = over) => (
    <div role="dialog" aria-label="Window" data-testid="window">
      <div data-testid="modal-header">Header</div>
      <div data-testid="modal-body" style={{ overflowY: "auto" }}>
        <ModalInset.Provider value={20}>
          <OptionalSection>
            {Array.from({ length: count }, (_, at) => (
              <OptionalField key={at} name={`Field ${at + 1}`} description={`Hint ${at + 1}`} forceOpen={extra.forceAt === at}>
                <input aria-label={`Input ${at + 1}`} />
              </OptionalField>
            ))}
          </OptionalSection>
        </ModalInset.Provider>
      </div>
      <div data-testid="modal-footer">Footer</div>
    </div>
  );
  const view = render(tree());
  return { ...view, again: (extra: { forceAt?: number }) => view.rerender(tree(extra)) };
}

const toggle = () => screen.getByTestId("optional-toggle");
const frame = () => screen.getByTestId("window");
const animationsOf = (element: Element) => played.filter((entry) => entry.element === element);
const fieldEls = () => screen.queryAllByTestId("optional-field");
/** Press the row with the pointer, and let the promises that follow it settle. */
const press = async (detail = 1) => {
  await act(async () => {
    fireEvent.click(toggle(), { detail });
    await Promise.resolve();
  });
};
const settleAll = async () => {
  await act(async () => {
    for (const entry of played) entry.settle();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("the section's motion: opening", () => {
  it("grows the frame over BASE in STANDARD, with its centre held: the clip opens from the old height, the header and body move up and the footer down, by half the difference", async () => {
    window_(3);
    await press();
    const growth = animationsOf(frame());
    expect(growth).toHaveLength(1);
    const old = EMPTY;
    const now = EMPTY + 3 * PER_FIELD;
    const half = (now - old) / 2;
    // Clip: from half off each end (the old height) to nothing (and the shadow's room), duration 200.
    expect(growth[0].options).toMatchObject({ duration: BASE, easing: STANDARD, fill: "none" });
    expect(growth[0].keyframes[0].clipPath).toMatch(new RegExp(`^inset\\(${half}px -\\d+px ${half}px -\\d+px round 12px\\)$`));
    expect(String(growth[0].keyframes[1].clipPath)).toMatch(/^inset\(-\d+px -\d+px -\d+px -\d+px round 12px\)$/);
    // The three parts, by half the difference: the top ones down to start with (so they move up), the footer up.
    expect(animationsOf(screen.getByTestId("modal-header"))[0].keyframes).toEqual([{ transform: `translateY(${half}px)` }, { transform: "none" }]);
    expect(animationsOf(screen.getByTestId("modal-body"))[0].keyframes).toEqual([{ transform: `translateY(${half}px)` }, { transform: "none" }]);
    expect(animationsOf(screen.getByTestId("modal-footer"))[0].keyframes).toEqual([{ transform: `translateY(${-half}px)` }, { transform: "none" }]);
    // The centre of what is shown, at the start: the new frame's top edge plus the cut, and its bottom edge less the cut.
    const top = CENTRE - now / 2 + half;
    const bottom = CENTRE + now / 2 - half;
    expect(Math.abs((top + bottom) / 2 - CENTRE)).toBeLessThan(1);
    expect(bottom - top).toBe(old);
    // Nothing animated is a layout property.
    for (const entry of played) {
      const keys = [...new Set(entry.keyframes.flatMap((frame) => Object.keys(frame)))].filter((key) => key !== "offset" && key !== "easing");
      expect(keys.filter((key) => LAYOUT.test(key))).toEqual([]);
    }
  });

  it("drops each field in 100 ms after the press: 20 from above, fading in over 240, top first, 60 apart", async () => {
    window_(3);
    await press();
    const drops = fieldEls().map((field) => animationsOf(field)[0]);
    expect(drops.map((entry) => entry.options.delay)).toEqual([OPTIONAL_DROP_AFTER, OPTIONAL_DROP_AFTER + STAGGER, OPTIONAL_DROP_AFTER + 2 * STAGGER]);
    expect(drops.every((entry) => entry.options.duration === DROP && entry.options.fill === "backwards")).toBe(true);
    expect(drops[0].keyframes).toEqual([{ opacity: 0, transform: `translateY(-${DROP_FALL}px)` }, { opacity: 1, transform: "none" }]);
    expect([OPTIONAL_DROP_AFTER, DROP, DROP_FALL, STAGGER]).toEqual([100, 240, 20, 60]);
  });

  it("lands the 12th and any after together", async () => {
    window_(14);
    await press();
    const delays = fieldEls().map((field) => animationsOf(field)[0].options.delay);
    expect(delays.slice(9)).toEqual([100 + 9 * 60, 100 + 10 * 60, 100 + 11 * 60, 100 + 11 * 60, 100 + 11 * 60]);
  });

  it("does not animate the frame when it does not change height (taller than the screen: the body scrolls inside)", async () => {
    window_(0 + 3);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const height = this.getAttribute("role") === "dialog" ? 800 : 0;
      return { x: 0, y: 50, top: 50, left: 0, right: 560, bottom: 50 + height, width: 560, height, toJSON: () => ({}) } as DOMRect;
    });
    await press();
    expect(animationsOf(frame())).toHaveLength(0);
    // The fields still fall in.
    expect(fieldEls().every((field) => animationsOf(field).length === 1)).toBe(true);
  });

  it("keeps the body where it was scrolled to when the fields arrive", async () => {
    window_(3);
    const body = screen.getByTestId("modal-body");
    body.scrollTop = 120;
    await press();
    expect(body.scrollTop).toBe(120);
  });
});

describe("the section's motion: closing", () => {
  it("lifts the fields out, rising 8 and fading over 160, the last first and 40 apart; then closes the frame over BASE", async () => {
    window_(3);
    await press();
    await settleAll();
    played = [];
    await press();
    const lifts = fieldEls().map((field) => animationsOf(field)[0]);
    // The last field starts first.
    expect(lifts.map((entry) => entry.options.delay)).toEqual([2 * OPTIONAL_LIFT_STAGGER, OPTIONAL_LIFT_STAGGER, 0]);
    expect(lifts.every((entry) => entry.options.duration === OPTIONAL_LIFT && entry.options.fill === "both")).toBe(true);
    expect(lifts[0].keyframes).toEqual([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(-${LIFT_RISE}px)` }]);
    // The frame waits for the lift.
    expect(animationsOf(frame())).toHaveLength(0);
    expect(fieldEls()).toHaveLength(3);
    // Then both edges move in about the fixed centre, and the fields leave the layout.
    await settleAll();
    const shrink = animationsOf(frame());
    expect(shrink).toHaveLength(1);
    expect(shrink[0].options).toMatchObject({ duration: BASE, easing: STANDARD, fill: "forwards" });
    const half = (3 * PER_FIELD) / 2;
    expect(shrink[0].keyframes[1].clipPath).toMatch(new RegExp(`^inset\\(${half}px `));
    expect(animationsOf(screen.getByTestId("modal-footer"))[0].keyframes).toEqual([{ transform: "none" }, { transform: `translateY(${-half}px)` }]);
    await settleAll();
    expect(fieldEls()).toHaveLength(0);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes at once under reduced motion: no lift, no drop, the new size and centre arrive at once", async () => {
    reduced = true;
    __resetMotionMediaCache();
    window_(3);
    await press();
    expect(fieldEls()).toHaveLength(3);
    await press();
    expect(fieldEls()).toHaveLength(0);
    expect(played).toHaveLength(0);
  });
});

describe("the section's motion: pressing again mid-motion", () => {
  it("finishes the running opening at once, then starts the reverse", async () => {
    window_(3);
    await press();
    const running = played.filter((entry) => entry.state === "running");
    expect(running.length).toBeGreaterThan(0);
    await press();
    // Every animation that was running was finished (not left, not cancelled), and the lift of the reverse has begun.
    expect(running.every((entry) => entry.state === "finished")).toBe(true);
    const lifts = fieldEls().flatMap((field) => animationsOf(field).filter((entry) => entry.options.id === "bm:lift"));
    expect(lifts).toHaveLength(3);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("finishes a closing at once (the fields gone, the frame small), then opens", async () => {
    window_(3);
    await press();
    await settleAll();
    await press();
    expect(fieldEls()).toHaveLength(3);
    await press();
    // The closing was ended: its fields were taken away, and a new opening put three in.
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(fieldEls()).toHaveLength(3);
    const growth = animationsOf(frame()).filter((entry) => entry.state === "running");
    expect(growth).toHaveLength(1);
    expect(growth[0].keyframes[0].clipPath).toMatch(new RegExp(`^inset\\(${(3 * PER_FIELD) / 2}px `));
  });
});

describe("the section's motion: reduced motion", () => {
  it("opens at once: the fields are there, nothing moves", async () => {
    reduced = true;
    __resetMotionMediaCache();
    window_(3);
    await press();
    expect(fieldEls()).toHaveLength(3);
    expect(played).toHaveLength(0);
  });
});
