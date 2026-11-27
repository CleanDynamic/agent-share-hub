// 29e: a focused field stays visible above the on-screen keyboard on a phone, and the page moves once. On focus the field
// waits for the visual viewport to settle (its first `resize` after the focus, or KEYBOARD_WAIT_MS), then scrolls into view a
// single time, only if the keyboard now covers it (its bottom is within 24 of the visible bottom). `scroll-margin-bottom: 24px`
// on fields (index.css) is the 24. A field inside a sheet is left to the sheet, which rides above the keyboard itself.
// jsdom and desktop have no keyboard: nothing runs.

import { PHONE_STANDARD } from "./motion";

const FIELD = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="color"], [type="hidden"], [type="button"], [type="submit"]), textarea, select, [contenteditable="true"]';
/** The longest the keyboard is waited for before the field is checked anyway. */
export const KEYBOARD_WAIT_MS = PHONE_STANDARD + 120;
export const FIELD_CLEARANCE = 24;

/** Pure: whether a field whose box ends at `bottom` is hidden by, or too near, a visible area ending at `visibleBottom`. */
export function needsScroll(bottom: number, visibleBottom: number, clearance = FIELD_CLEARANCE): boolean {
  return bottom > visibleBottom - clearance;
}

const isPhone = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;

let installed = false;

export function installPhoneKeyboard(): () => void {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (installed || !vv) return () => {};
  installed = true;
  let timer = 0;
  let cancel: (() => void) | null = null;

  const check = (field: HTMLElement) => {
    if (document.activeElement !== field) return;
    const visibleBottom = vv.offsetTop + vv.height;
    if (needsScroll(field.getBoundingClientRect().bottom, visibleBottom)) field.scrollIntoView({ block: "center", behavior: "auto" });
  };

  const onFocusIn = (event: FocusEvent) => {
    if (!isPhone()) return;
    const field = event.target instanceof HTMLElement && event.target.matches(FIELD) ? event.target : null;
    if (!field || field.closest('[role="dialog"], [role="alertdialog"]')) return;
    cancel?.();
    const run = () => {
      cancel?.();
      check(field);
    };
    vv.addEventListener("resize", run, { once: true });
    timer = window.setTimeout(run, KEYBOARD_WAIT_MS);
    cancel = () => {
      vv.removeEventListener("resize", run);
      window.clearTimeout(timer);
      cancel = null;
    };
  };

  document.addEventListener("focusin", onFocusIn);
  return () => {
    installed = false;
    cancel?.();
    document.removeEventListener("focusin", onFocusIn);
  };
}
