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
  /** Each shift, with what moved (tag, test id or data-ui, and the box before and after) for reading by eye. */
  shifts: { t: number; value: number; sources: string[]; footerOnly: boolean }[];
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
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; sources?: { node?: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] };
        const sources = (shift.sources ?? []).map((source) => {
          const node = source.node instanceof Element ? source.node : source.node?.parentElement;
          const name = node ? `${node.tagName.toLowerCase()}${node.getAttribute("data-testid") ? `#${node.getAttribute("data-testid")}` : ""}${node.getAttribute("data-ui") ? `[${node.getAttribute("data-ui")}]` : ""}` : "?";
          const box = (rect: DOMRectReadOnly) => `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
          return `${name} ${box(source.previousRect)} -> ${box(source.currentRect)}`;
        });
        // The footer sits at the foot of the surface: it moves whenever a page of another length is drawn. A shift that
        // moved nothing else is the frame following the page's length, not the page's content shifting.
        const footerOnly =
          (shift.sources ?? []).length > 0 &&
          (shift.sources ?? []).every((source) => {
            const node = source.node instanceof Element ? source.node : source.node?.parentElement;
            return Boolean(node?.closest('[data-slot="footer"]'));
          });
        log.shifts.push({ t: entry.startTime, value: shift.value, sources, footerOnly });
      }
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
  /** Layout shift during the change, in the page area: a shift that moved only the footer is not counted here. */
  layoutShift: number;
  /** The footer's own shifts, as the page's length changed. Reported, not judged. */
  footerShift: number;
  /** The header slot was the same element, with the same `data-frame-id`, in every frame. */
  headerKept: boolean;
  /** The header's box moved in some frame (more than half a pixel). */
  headerMoved: boolean;
  /** From the input to the ready mark, in ms. */
  readyMs: number;
  /** The scroll position in the first frame the new page was ready. */
  scrollAtReady: number;
  longestTaskMs: number;
  /** What moved in the shifts counted, for reading by eye. */
  shiftSources: string[];
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
    layoutShift: Math.round(log.shifts.filter((shift) => shift.t > input && shift.t <= end && !shift.footerOnly).reduce((sum, shift) => sum + shift.value, 0) * 1000) / 1000,
    footerShift: Math.round(log.shifts.filter((shift) => shift.t > input && shift.t <= end && shift.footerOnly).reduce((sum, shift) => sum + shift.value, 0) * 1000) / 1000,
    headerKept: frames.every((frame) => frame.headerSame && frame.headerId === headerId && frame.headerId !== "gone"),
    headerMoved: frames.some((frame) => !frame.header || Math.abs(frame.header.y - headerTop) > 0.5 || Math.abs(frame.header.x - headerLeft) > 0.5),
    readyMs: readyAt === -1 ? -1 : Math.round(after[readyAt].t - input),
    scrollAtReady: readyAt === -1 ? -1 : Math.round(after[readyAt].scrollY),
    longestTaskMs: Math.round(Math.max(0, ...log.longTasks.filter((task) => task.start + task.duration > input).map((task) => task.duration))),
    shiftSources: log.shifts.filter((shift) => shift.t > input && shift.t <= end).flatMap((shift) => shift.sources.map((source) => `${shift.value.toFixed(3)} ${source}`)),
  };
}

/* ── SV-06: the motion recorder, for the motion audit ──

   `installMotionTools(page)` adds a second init script, lighter than the page change sampler above (no page-area walk), that keeps
   while it is armed:
     - every frame's time, how many animations were running, and where each `[data-slide-id]` element near the window stood, in document
       coordinates (so a page that scrolls does not count as the element moving);
     - every `element.animate()` call: when, on which element, which properties;
     - every animation cut short: cancelled, or finished early by `finish()`, before it reached its end. A cut is "continued" when
       a new animation started on the same element in the same frame (within 20 ms either way): the motion goes on from there;
     - long tasks (PerformanceObserver, `longtask`);
     - the time of the input that started the moment (the pointer or click event's time), and whether the DOM changed in a frame.
   `measureMotion` turns one armed window into the numbers the audit judges. */

export interface MotionFrame {
  t: number;
  running: number;
  /** Something in the document changed since the frame before: the DOM, the scroll, or an animation was started. */
  dirty: boolean;
  /** `data-slide-id` → [x, y] in document coordinates, and 1 when any of it is in the window. */
  at: Record<string, [number, number, number]>;
}

export interface MotionLog {
  frames: MotionFrame[];
  started: { t: number; el: number; keys: string[] }[];
  cuts: { t: number; el: number; how: "cancel" | "finish" }[];
  longTasks: { start: number; duration: number }[];
  input: number;
}

declare global {
  interface Window {
    __motion?: {
      log: MotionLog;
      armed: boolean;
      arm: () => void;
      disarm: () => void;
      input: (t: number) => void;
    };
  }
}

function motionRecorder() {
  const log: MotionLog = {
    frames: [],
    started: [],
    cuts: [],
    longTasks: [],
    input: -1,
  };
  const ids = new WeakMap<Element, number>();
  let next = 1;
  const idOf = (element: Element) => {
    if (!ids.has(element)) ids.set(element, next++);
    return ids.get(element) as number;
  };
  let dirty = false;
  let lastScroll = 0;
  const state = {
    log,
    armed: false,
    arm() {
      lastScroll = scrollY;
      log.frames.length = 0;
      log.started.length = 0;
      log.cuts.length = 0;
      log.longTasks.length = 0;
      log.input = -1;
      state.armed = true;
    },
    disarm() {
      state.armed = false;
    },
    input(t: number) {
      if (state.armed && log.input < 0) log.input = t;
    },
  };
  window.__motion = state;

  const animate = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, frames: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    const animation = animate.call(this, frames, options);
    if (state.armed) {
      dirty = true;
      const list = Array.isArray(frames) ? frames : frames ? [frames as Keyframe] : [];
      const keys = [...new Set(list.flatMap((frame) => Object.keys(frame)))].filter((key) => !["offset", "easing", "composite"].includes(key));
      const el = idOf(this);
      log.started.push({ t: performance.now(), el, keys });
      animation.addEventListener("cancel", () => {
        if (state.armed) log.cuts.push({ t: performance.now(), el, how: "cancel" });
      });
    }
    return animation;
  };
  const finish = Animation.prototype.finish;
  Animation.prototype.finish = function (this: Animation) {
    if (state.armed && this.playState === "running") {
      const timing = this.effect?.getComputedTiming();
      const end = Number(timing?.endTime ?? 0);
      const now = Number(this.currentTime ?? 0);
      const target = (this.effect as KeyframeEffect | null)?.target;
      if (target && now < end - 1)
        log.cuts.push({
          t: performance.now(),
          el: idOf(target),
          how: "finish",
        });
    }
    return finish.call(this);
  };

  for (const type of ["pointerdown", "pointerup", "click", "keydown", "wheel"])
    addEventListener(type, (event) => state.input(event.timeStamp), {
      capture: true,
      passive: true,
    });

  const watch = () => {
    new MutationObserver(() => {
      dirty = true;
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  };
  if (document.body) watch();
  else addEventListener("DOMContentLoaded", watch);

  const sample = (t: number) => {
    if (state.armed) {
      const at: Record<string, [number, number, number]> = {};
      const height = innerHeight;
      for (const element of document.querySelectorAll("[data-slide-id]")) {
        const box = element.getBoundingClientRect();
        // Near the window: its whole travel is known, though only a step taken on screen can be seen (see `measureMotion`).
        if (box.bottom < -height || box.top > 2 * height) continue;
        const shown = box.bottom > 0 && box.top < height ? 1 : 0;
        at[element.getAttribute("data-slide-id") as string] = [Math.round((box.left + scrollX) * 10) / 10, Math.round((box.top + scrollY) * 10) / 10, shown];
      }
      const running = document.getAnimations().filter((animation) => animation.playState === "running").length;
      if (scrollY !== lastScroll) dirty = true;
      lastScroll = scrollY;
      log.frames.push({ t, running, dirty, at });
      dirty = false;
      if (log.frames.length > 5000) log.frames.splice(0, 2500);
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  try {
    new PerformanceObserver((list) => {
      if (!state.armed) return;
      for (const entry of list.getEntries())
        log.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: "longtask" });
  } catch {
    /* an engine without long tasks: the list stays empty */
  }
}

export async function installMotionTools(page: Page): Promise<void> {
  await page.addInitScript(motionRecorder);
}

export async function armMotion(page: Page): Promise<void> {
  await page.evaluate(() => window.__motion?.arm());
}

export async function readMotion(page: Page): Promise<MotionLog> {
  return page.evaluate(() => {
    window.__motion?.disarm();
    return JSON.parse(
      JSON.stringify(
        window.__motion?.log ?? {
          frames: [],
          started: [],
          cuts: [],
          longTasks: [],
          input: -1,
        },
      ),
    );
  });
}

export interface MotionNumbers {
  /** Frames more than 25 ms after one where an animation was running. */
  frameGaps: number;
  /** Long tasks over 50 ms begun while an animation ran, with one still running when they ended. */
  longTasks: number;
  longestTaskMs: number;
  /** Animations cut short (cancelled, or finished early) with nothing continuing on that element in the same frame. */
  cancelled: number;
  /** The largest single-frame move of any `[data-slide-id]` element, as a share of its whole travel (0 to 1). */
  largestJump: number;
  /** Which element made it, for reading by eye. */
  jumpOf: string;
  /** From the input to the first frame where anything changed, in ms. */
  firstFrameMs: number;
  /** From the input to the last frame something ran or changed, in ms. */
  settledMs: number;
  /** Properties animated other than transform and opacity. */
  offCompositor: string[];
}

/** Elements that travel less than this in all are not judged: a pixel of rounding is not a jump. */
const MIN_TRAVEL = 6;

export function measureMotion(log: MotionLog): MotionNumbers {
  const input = log.input >= 0 ? log.input : (log.frames[0]?.t ?? 0);
  const after = log.frames.filter((frame) => frame.t >= input);
  // Moving: an animation runs, or the page scrolls (Go to it scrolls by script, not by an animation).
  const lastRunning = [...after].reverse().find((frame) => frame.running > 0 || frame.dirty);
  const end = lastRunning ? lastRunning.t : input;
  const moving = after.filter((frame) => frame.t <= end + 20);
  // While something moves: a gap after a frame where an animation was running, a long task begun while one ran and ended with one
  // still to run. The render that answers the input comes before anything moves, and is in click to first frame instead.
  let gaps = 0;
  for (let at = 1; at < moving.length; at += 1) if (moving[at - 1].running > 0 && moving[at].t - moving[at - 1].t > 25) gaps += 1;
  const first = after.find((frame) => frame.dirty || frame.running > 0);
  const runningAt = (t: number, side: "before" | "after") => (side === "before" ? [...moving].reverse().find((frame) => frame.t <= t) : moving.find((frame) => frame.t >= t))?.running ?? 0;
  const tasks = log.longTasks.filter((task) => task.duration > 50 && task.start >= input && task.start <= end && runningAt(task.start, "before") > 0 && runningAt(task.start + task.duration, "after") > 0);
  const cancelled = log.cuts.filter((cut) => !log.started.some((start) => start.el === cut.el && Math.abs(start.t - cut.t) <= 20)).length;
  // The jump: per element, each frame's move and the sum of them; only frames where it was there before and after. A step counts as
  // a jump only when the element is in the window in one of its two frames: a box off screen is not seen to move, and the List
  // does not slide it, on purpose.
  const travel = new Map<string, { total: number; most: number }>();
  for (let at = 1; at < after.length; at += 1) {
    const was = after[at - 1].at;
    const now = after[at].at;
    for (const id of Object.keys(now)) {
      if (!was[id]) continue;
      const step = Math.hypot(now[id][0] - was[id][0], now[id][1] - was[id][1]);
      const entry = travel.get(id) ?? { total: 0, most: 0 };
      entry.total += step;
      if (was[id][2] || now[id][2]) entry.most = Math.max(entry.most, step);
      travel.set(id, entry);
    }
  }
  let largestJump = 0;
  let jumpOf = "";
  for (const [id, entry] of travel) {
    if (entry.total < MIN_TRAVEL) continue;
    const share = entry.most / entry.total;
    if (share > largestJump) {
      largestJump = share;
      jumpOf = `${id} (${Math.round(entry.most)} of ${Math.round(entry.total)} px)`;
    }
  }
  return {
    frameGaps: gaps,
    longTasks: tasks.length,
    longestTaskMs: Math.round(Math.max(0, ...tasks.map((task) => task.duration))),
    cancelled,
    largestJump: Math.round(largestJump * 100) / 100,
    jumpOf,
    firstFrameMs: first ? Math.round(first.t - input) : -1,
    settledMs: Math.round(end - input),
    offCompositor: [...new Set(log.started.flatMap((start) => start.keys).filter((key) => !["transform", "opacity", "transformOrigin"].includes(key)))],
  };
}
