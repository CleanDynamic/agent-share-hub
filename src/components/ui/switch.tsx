import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";
import { switchThumbStyle, switchTrackStyle, SWITCH_THUMB_CLASS, SWITCH_TRACK_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the switch.

   THE TRACK IS `--r-control` — 12px — AND NOT A PILL. This is a deliberate
   departure and is worth stating where someone will read it, because a
   rounded-rectangle switch is unusual enough to look like a bug rather than a
   decision. Every platform draws this control as a capsule. The buildgallery
   radius scale removed the capsule rule on purpose: `--r-full` is for circular
   things only — spinners and avatars — so a 999px track here would be the one
   pill left in the system, and a lone survivor of a retired rule is worse than
   a switch that looks slightly unfamiliar.

   THE THUMB STAYS CIRCULAR, because the thumb is a circle. `--r-full` is
   correct there for exactly the reason it is wrong on the track.

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
