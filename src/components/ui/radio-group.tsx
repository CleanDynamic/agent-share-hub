import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { radioStyle, RADIO_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the radio.

   THE ONE PLACE BESIDES THE SPINNER, THE AVATAR AND THE SWITCH THUMB WHERE
   `--r-full` IS CORRECT. The radius scale's rule is that 999px is for circular
   things, and a radio is a circular thing: roundness is what distinguishes
   single choice from the checkbox's multiple choice, and that convention is
   older and far better known than this theme. Squaring it to satisfy "nothing
   is a pill" would trade a real signal for a cosmetic consistency — the rule
   exists to stop CAPSULES, and a 16px circle is not one.

   `h-4 w-4` and the 1px border are untouched.
   ──────────────────────────────────────────────────────────────────────────── */

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
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
      <RadioGroupPrimitive.Item
        ref={ref}
        disabled={disabled}
        className={cn(
          "aspect-square h-4 w-4 border border-solid focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          RADIO_CLASS,
          className,
        )}
        style={{ ...radioStyle(state), ...style }}
        {...props}
        {...handlers}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-2.5 w-2.5 fill-current text-current" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
    );
  },
);
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
