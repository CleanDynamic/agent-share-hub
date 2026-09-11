import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonSlot, buttonStyle, type ButtonVariant } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the button, on the token system.

   FOUR TREATMENTS, SIX NAMES, NO CONSUMER CHANGES. The theme has a primary, a
   secondary and a tertiary action plus a destructive one; shadcn ships six
   variant names. They are mapped rather than renamed, so every `variant=`
   already written in this codebase keeps compiling and keeps meaning what it
   meant:

     default     → primary,   --action fill / --on-action label
     destructive → primary,   --cat-breakage fill / --on-action label
     secondary   → secondary, --glass fill + --line border
     outline     → secondary, --glass-2 fill + --line border
     ghost       → tertiary,  --text2, no fill until hover
     link        → tertiary,  --action text

   The mapping itself lives in `src/lib/theme/controls.ts`; this file only spends
   it.

   WHY THE CVA STILL CARRIES ITS OLD COLOUR CLASSES. `buttonVariants` is also
   imported by `alert-dialog.tsx`, `pagination.tsx` and `calendar.tsx`, which use
   it as a bare className generator on elements that are NOT this component —
   calendar's day cells are produced by react-day-picker and can never take an
   inline style. Stripping the colours here would leave those three rendering
   unpainted, so the class strings are left exactly as they were and the token
   paint is applied inline, where it outranks them. Those three surfaces keep
   their existing shadcn appearance until the prompt that owns each one repaints
   it; nothing regresses.

   THE ONE CLASS THAT HAD TO BE OVERRIDDEN is the focus ring. Tailwind draws
   `focus-visible:ring-2` as a box-shadow, which an outline cannot replace, so
   the two rings would stack. `boxShadow: "none"` inline removes it for this
   component only — and no Button in this codebase carries a `shadow-*` class,
   so that costs nothing. The three files above keep their ring.

   SIZES ARE NOT TOUCHED. `h-9`/`h-10`/`h-11` and every padding stay in the cva
   where they are. Nothing in this file sets a height, a padding or a display.
   ──────────────────────────────────────────────────────────────────────────── */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
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
    const Comp = asChild ? Slot : "button";
    const resolved = (variant ?? "default") as ButtonVariant;

    const { state, handlers } = useInteractive<HTMLButtonElement>(
      { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
      { disabled },
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        /* `neoscale-ui` RULE 3 reserves primary button SURFACES as externally
           supplied. The slot marks where that component is dropped in, and the
           token paint below is the DEFAULT underneath it: `style` is spread
           with our object first, so a visual component — or any consumer —
           overrides it rather than fighting it. A `data-visual-slot` passed by
           a consumer also wins, because `props` is spread after this. */
        data-visual-slot={buttonSlot(resolved)}
        style={{ ...buttonStyle(resolved, state), boxShadow: "none", ...style }}
        {...props}
        {...handlers}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
