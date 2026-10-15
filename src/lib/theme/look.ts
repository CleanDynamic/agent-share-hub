/* UI-P78 — the look switch.

   REFINED_LOOK_ENABLED switches the whole site to the refined look (UI-P79 to
   UI-P97 build it, beside the current one). It is on since UI-P98; rollback is
   `false`. With it off the current screens run exactly as before.

   On `/dev/*` the URL decides instead, so every refined board can be checked
   while the switch is off: `?look=refined` or `?look=current`. Anywhere else
   the switch decides and the URL is ignored, so a visitor cannot opt in.

   `useLook()` is read by the theme provider, which mirrors it onto
   `<html data-look="refined">` (absent for the current look). Nothing else
   reads it before the forks in UI-P80 onwards.

   ROLLBACK is to set the value back to `false`. Nothing the current look uses
   is removed until UI-P99. */

import { useContext } from "react";
import { UNSAFE_LocationContext } from "react-router-dom";

export const REFINED_LOOK_ENABLED = true as const;

export type Look = "current" | "refined";

const isDevRoute = (pathname: string): boolean => pathname === "/dev" || pathname.startsWith("/dev/");

/** The look for a location. Pure, so the rule is tested without a router. */
export function resolveLook(pathname: string, search: string, enabled: boolean = REFINED_LOOK_ENABLED): Look {
  if (isDevRoute(pathname)) {
    const asked = new URLSearchParams(search).get("look");
    if (asked === "refined" || asked === "current") return asked;
  }
  return enabled ? "refined" : "current";
}

/** The look in force. Outside a router (a bare test render) there is no URL to read, so the switch decides. */
export function useLook(): Look {
  const location = useContext(UNSAFE_LocationContext)?.location;
  return resolveLook(location?.pathname ?? "", location?.search ?? "");
}
