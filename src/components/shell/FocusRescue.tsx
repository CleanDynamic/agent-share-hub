// G17: after something is removed, focus goes somewhere sensible, never to the body.
//
// One watcher, mounted once by the site frame. While focus moves it remembers where it is: each list round the focused
// control (a ul, ol, tbody, list, listbox, grid or [data-focus-list]), which item holds the control and which of the item's
// controls it is, the boxes round it, the headings before it, and whether it is in a dialog. When the focused element leaves the document and focus
// has fallen to the body (a draft deleted, a chip removed, a row revoked, a dialog closed with no trigger to go back to), focus
// goes to the same control of the item now in that place (the next one), else of the previous item, else to the first control
// of the nearest box that survived (what replaced it: a Confirm, the button back after Cancel), else to the heading before it.
// A dialog with nothing left to go to hands focus to the page's h1. Anything that places focus itself (Radix returning focus
// to a trigger, ScrollKeeper after a page change) is left alone: the watcher acts only when focus is on the body.

import { useEffect } from "react";

const LIST = 'ul, ol, tbody, [role="list"], [role="listbox"], [role="grid"], [data-focus-list]';
/** How far up from the focused control a surviving container is looked in (never past a list, main or the body). */
const NEAR = 5;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const DIALOG = '[role="dialog"], [role="alertdialog"]';

interface Level {
  list: Element;
  index: number;
  control: number;
}

interface Place {
  el: HTMLElement;
  levels: Level[];
  /** The boxes round the control, nearest first, up to the first list: what replaced it may be in one (Confirm, Cancel). */
  near: Element[];
  heading: HTMLElement | null;
  /** Other headings before it, nearest first, for when the nearest goes with the removal. */
  headings: string[];
  /** The heading's level and words, to find it again when its section is drawn anew (a list reloading after a removal). */
  headingKey: string | null;
  inDialog: boolean;
}

/** How long a removal keeps looking for a place for focus while its region redraws (a reload after the write). */
export const RESCUE_WAIT_MS = 3000;

const keyOf = (heading: HTMLElement | null): string | null => (heading ? `${heading.tagName}:${(heading.textContent ?? "").trim()}` : null);

/** The controls in `root` a person could be on: not hidden, not inside something hidden. */
const focusables = (root: Element): HTMLElement[] =>
  [...(root.matches(FOCUSABLE) ? [root as HTMLElement] : []), ...Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))].filter(
    (el) => !el.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none",
  );

/** The h1 to h3 before `el` in the document (in main when there is one), nearest first. */
function headingsBefore(el: Element): HTMLElement[] {
  const scope = el.closest("main") ?? document;
  const found: HTMLElement[] = [];
  for (const heading of Array.from(scope.querySelectorAll<HTMLElement>("h1, h2, h3"))) {
    if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found.unshift(heading);
    else break;
  }
  return found;
}

function placeOf(el: HTMLElement): Place {
  const levels: Level[] = [];
  let child: Element = el;
  for (let parent = el.parentElement; parent; child = parent, parent = parent.parentElement) {
    if (!parent.matches(LIST)) continue;
    const item = child;
    levels.push({ list: parent, index: Array.prototype.indexOf.call(parent.children, item), control: Math.max(0, focusables(item).indexOf(el)) });
  }
  const near: Element[] = [];
  for (let box = el.parentElement, step = 0; box && step < NEAR && !box.matches(LIST) && box.tagName !== "MAIN" && box !== document.body; box = box.parentElement, step++) near.push(box);
  const inDialog = Boolean(el.closest(DIALOG));
  const before = inDialog ? [] : headingsBefore(el);
  const heading = before[0] ?? null;
  return { el, levels, near, heading, headingKey: keyOf(heading), headings: before.slice(1, 4).map((h) => keyOf(h) as string), inDialog };
}

function take(el: HTMLElement): void {
  if (!el.matches(FOCUSABLE) && !el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.style.outline = "none";
  }
  el.focus({ preventScroll: false });
}

/** Where focus goes once `place.el` has gone; null when nothing sensible is left (a page change: ScrollKeeper's). */
export function rescueTarget(place: Place): HTMLElement | null {
  for (const level of place.levels) {
    if (!level.list.isConnected) continue;
    const items = Array.from(level.list.children);
    for (const at of [level.index, level.index - 1]) {
      const item = items[at];
      if (!item) continue;
      const controls = focusables(item);
      const target = controls[level.control] ?? controls[0];
      if (target) return target;
    }
  }
  for (const box of place.near) {
    if (!box.isConnected) continue;
    const first = focusables(box)[0];
    if (first) return first;
  }
  if (place.heading?.isConnected) return place.heading;
  const shown = Array.from(document.querySelectorAll<HTMLElement>("main h1, main h2, main h3"));
  for (const key of [place.headingKey, ...place.headings]) {
    const again = key ? shown.find((heading) => keyOf(heading) === key) : undefined;
    if (again) return again;
  }
  if (place.inDialog) return document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("h1");
  return null;
}

export function FocusRescue() {
  useEffect(() => {
    let place: Place | null = null;
    /** Set when the focused element has gone and no place was found yet: the region may be drawing anew. */
    let until = 0;
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target !== document.body) {
        place = placeOf(event.target);
        until = 0;
      }
    };
    const check = () => {
      if (!place || place.el.isConnected) return;
      const now = document.activeElement;
      if (now && now !== document.body) {
        place = null;
        return;
      }
      if (!until) until = Date.now() + RESCUE_WAIT_MS;
      if (Date.now() > until) {
        place = null;
        return;
      }
      const target = rescueTarget(place);
      if (!target) return;
      place = null;
      take(target);
    };
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocus, true);
    return () => {
      watch.disconnect();
      document.removeEventListener("focusin", onFocus, true);
    };
  }, []);
  return null;
}

export default FocusRescue;
