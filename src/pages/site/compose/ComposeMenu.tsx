/* CA-10 (CA-09 F1): every menu in the composer opens through these, so it keeps clear of the header and, on a phone,
   of the dock and the action bar (`useMenuCollisionPadding`). With `menuSurface`'s max height, a menu taller than
   the room it has scrolls inside itself; no row is ever off the screen. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { useMenuFocus } from "@/lib/focus/windowFocus";

import { useMenuCollisionPadding } from "./composeChrome";

export const MenuContent = forwardRef<ElementRef<typeof Menu.Content>, ComponentPropsWithoutRef<typeof Menu.Content>>(function MenuContent({ onCloseAutoFocus, ...props }, ref) {
  const collisionPadding = useMenuCollisionPadding();
  /* CA-26 P2: a menu whose item removed its own button leaves focus nowhere; it goes to the item now in that place instead. */
  const closing = useMenuFocus(onCloseAutoFocus);
  return <Menu.Content ref={ref} collisionPadding={collisionPadding} onCloseAutoFocus={closing} {...props} />;
});

export const MenuSubContent = forwardRef<ElementRef<typeof Menu.SubContent>, ComponentPropsWithoutRef<typeof Menu.SubContent>>(function MenuSubContent(props, ref) {
  const collisionPadding = useMenuCollisionPadding();
  return <Menu.SubContent ref={ref} collisionPadding={collisionPadding} {...props} />;
});
