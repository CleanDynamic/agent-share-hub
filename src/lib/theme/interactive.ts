// buildgallery.ai — hover, keyboard focus and press, tracked in React.
//
// BG-P07. `controls.ts` says what a control looks like in each state; this says
// which state it is in.
//
// WHY THIS IS A HOOK AND NOT A STYLESHEET. `:hover` and `:focus-visible` are
// exactly the two things an inline style cannot express, and this project
// styles inline because Tailwind's generated utilities beat hand-written
// classes at build time (`neoscale-ui` RULE 1). Adding a `.bg-button:hover`
// rule to `index.css` would be a class that silently loses. So the pseudo-class
// is resolved in JavaScript and spent inline, which is the same shape BG-P02's
// ThemeToggle already used for its focus ring — this generalises it rather than
// inventing a second mechanism.
//
// WHY `:focus-visible` AND NOT `:focus`. A mouse click on a button should not
// leave a ring behind; a Tab onto it must. The browser already knows the
// difference and will tell us, so `onFocus` asks the element whether it
// currently matches `:focus-visible` rather than guessing from the event.
// Where the pseudo-class is unsupported the ring is SHOWN rather than hidden —
// a ring nobody needed is a cosmetic flaw, a missing one is a keyboard trap.
//
// COST. One `useState` per control and a re-render on enter, leave, focus, blur
// and press — for the single control being interacted with, never for its
// neighbours. A feed of a hundred buttons re-renders one of them on hover.

import { useCallback, useMemo, useState } from "react";
import type { FocusEvent, MouseEvent, PointerEvent } from "react";

import { hoverIsFine, type ControlState } from "./controls";

/** The handlers this hook owns. Every one composes with an incoming handler. */
export interface InteractiveHandlers<E extends HTMLElement> {
  onMouseEnter: (event: MouseEvent<E>) => void;
  onMouseLeave: (event: MouseEvent<E>) => void;
  onFocus: (event: FocusEvent<E>) => void;
  onBlur: (event: FocusEvent<E>) => void;
  onPointerDown: (event: PointerEvent<E>) => void;
  onPointerUp: (event: PointerEvent<E>) => void;
  onPointerCancel: (event: PointerEvent<E>) => void;
}

export interface UseInteractiveResult<E extends HTMLElement> {
  /** Feed this straight into a `controls.ts` builder. */
  readonly state: ControlState;
  /** Spread onto the element AFTER `{...props}`, never before. */
  readonly handlers: InteractiveHandlers<E>;
}

/**
 * Track hover, keyboard focus and press for one control.
 *
 * Pass the consumer's own handlers in and they are called first, unconditionally
 * — including when the control is disabled, because a disabled control that
 * swallowed a caller's `onBlur` would be a silent behaviour change and this is
 * a restyle. Only the visual state is suppressed while disabled.
 */
export function useInteractive<E extends HTMLElement = HTMLElement>(
  incoming: Partial<InteractiveHandlers<E>> = {},
  options: { disabled?: boolean } = {},
): UseInteractiveResult<E> {
  const { disabled } = options;
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  const {
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  } = incoming;

  const handleMouseEnter = useCallback(
    (event: MouseEvent<E>) => {
      onMouseEnter?.(event);
      /* Gated on a fine pointer: on a touch screen `:hover` sticks after a tap
         and leaves the control looking permanently lit. */
      if (hoverIsFine()) setHovered(true);
    },
    [onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent<E>) => {
      onMouseLeave?.(event);
      setHovered(false);
      /* A pointer that leaves mid-press will never deliver its pointerup here,
         so the press is released on the way out rather than left stuck on. */
      setPressed(false);
    },
    [onMouseLeave],
  );

  const handleFocus = useCallback(
    (event: FocusEvent<E>) => {
      onFocus?.(event);
      let visible = true;
      try {
        visible = event.currentTarget.matches(":focus-visible");
      } catch {
        /* :focus-visible unsupported. Show the ring rather than hide it. */
      }
      if (visible) setFocusVisible(true);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<E>) => {
      onBlur?.(event);
      setFocusVisible(false);
      setPressed(false);
    },
    [onBlur],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<E>) => {
      onPointerDown?.(event);
      setPressed(true);
    },
    [onPointerDown],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<E>) => {
      onPointerUp?.(event);
      setPressed(false);
    },
    [onPointerUp],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<E>) => {
      onPointerCancel?.(event);
      setPressed(false);
    },
    [onPointerCancel],
  );

  const handlers = useMemo<InteractiveHandlers<E>>(
    () => ({
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    }),
    [
      handleMouseEnter,
      handleMouseLeave,
      handleFocus,
      handleBlur,
      handlePointerDown,
      handlePointerUp,
      handlePointerCancel,
    ],
  );

  const state = useMemo<ControlState>(
    () =>
      disabled
        ? { disabled: true }
        : { hovered, focusVisible, pressed, disabled: false },
    [disabled, hovered, focusVisible, pressed],
  );

  return { state, handlers };
}
