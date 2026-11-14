// The build editor's tutorial: when it is offered, how it is stepped through, and that it can be left at any step.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "maker-1" } as { id: string } | null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { TutorialWindow } from "./TutorialWindow";
import { SCENE_LOOP_MS, between, enter, leave, path, playScene, press, shift } from "./tutorialScenes";
import { TUTORIAL_COPY, TUTORIAL_STEPS, clampStep } from "./tutorialSteps";
import {
  TUTORIAL_SETTLE_MS,
  closeTutorial,
  hasSeenTutorial,
  isTutorialOpen,
  markTutorialSeen,
  offerTutorial,
  openTutorial,
  shouldOfferTutorial,
  tutorialSeenKey,
  useTutorialOpen,
} from "./tutorialStore";

const MAKER = "maker-1";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  closeTutorial(MAKER);
  window.localStorage.clear();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("who is offered the tutorial", () => {
  it("offers it to a maker who has not seen it, and to nobody else", () => {
    expect(shouldOfferTutorial({ seen: false, automated: false })).toBe(true);
    expect(shouldOfferTutorial({ seen: true, automated: false })).toBe(false);
    expect(shouldOfferTutorial({ seen: false, automated: true })).toBe(false);
  });

  it("remembers each maker apart, on this device", () => {
    expect(tutorialSeenKey("a")).not.toBe(tutorialSeenKey("b"));
    expect(hasSeenTutorial("a")).toBe(false);
    markTutorialSeen("a");
    expect(hasSeenTutorial("a")).toBe(true);
    expect(hasSeenTutorial("b")).toBe(false);
  });

  it("counts storage that cannot be read as seen, so it is not shown on every visit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("does not throw when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => markTutorialSeen(MAKER)).not.toThrow();
  });
});

describe("the first visit", () => {
  const settle = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(TUTORIAL_SETTLE_MS);
    });
  };

  it("opens once the editor's code is in and the page has settled", async () => {
    vi.useFakeTimers();
    offerTutorial(MAKER, Promise.resolve());
    expect(isTutorialOpen()).toBe(false);
    await settle();
    expect(isTutorialOpen()).toBe(true);
  });

  it("does not open for a maker who has seen it", async () => {
    vi.useFakeTimers();
    markTutorialSeen(MAKER);
    offerTutorial(MAKER, Promise.resolve());
    await settle();
    expect(isTutorialOpen()).toBe(false);
  });

  it("does not open in an automated browser", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    try {
      offerTutorial(MAKER, Promise.resolve());
      await settle();
      expect(isTutorialOpen()).toBe(false);
    } finally {
      Reflect.deleteProperty(navigator, "webdriver");
    }
  });

  it("does not open over another window, and stays unseen for the next visit", async () => {
    vi.useFakeTimers();
    const other = document.createElement("div");
    other.setAttribute("role", "dialog");
    document.body.append(other);
    offerTutorial(MAKER, Promise.resolve());
    await settle();
    other.remove();
    expect(isTutorialOpen()).toBe(false);
    expect(hasSeenTutorial(MAKER)).toBe(false);
  });

  it("does not open once the visit has left", async () => {
    vi.useFakeTimers();
    const stop = offerTutorial(MAKER, Promise.resolve());
    stop();
    await settle();
    expect(isTutorialOpen()).toBe(false);
  });

  it("is seen once it is closed, and not before", () => {
    openTutorial();
    expect(hasSeenTutorial(MAKER)).toBe(false);
    closeTutorial(MAKER);
    expect(isTutorialOpen()).toBe(false);
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });
});

describe("the words", () => {
  it("is five steps, each a title, a sentence and three points", () => {
    expect(TUTORIAL_STEPS).toHaveLength(5);
    expect(new Set(TUTORIAL_STEPS.map((step) => step.scene)).size).toBe(5);
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.points).toHaveLength(3);
    }
  });

  it("never steps past either end", () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(99)).toBe(TUTORIAL_STEPS.length - 1);
  });
});

