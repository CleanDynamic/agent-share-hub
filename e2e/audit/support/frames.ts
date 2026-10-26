/* SV-04: frame tools for the audits. What the screen did, frame by frame, while a page changed.

   `installFrameTools(page)` adds an init script that, from the first frame of every document, keeps:
     - a requestAnimationFrame sampler: each frame's time and what the page area held (see `PageAreaKind`);
     - a long-task observer (PerformanceObserver, `longtask`);
     - a layout-shift observer (every shift, input or not: a page change follows a click, which CLS would excuse);
     - a per-frame read of chosen elements' boxes (`watch`, CSS selectors);
     - the last input: the time of the last click (its event time) and of the last popstate (Back and Forward).
   The node side reads it back with `readFrames`, clears it with `resetFrames`, and turns a window of it into the numbers
   of one page change with `measureChange`. SV-06's motion audit reuses the sampler and the observers.

   WHAT THE PAGE AREA HOLDS, read once per frame from `<main id="main">` without the breadcrumb:
     old          the page the change started from is still there (its page-ready mark is still on <html>);
     ready        the new page's page-ready mark is on <html>;
     placeholder  loading blocks are showing (`[data-ui=skeleton]`, the composer's `loading-blocks`). Its signature is the
                  blocks' boxes, rounded to 4 px, so two placeholders of the same shape are one state and a swap between two
                  different shapes is two;
     content      something is drawn and nothing is loading, but the new page is not ready yet;
     empty        no `#main`, or nothing visible in it. */

import type { Page } from "@playwright/test";

export type PageAreaKind = "old" | "ready" | "placeholder" | "content" | "empty";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameSample {
  /** performance.now() at the frame. */
  t: number;
  kind: PageAreaKind;
  /** The placeholder's shape, or the content's: a string to tell two states apart. */
  sig: string;
  /** The header slot's `data-frame-id`, or "" when there is none, or "gone" when the slot is not in the document. */
  headerId: string;
  /** Whether the header slot is the same element as the one the window started with. */
  headerSame: boolean;
  header: Box | null;
  /** The primary nav item marked current (its href), or "". */
  current: string;
  scrollY: number;
  /** The page area's opacity in a view transition: [old, new], or null when none is running. */
  fade: [number, number] | null;
  watched: (Box | null)[];
}

export interface FrameLog {
  frames: FrameSample[];
  longTasks: { start: number; duration: number }[];
  shifts: { t: number; value: number }[];
  lastClick: number;
  lastPop: number;
}

declare global {
  interface Window {
    __frames?: {
      log: FrameLog;
      watch: string[];
      /** The mark of the page the change starts from, and of the page it goes to. */
      from: string;
      to: string;
      header: Element | null;
      reset: (from: string, to: string) => void;
    };
  }
}

/** The recorder, run in the page before any of its scripts. */
function recorder() {
  const log: FrameLog = { frames: [], longTasks: [], shifts: [], lastClick: -1, lastPop: -1 };
  const state = {
    log,
    watch: [] as string[],
    from: "",
    to: "",
    header: null as Element | null,
    reset(from: string, to: string) {
      log.frames.length = 0;
      log.longTasks.length = 0;
      log.shifts.length = 0;
      state.from = from;
      state.to = to;
      state.header = document.querySelector('[data-slot="header"],[data-slot="mobile-header"]');
    },
  };
  window.__frames = state;

  const BLOCKS = '[data-ui="skeleton"],[data-testid="loading-blocks"],[data-bg-animated]';
  const box = (element: Element | null) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.01;
  };
  const round = (value: number) => Math.round(value / 4) * 4;

  function pageArea(): { kind: PageAreaKind; sig: string } {
    const mark = document.documentElement.getAttribute("data-page-ready");
    if (state.to && mark === state.to) return { kind: "ready", sig: state.to };
    if (state.from && mark === state.from) return { kind: "old", sig: state.from };
    const main = document.getElementById("main");
    if (!main) return { kind: "empty", sig: "no main" };
    const blocks = [...main.querySelectorAll(BLOCKS)].filter((element) => !element.closest('[data-slot="breadcrumb"]') && visible(element));
    if (blocks.length > 0) {
      const sig = blocks
        .slice(0, 40)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return `${round(rect.x)},${round(rect.y)},${round(rect.width)},${round(rect.height)}`;
        })
        .join(" ");
      return { kind: "placeholder", sig: `${blocks.length}:${sig}` };
    }
    // Anything drawn: text, an image, a control. Walked shallowly enough to stay inside a frame.
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let seen = 0;
    for (let node = walker.nextNode(); node && seen < 4000; node = walker.nextNode(), seen += 1) {
      const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
      if (!element || element.closest('[data-slot="breadcrumb"]')) continue;
      const drawn = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "").trim().length > 0 : /^(IMG|SVG|CANVAS|VIDEO|INPUT|BUTTON|TEXTAREA)$/i.test(element.tagName);
      if (drawn && visible(element)) return { kind: "content", sig: `content` };
    }
    return { kind: "empty", sig: "nothing" };
  }

  function fade(): [number, number] | null {
    const running = document.getAnimations().some((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "";
      return target.startsWith("::view-transition");
    });
    if (!running) return null;
    const root = document.documentElement;
    const read = (pseudo: string) => Number(getComputedStyle(root, pseudo).opacity || "1");
    return [read("::view-transition-old(page)"), read("::view-transition-new(page)")];
  }

  function sample(t: number) {
    const header = document.querySelector('[data-slot="header"],[data-slot="mobile-header"]');
    const current = document.querySelector('nav[aria-label="Primary"] [aria-current="page"], [data-slot="dock"] [aria-current="page"]');
    const area = pageArea();
    log.frames.push({
      t,
      kind: area.kind,
      sig: area.sig,
      headerId: header ? (header.getAttribute("data-frame-id") ?? "") : "gone",
      headerSame: header !== null && header === state.header,
      header: box(header),
      current: current?.getAttribute("href") ?? "",
      scrollY: window.scrollY,
      fade: fade(),
      watched: state.watch.map((selector) => box(document.querySelector(selector))),
    });
    if (log.frames.length > 20_000) log.frames.splice(0, 10_000);
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) log.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* an engine without long tasks: the list stays empty */
  }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) log.shifts.push({ t: entry.startTime, value: (entry as PerformanceEntry & { value: number }).value });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    /* as above */
  }
  addEventListener("click", (event) => (log.lastClick = event.timeStamp), { capture: true });
  addEventListener("popstate", () => (log.lastPop = performance.now()), { capture: true });
}

