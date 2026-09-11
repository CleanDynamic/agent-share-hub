import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { switchThumbStyle, switchTrackStyle, SWITCH_THUMB_CLASS, SWITCH_TRACK_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the switch.

   THE TRACK IS `--r-control`, WHICH AT THIS SIZE IS STILL A CAPSULE. The spec
   asks for `--r-control` here and describes it as "not a pill". Both cannot be
   true of a 24px-tall track: `h-6` is 24px, `--r-control` is 12px, and a radius
   of exactly half an element's height is a capsule. The token is honoured and
   the description is not, because the two ways to honour the description are
   changing the height — structural, and the one thing this restyle may never
   do — or adding a seventh radius to a six-step scale.

   This is stated plainly rather than dressed up: the switch renders rounder
   than the spec intended, the cause is the control's size rather than the
   token, and the fix belongs to whichever prompt owns control sizing. Every
   control 36px or taller puts `--r-control` at 27-33% of its height, which is
   the soft rectangle the scale was designed for.

   THE THUMB IS CIRCULAR ON PURPOSE, because a thumb is a circle — that one is
   `--r-full` by the scale's own rule rather than by accident.

   `h-6 w-11` and `h-5 w-5` are untouched, so the control occupies the same box
   it always did and the thumb still travels the same 20px.
   ──────────────────────────────────────────────────────────────────────────── */

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(
  (
    {
      className,
      style,
      disabled,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    ref,
  ) => {
    const { state, handlers } = useInteractive<HTMLButtonElement>(
      { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
      { disabled },
    );

    return (
      <SwitchPrimitives.Root
        className={cn(
          /* `border-transparent` is dropped and `border-2` kept: the width is
             layout (see switchTrackStyle) and the colour is now the track's,
             set by SWITCH_TRACK_CLASS. Leaving both would put two classes on
             `border-color` and let Tailwind's own output order decide which
             wins, which is not a thing to leave to chance. */
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-2 border-solid transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          SWITCH_TRACK_CLASS,
          className,
        )}
        disabled={disabled}
        style={{ ...switchTrackStyle(state), ...style }}
        {...props}
        {...handlers}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block h-5 w-5 ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
            SWITCH_THUMB_CLASS,
          )}
          style={switchThumbStyle()}
        />
      </SwitchPrimitives.Root>
    );
  },
);
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
