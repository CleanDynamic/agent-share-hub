// What a page tells the phone's top bar (prompt 19). The bar's table (`phoneTopBar.ts`) decides what sits where; a page that
// owns the thing behind a slot registers it here while it is mounted: the Activity page's "Mark all read" write, a build's
// actions menu, the person's name on Followers. Nothing is registered on a desktop, and a page that registers nothing leaves
// the bar to the table. One store for the whole frame; the bar subscribes, pages write.

import { useEffect, useRef, useSyncExternalStore } from "react";

export interface PageBar {
  /** Replaces the table's centre title (the person's name on Followers, the space's name on a topic). */
  title?: string;
  /** Replaces the back control's name ("Back to Rebuild source"). */
  backLabel?: string;
  /** Where Back goes when there is no history to step back through. */
  backTo?: string;
  /** The page's More menu. Without it the bar draws no More. */
  more?: () => void;
  /** Activity's write. `disabled` while nothing is unread. */
  markAll?: { run: () => void; disabled: boolean };
  /** Onboarding's Skip. */
  skip?: () => void;
}

let current: PageBar = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The bar's page state, for the container. */
export function usePageBar(): PageBar {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/** Registers `bar` while the calling page is mounted. Callbacks are read through a ref, so a new function each render is fine. */
export function useRegisterPageBar(bar: PageBar | null): void {
  const latest = useRef(bar);
  latest.current = bar;
  const key = bar ? JSON.stringify([bar.title, bar.backLabel, bar.backTo, !!bar.more, bar.markAll?.disabled, !!bar.markAll, !!bar.skip]) : "";
  useEffect(() => {
    if (!latest.current) return;
    const own: PageBar = {
      title: latest.current.title,
      backLabel: latest.current.backLabel,
      backTo: latest.current.backTo,
      more: latest.current.more ? () => latest.current?.more?.() : undefined,
      markAll: latest.current.markAll ? { disabled: latest.current.markAll.disabled, run: () => latest.current?.markAll?.run() } : undefined,
      skip: latest.current.skip ? () => latest.current?.skip?.() : undefined,
    };
    current = { ...current, ...own };
    emit();
    return () => {
      current = {};
      emit();
    };
  }, [key]);
}

/** Test seam: drop whatever a page left. */
export function __resetPageBar(): void {
  current = {};
  emit();
}