export async function installFrameTools(page: Page): Promise<void> {
  await page.addInitScript(recorder);
}

/** Start a new window: forget what was recorded, and say which page the change leaves and which it goes to. */
export async function resetFrames(page: Page, from: string, to: string, watch: string[] = []): Promise<void> {
  await page.evaluate(
    ([fromMark, toMark, selectors]) => {
      window.__frames?.reset(fromMark as string, toMark as string);
      if (window.__frames) window.__frames.watch = selectors as string[];
    },
    [from, to, watch] as const,
  );
}

export async function readFrames(page: Page): Promise<FrameLog> {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__frames?.log ?? { frames: [], longTasks: [], shifts: [], lastClick: -1, lastPop: -1 })));
}

export interface ChangeNumbers {
  /** From the click (or Back) to the first frame that differs from the one before it, in ms. */
  firstChangeMs: number;
  /** Frames between the input and the ready mark where the page area was empty. */
  emptyFrames: number;
  /** The states the page area went through between the old page and the new one ready, e.g. ["placeholder", "content"]. */
  states: string[];
  /** How many of those were placeholders of different shapes. */
  placeholderStates: number;
  layoutShift: number;
  /** The header slot was the same element, with the same `data-frame-id`, in every frame. */
  headerKept: boolean;
  /** The header's box moved in some frame (more than half a pixel). */
  headerMoved: boolean;
  /** From the input to the ready mark, in ms. */
  readyMs: number;
  /** The scroll position in the first frame the new page was ready. */
  scrollAtReady: number;
  longestTaskMs: number;
}

/** The numbers of one page change, from a window that `resetFrames` started just before the input. */
export function measureChange(log: FrameLog, input: number): ChangeNumbers {
  const frames = log.frames;
  const before = [...frames].reverse().find((frame) => frame.t <= input) ?? frames[0];
  const after = frames.filter((frame) => frame.t > input);
  const look = (frame: FrameSample) => `${frame.kind}|${frame.sig}|${frame.current}`;
  const changed = after.find((frame) => look(frame) !== look(before));
  const readyAt = after.findIndex((frame) => frame.kind === "ready");
  const until = readyAt === -1 ? after : after.slice(0, readyAt);
  const states: string[] = [];
  const shapes = new Set<string>();
  for (const frame of until) {
    if (frame.kind === "old") continue;
    const state = frame.kind === "placeholder" ? `placeholder ${frame.sig}` : frame.kind;
    if (states.at(-1) !== state) states.push(state);
    if (frame.kind === "placeholder") shapes.add(frame.sig);
  }
  const headerTop = before?.header?.y ?? 0;
  const headerLeft = before?.header?.x ?? 0;
  const headerId = before?.headerId ?? "";
  const end = readyAt === -1 ? Infinity : after[readyAt].t + 250;
  return {
    firstChangeMs: changed ? Math.round(changed.t - input) : -1,
    emptyFrames: until.filter((frame) => frame.kind === "empty").length,
    states: states.map((state) => (state.startsWith("placeholder") ? `placeholder#${[...shapes].indexOf(state.slice(12)) + 1}` : state)),
    placeholderStates: shapes.size,
    layoutShift: Math.round(log.shifts.filter((shift) => shift.t > input && shift.t <= end).reduce((sum, shift) => sum + shift.value, 0) * 1000) / 1000,
    headerKept: frames.every((frame) => frame.headerSame && frame.headerId === headerId && frame.headerId !== "gone"),
    headerMoved: frames.some((frame) => !frame.header || Math.abs(frame.header.y - headerTop) > 0.5 || Math.abs(frame.header.x - headerLeft) > 0.5),
    readyMs: readyAt === -1 ? -1 : Math.round(after[readyAt].t - input),
    scrollAtReady: readyAt === -1 ? -1 : Math.round(after[readyAt].scrollY),
    longestTaskMs: Math.round(Math.max(0, ...log.longTasks.filter((task) => task.start + task.duration > input).map((task) => task.duration))),
  };
}
