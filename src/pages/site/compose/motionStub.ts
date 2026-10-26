/* SV-06: the Web Animations API, for jsdom. Tests only.

   Every `element.animate()` is recorded, not played. Its `finished` resolves when the test's clock (fake timers) passes its delay and
   duration, the way a real one would end, so a sequence that waits on one step's end before the next can be stepped through by
   advancing time. `cancel()` fires a "cancel" event and rejects `finished`, as a browser does; `finish()` resolves it at once.
   `getAnimations()` answers what is running on an element. */

import { act } from "@testing-library/react";
import { vi } from "vitest";

export interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finished: boolean;
  cancelled: boolean;
  animation: Animation;
  /** Ends it now, as if it had run its course (a held one ends only this way). */
  end: () => void;
}

/**
 * `hold`: animations it picks do not end on the clock, only when the test calls their `end()`, as when the main thread is too busy
 * for an animation to reach its end in its own time.
 */
export function stubAnimations({ hold }: { hold?: (entry: Played) => boolean } = {}): { played: Played[]; restore: () => void } {
  const played: Played[] = [];
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const listeners = new Map<string, Set<() => void>>();
    let resolve: () => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const finished = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    // Nothing need wait on it to cancel it.
    finished.catch(() => undefined);
    const total = Number(options?.delay ?? 0) + Number(options?.duration ?? 0);
    const entry = { element: this, keyframes, options, finished: false, cancelled: false } as Played;
    const end = () => {
      if (entry.finished || entry.cancelled) return;
      entry.finished = true;
      resolve();
    };
    const timer = hold?.(entry) ? undefined : setTimeout(end, total);
    entry.end = () => {
      clearTimeout(timer);
      end();
    };
    const animation = {
      id: options?.id ?? "",
      finished,
      get playState() {
        return entry.cancelled ? "idle" : entry.finished ? "finished" : "running";
      },
      finish: () => {
        clearTimeout(timer);
        end();
      },
      cancel: () => {
        if (entry.finished || entry.cancelled) return;
        clearTimeout(timer);
        entry.cancelled = true;
        for (const listener of listeners.get("cancel") ?? []) listener();
        reject(new DOMException("The animation was cancelled", "AbortError"));
      },
      addEventListener: (type: string, listener: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(listener)),
      removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
      effect: { getComputedTiming: () => ({ progress: entry.finished ? 1 : 0, endTime: total }) },
    } as unknown as Animation;
    entry.animation = animation;
    played.push(entry);
    return animation;
  }) as never;
  Element.prototype.getAnimations = function (this: Element) {
    return played.filter((entry) => entry.element === this && !entry.finished && !entry.cancelled).map((entry) => entry.animation);
  } as never;
  return {
    played,
    restore: () => {
      delete (Element.prototype as { animate?: unknown }).animate;
      delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
    },
  };
}

/** The test's clock moves a frame at a time, as a browser's does: React draws between frames, so a step set going by one draw runs. */
const FRAME = 16;

/** Time passes on the test's clock, and what each animation's end set going runs (it waits on a promise, not a timer). */
export async function passes(ms: number): Promise<void> {
  let left = ms;
  do {
    const step = Math.min(FRAME, left);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
    left -= step;
  } while (left > 0);
}
