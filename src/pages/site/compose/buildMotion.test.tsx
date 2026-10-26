// CA-22 P1 - the five helpers, with fake timers and recorded animations: the order of calls, cancelling, reduced motion.

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BASE, FAST } from "@/lib/theme/motion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";
import { DROP, DROP_FALL, LIFT, LIFT_RISE, OUTLINE_HOLD, OUTLINE_IN, OUTLINE_OUT, SLIDE, STAGGER, STAGGER_CAP, CROSSFADE } from "@/lib/build/buildMotion";

import { crossfade, useCrossfade, dropIn, liftOut, liftSpan, outlineOnce, slideOut, staggerDelay, useLeaving } from "./buildMotion";

interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finished: boolean;
  cancelled: boolean;
}
let played: Played[] = [];
let reduced = false;

const LAYOUT = /^(width|height|top|left|right|bottom|margin|padding|inset|boxShadow|box-shadow)/;

beforeEach(() => {
  reduced = false;
  played = [];
  window.matchMedia = ((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  __resetMotionMediaCache();
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const entry: Played = { element: this, keyframes, options, finished: false, cancelled: false };
    played.push(entry);
    return {
      id: options.id ?? "",
      finished: Promise.resolve(),
      finish: () => {
        entry.finished = true;
      },
      cancel: () => {
        entry.cancelled = true;
      },
    } as unknown as Animation;
  }) as never;
  Element.prototype.getAnimations = function (this: Element) {
    return played
      .filter((entry) => entry.element === this && !entry.finished && !entry.cancelled)
      .map((entry) => ({ id: entry.options.id ?? "", playState: "running", finish: () => (entry.finished = true), cancel: () => (entry.cancelled = true) }) as unknown as Animation);
  } as never;
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (Element.prototype as { animate?: unknown }).animate;
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  __resetMotionMediaCache();
});

const div = () => document.body.appendChild(document.createElement("div"));
const only = (keyframes: Keyframe[]) => [...new Set(keyframes.flatMap((frame) => Object.keys(frame)))].filter((key) => key !== "offset" && key !== "easing");

describe("the timings", () => {
  it("names the figures the boards give, and leaves motion.ts its three durations", () => {
    expect([SLIDE, LIFT, LIFT_RISE, DROP, DROP_FALL, STAGGER, STAGGER_CAP, CROSSFADE, OUTLINE_IN, OUTLINE_HOLD, OUTLINE_OUT]).toEqual([FAST, BASE, 8, 240, 20, 60, 12, FAST, 150, 500, 300]);
  });

  it("staggers 60 apart and sends everything past the 12th with the 12th", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBe(60);
    expect(staggerDelay(11)).toBe(660);
    expect(staggerDelay(12)).toBe(660);
    expect(staggerDelay(40)).toBe(660);
    expect(liftSpan(40)).toBe(660 + LIFT);
    expect(liftSpan(0)).toBe(0);
  });
});

describe("dropIn", () => {
  it("falls 20 from above, fading in, over 240, in the order given and 60 apart", () => {
    const items = [div(), div(), div()];
    dropIn(items, { stagger: STAGGER });
    expect(played.map((entry) => entry.element)).toEqual(items);
    expect(played[0].keyframes).toEqual([{ opacity: 0, transform: "translateY(-20px)" }, { opacity: 1, transform: "none" }]);
    expect(played.map((entry) => entry.options.delay)).toEqual([0, 60, 120]);
    expect(played.every((entry) => entry.options.duration === DROP && entry.options.fill === "backwards")).toBe(true);
  });

  it("caps the stagger: the 13th and the rest go with the 12th", () => {
    dropIn(Array.from({ length: 15 }, div), { stagger: STAGGER });
    expect(played.map((entry) => entry.options.delay).slice(10)).toEqual([600, 660, 660, 660, 660]);
  });

  it("animates opacity and transform and nothing else", () => {
    dropIn([div()]);
    expect(only(played[0].keyframes).sort()).toEqual(["opacity", "transform"]);
  });

  it("can be cancelled part-way", () => {
    const run = dropIn([div(), div()], { stagger: 60 });
    run.cancel();
    expect(played.every((entry) => entry.cancelled)).toBe(true);
  });

  it("SV-06: a change mid-animation carries on from the running one: it is let go in the same call, never finished at once", () => {
    const item = div();
    dropIn([item]);
    dropIn([item]);
    expect(played).toHaveLength(2);
    expect(played[0].finished).toBe(false);
    expect(played[0].cancelled).toBe(true);
    expect(played[1].cancelled).toBe(false);
  });

  it("under reduced motion nothing moves: no animation, and it is already finished", async () => {
    reduced = true;
    __resetMotionMediaCache();
    const run = dropIn([div(), div()], { stagger: 60 });
    expect(played).toHaveLength(0);
    await expect(run.finished).resolves.toBeUndefined();
  });
});

