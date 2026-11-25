// What a page tells the phone's top bar (prompt 19). The bar's table (`phoneTopBar.ts`) decides what sits where; a page that
// owns the thing behind a slot registers it here while it is mounted: the Activity page's "Mark all read" write, a build's
// actions menu, the person's name on Followers. Nothing is registered on a desktop, and a page that registers nothing leaves
// the bar to the table. One store for the whole frame; the bar subscribes, pages write.

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { MobileIconName } from "@/components/brand/mobileIcons";

/** One row of the More sheet. Give `to` for a link or `onSelect` for an action. */
export interface MoreItem {
  label: string;
  to?: string;
  onSelect?: () => void;
  tone?: "danger";
  disabled?: boolean;
  /** Prompt 23: the editor's rows carry their icon at 22 (and are drawn 15/500). */
  icon?: MobileIconName;
}

export interface PageBar {
  /** Replaces the table's centre title (the person's name on Followers, the space's name on a topic). */
  title?: string;
  /** Replaces the back control's name ("Back to Rebuild source"). */
  backLabel?: string;
  /** Where Back goes when there is no history to step back through. */
  backTo?: string;
  /** What the page adds to the bar's More sheet, above the bar's own Copy link and Share. */
  more?: readonly MoreItem[];
  /** Messages' gear: the open conversation's settings. */
  settings?: () => void;
  /** Activity's write. `disabled` while nothing is unread. */
  markAll?: { run: () => void; disabled: boolean };
  /** Onboarding's Skip. */
  skip?: () => void;
  /** Prompt 23: the More sheet holds only the page's rows, in its order (the editor has no Copy link or Share). */
  bare?: boolean;
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
  const key = bar
    ? JSON.stringify([bar.title, bar.backLabel, bar.backTo, bar.more?.map((item) => [item.label, item.to, item.tone, item.disabled, !!item.onSelect, item.icon]), !!bar.settings, bar.markAll?.disabled, !!bar.markAll, !!bar.skip, !!bar.bare])
    : "";
  useEffect(() => {
    if (!latest.current) return;
    const own: PageBar = {
      title: latest.current.title,
      backLabel: latest.current.backLabel,
      backTo: latest.current.backTo,
      more: latest.current.more?.map((item, index) => ({ ...item, onSelect: item.onSelect ? () => latest.current?.more?.[index]?.onSelect?.() : undefined })),
      settings: latest.current.settings ? () => latest.current?.settings?.() : undefined,
      markAll: latest.current.markAll ? { disabled: latest.current.markAll.disabled, run: () => latest.current?.markAll?.run() } : undefined,
      skip: latest.current.skip ? () => latest.current?.skip?.() : undefined,
      bare: latest.current.bare,
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
