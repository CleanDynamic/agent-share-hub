/* The build editor's tutorial: whether it is open, and whether this maker has seen it.

   THE OPEN BIT is one value for the page, kept here and not in a component, because two places far apart change it: the
   route offers the tutorial the first time a maker opens the editor, and "Tutorial" under Build options opens it again.
   The window (TutorialWindow, loaded when it first opens) reads it through `useTutorialOpen`.

   SEEN is remembered for that maker on this device (`localStorage`), as the View switch is (viewOptions.ts). Storage can be
   missing or refuse (a private window, site data blocked): every read and write is in a try/catch. A read that fails counts
   as seen, so a maker whose browser keeps nothing is not shown the tutorial on every visit; it is still in the menu.

   IT IS NEVER OFFERED TO AN AUTOMATED BROWSER (`navigator.webdriver`): the end-to-end suites and the performance audits open
   the editor as a maker who has seen nothing, and a window over the page would stand in front of every one of them.

   THIS FILE STAYS SMALL. ComposeRoute imports it, and App.tsx imports ComposeRoute eagerly, so it is in the first download:
   no copy, no styles and no window code belong here. */

import { useSyncExternalStore } from "react";

/** What the menu item says. The window's own words are in tutorialSteps.ts, which loads with the window. */
export const TUTORIAL_MENU_COPY = { item: "Tutorial" } as const;

/** One entry per maker, so two makers on one device each get their own first visit. */
export const tutorialSeenKey = (makerId: string | null | undefined): string => `compose-tutorial:v1:${makerId ?? "signed-out"}`;

export function hasSeenTutorial(makerId: string | null | undefined): boolean {
  try {
    return window.localStorage.getItem(tutorialSeenKey(makerId)) !== null;
  } catch {
    return true;
  }
}

export function markTutorialSeen(makerId: string | null | undefined): void {
  try {
    window.localStorage.setItem(tutorialSeenKey(makerId), new Date().toISOString());
  } catch {
    /* Nothing to do: it stays closed for the rest of this visit either way. */
  }
}

/** True in a browser driven by a test or an audit. */
export const isAutomated = (): boolean => typeof navigator !== "undefined" && navigator.webdriver === true;

/** The whole rule for offering it unasked. */
export const shouldOfferTutorial = (facts: { seen: boolean; automated: boolean }): boolean => !facts.seen && !facts.automated;

/* ── the open bit ── */

let open = false;
const listeners = new Set<() => void>();

const set = (next: boolean) => {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isTutorialOpen = (): boolean => open;

export function openTutorial(): void {
  set(true);
}

/** Close it, however far it had got. Closing is what counts as having seen it. */
export function closeTutorial(makerId: string | null | undefined): void {
  if (!open) return;
  markTutorialSeen(makerId);
  set(false);
}

export function useTutorialOpen(): boolean {
  return useSyncExternalStore(subscribe, isTutorialOpen, () => false);
}

/* ── the first visit ── */

/** After the editor's code is in, the page is given this long to draw and settle before the window opens over it. */
export const TUTORIAL_SETTLE_MS = 700;

/** Any other window already open (the welcome window, a sheet): the tutorial waits for the next visit rather than stack on it. */
const OTHER_WINDOW = '[role="dialog"], [role="alertdialog"]';

/**
 * Offer the tutorial to a maker who has not seen it: once `ready` resolves (the editor's code has arrived) and the page has
 * settled, it opens. Returns the stop function, for a visit that leaves first.
 */
export function offerTutorial(makerId: string | null | undefined, ready: Promise<unknown>): () => void {
  if (!shouldOfferTutorial({ seen: hasSeenTutorial(makerId), automated: isAutomated() })) return () => undefined;
  let stopped = false;
  let timer: number | undefined;
  void ready
    .then(() => {
      if (stopped) return;
      timer = window.setTimeout(() => {
        if (stopped || document.querySelector(OTHER_WINDOW)) return;
        openTutorial();
      }, TUTORIAL_SETTLE_MS);
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
