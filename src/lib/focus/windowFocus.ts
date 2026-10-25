// CA-26 P2: a window's focus, in one place.
//
// - It opens on its first field, or its primary action when it has no field.
// - It closes onto the element that opened it. A window opened from a menu was opened by the menu's button, not by the
//   menu item the press landed on, which is gone by then. When that element is gone too (a tile that was removed), focus goes
//   to the item now standing in its place in the build, and failing that to the build list.
// - Focus a caller or an action moved on its own while the window closed is left where it is.

import { useCallback, useEffect, useRef } from "react";

import { buildPanel, itemAt, placeOf, type Place } from "./buildItems";

/** Menus and popovers close themselves; what had focus inside one is not an opener. */
const TRANSIENT = '[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-radix-menu-content]';

let lastFocused: HTMLElement | null = null;
let installed = false;

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "focusin",
    (event) => {
      const el = event.target;
      if (el instanceof HTMLElement && el !== document.body && !el.closest(TRANSIENT)) lastFocused = el;
    },
    true,
  );
}
install();

export interface Opener {
  el: HTMLElement | null;
  place: Place | null;
}

/** The button whose menu or popover is open now: a pointer press on a menu button does not focus it, so focus alone cannot say. */
const openTrigger = (inside: Element | null): HTMLElement | null => {
  const id = inside?.closest<HTMLElement>(TRANSIENT)?.id;
  const byId = id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(id)}"]`) : null;
  if (byId) return byId;
  const open = [...document.querySelectorAll<HTMLElement>('[aria-haspopup][aria-expanded="true"]')];
  return open.at(-1) ?? null;
};

export const captureOpener = (): Opener => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const within = active && active !== document.body && active.closest(TRANSIENT) ? active : null;
  const el = active && active !== document.body && !within ? active : (openTrigger(within) ?? (lastFocused && lastFocused.isConnected ? lastFocused : null));
  return { el, place: placeOf(el) };
};

const usable = (el: HTMLElement | null): el is HTMLElement => Boolean(el && el.isConnected && !el.closest("[hidden]") && el.style.visibility !== "hidden");

/** Give focus back: the opener if it is there, else the build item standing in its place, else the build list. */
export function returnFocus(opener: Opener, leaving?: Element | null): void {
  const active = document.activeElement;
  // Someone already moved it on purpose (an action's target, a field the page opened): not ours to take.
  if (active && active !== document.body && !active.closest('[role="dialog"], [role="alertdialog"]') && !leaving?.contains(active)) return;
  const target = usable(opener.el) ? opener.el : (itemAt(opener.place) ?? buildPanel());
  target?.focus();
}

/** The first field of a window, or its primary action, or nothing (the browser's own first stop then stands). */
export function firstFocus(content: HTMLElement): HTMLElement | null {
  const field = [...content.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"]')].find(
    (el) => !el.hasAttribute("disabled") && !el.closest("[hidden]") && el.getAttribute("tabindex") !== "-1",
  );
  if (field) return field;
  const primary = content.querySelector<HTMLElement>('[data-variant="primary"]:not([disabled])') ?? content.querySelector<HTMLElement>('button[type="submit"]:not([disabled])');
  if (primary) return primary;
  // No field and no primary action (a menu-like list, a question with two plain answers): the first control that is not Close.
  return [...content.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')].find((el) => el.getAttribute("aria-label") !== "Close") ?? null;
}

export interface WindowFocus {
  onOpenAutoFocus: (event: Event) => void;
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * `useWindowFocus(open)`: the two handlers a Radix dialog takes. `onClose` runs first and may keep the event (preventDefault)
 * when a window means to leave focus somewhere of its own.
 */
export function useWindowFocus(open: boolean, onClose?: (event: Event) => void, onOpen?: (event: Event) => void): WindowFocus {
  const opener = useRef<Opener>({ el: null, place: null });
  const was = useRef(false);
  if (open && !was.current) opener.current = captureOpener();
  was.current = open;
  const latest = useRef({ onClose, onOpen });
  latest.current = { onClose, onOpen };

  const onOpenAutoFocus = useCallback((event: Event) => {
    latest.current.onOpen?.(event);
    if (event.defaultPrevented) return;
    const content = event.currentTarget instanceof HTMLElement ? event.currentTarget : event.target instanceof HTMLElement ? event.target : null;
    const first = content ? firstFocus(content) : null;
    if (!first) return;
    event.preventDefault();
    first.focus();
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    latest.current.onClose?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    returnFocus(opener.current);
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
}

/**
 * A menu's handler for `onCloseAutoFocus`. The menu gives focus back to its button on its own; this only answers for a button
 * that is gone by then (a menu whose item removed the thing the button belongs to): focus goes to the item now in its place in
 * the build, or the build list. `onClose` runs first and may keep the event.
 */
export function useMenuFocus(onClose?: (event: Event) => void): (event: Event) => void {
  const opener = useRef<Opener | null>(null);
  if (opener.current === null) opener.current = captureOpener();
  useEffect(() => {
    // The menu is open now, and its button says so (a pointer press does not focus it, so the capture above may have missed it).
    const trigger = openTrigger(null);
    if (trigger) opener.current = { el: trigger, place: placeOf(trigger) };
  }, []);
  const latest = useRef(onClose);
  latest.current = onClose;
  return useCallback((event: Event) => {
    latest.current?.(event);
    const held = opener.current as Opener;
    if (event.defaultPrevented || usable(held.el)) return;
    event.preventDefault();
    returnFocus(held);
  }, []);
}
