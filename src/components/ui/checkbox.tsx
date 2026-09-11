import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { checkboxStyle, CHECKBOX_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the checkbox.

   `--r-chip` — 8px, the scale's smallest step. A checkbox is the same size and
   the same kind of object as a chip, so it takes the same corner; at 16px
   square, 8px is soft without rounding away the square-ness that tells a reader
   this is a multiple-choice control rather than a radio.

   `h-4 w-4` and the 1px border are untouched. The tick is `--on-action` on the
   `--action` fill, which is the same measured pair the primary button uses.
   ──────────────────────────────────────────────────────────────────────────── */

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
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
      <CheckboxPrimitive.Root
        ref={ref}
        disabled={disabled}
        className={cn(
          "peer h-4 w-4 shrink-0 border border-solid focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          CHECKBOX_CLASS,
          className,
        )}
        style={{ ...checkboxStyle(state), ...style }}
        {...props}
        {...handlers}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
