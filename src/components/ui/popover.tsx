import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";
import { menuPanelStyle } from "@/lib/theme/controls";

/* BG-P07 — the popover. `elevation.raised` on a glass panel at --r-panel.

   THE PANEL IS GLASS AND WHATEVER IS PUT INSIDE IT IS NOT. PopoverPrimitive.Portal
   renders this into document.body, so it is a sibling of the app root and can
   never come to rest inside another blurred surface — which is the only reason
   a blur is affordable here and not on a control. Anything rendered as a child
   of this panel must stay opaque: a blurred surface inside a blurred surface is
   two stacked compositing layers, each re-reading the pixels beneath it every
   frame, and that nesting is what made the previous shell slow. */

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 border p-4 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      style={{ ...menuPanelStyle, ...style }}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
