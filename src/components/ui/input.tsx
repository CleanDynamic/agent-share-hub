import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the text field, on the token system.

   `--recess` ground, `--line` border, `--text` value, `--text2` placeholder,
   `--r-control` radius, and the shared focus ring. A field sits IN the page
   where a button sits ON it, and `--recess` is the token for exactly that.

   THE ERROR STATE IS DRIVEN BY `aria-invalid`, WHICH IS NOT A NEW PROP. It is
   already part of `React.ComponentProps<"input">`, so a consumer that sets it
   today for screen readers gets the breakage-red border for free, and no
   consumer has to change to opt in. The matching message is
   `fieldMessageStyle` in `controls.ts`, spent by whatever renders the message —
   this component has no slot for one and is not given one, because adding a
   wrapper element would change the layout of every form in the app.

   THE iOS 16px RULE IS INTACT. `index.css` forces `font-size: 16px` on every
   input below 768px, because anything smaller makes mobile Safari zoom the
   viewport on focus and never zoom back out. Nothing here sets a font size, and
   the `md:text-sm` class below — which only applies at 768px and up, where the
   rule hands control back — is left exactly as it was.

   WHY THE TAILWIND RING CLASSES ARE GONE FROM THIS STRING. Tailwind draws its
   ring as a box-shadow; the theme's ring is an outline. Both would show. The
   outline is the one that survives an `overflow: hidden` ancestor and cannot
   shift a layout, so it is the one that stays.

   THE PLACEHOLDER IS THE ONE COLOUR HERE THAT CANNOT BE INLINE. `::placeholder`
   is a pseudo-element, so no style object can reach it, and a hand-written rule
   in `index.css` would lose to Tailwind at build time. The remaining mechanism
   is a Tailwind utility that spends the token —
   `placeholder:text-[color:var(--text2)]` — which is a GENERATED utility rather
   than a new CSS class, so it is not the thing `neoscale-ui` RULE 1 forbids.
   The `color:` hint is load-bearing: without it Tailwind cannot tell a bare
   `var()` from a font size and drops the utility.
   ──────────────────────────────────────────────────────────────────────────── */

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (
    {
      className,
      type,
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
    const { state, handlers } = useInteractive<HTMLInputElement>(
      { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
      { disabled },
    );

    const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[color:var(--text2)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        disabled={disabled}
        style={{ ...fieldStyle({ ...state, invalid }), ...style }}
        {...props}
        {...handlers}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