describe("liftOut", () => {
  it("fades out and rises 8 over 200, and stays that way until it is taken away", () => {
    liftOut([div()]);
    expect(played[0].keyframes).toEqual([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }]);
    expect(played[0].options).toMatchObject({ duration: LIFT, fill: "both" });
  });

  it("does nothing under reduced motion", () => {
    reduced = true;
    __resetMotionMediaCache();
    liftOut([div()]);
    expect(played).toHaveLength(0);
  });
});

describe("slideOut", () => {
  it("starts at the place it comes out of, see-through, and moves to where it is", () => {
    const item = div();
    item.getBoundingClientRect = () => ({ left: 10, top: 110, width: 200, height: 50, right: 210, bottom: 160, x: 10, y: 110, toJSON: () => ({}) });
    slideOut(item, { x: 10, y: 10, w: 200, h: 50 });
    expect(played[0].keyframes[0]).toMatchObject({ opacity: 0, transform: "translate(0px, -100px) scale(1, 1)" });
    expect(played[0].keyframes[1]).toMatchObject({ opacity: 1, transform: "none" });
    expect(played[0].options.duration).toBe(DROP);
  });
});

describe("useLeaving", () => {
  type Item = { id: string };
  function List({ items, ...rest }: { items: Item[]; stagger?: number; reverse?: boolean; lifts?: (keys: readonly string[]) => boolean }) {
    const { items: shown, leaving } = useLeaving(items, (item) => item.id, { find: (key) => document.querySelector<HTMLElement>(`[data-key="${key}"]`), ...rest });
    return (
      <>
        {shown.map((item) => (
          <p key={item.id} data-key={item.id} data-leaving={leaving.has(item.id) || undefined}>
            {item.id}
          </p>
        ))}
      </>
    );
  }
  const ids = () => [...document.querySelectorAll("p")].map((p) => p.textContent);

  it("keeps the removed element mounted, in place, for LIFT, lifting; then removes it", () => {
    const view = render(<List items={[{ id: "a" }, { id: "b" }, { id: "c" }]} />);
    view.rerender(<List items={[{ id: "a" }, { id: "c" }]} />);
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(document.querySelector('[data-key="b"]')?.getAttribute("data-leaving")).toBe("true");
    expect(played).toHaveLength(1);
    expect(played[0].element).toBe(document.querySelector('[data-key="b"]'));
    expect(played[0].options.duration).toBe(LIFT);
    act(() => vi.advanceTimersByTime(LIFT - 1));
    expect(ids()).toEqual(["a", "b", "c"]);
    act(() => vi.advanceTimersByTime(1));
    expect(ids()).toEqual(["a", "c"]);
  });

  it("lifts from the last to the first, 60 apart, when asked, and lets go once the last has lifted", () => {
    const view = render(<List items={[{ id: "a" }, { id: "b" }, { id: "c" }]} stagger={STAGGER} reverse />);
    view.rerender(<List items={[]} stagger={STAGGER} reverse />);
    expect(played.map((entry) => entry.element.getAttribute("data-key"))).toEqual(["c", "b", "a"]);
    expect(played.map((entry) => entry.options.delay)).toEqual([0, 60, 120]);
    act(() => vi.advanceTimersByTime(120 + LIFT - 1));
    expect(ids()).toHaveLength(3);
    act(() => vi.advanceTimersByTime(1));
    expect(ids()).toHaveLength(0);
  });

  it("does nothing when nothing asks for a lift, and under reduced motion removes at once", () => {
    // SV-06: nothing asked for a lift (no label for these keys): they go before they are painted.
    const off = render(<List items={[{ id: "a" }, { id: "b" }]} lifts={() => false} />);
    off.rerender(<List items={[{ id: "a" }]} lifts={() => false} />);
    expect(ids()).toEqual(["a"]);
    cleanup();
    reduced = true;
    __resetMotionMediaCache();
    const view = render(<List items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<List items={[{ id: "a" }]} />);
    expect(ids()).toEqual(["a"]);
    expect(played).toHaveLength(0);
  });

  it("an item that comes back while it is leaving is simply there again", () => {
    const view = render(<List items={[{ id: "a" }, { id: "b" }]} />);
    view.rerender(<List items={[{ id: "a" }]} />);
    view.rerender(<List items={[{ id: "a" }, { id: "b" }]} />);
    act(() => vi.advanceTimersByTime(LIFT * 2));
    expect(ids()).toEqual(["a", "b"]);
  });

  it("does not lift a first load", () => {
    render(<List items={[{ id: "a" }]} />);
    expect(played).toHaveLength(0);
  });
});

