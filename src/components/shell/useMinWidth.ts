/* UI-P16 — viewport-width queries as booleans, read synchronously.

   WHY NOT `useIsMobile`. That hook starts `false` and corrects itself in an
   effect, so a phone's first render is the desktop one; wide content then makes
   mobile browsers widen the layout viewport, `innerWidth` stays ≥768 and the
   hook never flips back. These read `matchMedia` on the first client render, so
   the frame picks the right chrome before anything can overflow. Server and
   jsdom (no matchMedia) read as wide. */

import { useSyncExternalStore } from "react";

function useMedia(query: string, fallback: boolean): boolean {
  const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  const read = () =>
    typeof window === "undefined" || typeof window.matchMedia !== "function" ? fallback : window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, read, () => fallback);
}

export function useMinWidth(px: number): boolean {
  return useMedia(`(min-width: ${px}px)`, true);
}

/** True when the primary pointer is a mouse or trackpad: where dragging a row makes sense. */
export function useFinePointer(): boolean {
  return useMedia("(hover: hover) and (pointer: fine)", true);
}

/** True below the app's 768px breakpoint. */
export function useIsPhone(): boolean {
  return useMedia("(max-width: 767px)", false);
}

/** G22: a window under 480 CSS pixels tall (a 1280 by 800 window at 200% and up): pinned chrome there would cover the page,
    so the header, the dock and the composer's action bar scroll with it. */
export const SHORT_WINDOW = 480;
export function useShortWindow(): boolean {
  return useMedia(`(max-height: ${SHORT_WINDOW - 1}px)`, false);
}

/* UI-P39 — the widths between the boards. The kit draws 1440 and 390; between
   768 and 1279 a page reads one of these tiers and changes nothing else.
   `full` is 1280 up (the board's composition), `split` is 1024 to 1279 (both
   tracks kept, the side track narrowing), `stacked` is 768 to 1023 (one track,
   desktop chrome). Below 768 the page is the phone view. */

export const BETWEEN = { stack: 1024, full: 1280 } as const;

export type WidthTier = "full" | "split" | "stacked";

export function useWidthTier(): WidthTier {
  const full = useMinWidth(BETWEEN.full);
  const split = useMinWidth(BETWEEN.stack);
  return full ? "full" : split ? "split" : "stacked";
}

/** The narrowest a two-track row's side track goes before the row stacks. */
export const SIDE_TRACK_MIN = 340;

/**
 * A two-track row's side track: its board width from a 1280 viewport up (the
 * 1232px column), narrowing with the column below that to 340, never wider than
 * the board draws it. A track drawn narrower than 340 keeps its width.
 */
export function sideTrack(px: number): string {
  if (px <= SIDE_TRACK_MIN) return `${px}px`;
  const share = ((px / (BETWEEN.full - 48)) * 100).toFixed(3);
  return `clamp(${SIDE_TRACK_MIN}px, ${share}%, ${px}px)`;
}

/** The board is drawn at 1280 and up only: narrower, a page in `board` fit lays out in `content` fit. */
export function useTierFit<F extends string>(fit: F | undefined): F | "content" | undefined {
  return useWidthTier() === "full" ? fit : "content";
}

/* Prompt 24: whether a hardware keyboard is about, for the phone's Keyboard shortcuts item: a fine pointer, or a key pressed
   with a modifier (Cmd, Ctrl, Alt) since the page loaded. */
let keyboardSeen = false;
const keyboardListeners = new Set<() => void>();
function onModifierKey(event: KeyboardEvent) {
  if (keyboardSeen || !(event.metaKey || event.ctrlKey || event.altKey)) return;
  keyboardSeen = true;
  keyboardListeners.forEach((notify) => notify());
}
function subscribeKeyboard(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  if (keyboardListeners.size === 0) window.addEventListener("keydown", onModifierKey, true);
  keyboardListeners.add(onChange);
  return () => {
    keyboardListeners.delete(onChange);
    if (keyboardListeners.size === 0) window.removeEventListener("keydown", onModifierKey, true);
  };
}

export function useHardwareKeyboard(): boolean {
  const fine = useMedia("(pointer: fine)", true);
  const seen = useSyncExternalStore(subscribeKeyboard, () => keyboardSeen, () => false);
  return fine || seen;
}
