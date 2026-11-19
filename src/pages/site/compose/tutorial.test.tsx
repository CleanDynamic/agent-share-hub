// The build editor's tutorial: when it is offered, how its eight chapters are played, and that it can be left at any step.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "maker-1" } as { id: string } | null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { TutorialWindow } from "./TutorialWindow";
import { IDLE_HINT_MS, TUTORIAL_COPY, TUTORIAL_STAGES, TUTORIAL_STEPS, buildCount, builtAt, clampStep, outlineOf, runTime, stageOf } from "./tutorialSteps";
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
  it("is eight chapters, each a title, a sentence and three points, in four stages", () => {
    expect(TUTORIAL_STEPS).toHaveLength(8);
    expect(new Set(TUTORIAL_STEPS.map((step) => step.scene)).size).toBe(8);
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.points).toHaveLength(3);
    }
    expect(TUTORIAL_STAGES.map((stage) => stage.name)).toEqual(["Foundations", "Structure", "Agents", "Sharing"]);
    expect(TUTORIAL_STAGES.flatMap((stage) => stage.chapters)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(stageOf(5).name).toBe("Agents");
  });

  it("never steps past either end", () => {
    expect(clampStep(-1)).toBe(0);
    expect(clampStep(99)).toBe(TUTORIAL_STEPS.length - 1);
  });
});

describe("the build, chapter by chapter", () => {
  it("starts empty and grows to two sessions and seven steps", () => {
    expect(buildCount(builtAt(0, 0))).toBeNull();
    expect(buildCount(builtAt(0, 2))).toBe("1 session · 2 steps");
    expect(buildCount(builtAt(1, 2))).toBe("1 session · 3 steps");
    expect(buildCount(builtAt(2, 2))).toBe("2 sessions · 5 steps");
    expect(buildCount(builtAt(4, 3))).toBe("2 sessions · 6 steps");
    expect(buildCount(builtAt(7, 0))).toBe("2 sessions · 7 steps");
  });

  it("counts the steps straight down, across sessions", () => {
    const numbers = outlineOf(builtAt(7, 0))
      .filter((row) => row.kind === "step")
      .map((row) => row.number);
    expect(numbers).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    const tool = outlineOf(builtAt(1, 3)).find((row) => row.key === "tool");
    expect(tool?.number).toBe("2");
  });
});

