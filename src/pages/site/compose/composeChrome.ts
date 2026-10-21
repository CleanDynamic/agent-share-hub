/* CA-10 — what the composer's menus and scrolls must keep clear of (CA-09 F1, F12).

   THE BARS. Every viewport has the 48 header at the top (`HEADER_HEIGHT`). A phone also has the dock at the bottom
   (`DOCK_HEIGHT`) and, above it, the composer's sticky Card / Preview / Publish bar: 8 of padding round a 48 button
   and a 1px border, so 66 tall, its foot `ACTION_BAR_LIFT` above the dock's top. So on a phone the bottom
   `PHONE_BARS_BOTTOM` px of the screen (plus the safe-area inset) are covered.

   A MENU'S COLLISION PADDING (`useMenuCollisionPadding`) keeps every composer menu out from under those bars; with
   `menuSurface`'s max height (Radix's available height) a long menu scrolls inside itself instead of running off
   the screen.

   THE SCROLL PADDING (`useComposerScrollPadding`) is the same room for the page's own scroller: a focused field or a
   newly added tile scrolled into view lands above the bars, never under them. */

import { useEffect } from "react";

import { DOCK_HEIGHT, HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { useIsPhone } from "@/components/shell/useMinWidth";

/** The sticky action bar on a phone: 8 + 48 + 8 and a 1px border above and below. */
export const ACTION_BAR_HEIGHT = 66;
/** The gap between the dock's top and the action bar's foot. */
export const ACTION_BAR_LIFT = 35;
/** The action bar's `bottom`, without the safe-area inset (92). */
export const ACTION_BAR_BOTTOM = DOCK_HEIGHT + ACTION_BAR_LIFT;
/** What covers the foot of a phone's screen in the composer: the dock, the gap and the action bar (158). */
export const PHONE_BARS_BOTTOM = ACTION_BAR_BOTTOM + ACTION_BAR_HEIGHT;
/** Air between a menu or a scrolled-to thing and a bar. */
export const BAR_AIR = 8;

export interface CollisionPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A composer menu's collision padding, for the viewport it is on. */
export function menuCollisionPadding(phone: boolean): CollisionPadding {
  return { top: HEADER_HEIGHT + BAR_AIR, right: BAR_AIR, bottom: (phone ? PHONE_BARS_BOTTOM : 0) + BAR_AIR, left: BAR_AIR };
}

export function useMenuCollisionPadding(): CollisionPadding {
  return menuCollisionPadding(useIsPhone());
}

/** The page scroller's padding while the composer is open, as CSS lengths. */
export function composerScrollPadding(phone: boolean): { top: string; bottom: string } {
  return {
    top: `${HEADER_HEIGHT + BAR_AIR}px`,
    bottom: phone ? `calc(${PHONE_BARS_BOTTOM + BAR_AIR}px + env(safe-area-inset-bottom))` : `${BAR_AIR}px`,
  };
}

/** Sets the document scroller's scroll padding while mounted, and puts back what was there. */
export function useComposerScrollPadding(phone: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    const before = { top: root.style.scrollPaddingTop, bottom: root.style.scrollPaddingBottom };
    const padding = composerScrollPadding(phone);
    root.style.scrollPaddingTop = padding.top;
    root.style.scrollPaddingBottom = padding.bottom;
    return () => {
      root.style.scrollPaddingTop = before.top;
      root.style.scrollPaddingBottom = before.bottom;
    };
  }, [phone]);
}