describe("outlineOnce", () => {
  it("is a separate ring: in 150, hold 500, out 300, and only its opacity changes", () => {
    const host = div();
    const run = outlineOnce(host);
    const ring = host.querySelector('[data-testid="outline-once"]') as HTMLElement;
    expect(ring).not.toBeNull();
    expect(ring.style.left).toBe("-4px");
    expect(ring.style.borderWidth).toBe("1.5px");
    expect(only(played[0].keyframes)).toEqual(["opacity"]);
    expect(played[0].options.duration).toBe(OUTLINE_IN + OUTLINE_HOLD + OUTLINE_OUT);
    const stops = played[0].keyframes.map((frame) => [frame.offset, frame.opacity]);
    expect(stops).toEqual([[0, 0], [150 / 950, 1], [650 / 950, 1], [1, 0]]);
    run.finish();
  });

  it("takes the colour it is given, and the link's longer hold", () => {
    const host = div();
    outlineOnce(host, "#7FA7D9", { hold: 800, out: 600 });
    expect((host.querySelector('[data-testid="outline-once"]') as HTMLElement).style.borderColor).toBe("#7fa7d9");
    expect(played[0].options.duration).toBe(150 + 800 + 600);
  });

  it("removes itself when it ends", async () => {
    const host = div();
    const run = outlineOnce(host);
    await run.finished;
    expect(host.querySelector('[data-testid="outline-once"]')).toBeNull();
  });

  it("under reduced motion shows for the hold and goes, with no fade", () => {
    reduced = true;
    __resetMotionMediaCache();
    const host = div();
    outlineOnce(host);
    expect(played).toHaveLength(0);
    expect((host.querySelector('[data-testid="outline-once"]') as HTMLElement).style.opacity).toBe("1");
    act(() => vi.advanceTimersByTime(OUTLINE_HOLD));
    expect(host.querySelector('[data-testid="outline-once"]')).toBeNull();
  });
});

describe("crossfade", () => {
  it("lays the old words over the new and fades them past each other over 150, then removes the old", async () => {
    const host = div();
    host.textContent = "Prompt";
    crossfade(host, () => (host.textContent = "Agent"));
    expect(host.textContent).toBe("Agent");
    const ghost = document.querySelector('[data-testid="crossfade-old"]') as HTMLElement;
    expect(ghost.textContent).toBe("Prompt");
    expect(played.map((entry) => only(entry.keyframes)).every((keys) => keys.length === 1 && keys[0] === "opacity")).toBe(true);
    expect(played.every((entry) => entry.options.duration === CROSSFADE)).toBe(true);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="crossfade-old"]')).toBeNull());
  });

  it("changes the words at once and animates nothing under reduced motion", () => {
    reduced = true;
    __resetMotionMediaCache();
    const host = div();
    crossfade(host, () => (host.textContent = "Agent"));
    expect(host.textContent).toBe("Agent");
    expect(played).toHaveLength(0);
  });

  it("useCrossfade adds nothing to the page; when the value changes the old words are a separate layer, then gone", () => {
    function Count({ n }: { n: number }) {
      const ref = useCrossfade<HTMLSpanElement>(n);
      return <span ref={ref}>{n} selected</span>;
    }
    const view = render(<Count n={2} />);
    expect(view.container.innerHTML).toBe("<span>2 selected</span>");
    view.rerender(<Count n={3} />);
    expect(view.container.textContent).toBe("3 selected");
    expect(document.querySelector('[data-testid="crossfade-old"]')?.textContent).toBe("2 selected");
    expect(played.map((entry) => entry.keyframes.map((frame) => frame.opacity))).toEqual([[1, 0], [0, 1]]);
    return vi.waitFor(() => expect(document.querySelector('[data-testid="crossfade-old"]')).toBeNull());
  });
});