describe("the examples' timelines", () => {
  const ordered = (frames: { offset: number }[]) => frames.every((frame, index) => index === 0 || frame.offset >= frames[index - 1].offset);
  const inLoop = (frames: { offset: number }[]) => frames[0].offset === 0 && frames.at(-1)?.offset === 1;

  it("run from the start of the loop to its end, in order", () => {
    const all = [enter(0.3), leave(0.4), between(0.2, 0.6), shift(0.4, 0.5, "translateY(-44px)"), press(0.9), path([[0, 0, 0], [0.5, 10, 10], [1, 0, 0]])];
    for (const frames of all) {
      expect(ordered(frames)).toBe(true);
      expect(inLoop(frames)).toBe(true);
    }
  });

  it("change opacity and transform, and nothing else", () => {
    for (const frame of [...enter(0.3), ...leave(0.4), ...between(0.2, 0.6), ...press(0.5)]) {
      expect(Object.keys(frame).every((key) => ["offset", "opacity", "transform", "easing"].includes(key))).toBe(true);
    }
  });

  it("play every piece together, on one loop", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div data-tl='${JSON.stringify(enter(0.2))}'></div><div data-tl='${JSON.stringify(leave(0.5))}'></div><div data-tl='not json'></div>`;
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
    for (const el of root.querySelectorAll<HTMLElement>("[data-tl]")) el.animate = animate;
    expect(playScene(root)).toHaveLength(2);
    expect(animate).toHaveBeenCalledWith(expect.any(Array), { duration: SCENE_LOOP_MS, iterations: Infinity });
  });
});

describe("the window", () => {
  function Host() {
    return <TutorialWindow open={useTutorialOpen()} />;
  }
  const open = () => {
    render(<Host />);
    act(() => openTutorial());
  };
  const step = () => screen.getByTestId("tutorial-window").getAttribute("data-step");
  const next = () => fireEvent.click(screen.getByTestId("tutorial-next"));

  it("opens on step 1, with its example beside the words", () => {
    open();
    expect(screen.getByRole("dialog", { name: TUTORIAL_STEPS[0].title })).toBeTruthy();
    expect(screen.getByTestId("tutorial-count").textContent).toBe("Tutorial · Step 1 of 5");
    expect(screen.getByTestId("tutorial-example").getAttribute("data-scene")).toBe("layout");
    expect(screen.queryByTestId("tutorial-back")).toBeNull();
  });

  it("steps forward and back through all five, and ends on Start building", () => {
    open();
    for (const [index, entry] of TUTORIAL_STEPS.entries()) {
      expect(step()).toBe(String(index + 1));
      expect(screen.getByTestId("tutorial-title").textContent).toBe(entry.title);
      expect(screen.getByTestId("tutorial-example").getAttribute("data-scene")).toBe(entry.scene);
      for (const point of entry.points) expect(within(screen.getByTestId("tutorial-points")).getByText(point.lead)).toBeTruthy();
      if (index < TUTORIAL_STEPS.length - 1) next();
    }
    expect(screen.getByTestId("tutorial-next").textContent).toBe(TUTORIAL_COPY.done);
    expect(screen.queryByTestId("tutorial-skip")).toBeNull();
    expect(screen.getByText(TUTORIAL_COPY.again)).toBeTruthy();
    fireEvent.click(screen.getByTestId("tutorial-back"));
    expect(step()).toBe("4");
  });

  it("steps with the Left and Right keys", () => {
    open();
    const win = screen.getByTestId("tutorial-window");
    fireEvent.keyDown(win, { key: "ArrowRight" });
    fireEvent.keyDown(win, { key: "ArrowRight" });
    expect(step()).toBe("3");
    fireEvent.keyDown(win, { key: "ArrowLeft" });
    expect(step()).toBe("2");
    fireEvent.keyDown(win, { key: "ArrowLeft" });
    fireEvent.keyDown(win, { key: "ArrowLeft" });
    expect(step()).toBe("1");
  });

  it.each([0, 1, 2, 3])("can be skipped at step %i, and is then seen", (steps) => {
    open();
    for (let index = 0; index < steps; index++) next();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(isTutorialOpen()).toBe(false);
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it.each([0, 2, 4])("can be closed from the corner at step %i", (steps) => {
    open();
    for (let index = 0; index < steps; index++) next();
    fireEvent.click(screen.getByRole("button", { name: TUTORIAL_COPY.close }));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("closes on Escape, part of the way through", () => {
    open();
    next();
    next();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("closes from the last step's button", () => {
    open();
    for (let index = 0; index < 4; index++) next();
    next();
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("starts at step 1 again each time it is opened", () => {
    open();
    next();
    next();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    act(() => openTutorial());
    expect(step()).toBe("1");
  });

  it("closes when the page under it goes away", () => {
    const view = render(<Host />);
    act(() => openTutorial());
    view.unmount();
    expect(isTutorialOpen()).toBe(false);
  });
});
