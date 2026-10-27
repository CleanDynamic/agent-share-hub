// CA-22 P6 - around the build: the selection bar, the notice, Details and Go to it.

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { BAR_RISE, CROSSFADE, DROP, DROP_FALL, GOTO_HOLD, GOTO_OUT, LIFT, LIFT_RISE } from "@/lib/build/buildMotion";
import { BASE, FAST, __resetMotionMediaCache } from "@/lib/theme/motion";

import { goToIt, useHeld } from "./buildMotion";
import { DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";
import { ReferenceNotice } from "./referencePieces";
import { SelectionBar, type SelectionBarProps } from "./removePieces";
import { passes, stubAnimations } from "./motionStub";

interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let played: Played[] = [];
let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  played = [];
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  ({ played } = stubAnimations());
});
afterEach(() => {
  cleanup();
  // The old words of a crossfade stand in the body until their fade ends; a test that stops first leaves them.
  document.querySelectorAll('[data-testid="crossfade-old"]').forEach((node) => node.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
  __resetMotionMediaCache();
});

const bar = (over: Partial<SelectionBarProps> = {}): SelectionBarProps => ({
  phone: false,
  count: 2,
  moveTo: { sessions: [], parts: [] },
  holds: { tiles: 2, sessions: 0 },
  onMoveToSession: vi.fn(),
  onMoveToPart: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  ...over,
});

describe("the selection bar", () => {
  it("rises 16 and fades in over BASE on the second pick; a further pick only crossfades the count", () => {
    const view = render(<SelectionBar {...bar()} />);
    const toolbar = document.querySelector('[data-testid="selection-bar"]');
    const rise = played.filter((entry) => entry.element === toolbar);
    expect(rise).toHaveLength(1);
    expect(rise[0].keyframes).toEqual([{ opacity: 0, transform: `translateY(${BAR_RISE}px)` }, { opacity: 1, transform: "none" }]);
    expect(rise[0].options.duration).toBe(BASE);
    view.rerender(<SelectionBar {...bar({ count: 3 })} />);
    expect(played.filter((entry) => entry.element === toolbar)).toHaveLength(1);
    expect(document.querySelector('[data-testid="crossfade-old"]')?.textContent).toBe("2 selected");
    expect(document.querySelector('[data-testid="selection-count"]')?.textContent).toBe("3 selected");
  });

  it("falls 16 and fades out over BASE when it leaves, and takes no clicks meanwhile", () => {
    const view = render(<SelectionBar {...bar()} />);
    view.rerender(<SelectionBar {...bar()} leaving />);
    const toolbar = document.querySelector('[data-testid="selection-bar"]') as HTMLElement;
    const fall = played.filter((entry) => entry.element === toolbar).at(-1);
    expect(fall?.keyframes).toEqual([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(${BAR_RISE}px)` }]);
    expect(fall?.options).toMatchObject({ duration: BASE, fill: "both" });
    expect(toolbar.style.pointerEvents).toBe("none");
  });

  it("is held for BASE after its data goes, then gone; at once under reduced motion", async () => {
    function Probe({ on }: { on: boolean }) {
      const held = useHeld(on ? { n: 2 } : null, BASE);
      return <p data-testid="probe">{held.value ? `${held.value.n}${held.leaving ? " leaving" : ""}` : "none"}</p>;
    }
    const view = render(<Probe on />);
    view.rerender(<Probe on={false} />);
    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe("2 leaving");
    await passes(BASE);
    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe("none");
    cleanup();
    reduced = true;
    __resetMotionMediaCache();
    const again = render(<Probe on />);
    again.rerender(<Probe on={false} />);
    expect(document.querySelector('[data-testid="probe"]')?.textContent).toBe("none");
  });
});

describe("the notice", () => {
  const notice = (n: number, sentence = "Removed Prompt 2") => ({ sentence, n });
  const box = () => document.querySelector('[data-testid="reference-notice"]');

  it("arrives as a drop (SV-07 P5), centred by its margins; a new notice crossfades its words in place and does not drop again", () => {
    const view = render(<ReferenceNotice notice={notice(1)} onUndo={() => undefined} onDone={() => undefined} />);
    const rises = () => played.filter((entry) => entry.element === box());
    expect(rises()).toHaveLength(1);
    expect(rises()[0].keyframes).toEqual([{ opacity: 0, transform: `translateY(-${DROP_FALL}px)` }, { opacity: 1, transform: "none" }]);
    expect(rises()[0].options.duration).toBe(DROP);
    view.rerender(<ReferenceNotice notice={notice(2, "Duplicated Prompt 2")} onUndo={() => undefined} onDone={() => undefined} />);
    expect(rises()).toHaveLength(1);
    expect(document.querySelector('[data-testid="crossfade-old"]')?.textContent).toBe("Removed Prompt 2");
    expect(box()?.textContent).toContain("Duplicated Prompt 2");
  });

  it("leaves as a lift, with no delay and quicker than it arrived, before it is gone (SV-07 P5)", async () => {
    const view = render(<ReferenceNotice notice={notice(1)} onUndo={() => undefined} onDone={() => undefined} />);
    view.rerender(<ReferenceNotice notice={null} onUndo={() => undefined} onDone={() => undefined} />);
    expect(box()).not.toBeNull();
    const lift = played.filter((entry) => entry.element === box()).at(-1);
    expect(lift?.keyframes[1]).toEqual({ opacity: 0, transform: `translateY(-${LIFT_RISE}px)` });
    expect(lift?.options).toMatchObject({ duration: LIFT, delay: 0 });
    expect(LIFT).toBeLessThan(DROP);
    await passes(LIFT);
    expect(box()).toBeNull();
  });
});

describe("Details", () => {
  const props = (view: DetailsPanelProps["view"]): DetailsPanelProps => ({
    phone: false,
    view,
    build: buildFacts,
    onRename: vi.fn(),
    onModel: vi.fn(),
    onAddUse: vi.fn(),
    onRemoveUse: vi.fn(),
    onRuns: vi.fn(),
    onRemoveInside: vi.fn(),
    onToggleSessionPrompt: vi.fn(),
    onDownload: vi.fn(),
    onFields: vi.fn(),
    onAddPicture: vi.fn(),
    onUseAsCover: vi.fn(),
    onSelect: vi.fn(),
    onEdit: vi.fn(),
  });
  const kindShown = () => document.querySelector('[data-testid="details-panel"]')?.getAttribute("data-kind");

  it("when the selection changes the old content fades out over FAST, then the new fades in over FAST; nothing slides", async () => {
    const view = render(<DetailsPanel {...props(tileView("prompt", "full"))} />);
    expect(played).toHaveLength(0);
    view.rerender(<DetailsPanel {...props(tileView("agent", "full"))} />);
    expect(kindShown()).toBe("prompt");
    const out = played.at(-1);
    expect(out?.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
    expect(out?.options.duration).toBe(FAST);
    await passes(FAST);
    expect(kindShown()).toBe("agent");
    const inn = played.at(-1);
    expect(inn?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(inn?.options.duration).toBe(FAST);
    expect(played.every((entry) => entry.keyframes.every((frame) => !("transform" in frame)))).toBe(true);
  });

  it("the empty line crossfades the same way", async () => {
    const view = render(<DetailsPanel {...props(null)} />);
    view.rerender(<DetailsPanel {...props(tileView("prompt", "full"))} />);
    expect(document.body.textContent).toContain("Select a tile or session to see it here.");
    await passes(FAST);
    expect(kindShown()).toBe("prompt");
  });

  it("under reduced motion the new content is simply there", async () => {
    reduced = true;
    __resetMotionMediaCache();
    const view = render(<DetailsPanel {...props(tileView("prompt", "full"))} />);
    view.rerender(<DetailsPanel {...props(tileView("agent", "full"))} />);
    expect(kindShown()).toBe("agent");
    expect(played).toHaveLength(0);
  });
});

describe("Go to it", () => {
  const target = (top: number) => {
    const el = document.body.appendChild(document.createElement("div"));
    el.getBoundingClientRect = () => ({ top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) });
    return el;
  };

  it("an off-screen component is scrolled to the middle by the browser's smooth scroll, then outlined once in the link's colour: 800 hold, 600 out", async () => {
    const scrolls: ScrollToOptions[] = [];
    window.scrollTo = ((options: ScrollToOptions) => void scrolls.push(options)) as never;
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => window.setTimeout(() => run(performance.now()), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const el = target(2000);
    const run = goToIt(el, "#7FA7D9");
    expect(played).toHaveLength(0);
    // SV-06 P7: one smooth scroll, and the ring once the page is still.
    expect(scrolls).toEqual([{ top: 2000 - (800 - 100) / 2, behavior: "smooth" }]);
    await vi.advanceTimersByTimeAsync(100);
    const ring = played.at(-1)?.element as HTMLElement;
    expect(ring.getAttribute("data-testid")).toBe("outline-once");
    expect(ring.style.borderColor).toBe("#7fa7d9");
    expect(ring.style.borderWidth).toBe("1.5px");
    expect(played.at(-1)?.options.duration).toBe(150 + GOTO_HOLD + GOTO_OUT);
    run.cancel();
  });

  it("a component already on screen is not scrolled; the ring comes at once", async () => {
    const scrolls: number[] = [];
    window.scrollTo = ((_x: number, y: number) => void scrolls.push(y)) as never;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const el = target(100);
    goToIt(el);
    expect(scrolls).toHaveLength(0);
    expect(el.querySelector('[data-testid="outline-once"]')).not.toBeNull();
  });

  it("under reduced motion it jumps and the ring shows without a fade", async () => {
    reduced = true;
    __resetMotionMediaCache();
    const scrolls: number[] = [];
    window.scrollTo = ((_x: number, y: number) => void scrolls.push(y)) as never;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    const el = target(2000);
    goToIt(el, "#7FA7D9");
    await vi.advanceTimersByTimeAsync(0);
    expect(scrolls).toHaveLength(1);
    expect(played).toHaveLength(0);
    expect(el.querySelector('[data-testid="outline-once"]')).not.toBeNull();
  });
});

// The crossfade is a fixed layer in the body; CROSSFADE is the same FAST as everything else that is feedback.
it("crossfades take FAST", () => expect(CROSSFADE).toBe(FAST));
