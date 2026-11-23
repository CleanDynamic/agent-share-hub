// The notepad's arrival (motion prompt 04), for the notepad window to call when it is built.
//
// IN: from the Expand button it was opened from. `transform-origin` is that button's centre relative to the notepad, then
// `scale(.96)` to 1 and opacity 0 to 1 over BASE on STANDARD. The modal under it dims (its own `::after` scrim) over BASE.
// OUT: opacity to 0 over FAST and the modal undims over FAST; focus goes back to the Expand button. Opacity and transform
// only; under reduced motion nothing animates and the end state is reached at once.

import { BASE, FAST, STANDARD, prefersReducedMotion } from "./motion";

/** Where a notepad's `transform-origin` sits so it grows from `button`: the button's centre, relative to the notepad. */
export function originFrom(button: DOMRect, notepad: DOMRect): string {
  const x = button.left + button.width / 2 - notepad.left;
  const y = button.top + button.height / 2 - notepad.top;
  return `${Math.round(x * 100) / 100}px ${Math.round(y * 100) / 100}px`;
}

const run = (el: HTMLElement, keyframes: Keyframe[], duration: number): Promise<void> => {
  if (prefersReducedMotion() || typeof el.animate !== "function") return Promise.resolve();
  return el.animate(keyframes, { duration, easing: STANDARD, fill: "both" }).finished.then(
    () => undefined,
    () => undefined,
  );
};

/** The notepad arrives from its Expand button. Resolves when it has arrived. */
export function notepadIn(notepad: HTMLElement, expand: HTMLElement): Promise<void> {
  notepad.style.transformOrigin = originFrom(expand.getBoundingClientRect(), notepad.getBoundingClientRect());
  return run(notepad, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "scale(1)" }], BASE);
}

/** The notepad leaves, the modal under it undims, and focus returns to the Expand button. */
export async function notepadOut(notepad: HTMLElement, expand: HTMLElement | null): Promise<void> {
  await run(notepad, [{ opacity: 1 }, { opacity: 0 }], FAST);
  expand?.focus();
}

/** The dim over the modal under the notepad: `--sheet-dim` on the modal's own `::after` (see `[data-notepad-dim]`). */
export const NOTEPAD_DIM_ATTRIBUTE = "data-notepad-dim";
