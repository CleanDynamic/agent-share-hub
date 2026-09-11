import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { tooltipStyle } from "@/lib/theme/controls";

/* BG-P07 — the tooltip, and the one overlay in this kit that is OPAQUE.

   Every other overlay here portals into document.body, which is what makes a
   blur affordable on it: a portalled surface cannot nest inside another blurred
   surface. This codebase's TooltipContent does NOT portal — it renders inline,
   so it genuinely can land inside a glass card, and blurring it would be the
   nested-blur case the theme forbids.

   So it takes a solid --text ground with --bg ink: the page's own text and
   background colours swapped, which is the highest-contrast pairing the system
   has in both themes (13.10:1 Exhibition, 14.17:1 Dusk) and needs no separate
   measurement. That is also the right call for 12px type that has to be read in
   under a second. */

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden px-3 py-1.5 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    style={{ ...tooltipStyle, ...style }}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
