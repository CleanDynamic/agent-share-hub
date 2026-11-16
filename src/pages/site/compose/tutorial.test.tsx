// The build editor's tutorial: when it is offered, how its challenges are played, and that it can be left at any step.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "maker-1" } as { id: string } | null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { TutorialWindow } from "./TutorialWindow";
import { SCENE_LOOP_MS, between, enter, leave, path, playScene, press, shift } from "./tutorialScenes";
import { IDLE_HINT_MS, TUTORIAL_COPY, TUTORIAL_STEPS, clampStep, runTime } from "./tutorialSteps";
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

describe("the challenges, in words", () => {
  it("gives every step one to three goals, each with what it asks and a hint", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.task.goals.length).toBeGreaterThanOrEqual(1);
      expect(step.task.goals.length).toBeLessThanOrEqual(3);
      expect(new Set(step.task.goals.map((goal) => goal.id)).size).toBe(step.task.goals.length);
      for (const goal of step.task.goals) {
        expect(goal.ask.length).toBeGreaterThan(0);
        expect(goal.hint.length).toBeGreaterThan(0);
      }
      expect(step.task.done.length).toBeGreaterThan(0);
    }
  });

  it("writes a run's time as minutes and seconds", () => {
    expect(runTime(0)).toBe("0:00");
    expect(runTime(9_400)).toBe("0:09");
    expect(runTime(75_000)).toBe("1:15");
    expect(runTime(-5)).toBe("0:00");
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
  const main = () => screen.getByTestId("tutorial-next");
  const next = () => fireEvent.click(main());
  const press = (id: string) => fireEvent.click(screen.getByTestId("tutorial-task").querySelector(`[data-target="${id}"]`) as HTMLElement);
  const ask = () => screen.getByTestId("tutorial-ask").textContent;
  const progress = () => screen.getByTestId("tutorial-progress").textContent;
  const stage = () => screen.getByTestId("tutorial-task");
  /** Clear the step showing: press each goal's target in order. */
  const clear = (index: number) => {
    for (const goal of TUTORIAL_STEPS[index].task.goals) press(goal.id);
  };

  it("opens on step 1, asking for its first goal, with nothing done", () => {
    open();
    expect(screen.getByRole("dialog", { name: TUTORIAL_STEPS[0].title })).toBeTruthy();
    expect(screen.getByTestId("tutorial-count").textContent).toBe("Tutorial · Step 1 of 5");
    expect(stage().getAttribute("data-scene")).toBe("layout");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.goals[0].ask);
    expect(progress()).toBe("0 of 5 done");
    expect(main().textContent).toBe(TUTORIAL_COPY.skipStep);
    expect(document.activeElement).toBe(main());
    expect(screen.queryByTestId("tutorial-back")).toBeNull();
  });

  it("clears a goal on the right press and asks for the next", () => {
    open();
    press("sources");
    expect(stage().getAttribute("data-done")).toBe("1");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.goals[1].ask);
    expect(progress()).toBe("0 of 5 done");
  });

  it("answers a wrong press with a hint and a pointer, and loses nothing", () => {
    open();
    press("sources");
    press("details");
    expect(stage().getAttribute("data-done")).toBe("1");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[0].task.goals[1].hint);
    expect(screen.getByTestId("tutorial-hint-ring")).toBeTruthy();
    press("build");
    expect(screen.queryByTestId("tutorial-hint")).toBeNull();
    expect(screen.queryByTestId("tutorial-hint-ring")).toBeNull();
  });

  it("says why, where a wrong press teaches something", () => {
    open();
    for (let index = 0; index < 4; index++) next();
    press("publish");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[4].task.wrong?.publish);
    expect(stage().getAttribute("data-done")).toBe("0");
  });

  it("points at the target by itself after a long pause", () => {
    vi.useFakeTimers();
    open();
    expect(screen.queryByTestId("tutorial-hint-ring")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(IDLE_HINT_MS);
    });
    expect(screen.getByTestId("tutorial-hint-ring")).toBeTruthy();
    expect(screen.queryByTestId("tutorial-hint")).toBeNull();
  });

  it("clears the step on its last goal: the bar fills, the count goes up and the main button becomes Next", () => {
    open();
    clear(0);
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.done);
    expect(progress()).toBe("1 of 5 done");
    expect(screen.getByTestId("tutorial-bars").querySelectorAll('[data-cleared="true"]')).toHaveLength(1);
    expect(main().textContent).toBe(TUTORIAL_COPY.next);
    expect(main().getAttribute("data-variant")).toBe("primary");
    expect(document.activeElement).toBe(main());
  });

  it("can be played through, every step in order, to a clean run", () => {
    open();
    for (const [index, entry] of TUTORIAL_STEPS.entries()) {
      expect(step()).toBe(String(index + 1));
      expect(screen.getByTestId("tutorial-title").textContent).toBe(entry.title);
      expect(stage().getAttribute("data-scene")).toBe(entry.scene);
      for (const point of entry.points) expect(within(screen.getByTestId("tutorial-points")).getByText(point.lead)).toBeTruthy();
      clear(index);
      expect(progress()).toBe(`${index + 1} of 5 done`);
      if (index === TUTORIAL_STEPS.length - 1) expect(main().textContent).toBe(TUTORIAL_COPY.finish);
      next();
    }
    expect(step()).toBe("complete");
    expect(screen.getByTestId("tutorial-title").textContent).toBe("All five challenges done");
    expect(screen.getByTestId("tutorial-stat-challenges").textContent).toBe("5 of 5");
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe(TUTORIAL_COPY.complete.none);
    expect(screen.getByTestId("tutorial-stat-time").textContent).toMatch(/^\d+:\d\d$/);
    expect(screen.getByTestId("tutorial-clean")).toBeTruthy();
    expect(screen.getByText(TUTORIAL_COPY.reopen)).toBeTruthy();
    expect(main().textContent).toBe(TUTORIAL_COPY.done);
    next();
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("counts hints, and a run with any is not a clean one", () => {
    open();
    press("build");
    for (const index of TUTORIAL_STEPS.keys()) {
      clear(index);
      next();
    }
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe("1");
    expect(screen.queryByTestId("tutorial-clean")).toBeNull();
  });

  it("never holds anyone behind a challenge: a step can be skipped, and the summary says how many were done", () => {
    open();
    clear(0);
    next();
    for (let index = 1; index < 5; index++) {
      expect(main().textContent).toBe(TUTORIAL_COPY.skipStep);
      next();
    }
    expect(step()).toBe("complete");
    expect(screen.getByTestId("tutorial-title").textContent).toBe("1 of 5 challenges done");
    expect(screen.queryByTestId("tutorial-clean")).toBeNull();
  });

  it("closes from the last step with nothing done, with no summary to show", () => {
    open();
    for (let index = 0; index < 5; index++) next();
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("Show me plays the step as an example, Try it comes back, and watching counts as a hint", () => {
    open();
    fireEvent.click(screen.getByTestId("tutorial-watch"));
    expect(screen.queryByTestId("tutorial-task")).toBeNull();
    expect(screen.getByTestId("tutorial-example").getAttribute("data-scene")).toBe("layout");
    expect(ask()).toBe(TUTORIAL_COPY.watching);
    fireEvent.click(screen.getByTestId("tutorial-watch"));
    expect(stage().getAttribute("data-done")).toBe("0");
    for (const index of TUTORIAL_STEPS.keys()) {
      clear(index);
      next();
    }
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe("1");
  });

  it("keeps a cleared step cleared when it is come back to, and Again plays it once more", () => {
    open();
    clear(0);
    next();
    fireEvent.click(screen.getByTestId("tutorial-back"));
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(main().textContent).toBe(TUTORIAL_COPY.next);
    fireEvent.click(screen.getByTestId("tutorial-again"));
    expect(stage().getAttribute("data-done")).toBe("0");
    expect(progress()).toBe("1 of 5 done");
  });

  it("the Tool step can be moved by its button as well as by dragging", () => {
    open();
    for (let index = 0; index < 3; index++) next();
    press("add");
    press("file");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[3].task.wrong?.file);
    press("tool");
    expect(screen.getByTestId("tutorial-drag")).toBeTruthy();
    press("move");
    expect(stage().getAttribute("data-cleared")).toBe("true");
  });

  it("the Tool step can be dragged above step 2, and a short pull puts it back", () => {
    open();
    for (let index = 0; index < 3; index++) next();
    press("add");
    press("tool");
    const tile = screen.getByTestId("tutorial-drag");
    // jsdom has no PointerEvent, so a pointer event made by the library carries no place: a mouse event of the same name does.
    const pointer = (type: string, clientY: number) => act(() => void tile.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY })));
    pointer("pointerdown", 200);
    pointer("pointermove", 192);
    pointer("pointerup", 192);
    expect(stage().getAttribute("data-done")).toBe("2");
    pointer("pointerdown", 200);
    pointer("pointermove", 165);
    pointer("pointerup", 165);
    expect(stage().getAttribute("data-cleared")).toBe("true");
  });

  it("every target is a named button", () => {
    open();
    for (const [index, entry] of TUTORIAL_STEPS.entries()) {
      for (const goal of entry.task.goals) {
        const target = stage().querySelector(`[data-target="${goal.id}"]`);
        expect(target?.tagName).toBe("BUTTON");
        expect(target?.getAttribute("aria-label")).toBeTruthy();
        press(goal.id);
      }
      if (index < TUTORIAL_STEPS.length - 1) next();
    }
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

  it.each([0, 1, 2, 3, 4])("can be skipped after %i steps, and is then seen", (steps) => {
    open();
    for (let index = 0; index < steps; index++) next();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(isTutorialOpen()).toBe(false);
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it.each([0, 2, 4])("can be closed from the corner after %i steps", (steps) => {
    open();
    for (let index = 0; index < steps; index++) next();
    fireEvent.click(screen.getByRole("button", { name: TUTORIAL_COPY.close }));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("closes on Escape, in the middle of a challenge", () => {
    open();
    next();
    press("picture");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("starts at step 1 again, with nothing done, each time it is opened", () => {
    open();
    clear(0);
    next();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    act(() => openTutorial());
    expect(step()).toBe("1");
    expect(progress()).toBe("0 of 5 done");
  });

  it("closes when the page under it goes away", () => {
    const view = render(<Host />);
    act(() => openTutorial());
    view.unmount();
    expect(isTutorialOpen()).toBe(false);
  });
});
