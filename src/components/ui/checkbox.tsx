import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { CHECKBOX_CLASS, checkboxStyle, CONTROL_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the checkbox.

   `--r-chip` — 8px — ON A 15px BOX, WHICH MAKES IT A CIRCLE. The spec assigns
   `--r-chip` to checkboxes and that is what is applied, but the box is 15px
   and a radius of half the side or more fully rounds it. The practical consequence is
   that a checkbox here is the same SHAPE as a radio, and only the tick tells
   them apart.

   THAT IS A REAL AFFORDANCE DEFECT AND IS REPORTED AS ONE. Round means pick
   one and square means pick any — one of the oldest conventions in the
   interface, and the same convention radio-group.tsx relies on. It is not
   fixed here: the box's size belongs to the density pass, which made it
   smaller, and a smaller radius is a seventh step in a scale whose value is
   that it has six. On a chip, 24px tall and what
   `--r-chip` was sized for, the same token is 33% of the height and reads as
   the soft corner it was meant to be. The fix is a bigger box, and it belongs
   to the prompt that owns sizing.

   UI-P53, THE DENSITY PASS, SET ITS SIZE: 15px (`CONTROL_CLASS.checkbox`),
   the checkbox the pass names, 18 → 15; this box was 16. The tick went from
   16px to 12px so it sits inside the 13px the border leaves. The 1px border is
   untouched. The tick is `--on-action` on the `--action` fill, which is the
   same measured pair the primary button uses.
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
          "peer shrink-0 border border-solid focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          CONTROL_CLASS.checkbox,
          CHECKBOX_CLASS,
          className,
        )}
        style={{ ...checkboxStyle(state), ...style }}
        {...props}
        {...handlers}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          <Check className="h-3 w-3" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