describe("the challenges, in words", () => {
  it("gives every chapter one to four goals, each with what it asks and a hint", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.task.goals.length).toBeGreaterThanOrEqual(1);
      expect(step.task.goals.length).toBeLessThanOrEqual(4);
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
  const count = () => screen.getByTestId("tutorial-build-count").textContent;
  /** Clear the chapter showing: press each goal's target in order. */
  const clear = (index: number) => {
    for (const goal of TUTORIAL_STEPS[index].task.goals) press(goal.id);
  };
  /** Go to a chapter by skipping the ones before it. */
  const goTo = (index: number) => {
    for (let at = 0; at < index; at++) next();
  };
  const COUNTS = ["1 session · 2 steps", "1 session · 3 steps", "2 sessions · 5 steps", "2 sessions · 5 steps", "2 sessions · 6 steps", "2 sessions · 7 steps", "2 sessions · 7 steps", "2 sessions · 7 steps"];

  it("opens on chapter 1, asking for its first goal, with nothing done and nothing built", () => {
    open();
    expect(screen.getByRole("dialog", { name: TUTORIAL_STEPS[0].title })).toBeTruthy();
    expect(screen.getByTestId("tutorial-count").textContent).toBe("Tutorial · Chapter 1 of 8");
    expect(stage().getAttribute("data-scene")).toBe("conversation");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.goals[0].ask);
    expect(progress()).toBe("0 of 8 done");
    expect(count()).toBe(TUTORIAL_COPY.build.empty);
    expect(main().textContent).toBe(TUTORIAL_COPY.skipStep);
    expect(main().textContent).toBe("Skip chapter");
    expect(document.activeElement).toBe(main());
    expect(screen.queryByTestId("tutorial-back")).toBeNull();
  });

  it("groups the eight bars under the four stages' names", () => {
    open();
    const bars = screen.getByTestId("tutorial-bars");
    expect(bars.querySelectorAll("[data-stage]")).toHaveLength(4);
    expect(bars.textContent).toBe("FoundationsStructureAgentsSharing");
    expect(bars.querySelectorAll("div > span:not([data-cleared]):empty").length).toBe(8);
  });

  it("clears a goal on the right press and asks for the next", () => {
    open();
    press("import");
    expect(stage().getAttribute("data-done")).toBe("1");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.goals[1].ask);
    expect(progress()).toBe("0 of 8 done");
  });

  it("answers a wrong press with a hint and a pointer, and loses nothing", () => {
    open();
    press("empty");
    expect(stage().getAttribute("data-done")).toBe("0");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[0].task.wrong?.empty);
    expect(screen.getByTestId("tutorial-hint-ring")).toBeTruthy();
    press("import");
    expect(screen.queryByTestId("tutorial-hint")).toBeNull();
    expect(screen.queryByTestId("tutorial-hint-ring")).toBeNull();
    expect(stage().getAttribute("data-done")).toBe("1");
  });

  it("says why, where a wrong press teaches something", () => {
    open();
    goTo(7);
    press("publish");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[7].task.wrong?.publish);
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

  it("clears the chapter on its last goal: the bar fills, the count goes up and the main button becomes Next", () => {
    open();
    clear(0);
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(ask()).toBe(TUTORIAL_STEPS[0].task.done);
    expect(progress()).toBe("1 of 8 done");
    expect(screen.getByTestId("tutorial-bars").querySelectorAll('[data-cleared="true"]')).toHaveLength(1);
    expect(main().textContent).toBe(TUTORIAL_COPY.next);
    expect(main().getAttribute("data-variant")).toBe("primary");
    expect(document.activeElement).toBe(main());
  });

  it("can be played through, every chapter in order, to a clean run, the build growing as it goes", () => {
    open();
    for (const [index, entry] of TUTORIAL_STEPS.entries()) {
      expect(step()).toBe(String(index + 1));
      expect(screen.getByTestId("tutorial-count").textContent).toBe(`Tutorial · Chapter ${index + 1} of 8`);
      expect(screen.getByTestId("tutorial-title").textContent).toBe(entry.title);
      expect(stage().getAttribute("data-scene")).toBe(entry.scene);
      for (const point of entry.points) expect(within(screen.getByTestId("tutorial-points")).getByText(point.lead)).toBeTruthy();
      clear(index);
      expect(count()).toBe(COUNTS[index]);
      expect(progress()).toBe(`${index + 1} of 8 done`);
      if (index === TUTORIAL_STEPS.length - 1) expect(main().textContent).toBe(TUTORIAL_COPY.finish);
      next();
    }
    expect(step()).toBe("complete");
    expect(screen.getByTestId("tutorial-title").textContent).toBe("All 8 chapters done");
    expect(screen.getByTestId("tutorial-stat-chapters").textContent).toBe("8 of 8");
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe(TUTORIAL_COPY.complete.none);
    expect(screen.getByTestId("tutorial-stat-time").textContent).toMatch(/^\d+:\d\d$/);
    expect(screen.getByTestId("tutorial-clean")).toBeTruthy();
    expect(screen.getByText(TUTORIAL_COPY.reopen)).toBeTruthy();
    expect(main().textContent).toBe(TUTORIAL_COPY.done);
    next();
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("marks the rows a chapter adds, and only those", () => {
    open();
    goTo(5);
    const outline = screen.getByTestId("tutorial-outline");
    expect(outline.querySelectorAll('[data-new="true"]')).toHaveLength(0);
    clear(5);
    const fresh = [...outline.querySelectorAll('[data-new="true"]')].map((row) => row.getAttribute("data-row"));
    expect(fresh).toEqual(["team"]);
    expect(count()).toBe("2 sessions · 7 steps");
  });

  it("counts hints, and a run with any is not a clean one", () => {
    open();
    press("empty");
    for (const index of TUTORIAL_STEPS.keys()) {
      clear(index);
      next();
    }
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe("1");
    expect(screen.queryByTestId("tutorial-clean")).toBeNull();
  });

  it("never holds anyone behind a challenge: a chapter can be skipped, and the summary says how many were done", () => {
    open();
    clear(0);
    next();
    for (let index = 1; index < 8; index++) {
      expect(main().textContent).toBe(TUTORIAL_COPY.skipStep);
      next();
    }
    expect(step()).toBe("complete");
    expect(screen.getByTestId("tutorial-title").textContent).toBe("1 of 8 chapters done");
    expect(screen.queryByTestId("tutorial-clean")).toBeNull();
  });

  it("closes from the last chapter with nothing done, with no summary to show", () => {
    open();
    for (let index = 0; index < 8; index++) next();
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("Show me plays the chapter by itself, can be paused, Try it comes back, and watching counts as a hint", () => {
    vi.useFakeTimers();
    open();
    fireEvent.click(screen.getByTestId("tutorial-watch"));
    expect(screen.queryByTestId("tutorial-task")).toBeNull();
    const example = screen.getByTestId("tutorial-example");
    expect(example.getAttribute("data-scene")).toBe("conversation");
    expect(ask()).toBe(TUTORIAL_COPY.watching);
    // It points at the first target, then clears it.
    expect(screen.getByTestId("tutorial-hint-ring")).toBeTruthy();
    expect(example.querySelector("[data-target]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(screen.queryByTestId("tutorial-hint-ring")).toBeNull();
    // Pressing the stage pauses it, and pressing again plays it.
    fireEvent.click(example);
    expect(screen.getByRole("button", { name: TUTORIAL_COPY.play }).getAttribute("aria-pressed")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.queryByTestId("tutorial-hint-ring")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: TUTORIAL_COPY.play }));
    expect(screen.getByRole("button", { name: TUTORIAL_COPY.pause }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByTestId("tutorial-watch"));
    expect(stage().getAttribute("data-done")).toBe("0");
    for (const index of TUTORIAL_STEPS.keys()) {
      clear(index);
      next();
    }
    expect(screen.getByTestId("tutorial-stat-hints").textContent).toBe("1");
  });

  it("Show me plays every chapter without throwing", () => {
    vi.useFakeTimers();
    open();
    for (const index of TUTORIAL_STEPS.keys()) {
      fireEvent.click(screen.getByTestId("tutorial-watch"));
      expect(screen.getByTestId("tutorial-example").getAttribute("data-scene")).toBe(TUTORIAL_STEPS[index].scene);
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      fireEvent.click(screen.getByTestId("tutorial-watch"));
      next();
    }
  });

  it("keeps a cleared chapter cleared when it is come back to, and Again plays it once more", () => {
    open();
    clear(0);
    next();
    fireEvent.click(screen.getByTestId("tutorial-back"));
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(main().textContent).toBe(TUTORIAL_COPY.next);
    fireEvent.click(screen.getByTestId("tutorial-again"));
    expect(stage().getAttribute("data-done")).toBe("0");
    expect(progress()).toBe("1 of 8 done");
  });

  it("the Stripe tool can be moved by its button as well as by dragging", () => {
    open();
    goTo(1);
    press("add");
    press("file");
    expect(screen.getByTestId("tutorial-hint").textContent).toBe(TUTORIAL_STEPS[1].task.wrong?.file);
    press("tool");
    expect(screen.getByTestId("tutorial-drag")).toBeTruthy();
    press("move");
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(count()).toBe("1 session · 3 steps");
  });

  /** jsdom has no PointerEvent, so a pointer event made by the library carries no place: a mouse event of the same name does. */
  const drag = (tile: HTMLElement, from: number, to: number) => {
    const pointer = (type: string, clientY: number) => act(() => void tile.dispatchEvent(new MouseEvent(type, { bubbles: true, clientY })));
    pointer("pointerdown", from);
    pointer("pointermove", to);
    pointer("pointerup", to);
  };

  it("the Stripe tool can be dragged above step 2, and a short pull puts it back", () => {
    open();
    goTo(1);
    press("add");
    press("tool");
    const tile = screen.getByTestId("tutorial-drag");
    drag(tile, 200, 192);
    expect(stage().getAttribute("data-done")).toBe("2");
    drag(tile, 200, 165);
    expect(stage().getAttribute("data-cleared")).toBe("true");
  });

  it("Session 2 can be moved into Part B by its button as well as by dragging", () => {
    open();
    goTo(3);
    press("part");
    expect(screen.getByTestId("tutorial-outline").textContent).toContain("Part B · empty");
    press("move");
    expect(stage().getAttribute("data-cleared")).toBe("true");
    expect(screen.getByTestId("tutorial-outline").textContent).not.toContain("empty");
    expect(count()).toBe("2 sessions · 5 steps");
  });

  it("Session 2 can be dragged down into Part B, and a short pull puts it back", () => {
    open();
    goTo(3);
    press("part");
    const tile = screen.getByTestId("tutorial-drag");
    drag(tile, 100, 120);
    expect(stage().getAttribute("data-done")).toBe("1");
    drag(tile, 100, 160);
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

  it.each([0, 1, 2, 3, 4, 5, 6, 7])("can be skipped after %i chapters, and is then seen", (steps) => {
    open();
    goTo(steps);
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(isTutorialOpen()).toBe(false);
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it.each([0, 3, 7])("can be closed from the corner after %i chapters", (steps) => {
    open();
    goTo(steps);
    fireEvent.click(screen.getByRole("button", { name: TUTORIAL_COPY.close }));
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("closes on Escape, in the middle of a challenge", () => {
    open();
    goTo(4);
    press("add");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByTestId("tutorial-window")).toBeNull();
    expect(hasSeenTutorial(MAKER)).toBe(true);
  });

  it("starts at chapter 1 again, with nothing done, each time it is opened", () => {
    open();
    clear(0);
    next();
    fireEvent.click(screen.getByTestId("tutorial-skip"));
    act(() => openTutorial());
    expect(step()).toBe("1");
    expect(progress()).toBe("0 of 8 done");
  });

  it("closes when the page under it goes away", () => {
    const view = render(<Host />);
    act(() => openTutorial());
    view.unmount();
    expect(isTutorialOpen()).toBe(false);
  });
});
