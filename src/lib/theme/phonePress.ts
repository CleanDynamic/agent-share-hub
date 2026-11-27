// 29e: the phone's press state, on pointerdown. One listener for the whole app instead of a state hook per control: the
// tappable under the finger gets `data-pressed` the moment it goes down (not on release), and index.css draws it: rows and
// buttons darken 6%, icon buttons shrink to 0.96. Release removes it and the stylesheet restores over PHONE_QUICK
// (`data-motion="press"` stays on for that long, so the no-motion rule leaves the transition alone).
// Under 768px only; nothing is added to a desktop element. A touch that turns into a scroll fires pointercancel, which
// releases the press, so scrolling a feed never leaves a row dark.

import { PHONE_QUICK } from "./motion";

const TAPPABLE = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], summary, label[for], [data-hit]';
const ICON = '[data-ui="icon-button"], [data-press="icon"]';

const isPhone = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
const disabled = (el: Element): boolean => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true";

/** A button that holds one bare icon is an icon button. */
function isIconButton(el: HTMLElement): boolean {
  if (el.matches(ICON)) return true;
  return el.tagName === "BUTTON" && !el.textContent?.trim() && el.querySelector("svg") !== null;
}

let pressed: HTMLElement | null = null;
let settle = 0;

function release(): void {
  const el = pressed;
  pressed = null;
  if (!el) return;
  el.removeAttribute("data-pressed");
  window.clearTimeout(settle);
  settle = window.setTimeout(() => {
    if (el.getAttribute("data-motion") === "press") el.removeAttribute("data-motion");
    el.removeAttribute("data-press");
  }, PHONE_QUICK + 40);
}

function onDown(event: PointerEvent): void {
  if (!isPhone()) return;
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TAPPABLE) : null;
  if (!target || disabled(target)) return;
  release();
  pressed = target;
  if (!target.hasAttribute("data-motion")) target.setAttribute("data-motion", "press");
  if (!target.hasAttribute("data-press") && isIconButton(target)) target.setAttribute("data-press", "icon");
  target.setAttribute("data-pressed", "");
}

let installed = false;

/** Call once at start. Returns the cleanup (tests). */
export function installPhonePress(): () => void {
  if (installed || typeof document === "undefined") return () => {};
  installed = true;
  document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  document.addEventListener("pointerup", release, { capture: true, passive: true });
  document.addEventListener("pointercancel", release, { capture: true, passive: true });
  document.addEventListener("dragstart", release, { capture: true, passive: true });
  return () => {
    installed = false;
    release();
    document.removeEventListener("pointerdown", onDown, { capture: true });
    document.removeEventListener("pointerup", release, { capture: true });
    document.removeEventListener("pointercancel", release, { capture: true });
    document.removeEventListener("dragstart", release, { capture: true });
  };
}
