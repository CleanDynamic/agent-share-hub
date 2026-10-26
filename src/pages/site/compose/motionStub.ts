/* SV-06: the Web Animations API, for jsdom. Tests only.

   Every `element.animate()` is recorded, not played. Its `finished` resolves when the test's clock (fake timers) passes its delay and
   duration, the way a real one would end, so a sequence that waits on one step's end before the next can be stepped through by
   advancing time. `cancel()` fires a "cancel" event and never resolves `finished` as a finish; `finish()` resolves it at once.
   `getAnimations()` answers what is running on an element. */

import { vi } from "vitest";

export interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finished: boolean;
  cancelled: boolean;
  animation: Animation;
}

export function stubAnimations(): { played: Played[]; restore: () => void } {
  const played: Played[] = [];
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const listeners = new Map<string, Set<() => void>>();
    let resolve: () => void = () => undefined;
    const finished = new Promise<void>((done) => (resolve = done));
    const total = Number(options?.delay ?? 0) + Number(options?.duration ?? 0);
    const entry = { element: this, keyframes, options, finished: false, cancelled: false } as Played;
    const end = () => {
      if (entry.finished || entry.cancelled) return;
      entry.finished = true;
      resolve();
    };
    const timer = setTimeout(end, total);
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
