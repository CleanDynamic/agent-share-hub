import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { FOCUS_RING_CLASS, tabsListStyle, tabTriggerStyle, TAB_TRIGGER_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — tabs.

   THE ACTIVE TAB IS MARKED BY AN `--action` UNDERLINE, NOT BY A FILLED PILL.
   A tab row is a set of labels with one of them current; filling the current
   one makes it read as a button while its neighbours read as text, which is
   the wrong relationship between them. The underline says "you are here"
   without changing what kind of object the tab is.

   THE UNDERLINE IS AN INSET BOX-SHADOW AND NOT A BORDER. A border would add 2px
   to whichever trigger is active and shift every tab in the row each time the
   selection moved — a layout change produced by a visual decision, which is
   exactly what this restyle is not allowed to do. An inset shadow occupies no
   space.

   The list keeps its `--recess` ground at `--r-control`, so the row reads as
   one grouped object cut into the page rather than as loose text.
   ──────────────────────────────────────────────────────────────────────────── */

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, style, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex h-10 items-center justify-center p-1", className)}
    style={{ ...tabsListStyle, ...style }}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
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
      <TabsPrimitive.Trigger
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          TAB_TRIGGER_CLASS,
          className,
        )}
        style={{ ...tabTriggerStyle(state), ...style }}
        {...props}
        {...handlers}
      />
    );
  },
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  /* Radix gives the panel tabIndex=0, so it is a real tab stop and must show a
     ring. It has no hover state of its own, so it takes the class form rather
     than growing a useState and re-rendering its whole subtree to draw one. */
  <TabsPrimitive.Content ref={ref} className={cn("mt-2", FOCUS_RING_CLASS, className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
